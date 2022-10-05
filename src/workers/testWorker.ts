import { TestJobData, TestJobName, TestJobResponse } from './types'
import { Job } from 'bullmq'

export default async function (
  job: Job<TestJobData, TestJobResponse, TestJobName>,
) {
  const t0 = Date.now()
  console.log(`[JOB] started at ${t0}`)
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(true)
    }, 5000 + 5000 * Math.random())
  })
  if (Math.random() < 0.2) {
    throw new Error('something bad happened')
  }
  const t = Date.now() - t0
  const message = `Painted ${job.data.count} buckets of ${job.data.color} in ${t}ms`
  return { message }
}
