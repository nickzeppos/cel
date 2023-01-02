import { prisma } from '../server/db/client'
import { fetchCongressAPI } from './congressAPI'
import { BillJobData, BillJobName, BillJobResponse } from './types'
import {
  billActionsResponseValidator,
  billResponseValidator,
} from './validators'
import { Job } from 'bullmq'

export default async function (
  job: Job<BillJobData, BillJobResponse, BillJobName>,
): Promise<BillJobResponse> {
  const t0 = Date.now()
  console.log(`[JOB] started at ${t0}`)
  const { congress, billNum, billType } = job.data
  const route = `/bill/${congress}/${billType}/${billNum}`
  const res = await fetchCongressAPI(route, { format: 'json' })
  const json = await res.json()

  const { bill } = billResponseValidator.parse(json)
  console.log('bill arrived')
  const actionsRes = await fetchCongressAPI(`${route}/actions`, {
    format: json,
  })

  const actionsJson = await actionsRes.json()
  const { actions } = billActionsResponseValidator.parse(actionsJson)

  const chambressId = await prisma.chambress.findUniqueOrThrow({
    where: {
      congress_chamber: {
        congress: congress,
        chamber: billType === 'hr' ? 'HOUSE' : 'SENATE',
      },
    },
    select: {
      id: true,
    },
  })

  const sponsorId = await prisma.member.findUniqueOrThrow({
    where: {
      bioguideId: bill.sponsors[0].bioguideId,
    },
    select: { bioguideId: true },
  })

  const billRecord = await prisma.bill.create({
    data: {
      billNum: billNum,
      title: bill.title,
      chambressId: chambressId.id,
      sponsorId: sponsorId.bioguideId,
      actions: actions.map((a) => a.text),
    },
  })

  const t = Date.now() - t0
  const message = `Received ${congress}-${billType}-${billNum}. Created billRecord ${
    billRecord.id
  } in ${t / 1000}s`
  return { message }
}
