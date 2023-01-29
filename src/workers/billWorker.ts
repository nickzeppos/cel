import { fetchCongressAPI } from './congressAPI'
import { BillJobData, BillJobName, BillJobResponse } from './types'
import { Job } from 'bullmq'
import { appendFileSync, writeFileSync } from 'fs'

async function f(
  path: string | null,
  congress: number,
  type: string,
  number: number,
) {
  const t0 = Date.now()
  const p = path === null ? '' : `/${path}`
  const res = await fetchCongressAPI(
    `/bill/${congress}/${type}/${number}${p}`,
    {
      format: 'json',
    },
  )
  const t1 = Date.now()
  const data = await res.json()

  try {
    writeFileSync(
      `./data/${congress}-${type}-${number}-${path}.json`,
      JSON.stringify(data, null, 2),
      'utf8',
    )
  } catch (e) {
    console.log(`error writing ${congress} ${type} ${number} ${path}`)
  }
  appendFileSync(
    './data/congressAPI.csv',
    `${number},${path},${t0},${t1},${res.status},${res.headers.get(
      'x-ratelimit-remaining',
    )},${res.headers.get('Retry-After')}\n`,
  )
}

export default async function (
  job: Job<BillJobData, BillJobResponse, BillJobName>,
): Promise<BillJobResponse> {
  const t0 = Date.now()
  // console.log(`[JOB] started at ${t0}`)
  const { congress, billNum, billType } = job.data

  Promise.all([
    f(null, congress, billType, billNum),
    f('actions', congress, billType, billNum),
    f('committees', congress, billType, billNum),
  ])

  // const route = `/bill/${congress}/${billType}/${billNum}`
  // const res = await fetchCongressAPI(route, { format: 'json' })
  // const json = await res.json()

  // const { bill } = billResponseValidator.parse(json)
  // const actionsRes = await fetchCongressAPI(`${route}/actions`, {
  //   format: 'json',
  // })

  // const actionsJson = await actionsRes.json()
  // const { actions } = billActionsResponseValidator.parse(actionsJson)

  // const committeesRes = await fetchCongressAPI(`${route}/committees`, {
  //   format: 'json',
  // })

  // const committeesJson = await committeesRes.json()
  // const { committees } = billCommitteesResponseValidator.parse(committeesJson)

  return { message: '' }
}
