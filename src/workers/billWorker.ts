import { fetchCongressAPI } from './congressAPI'
import { BillJobData, BillJobName, BillJobResponse } from './types'
import { Job } from 'bullmq'
import { appendFileSync, writeFileSync } from 'fs'

export default async function (
  job: Job<BillJobData, BillJobResponse, BillJobName>,
): Promise<BillJobResponse> {
  const { congress, billNum, billType, page } = job.data

  const t0 = Date.now()
  const p = page === '' ? '' : `/${page}`
  const res = await fetchCongressAPI(
    `/bill/${congress}/${billType}/${billNum}${p}`,
    {
      format: 'json',
    },
  )
  if (res.status === 429) {
  }
  const t1 = Date.now()
  const data = await res.json()

  try {
    writeFileSync(
      `./data/${congress}-${billType}-${billNum}-${page}.json`,
      JSON.stringify(data, null, 2),
      'utf8',
    )
  } catch (e) {
    console.log(`error writing ${congress} ${billType} ${billNum} ${page}`)
  }
  appendFileSync(
    './data/congressAPI.csv',
    `${billNum},${page},${t0},${t1},${res.status},${res.headers.get(
      'x-ratelimit-remaining',
    )},${res.headers.get('Retry-After')}\n`,
  )

  return { message: '' }
}
