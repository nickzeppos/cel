import { Job } from 'bullmq'

export default async function (job: Job) {
  console.log(`[JOB] ${job.id} ${job.data}`)

  job.updateProgress(1)
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(true)
    }, 5000 + 5000 * Math.random())
  })
  job.updateProgress(2)

  const x = Math.random() * 100
  console.log(`[JOB] ${job.id} ${x}`)
  return x
}
