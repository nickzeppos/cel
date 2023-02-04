import { AssetJobData, AssetJobName, AssetJobResponse } from './types'
import * as bullmq from 'bullmq'

export default async function (
  job: bullmq.Job<AssetJobData, AssetJobResponse, AssetJobName>,
): Promise<AssetJobResponse> {
  console.log('this is the worker for step regex asset', job.data.chamber)

  return {
    message: 'done',
  }
}
