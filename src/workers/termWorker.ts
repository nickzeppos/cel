import { prisma } from '../server/db/client'
import { fetchCongressAPI } from './congressAPI'
import {
  PartyHistory,
  TermJobData,
  TermJobName,
  TermJobResponse,
  TermResponse,
} from './types'
import { ChamberToEnum } from './utils'
import { memberResponseValidator } from './validators'
import { Term } from '@prisma/client'
import { Job } from 'bullmq'

export default async function (
  job: Job<TermJobData, TermJobResponse, TermJobName>,
): Promise<TermJobResponse> {
  const t0 = Date.now()
  console.log(`[JOB] started at ${t0}`)
  const { bioguide } = job.data

  const route = `/member/${bioguide}`
  const res = await fetchCongressAPI(route, { format: 'json' })
  if (res.status === 429) {
    const retryHeader = res.headers.get('Retry-After')
    console.log(`!!! RATE LIMITED !!!`)
    console.log(retryHeader)
    console.log(res)
  }
  const json = await res.json()
  const { member } = memberResponseValidator.parse(json)
  const validTerms = member.terms.filter((term) => term.congress >= 93)
  const sortedPh = member.partyHistory.sort((a, b) =>
    a.startYear > b.startYear ? 1 : -1,
  )
  for (const vt of validTerms) {
    const chambressId = await prisma.chambress.findUniqueOrThrow({
      where: {
        congress_chamber: {
          congress: vt.congress,
          chamber: ChamberToEnum[vt.chamber],
        },
      },
      select: {
        id: true,
      },
    })
    let party: string
    if (sortedPh.length === 1) {
      party = sortedPh[0].partyName
    } else {
      party = sortedPh.reduce((acc, c) => {
        if (!acc) {
          if (!c.endYear || (vt.termEndYear && c.endYear >= vt.termEndYear)) {
            return c.partyName
          }
        }
        return acc
      }, '')
    }
    const createPayload = {
      chambressId: chambressId.id,
      memberId: bioguide,
      state: vt.stateCode,
      party,
      district: vt.district,
    }
    await prisma.term.upsert({
      create: createPayload,
      update: {},
      where: {
        chambressId_memberId: {
          chambressId: chambressId.id,
          memberId: bioguide,
        },
      },
    })
  }
  return {
    message: `Created ${validTerms.length} terms for ${member.firstName} ${member.lastName}`,
  }
}
