import {
  billJobDataValidator,
  billTypeValidator,
  committeeActivitiesValidator,
  shortChamberNameValidator,
} from './validators'
import { z } from 'zod'

export interface TestJobData {
  color: string
  count: number
}
export interface TestJobResponse {
  message: string
}
export type TestJobName = 'test-job'

export type BillType = z.infer<typeof billTypeValidator>

export type BillJobData = z.infer<typeof billJobDataValidator>

export type ChamberShortName = z.infer<typeof shortChamberNameValidator>

export type ChamberShortNameLowercase = Lowercase<ChamberShortName>

export type CommitteeActivies = z.infer<typeof committeeActivitiesValidator>

export interface BillJobResponse {
  message: string
}

export interface BillCommitteeData {
  hasAIC: boolean
  reportedFrom: boolean
}

export type BillJobName = 'bill-job'

const RESOURCE_ROOT = 'resources'
export const IMPORTANT_LIST_PATH = `${RESOURCE_ROOT}/important`
export const RANKING_PHRASES_PATH = `${RESOURCE_ROOT}/ranking`
export const COMMITTEE_FILTERS_PATH = `${RESOURCE_ROOT}/committee`
export const STEP_REGEXES_PATH = `${RESOURCE_ROOT}/step`

export enum NumericStep {
  BILL,
  AIC,
  ABC,
  PASS,
  LAW,
}

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
