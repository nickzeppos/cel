import {
  AssetJobData,
  AssetJobName,
  AssetJobResponse,
  getStepRegexPath,
} from './types'
import * as bullmq from 'bullmq'
import { pipe } from 'fp-ts/lib/function'
import { existsSync, readFileSync } from 'fs'

export default async function (
  job: bullmq.Job<AssetJobData, AssetJobResponse, AssetJobName>,
): Promise<AssetJobResponse> {
  console.log('this is the worker for step regex asset', job.data.chamber)
  const { chamber } = job.data
  const STEPS = ['ABC', 'AIC', 'LAW', 'PASS'] as const

  const isPolicySatisfied = pipe(
    STEPS.map((step) => getStepRegexPath(chamber, step)),
    (paths) => paths.map((path) => existsSync(path)),
    (pathsExist) => pathsExist.every((value) => value),
  )
  if (!isPolicySatisfied) {
    throw new Error('Step regex asset could not be materialized')
  }

  const materializedData = pipe(
    STEPS.map(
      (step) =>
        [
          step,
          pipe(
            getStepRegexPath(chamber, step),
            (path) => readFileSync(path, { encoding: 'utf8', flag: 'r' }),
            (rawFile) => rawFile.split('\n'),
          ),
        ] as const,
    ),
    (entries) => new Map(entries),
  )

  console.log('🚀', materializedData)
  return {
    message: 'done',
  }
}
