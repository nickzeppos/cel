import { prisma } from '../server/db/client'
import { fetchCongressAPI } from './congressAPI'
import {
  BillJobData,
  BillJobName,
  BillJobResponse,
  CommitteeActivies,
  NumericStep,
} from './types'
import {
  computeImportance,
  computeStepData,
  getBillCommitteeData,
  getCommitteeFilters,
  getRegexesForStep,
} from './utils'
import {
  billActionsResponseValidator,
  billCommitteesResponseValidator,
  billResponseValidator,
} from './validators'
import { Committee, CommitteeAction, Issue, Step } from '@prisma/client'
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

  let issueRecord: Issue | undefined
  if (bill.policyArea) {
    issueRecord = await prisma.issue.create({
      data: {
        name: bill.policyArea.name,
        source: 'LEP',
      },
    })
  }

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

  const numericStepToPrismaStep: { [key: number]: string } = {
    [NumericStep.BILL]: 'BILL',
    [NumericStep.AIC]: 'AIC',
    [NumericStep.ABC]: 'ABC',
    [NumericStep.PASS]: 'PASS',
    [NumericStep.LAW]: 'LAW',
  }
  const terminalStepAsPrismaEum = numericStepToPrismaStep[
    terminalStep
  ] as any as Step

  const billRecord = await prisma.bill.update({
    where: {
      chambressId_billNum: {
        billNum: billNum,
        chambressId: chambressId.id,
      },
    },
    data: {
      billNum: billNum,
      title: bill.title,
      actions: actions.map((a) => a.text),
      hasAIC: hasAIC,
      importance: importance,
      terminalStep: terminalStepAsPrismaEum,
      chambress: {
        connect: { id: chambressId.id },
      },
      sponsor: {
        connect: { bioguideId: sponsorId.bioguideId },
      },
      issues: issueRecord ? { connect: { id: issueRecord.id } } : undefined,
    },
  })

  const committeeFilters = await getCommitteeFilters(chamberShortNameLowercase)
  const AICRegexList = await getRegexesForStep(
    chamberShortNameLowercase,
    NumericStep.AIC,
  )

  const filteredCommittees = committees
    .filter(
      (committee) =>
        committee.chamber.toLowerCase() === chamberShortNameLowercase,
    ) // filter on chamber
    .filter((committee) => !!committee.activities)
    .filter((committee) =>
      committee.activities.filter((activity) =>
        committeeFilters.includes(activity.name),
      ),
    ) // filter activities on committeeActivitiesFilter

  //  for each unique committee in the rows filtered from the committee page
  for (const committee of filteredCommittees) {
    //  create a committee doc
    const committeeRecord = await prisma.committee.create({
      data: {
        name: committee.name,
      },
    })
    // committeeRecords.push(committeeRecord)

    // get the committee specific activities
    const committeeActivities = committee.activities.map((a) => a.name)

    // get the ingredients for this committee
    const billCommitteeData = getBillCommitteeData(
      chamberShortNameLowercase,
      committee.name,
      committeeActivities,
      actions.map((a) => a.text),
      hasAIC,
      AICRegexList,
    )

    await prisma.committeeAction.create({
      data: {
        hasAic: billCommitteeData.hasAIC,
        reportedFrom: billCommitteeData.reportedFrom,
        committee: {
          connect: { id: committeeRecord.id },
        },
        bill: {
          connect: { id: billRecord.id },
        },
      },
    })
  }

  const t = Date.now() - t0
  const message = `Received ${congress}-${billType}-${billNum}. Created billRecord ${
    billRecord.id
  } in ${t / 1000}s`
  return { message }
}
