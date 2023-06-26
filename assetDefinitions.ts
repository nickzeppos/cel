import { AnyAsset, Asset } from './src/assets/assets.types'
import { billsCountAsset } from './src/assets/billsCount.asset'
import { billsListAsset } from './src/assets/billsList.asset'
import {
  debug,
  error,
  isNotNull,
  writeFileSyncWithDir,
} from './src/assets/utils'
import {
  billAssetMetadataValidator,
  bioguidesAssetMetadataValidator,
} from './src/utils/validators'
import { throttledFetchCongressAPI } from './src/workers/congressAPI'
import { StoredBillAsset } from './src/workers/types'
import {
  AllMember,
  Bill,
  BillList,
  Member,
  allMemberResponseValidator,
  allMemberValidator,
  billActionsResponseValidator,
  billDetailResponseValidator,
  memberResponseValidator,
  memberValidator,
} from './src/workers/validators'
import { Chamber } from '.prisma/client'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { z } from 'zod'

// Policy constants
export const CONGRESS_API_PAGE_SIZE_LIMIT = 250
const ALWAYS_FETCH_POLICY = () => async () => false
const NEVER_FETCH_POLICY = () => async () => true
const ONE_DAY_REFRESH = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export const membersCountAsset: Asset<number, [], [], unknown> = {
  name: 'membersCount',
  queue: 'congress-api-asset-queue',
  deps: [],
  policy: () => async () => {
    // if meta or data file doesn't exist, policy fails
    if (
      !existsSync(`./data/${membersCountAsset.name}-meta.json`) ||
      !existsSync(`./data/${membersCountAsset.name}.json`)
    ) {
      return false
    }
    // else, policy passes
    return true
  },
  read: async () => {
    const countString = readFileSync(
      `./data/${membersCountAsset.name}.json`,
      'utf8',
    )
    const count = parseInt(countString)
    return z.number().parse(count)
  },
  create: () => () => async () => {
    const url = '/member'
    debug('membersCountAsset.create', `fetching ${url}`)
    const res = await throttledFetchCongressAPI(url, { limit: 1 })
    debug('membersCountAsset.create', `done fetching ${url}`)
    const json = await res.json()
    const allMemberResponse = allMemberResponseValidator.safeParse(json)
    if (!allMemberResponse.success) {
      throw new Error(
        `membersCountAsset.create: failed to parse response from ${url}`,
      )
    }
    const count = allMemberResponse.data.pagination.count
    const countString = count.toString()

    // write data file
    writeFileSyncWithDir(`./data/${membersCountAsset.name}.json`, countString)

    // write meta file
    writeFileSyncWithDir(
      `./data/${membersCountAsset.name}-meta.json`,
      new Date().toString(),
    )
  },
}

export const membersAsset: Asset<
  Array<AllMember>,
  [],
  [typeof membersCountAsset],
  unknown
> = {
  name: 'members',
  queue: 'congress-api-asset-queue',
  deps: [membersCountAsset],
  policy: () => async () => {
    // if meta or data file doesn't exist, policy fails
    if (
      !existsSync(`./data/${membersAsset.name}-meta.json`) ||
      !existsSync(`./data/${membersAsset.name}.json`)
    ) {
      return false
    }
    // else, policy passes
    return true
  },
  read: async () => {
    const members = readFileSync(`./data/${membersAsset.name}.json`, 'utf8')
    return z.array(allMemberValidator).parse(JSON.parse(members))
  },
  create: () => () => async (membersCount) => {
    let totalCount = 0
    let offset: string | number = 0
    // eslint-disable-next-line prefer-const
    let limit: string | number = 250
    let members: Array<AllMember> = []

    do {
      console.log(
        `Fetching members ${totalCount} - ${
          totalCount + limit > membersCount ? membersCount : totalCount + limit
        }`,
      )
      // fetch with throttled fetchCongressAPI
      const res = await throttledFetchCongressAPI('/member', {
        offset,
        limit,
      })
      const json = await res.json()

      const allMemberResponse = allMemberResponseValidator.safeParse(json)
      if (!allMemberResponse.success) {
        throw new Error(
          `membersAsset.create: failed to parse response from /member`,
        )
      }
      const newMembers = allMemberResponse.data.members
      const parsed = newMembers.map(({ member }) => {
        const allMember = allMemberValidator.safeParse(member)
        if (!allMember.success) {
          throw new Error(
            `membersAsset.create: failed to parse member ${member.bioguideId}`,
          )
        }
        return allMember.data
      })
      members = [...members, ...parsed]
      totalCount += parsed.length
      offset += limit
    } while (totalCount < membersCount)

    // write data file
    writeFileSyncWithDir(
      `./data/${membersAsset.name}.json`,
      JSON.stringify(members),
    )

    // write meta file
    writeFileSyncWithDir(
      `./data/${membersAsset.name}-meta.json`,
      new Date().toString(),
    )
  },
}
function bioguideFile(bioguideId: string): string {
  return `./data/bioguides/${bioguideId}.json`
}
function bioguideMetaFile(): string {
  return `./data/bioguides/meta.json`
}
export const bioguidesAsset: Asset<
  Array<Member>,
  [],
  [typeof membersAsset],
  unknown
> = {
  name: 'bioguides',
  queue: 'congress-api-asset-queue',
  deps: [membersAsset],
  policy: () => async (members: Array<AllMember>) => {
    const missingBioguides = members
      .map(({ bioguideId }) =>
        existsSync(bioguideFile(bioguideId)) ? null : bioguideId,
      )
      .filter(isNotNull)
    const metaFile = bioguideMetaFile()
    debug('bioguidesAsset.policy', `writing ${metaFile}`)
    writeFileSyncWithDir(
      metaFile,
      JSON.stringify({
        lastPolicyRunTime: new Date().getTime(),
        missingBioguides,
      }),
    )
    return missingBioguides.length === 0
  },
  read: async () => {
    const fileList = readdirSync(`./data/${bioguidesAsset.name}`)
    let bioguides: Array<Member> = []
    for (const file of fileList) {
      const fileContents = readFileSync(
        `./data/${bioguidesAsset.name}/${file}`,
        'utf8',
      )
      const json = JSON.parse(fileContents)
      bioguides = [...bioguides, memberValidator.parse(json)]
    }
    return bioguides
  },
  create:
    ({ emit }) =>
    () =>
    // TODO: Unused deps right now because of how we're using members in the policy now to determine missing data
    async (_members) => {
      const metaFile = bioguideMetaFile()
      const metaFileExists = existsSync(metaFile)
      if (!metaFileExists) {
        throw new Error(`expected meta file to exist: ${metaFile}`)
      }
      const metaFileRaw = readFileSync(metaFile, 'utf8')
      const metaFileJSON = JSON.parse(metaFileRaw)
      const metaFileParsed =
        bioguidesAssetMetadataValidator.safeParse(metaFileJSON)
      if (!metaFileParsed.success) {
        throw new Error(`failed to parse bioguides meta file`)
      }
      const { missingBioguides } = metaFileParsed.data
      let bioguides: Array<Member> = []

      for (const bioguide of missingBioguides) {
        debug('bioguidesAsset.create', `fetching ${bioguide}`)
        const res = await throttledFetchCongressAPI(`/member/${bioguide}`)
        debug('bioguidesAsset.create', `parsing ${bioguide}`)
        const { json } = await res.json()
        const bioguideMemberResponse = memberResponseValidator.safeParse(json)
        if (!bioguideMemberResponse.success) {
          throw new Error(`failed to parse response for ${bioguide}`)
        }
        const { member } = bioguideMemberResponse.data

        // write data file
        debug('bioguidesAsset.create', `writing ${bioguideFile(bioguide)}`)
        writeFileSyncWithDir(bioguideFile(bioguide), JSON.stringify(member))
      }
    },
}

function billMetaFile(chamber: Chamber, congress: number) {
  return `data/bills/${congress}-${chamber}-meta.json`
}
function billFile(
  chamber: Chamber,
  congress: number,
  billNumber: number | string,
) {
  return `data/bills/${congress}-${chamber}-${billNumber}.json`
}
export const billAsset: Asset<
  Bill[],
  [Chamber, number],
  [typeof billsListAsset],
  {
    areAllDepsComplete: boolean
    files: StoredBillAsset[]
  }
> = {
  name: 'actions',
  queue: 'congress-api-asset-queue',
  deps: [billsListAsset],
  policy: (chamber, congress) => async (billsList: Array<BillList>) => {
    const missingBillNumbers = billsList
      .map(({ number }) =>
        existsSync(billFile(chamber, congress, number)) ? null : number,
      )
      .filter(isNotNull)

    const metaFile = billMetaFile(chamber, congress)
    debug('billsAsset.policy', `writing ${metaFile}`)
    writeFileSyncWithDir(
      metaFile,
      JSON.stringify({
        lastPolicyRunTime: new Date().getTime(),
        missingBillNumbers,
      }),
    )
    return missingBillNumbers.length === 0
  },
  read: async () => {
    throw new Error('not implemented')
  },
  create:
    ({ emit }) =>
    (chamber, congress) =>
    async () => {
      // read the meta file
      const metaFile = billMetaFile(chamber, congress)
      const metaFileExists = existsSync(metaFile)
      if (!metaFileExists) {
        throw new Error(`expected meta file to exist: ${metaFile}`)
      }
      const metaFileRaw = readFileSync(metaFile, 'utf8')
      const metaFileJSON = JSON.parse(metaFileRaw)

      const metadata = billAssetMetadataValidator.safeParse(metaFileJSON)
      if (!metadata.success) {
        throw new Error(`failed to parse meta file: ${metaFile}`)
      }

      // for each missing bill number
      const { missingBillNumbers } = metadata.data
      const billType = chamber === 'HOUSE' ? 'hr' : 's'
      for (const billNumber of missingBillNumbers) {
        // fetch the detail page
        const detailRes = await throttledFetchCongressAPI(
          `/bill/${congress}/${billType}/${billNumber}`,
        )
        const billDetailResponse = billDetailResponseValidator.safeParse(
          await detailRes.json(),
        )
        if (!billDetailResponse.success) {
          error(
            'billAsset.create',
            `invalid bill detail response ${chamber} ${congress} ${billNumber}`,
          )
          continue
        }

        // fetch first actions page
        const actionsRes = await throttledFetchCongressAPI(
          `/bill/${congress}/${billType}/${billNumber}/actions?limit=${CONGRESS_API_PAGE_SIZE_LIMIT}`,
        )
        const billActionsResponse = billActionsResponseValidator.safeParse(
          await actionsRes.json(),
        )
        if (!billActionsResponse.success) {
          error(
            'billAsset.create',
            `invalid bill actions response ${chamber} ${congress} ${billNumber}`,
          )
          continue
        }
        const { data } = billActionsResponse
        if (data.pagination?.count ?? 0 > 250) {
          error(
            'billAsset.create',
            `there are more than 250 actions for ${chamber} ${congress} ${billNumber}`,
          )
        }

        // combine them all into one json
        const billData: Bill = {
          detail: billDetailResponse.data.bill,
          actions: data.actions,
        }
        // write that file
        writeFileSyncWithDir(
          billFile(chamber, congress, billNumber),
          JSON.stringify(billData),
        )
      }
    },
  readMetadata: async (chamber, congress) => {
    return {
      areAllDepsComplete: true,
      files: [],
    }
  },
}

export const reportAsset: Asset<
  string,
  [],
  [
    typeof bioguidesAsset,
    typeof membersAsset,
    typeof billsListAsset,
    typeof billAsset,
  ],
  unknown
> = {
  name: 'report',
  queue: 'local-asset-queue',
  deps: [bioguidesAsset, membersAsset, billsListAsset, billAsset],
  policy: ALWAYS_FETCH_POLICY,
  read: async () => '',
  create: () => () => async () => {},
}

export type AssetNameOf<T extends AnyAsset> = T['name']

const allAssets = {
  membersCount: membersCountAsset,
  members: membersAsset,
  bioguides: bioguidesAsset,
  billsCount: billsCountAsset,
  bill: billAsset,
  billsList: billsListAsset,
  report: reportAsset,
} as const

export type AssetName = keyof typeof allAssets

export function getAssetForName(name: AssetName): AnyAsset {
  const asset = allAssets[name]
  if (asset == null) {
    console.error(`No asset with name ${name}`)
  }
  return asset
}

export function getAssetNames(): AssetName[] {
  return Object.keys(allAssets) as AssetName[]
}

export function isAssetName(name: string): name is AssetName {
  return name in allAssets
}
