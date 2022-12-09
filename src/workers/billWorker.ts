import { fetchCongressAPI } from './congressAPI'
import { BillJobData, BillJobName, BillJobResponse } from './types'
import { Job } from 'bullmq'

export default async function (
  job: Job<BillJobData, BillJobResponse, BillJobName>,
) {
  const t0 = Date.now()
  console.log(`[JOB] started at ${t0}`)
  const { congress, billNum, billType } = job.data
  const route = `/bill/${congress}/${billType}/${billNum}`
  const res = await fetchCongressAPI(route, { format: 'json' })
  const json = await res.json()
  console.log(json)
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(true)
    }, 5000 + 5000 * Math.random())
  })
  if (Math.random() < 0.2) {
    throw new Error('something bad happened')
  }
  const t = Date.now() - t0
  const message = `Pondered bill ${job.data.billNum} in the ${job.data.congress} ${job.data.billType} for ${t}ms`
  return { message }
}
