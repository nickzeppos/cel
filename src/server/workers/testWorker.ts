import { Job } from 'bullmq'

export interface TestJobData {
  color: string
  count: number
}
export interface TestJobResponse {
  message: string
}

export type TestJobName = 'test-job'

export type TestJob = Job<TestJobData, TestJobResponse, TestJobName>

export default async function (job: TestJob) {
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
