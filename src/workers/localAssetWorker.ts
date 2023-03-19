import {
  LocalAssetJobData,
  LocalAssetJobName,
  LocalAssetJobResponse,
} from './types'
import { Job } from 'bullmq'

export default async function execute(
  job: Job<LocalAssetJobData, LocalAssetJobResponse, LocalAssetJobName>,
): Promise<LocalAssetJobResponse> {
  console.log('Running local asset worker')
  console.log(job.name)
  console.log(job.queueName)
  console.log(job.data)
  return { message: '' }
}
