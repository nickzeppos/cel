import {
  BillCommitteeData,
  COMMITTEE_FILTERS_PATH,
  ChamberShortNameLowercase,
  FullChamberName,
  IMPORTANT_LIST_PATH,
  NumericStep,
  RANKING_PHRASES_PATH,
  RankingPhraseRow,
  RankingPhrases,
  STEP_REGEXES_PATH,
  StepRegexDictionary,
} from './types'
import { Chamber, Importance } from '.prisma/client'
import { parse } from 'csv-parse/sync'
import { readFile } from 'fs/promises'

// 4 groups of functions:
// (1) getters, functions which take args and retrieve resources
// (2) parsers, functions which take a resourced retrieved by a getter and parse it
// (3) calculators, functions which use resources to compute data
// (4) computers, functions which orchestrate or handle the whole pipeline
// pipe(get(args), parse(), calculate()) === compute(args), in my mind

// computers
export async function computeStepData(
  actions: string[],
  chamber: ChamberShortNameLowercase,
): Promise<{ terminalStep: NumericStep; hasAIC: boolean }> {
  const stepRegexes = await getStepRegexes(chamber)
  return calculateStepData(actions, stepRegexes)
}

export async function computeImportance(
  title: string,
  chamber: ChamberShortNameLowercase,
  congress: number,
  billNum: number,
): Promise<Importance> {
  const importantList = await getImportantList(chamber, congress)
  const { up, down } = await getRankingPhrases(chamber)
  return calculateImportance(title, billNum, importantList, up, down)
}

// calculators

export const getBillCommitteeData = (
  chamber: ChamberShortNameLowercase,
  committee: string,
  committeeActivities: string[],
  actions: string[],
  billHasAIC: boolean,
  AICRegexList: RegExp[],
): BillCommitteeData => {
  const hasAIC =
    billHasAIC && committeeDidAIC(chamber, committee, actions, AICRegexList)
  const reportedFrom = committeeReportedFrom(committeeActivities)
  return { hasAIC, reportedFrom }
}

export const committeeDidAIC = (
  chamber: ChamberShortNameLowercase,
  committee: string,
  actions: string[],
  AICRegexList: RegExp[],
): boolean => {
  const committeeActions = filterActionsByCommittee(committee, actions, chamber)
  let hasAIC = false
  for (let i = 0; i < committeeActions.length; i++) {
    const committeAction = committeeActions[i]
    for (let j = 0; j < AICRegexList.length; j++) {
      const regex = AICRegexList[j]
      if (committeAction.match(regex)) {
        hasAIC = true
        return hasAIC
      }
    }
  }
  return hasAIC
}

export const filterActionsByCommittee = (
  committee: string,
  actions: string[],
  chamber: ChamberShortNameLowercase,
): string[] => {
  return actions.filter((x) => x.includes(chamber))
}

export const committeeReportedFrom = (
  committeeActivities: string[],
): boolean => {
  const committeeReportedActivities = committeeActivities.map((s) =>
    /report/g.test(s.toLowerCase()),
  )
  return committeeReportedActivities.some((a) => a) ? true : false
}

function calculateStepData(
  actions: string[],
  stepRegexes: StepRegexDictionary,
): { terminalStep: NumericStep; hasAIC: boolean } {
  let terminalStep = NumericStep.BILL
  let hasAIC = false
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]
    for (let step = NumericStep.LAW; step > NumericStep.BILL; step--) {
      const regexes = stepRegexes.get(step)! // non-null assertion. Not required in old code, not sure why it wasn't?
      for (let j = 0; j < regexes.length; j++) {
        const regex = regexes[j]
        if (action.match(regex)) {
          terminalStep = Math.max(step, terminalStep)
          if (step === NumericStep.AIC && !hasAIC) hasAIC = true
        }
      }
    }
  }

  return { terminalStep, hasAIC }
}

function calculateImportance(
  title: string,
  billNum: number,
  importantlist: number[],
  up: string[],
  down: string[],
): Importance {
  const upLowerCase = up.map((phrase) => phrase.toLowerCase())
  const downLowerCase = down.map((phrase) => phrase.toLowerCase())
  const titleLowerCase = title.toLowerCase()

  const isImportant = importantlist.includes(billNum)
  const matchesTitle = (phrase: string) => titleLowerCase.match(phrase)
  const titleHasRankDownPhrase = downLowerCase.some(matchesTitle)
  const titleHasRankUpPhrase = upLowerCase.some(matchesTitle)

  if (isImportant && !titleHasRankDownPhrase)
    return Importance.SubstantiveAndSignificant
  if (!isImportant && titleHasRankDownPhrase && !titleHasRankUpPhrase)
    return Importance.Commemorative
  return Importance.Significant
}

// getters
export async function getImportantList(
  chamber: ChamberShortNameLowercase,
  congress: number,
): Promise<number[]> {
  const path = `${IMPORTANT_LIST_PATH}/${chamber}-${congress}.txt`
  const data = await readFile(path, 'utf-8')
  return parseImportantList(data)
}

export async function getRankingPhrases(
  chamber: ChamberShortNameLowercase,
): Promise<RankingPhrases> {
  const path = `${RANKING_PHRASES_PATH}/${chamber}.csv`
  const data = await readFile(path)
  const csv = parse(data, {
    columns: true,
    skip_empty_lines: true,
  }) as RankingPhraseRow[]
  return parseRankingPhraseRows(csv)
}

export async function getStepRegexes(
  chamber: ChamberShortNameLowercase,
): Promise<StepRegexDictionary> {
  const result = new Map<NumericStep, RegExp[]>()
  const getRegexes = async (step: NumericStep): Promise<void> => {
    result.set(step, await getRegexesForStep(chamber, step))
  }
  await Promise.all([
    getRegexes(NumericStep.AIC),
    getRegexes(NumericStep.ABC),
    getRegexes(NumericStep.PASS),
    getRegexes(NumericStep.LAW),
  ])
  return result
}

export async function getRegexesForStep(
  chamber: ChamberShortNameLowercase,
  step: NumericStep,
): Promise<RegExp[]> {
  const path = `${STEP_REGEXES_PATH}/${chamber}-${NumericStep[step]}.txt`
  const data = await readFile(path, 'utf-8')
  return parseStepRegexFile(data)
}

export async function getCommitteeFilters(
  chamber: ChamberShortNameLowercase,
): Promise<string[]> {
  const path = `${COMMITTEE_FILTERS_PATH}/${chamber}-committee-filters.txt`
  const data = await readFile(path, 'utf-8')
  return parseCommitteeFilterList(data)
}

// parsers
function parseImportantList(data: string): number[] {
  return data.split('\n').map((n) => Number.parseInt(n))
}

function parseCommitteeFilterList(data: string): string[] {
  return data.split('\n')
}

function parseRankingPhraseRows(data: RankingPhraseRow[]): RankingPhrases {
  return data.reduce(
    (acc, row) => {
      if (row.exception === '0') acc.down.push(row.phrase)
      else acc.up.push(row.phrase)

      return acc
    },
    { up: [], down: [] } as RankingPhrases,
  )
}

// trim specifically deals with a weird whitespace character that
// appears at the end of senate-AIC.txt:29
function parseStepRegexFile(data: string): RegExp[] {
  return data.split('\n').map((s) => new RegExp(s.trim().slice(1, -2), 'g'))
}

export const ChamberToEnum: Record<FullChamberName, Chamber> = {
  'House of Representatives': Chamber.HOUSE,
  Senate: Chamber.SENATE,
}

export function deriveThrottleTimeout(apiKeys: string[]) {
  return 5000 / apiKeys.length
}
