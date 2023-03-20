import {
  CongressAPIAssetJobData,
  CongressAPIAssetJobName,
  CongressAPIAssetJobResponse,
} from './types'
import { Job } from 'bullmq'

export default async function execute(
  job: Job<
    CongressAPIAssetJobData,
    CongressAPIAssetJobResponse,
    CongressAPIAssetJobName
  >,
): Promise<CongressAPIAssetJobResponse> {
  console.log('Running congress api asset worker')
  console.log(job.name)
  console.log(job.queueName)
  console.log(job.data)
  await new Promise((resolve) => setTimeout(resolve, 2000))
  return { message: '' }
}
