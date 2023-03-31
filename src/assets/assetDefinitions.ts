import { fetchCongressAPI } from '../workers/congressAPI'
import {
  AllMember,
  Member,
  allBillResponseValidator,
  allMemberResponseValidator,
  allMemberValidator,
  memberResponseValidator,
  memberValidator,
} from '../workers/validators'
import { AnyAsset, Asset } from './assets.types'
import { servedIncludes1973 } from './utils'
import { Chamber } from '@prisma/client'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'fs'
import { z } from 'zod'

// Policy constants
const ALWAYS_FETCH_POLICY = async () => false
const NEVER_FETCH_POLICY = async () => true
const ONE_DAY_REFRESH = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// fs fcn
function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir)
  }
}
// throttler
async function throttle(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const membersCountAsset: Asset<number, [], []> = {
  name: 'membersCount',
  queue: 'congress-api-asset-queue',
  deps: [],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: async () => {
    // if meta file doesn't exist, policy fails
    !existsSync(`./data/${membersCountAsset.name}-meta.json`) ? false : null
    // if meta file exists, compare to current time
    const lastUpdated = readFileSync(
      `./data/${membersCountAsset.name}-meta.json`,
      'utf8',
    )
    const lastUpdatedDate = new Date(lastUpdated)
    const now = new Date()
    const diff = now.getTime() - lastUpdatedDate.getTime()
    // if diff is greater than refresh period, policy fails
    return diff > membersCountAsset.refreshPeriod
  },
  write: () => async (count) => {
    writeFileSync(`./data/${membersCountAsset.name}.json`, count.toString())
    writeFileSync(
      `./data/${membersCountAsset.name}-meta.json`,
      new Date().toString(),
    )
  },
  read: async () => {
    const countString = readFileSync(
      `./data/${membersCountAsset.name}.json`,
      'utf8',
    )
    const count = parseInt(countString)
    return z.number().parse(count)
  },
  create: () => async () => {
    const res = await fetchCongressAPI('/member', { limit: 1 })
    const json = await res.json()
    return allMemberResponseValidator.parse(json).pagination.count
  },
}

export const membersAsset: Asset<
  Array<AllMember>,
  [],
  [typeof membersCountAsset]
> = {
  name: 'members',
  queue: 'congress-api-asset-queue',
  deps: [membersCountAsset],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: async () => {
    !existsSync(`./data/${membersAsset.name}-meta.json`) ? false : null
    !existsSync(`./data/${membersAsset.name}.json`) ? false : null
    const lastUpdated = readFileSync(
      `./data/${membersAsset.name}-meta.json`,
      'utf8',
    )
    const lastUpdatedDate = new Date(lastUpdated)
    const now = new Date()
    const diff = now.getTime() - lastUpdatedDate.getTime()
    return diff > membersAsset.refreshPeriod
  },
  write: () => async (members) => {
    writeFileSync(`./data/${membersAsset.name}.json`, JSON.stringify(members))
    writeFileSync(
      `./data/${membersAsset.name}-meta.json`,
      new Date().toString(),
    )
  },
  read: async () => {
    const members = readFileSync(`./data/${membersAsset.name}.json`, 'utf8')
    return z.array(allMemberValidator).parse(JSON.parse(members))
  },
  create: () => async (membersCount) => {
    let totalCount = 0
    let offset: string | number = 0
    let limit: string | number = 250
    let members: Array<AllMember> = []

    do {
      console.log(
        `Fetching members ${totalCount} - ${
          totalCount + limit > membersCount ? membersCount : totalCount + limit
        }`,
      )
      const res = await fetchCongressAPI('/member', {
        offset,
        limit,
      })
      const json = await res.json()
      const { members: newMembers } = allMemberResponseValidator.parse(json)
      const parsed = newMembers.map((member) =>
        allMemberValidator.parse(member.member),
      )
      members = [...members, ...parsed]
      totalCount += members.length
      offset += limit

      // manually throttle API requests 1 per ~10s
      await throttle(10000)
    } while (totalCount < membersCount)
    return members
  },
}

export const bioguidesAsset: Asset<Array<Member>, [], [typeof membersAsset]> = {
  name: 'bioguides',
  queue: 'congress-api-asset-queue',
  deps: [membersAsset],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: async () => {
    if (!existsSync(`./data/${bioguidesAsset.name}`)) {
      return false
    }
    if (!existsSync(`./data/${bioguidesAsset.name}-meta.json`)) {
      return false
    }
    const lastUpdated = readFileSync(
      `./data/${bioguidesAsset.name}-meta.json`,
      'utf8',
    )
    const lastUpdatedDate = new Date(lastUpdated)
    const now = new Date()
    const diff = now.getTime() - lastUpdatedDate.getTime()
    return diff > bioguidesAsset.refreshPeriod
  },
  write: () => async (bioguides) => {
    ensureDir(`./data/${bioguidesAsset.name}`)
    for (const bioguide of bioguides) {
      writeFileSync(
        `./data/${bioguidesAsset.name}/${bioguide.identifiers.bioguideId}.json`,
        JSON.stringify(bioguide),
      )
    }
    writeFileSync(
      `./data/${bioguidesAsset.name}-meta.json`,
      new Date().toString(),
    )
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
  create: () => async (members) => {
    const slicedMembers = members.slice(0, 9) // just first 10 for testing

    let bioguides: Array<Member> = []

    for (const member of slicedMembers) {
      const { served, bioguideId } = member
      console.log(`starting ${bioguideId}`)
      if (!servedIncludes1973(served)) {
        console.log(
          `skipping ${bioguideId} because served does not include 1973`,
        )
        continue
      }

      console.log(`found ${bioguideId} served in relevant range, fetching`)
      const res = await fetchCongressAPI(`/member/${bioguideId}`)
      const json = await res.json()
      try {
        console.log(`trying to parse ${bioguideId}`)
        const { member } = memberResponseValidator.parse(json)
        bioguides = [...bioguides, memberValidator.parse(member)]
        console.log(`parsed ${bioguideId} successfully`)
      } catch (e) {
        console.log(e)
        break
      }
      console.log(`sleeping for 5s before next request`)
      await throttle(5000)
    }
    console.log('return bioguides')
    return bioguides
  },
}

export const billsCountAsset: Asset<number, [Chamber, number], []> = {
  name: 'billsCount',
  queue: 'congress-api-asset-queue',
  deps: [],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: async (args) => {
    const [chamber, congress] = args
    const fileName = `./data/${billsCountAsset.name}-${congress}-${chamber}`
    !existsSync(`${fileName}.json`) ? false : null
    !existsSync(`${fileName}-meta.json`) ? false : null
    const lastUpdated = readFileSync(`${fileName}-meta.json`, 'utf8')
    const lastUpdatedDate = new Date(lastUpdated)
    const now = new Date()
    const diff = now.getTime() - lastUpdatedDate.getTime()
    return diff > billsCountAsset.refreshPeriod
  },
  write: (args) => async (count) => {
    const [chamber, congress] = args
    const fileName = `./data/${billsCountAsset.name}-${congress}-${chamber}`
    writeFileSync(`${fileName}.json`, count.toString())
    writeFileSync(`${fileName}-meta.json`, new Date().toString())
  },
  read: async (args) => {
    const [chamber, congress] = args
    const fileName = `./data/${billsCountAsset.name}-${congress}-${chamber}`
    const countString = readFileSync(`${fileName}.json`, 'utf8')
    const count = parseInt(countString)
    return z.number().parse(count)
  },
  create: (args) => async () => {
    const [chamber, congress] = args
    const billType = chamber === 'HOUSE' ? 'hr' : 's'
    const res = await fetchCongressAPI(`/bill/${congress}/${billType}`, {
      limit: 1,
    })
    const json = await res.json()
    return allBillResponseValidator.parse(json).pagination.count
  },
}

export const actionsAsset: Asset<number, [], [typeof billsCountAsset]> = {
  name: 'actions',
  queue: 'congress-api-asset-queue',
  deps: [billsCountAsset],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: NEVER_FETCH_POLICY,
  write: () => async () => {
    return
  },
  read: async () => 0,
  create: () => async () => 0,
}

export const billsAsset: Asset<number, [], [typeof billsCountAsset]> = {
  name: 'bills',
  queue: 'congress-api-asset-queue',
  deps: [billsCountAsset],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: ALWAYS_FETCH_POLICY,
  write: () => async () => {
    return
  },
  read: async () => 0,
  create: () => async () => 0,
}

export const reportAsset: Asset<
  string,
  [],
  [
    typeof bioguidesAsset,
    typeof membersAsset,
    typeof billsAsset,
    typeof actionsAsset,
  ]
> = {
  name: 'report',
  queue: 'local-asset-queue',
  deps: [bioguidesAsset, membersAsset, billsAsset, actionsAsset],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: ALWAYS_FETCH_POLICY,
  write: () => async () => {
    return
  },
  read: async () => '',
  create: () => async () => '',
}

export type AssetNameOf<T extends AnyAsset> = T['name']

const allAssets = {
  membersCount: membersCountAsset,
  members: membersAsset,
  bioguides: bioguidesAsset,
  billsCount: billsCountAsset,
  actions: actionsAsset,
  bills: billsAsset,
  report: reportAsset,
} as const

export type AssetName = keyof typeof allAssets

export function getAssetForName(name: AssetName): AnyAsset {
  return allAssets[name]
}

export function getAssetNames(): AssetName[] {
  return Object.keys(allAssets) as AssetName[]
}

export function isAssetName(name: string): name is AssetName {
  return name in allAssets
}
