import { AssetName } from '../assets/assetDefinitions'
import {
  billJobDataValidator,
  billTypeLowercaseValidator,
  committeeActivitiesValidator,
  fullChamberNameValidator,
  partyHistoryValidator,
  shortChamberNameValidator,
  termJobDataValidator,
  termResponseValidator,
} from './validators'
import { Chamber, Step } from '.prisma/client'
import { z } from 'zod'

export interface TestJobData {
  color: string
  count: number
}
export interface TestJobResponse {
  message: string
}
export type TestJobName = 'test-job'

export type BillJobName = 'bill-job'
export type BillJobData = z.infer<typeof billJobDataValidator>
export interface BillJobResponse {
  message: string
}

export type TermJobName = 'term-job'
export type TermJobData = z.infer<typeof termJobDataValidator>
export interface TermJobResponse {
  message: string
}
export type ChamberShortName = z.infer<typeof shortChamberNameValidator>

export type BillType = z.infer<typeof billTypeLowercaseValidator>
export type ChamberShortNameLowercase = Lowercase<ChamberShortName>
export type CommitteeActivies = z.infer<typeof committeeActivitiesValidator>

export interface BillCommitteeData {
  hasAIC: boolean
  reportedFrom: boolean
}

const RESOURCE_ROOT = 'resources'
export const IMPORTANT_LIST_PATH = `${RESOURCE_ROOT}/important`
export const RANKING_PHRASES_PATH = `${RESOURCE_ROOT}/ranking`
export const COMMITTEE_FILTERS_PATH = `${RESOURCE_ROOT}/committee`
export const STEP_REGEXES_PATH = `${RESOURCE_ROOT}/step`
export const getStepRegexPath = (chamber: Chamber, step: Step): string =>
  `${STEP_REGEXES_PATH}/${chamber.toLocaleLowerCase()}-${step}.txt`

// need the ordering when calculating terminal step
export enum NumericStep {
  BILL,
  AIC,
  ABC,
  PASS,
  LAW,
}

export type FullChamberName = z.infer<typeof fullChamberNameValidator>

export type StepRegexDictionary = Map<NumericStep, RegExp[]>
export interface RankingPhraseRow {
  phrase: string
  exception: string
}

export interface RankingPhrases {
  up: string[]
  down: string[]
}

export interface BillResources {
  rankingPhrases: RankingPhrases
  importantList: number[]
  stepRegexes: StepRegexDictionary
  committeeFilters: string[]
}

export type TermResponse = z.infer<typeof termResponseValidator>
export type PartyHistory = z.infer<typeof partyHistoryValidator>

export interface AssetJobData {
  chamber: Chamber
}
// this needs to be redis-safe!
export interface AssetJobResponse {
  message: string
  // stepRegexes?: Map<Step, string[]>
  stepRegexes?: string //Map<Step, string[]>
}
export type AssetJobName = 'asset-job'

// infer type from materialize input validator, but remove assetName.
// result is object type with keys of the remaining properties
// index object type by keys with same omission
// create array type with values obtained by indexing
// export type CongressAPIAssetJobData = Omit<
//   z.infer<typeof materializeValidator>,
//   'assetName'
// >
export type CongressAPIAssetJobData = [
  Chamber | null | undefined,
  number | null | undefined,
  number | null | undefined,
  number | null | undefined,
]

export interface CongressAPIAssetJobResponse {
  message: string
  data: DataTypeOf<AnyAsset>
}

export type CongressAPIAssetJobName = Exclude<AssetName, LocalAssetJobName>
export interface LocalAssetJobData {
  chamber?: Chamber
  congress?: number
}
export interface LocalAssetJobResponse {
  message: string
}
export type LocalAssetJobName = 'report'
