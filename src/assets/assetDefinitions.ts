import {
  fetchCongressAPI,
  throttledFetchCongressAPI,
} from '../workers/congressAPI'
import {
  AllBill,
  AllMember,
  Member,
  allBillResponseValidator,
  allBillValidator,
  allMemberResponseValidator,
  allMemberValidator,
  memberResponseValidator,
  memberValidator,
} from '../workers/validators'
import { AnyAsset, Asset } from './assets.types'
import { Chamber } from '@prisma/client'
import { format, formatDistance } from 'date-fns'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'fs'
import { z } from 'zod'

// Policy constants
export const CONGRESS_API_PAGE_SIZE_LIMIT = 250
const ALWAYS_FETCH_POLICY = () => async () => false
const NEVER_FETCH_POLICY = () => async () => true
const ONE_DAY_REFRESH = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

function writeFileSyncWithDir(...args: Parameters<typeof writeFileSync>) {
  const filename = args[0]
  if (typeof filename !== 'string') {
    throw new Error('we only know how to use string filenames!')
  }
  const dir = filename.split('/').slice(0, -1).join('/')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return writeFileSync(...args)
}

// throttler
async function throttle(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const membersCountAsset: Asset<number, [], [], unknown> = {
  name: 'membersCount',
  queue: 'congress-api-asset-queue',
  deps: [],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: () => async () => {
    // if meta file doesn't exist, policy fails
    if (!existsSync(`./data/${membersCountAsset.name}-meta.json`)) {
      return false
    }
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
    writeFileSyncWithDir(
      `./data/${membersCountAsset.name}.json`,
      count.toString(),
    )
    writeFileSyncWithDir(
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
  [typeof membersCountAsset],
  unknown
> = {
  name: 'members',
  queue: 'congress-api-asset-queue',
  deps: [membersCountAsset],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: () => async () => {
    if (
      !existsSync(`./data/${membersAsset.name}-meta.json`) ||
      !existsSync(`./data/${membersAsset.name}.json`)
    ) {
      return false
    }
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
    writeFileSyncWithDir(
      `./data/${membersAsset.name}.json`,
      JSON.stringify(members),
    )
    writeFileSyncWithDir(
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
    // eslint-disable-next-line prefer-const
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
      totalCount += parsed.length
      offset += limit

      // manually throttle API requests 1 per ~10s
      await throttle(10000)
    } while (totalCount < membersCount)
    return members
  },
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
  refreshPeriod: ONE_DAY_REFRESH,
  policy: () => async () => {
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
    for (const bioguide of bioguides) {
      writeFileSyncWithDir(
        `./data/${bioguidesAsset.name}/${bioguide.identifiers.bioguideId}.json`,
        JSON.stringify(bioguide),
      )
    }
    writeFileSyncWithDir(
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
    const slicedMembers = members.slice(0, 99) // just first 100 for testing

    let bioguides: Array<Member> = []

    for (const member of slicedMembers) {
      const { bioguideId } = member
      // console.log(`starting ${bioguideId}`)
      // if (!servedIncludes1973(served)) {
      //   console.log(
      //     `skipping ${bioguideId} because served does not include 1973`,
      //   )
      //   continue
      // }

      // console.log(`found ${bioguideId} served in relevant range, fetching`)
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

export const billsCountAsset: Asset<number, [Chamber, number], [], number> = {
  name: 'billsCount',
  queue: 'congress-api-asset-queue',
  deps: [],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: (chamber, congress) => async () => {
    // file exists
    const fileName = `./data/${billsCountAsset.name}-${congress}-${chamber}`
    if (
      [`${fileName}.json`, `${fileName}-meta.json`]
        .map((f) => existsSync(f))
        .includes(false)
    ) {
      debug('billsCountAsset.policy', 'file not found')
      return false
    }

    // file is not stale
    const lastUpdated = readFileSync(`${fileName}-meta.json`, 'utf8')
    const lastUpdatedDate = new Date(lastUpdated)

    const diff = Date.now() - lastUpdatedDate.getTime()
    debug(
      'billsCountAsset.policy',
      `last updated ${format(
        lastUpdatedDate,
        'yyyy-MM-dd hh:mm a',
      )} (${formatDistance(lastUpdatedDate, Date.now(), {
        addSuffix: true,
      })}))`,
    )
    const isStale = diff > billsCountAsset.refreshPeriod
    debug('billsCountAsset.policy', `asset ${isStale ? 'is' : 'is not'} stale`)
    return !isStale
  },
  write: (chamber, congress) => async (count) => {
    const fileName = `./data/${billsCountAsset.name}-${congress}-${chamber}`
    writeFileSyncWithDir(`${fileName}.json`, count.toString())
    writeFileSyncWithDir(`${fileName}-meta.json`, new Date().toString())
    debug('billsCountAsset.write', `wrote "${count}" to ${fileName}`)
  },
  read: async (chamber, congress) => {
    const fileName = `./data/${billsCountAsset.name}-${congress}-${chamber}`
    const countString = readFileSync(`${fileName}.json`, 'utf8')
    const count = parseInt(countString)
    return z.number().parse(count)
  },
  create: (chamber, congress) => async () => {
    const billType = chamber === 'HOUSE' ? 'hr' : 's'
    const url = `/bill/${congress}/${billType}`
    debug('billsCountAsset.create', `fetching ${url}`)
    const res = await throttledFetchCongressAPI(url, { limit: 1 })
    debug('billsCountAsset.create', `done fetching ${url}`)
    const json = await res.json()
    return allBillResponseValidator.parse(json).pagination.count
  },
  readMetadata: (chamber, congress) => async () => {
    const fileName = `./data/${billsCountAsset.name}-${congress}-${chamber}`
    const countString = readFileSync(`${fileName}.json`, 'utf8')
    const count = parseInt(countString)
    return z.number().parse(count)
  },
}

export const actionsAsset: Asset<
  number,
  [],
  [typeof billsCountAsset],
  unknown
> = {
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

export const billsAsset: Asset<
  Array<AllBill>,
  [Chamber, number, number | null | undefined, number | null | undefined],
  [typeof billsCountAsset],
  {
    pageStatuses: { file: string; status: string }[]
    expectedPageFiles: string[]
  }
> = {
  name: 'bills',
  queue: 'congress-api-asset-queue',
  deps: [billsCountAsset],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: (chamber, congress) => async (billsCount) => {
    const fileName = `./data/${billsAsset.name}-${congress}-${chamber}`
    // if files don't exist, policy fails
    if (
      !existsSync(`${fileName}.json`) ||
      !existsSync(`${fileName}-meta.json`)
    ) {
      return false
    }

    // if file is stale, policy fails
    const lastUpdated = readFileSync(`${fileName}-meta.json`, 'utf8')
    const lastUpdatedDate = new Date(lastUpdated)
    const now = new Date()
    const diff = now.getTime() - lastUpdatedDate.getTime()
    const isStale = diff > billsAsset.refreshPeriod
    if (isStale) {
      return false
    }

    // if count in file is incomplete (!= billsCount), policy fails
    const dataStr = readFileSync(`${fileName}.json`, 'utf8')
    const data = JSON.parse(dataStr)
    const bills = z.array(allBillValidator).safeParse(data)
    if (!bills.success) {
      error('billsAsset.policy', `failed to parse ${fileName}.json`)
      return false
    }
    const isComplete = bills.data.length === billsCount
    if (!isComplete) {
      error(
        'billsAsset.policy',
        `${fileName}.json contains ${bills.data.length} bills, but billsCount is ${billsCount}}`,
      )
      return false
    }

    return true
  },
  write: (chamber, congress) => async (bills) => {
    const fileName = `./data/${billsAsset.name}/${congress}-${chamber}`

    // call writeFileSync with an option to create folders that don't exist
    writeFileSyncWithDir(`${fileName}.json`, JSON.stringify(bills))
    writeFileSyncWithDir(`${fileName}-meta.json`, new Date().toString())
  },
  read: async (chamber, congress) => {
    const fileName = `./data/bills/${congress}-${chamber}.json`
    console.log('read bills asset at ', fileName)
    const file = readFileSync(fileName, 'utf8')
    const bills = JSON.parse(file)
    return z.array(allBillValidator).parse(bills)
  },
  create: (chamber, congress) => async (billsCount) => {
    debug(
      'billsAsset.create',
      `creating ${billsCount} bills with args ${chamber}, ${congress}`,
    )
    const billType = chamber === 'HOUSE' ? 'hr' : 's'

    const bills: Array<AllBill> = []
    let offset = 0
    let totalCount = 0
    let pageNum = 1
    do {
      const url = `/bill/${congress}/${billType}?offset=${offset}&limit=${CONGRESS_API_PAGE_SIZE_LIMIT}`
      debug('billsAsset.create', `fetching ${url}`)
      const res = await throttledFetchCongressAPI(url, {
        offset,
        limit: CONGRESS_API_PAGE_SIZE_LIMIT,
      })
      debug('billsAsset.create', `done fetching ${url}`)
      const json = await res.json()
      const { bills: newBills } = allBillResponseValidator.parse(json)
      const parsed = newBills.map((bill) => allBillValidator.parse(bill))
      const fileName = `./data/${billsAsset.name}/${congress}-${chamber}-page-${pageNum}.json`
      writeFileSyncWithDir(fileName, JSON.stringify(parsed))
      debug('billsAsset.create', `wrote ${parsed.length} bills to ${fileName}`)
      bills.push(...parsed)
      totalCount += parsed.length
      offset += CONGRESS_API_PAGE_SIZE_LIMIT
      pageNum++
      debug(
        'billsAsset.create',
        `added ${parsed.length} bills, total count is ${totalCount}`,
      )
    } while (totalCount < billsCount)
    debug(
      'billsAsset.create',
      `done fetching bills, total count is ${totalCount}`,
    )
    return bills
  },
  readMetadata: (chamber, congress) => async (count) => {
    const expectedPageFiles = Array(
      Math.floor(count / CONGRESS_API_PAGE_SIZE_LIMIT),
    )
      .fill(null)
      .map((_, i) => `./data/bills/${congress}-${chamber}-page-${i + 1}.json`)
    const pageStatuses = expectedPageFiles.map((f) => {
      const file = f
      const status = existsSync(file) ? 'complete' : 'incomplete'
      return { file, status }
    })
    return { pageStatuses, expectedPageFiles }
  },
}

export const reportAsset: Asset<
  string,
  [],
  [
    typeof bioguidesAsset,
    typeof membersAsset,
    typeof billsAsset,
    typeof actionsAsset,
  ],
  unknown
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

function debug(key: string, message: string): void {
  console.debug(`[${key} | ${format(Date.now(), 'HH:mm:ss.SSS')}]: ${message}`)
}

function error(key: string, message: string): void {
  console.error(`[${key} | ${format(Date.now(), 'HH:mm:ss.SSS')}]: ${message}`)
}
