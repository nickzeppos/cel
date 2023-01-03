import { prisma } from '../server/db/client'
import { fetchCongressAPI } from './congressAPI'
import { BillJobData, BillJobName, BillJobResponse } from './types'
import { computeImportance, computeStepData } from './utils'
import {
  billActionsResponseValidator,
  billCommitteesResponseValidator,
  billResponseValidator,
} from './validators'
import { Step } from '@prisma/client'
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
  const actionsRes = await fetchCongressAPI(`${route}/actions`, {
    format: 'json',
  })

  const actionsJson = await actionsRes.json()
  const { actions } = billActionsResponseValidator.parse(actionsJson)

  const committeesRes = await fetchCongressAPI(`${route}/committees`, {
    format: 'json',
  })

  const committeesJson = await committeesRes.json()
  const { committees } = billCommitteesResponseValidator.parse(committeesJson)

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

  const chamberShortNameLowercase = billType === 'hr' ? 'house' : 'senate'

  const importance = await computeImportance(
    bill.title,
    chamberShortNameLowercase,
    congress,
    billNum,
  )
  const { terminalStep, hasAIC } = await computeStepData(
    actions.map((a) => a.text),
    chamberShortNameLowercase,
  )

  // I dont like this way of doing it, but I have to go from the numeric enum we use in our app to
  // the string enum prisma seems to use (seemingly exclusively and by default). We need numeric enum
  // for Step in our app because we rely on both it being a number, and on its underyling numeric
  // ordinality for comparisons when calculating terminalStep (i.e., numeric enum enables step > step,
  // step--, etc.). Alternative that comes to mind is a lookup table, but this is easier first pass.
  const terminalStepAsPrismaEum = terminalStep as any as Step

  const billRecord = await prisma.bill.create({
    data: {
      billNum: billNum,
      title: bill.title,
      chambressId: chambressId.id,
      sponsorId: sponsorId.bioguideId,
      actions: actions.map((a) => a.text),
      hasAIC: hasAIC,
      importance: importance,
      terminalStep: terminalStepAsPrismaEum,
    },
  })

  const t = Date.now() - t0
  const message = `Received ${congress}-${billType}-${billNum}. Created billRecord ${
    billRecord.id
  } in ${t / 1000}s`
  return { message }
}
