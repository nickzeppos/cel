import { Job } from 'bullmq'

export default async function (job: Job) {
  console.log(`[JOB] ${job.id} ${job.data}`)
  job.updateProgress(42)
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(true)
    }, 10000)
  })
  job.updateProgress(84)

  const x = Math.random() * 100
  console.log(`[JOB] ${job.id} ${x}`)
  return x
}
