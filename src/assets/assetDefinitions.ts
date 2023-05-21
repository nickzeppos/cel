import { Chamber } from '.prisma/client'
import { format, formatDistance } from 'date-fns'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'fs'
import { z } from 'zod'
import { billsAssetMetadataValidator } from '../utils/validators'
import {
  fetchCongressAPI,
  throttledFetchCongressAPI,
} from '../workers/congressAPI'
import {
  AllBill,
  AllMember,
  Member,
  allBillResponseValidator,
  allMemberResponseValidator,
  allMemberValidator,
  billListValidator,
  memberResponseValidator,
  memberValidator,
} from '../workers/validators'
import { AnyAsset, Asset } from './assets.types'

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
  create: () => () => async () => {
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
  create: () => () => async (membersCount) => {
    let totalCount = 0
    let offset: string | number = 0
    // eslint-disable-next-line prefer-const
    let limit: string | number = 250
    let members: Array<AllMember> = []

    do {
      console.log(
        `Fetching members ${totalCount} - ${totalCount + limit > membersCount ? membersCount : totalCount + limit
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
  create: () => () => async (members) => {
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

export const billsCountAsset: Asset<
  number,
  [Chamber, number],
  [],
  {
    fileExists: boolean
    count: number
  }
> = {
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
  create: () => (chamber, congress) => async () => {
    const billType = chamber === 'HOUSE' ? 'hr' : 's'
    const url = `/bill/${congress}/${billType}`
    debug('billsCountAsset.create', `fetching ${url}`)
    const res = await throttledFetchCongressAPI(url, { limit: 1 })
    debug('billsCountAsset.create', `done fetching ${url}`)
    const json = await res.json()
    return allBillResponseValidator.parse(json).pagination.count
  },
  readMetadata: (chamber, congress) => async () => {
    const fileName = `./data/${billsCountAsset.name}-${congress}-${chamber}.json`
    const fileExists = existsSync(fileName)
    if (!fileExists) {
      return {
        count: 0,
        fileExists,
      }
    }
    const countString = readFileSync(fileName, 'utf8')
    const count = parseInt(countString)
    return {
      count: z.number().parse(count),
      fileExists,
    }
  },
}

export const billAsset: Asset<
  number,
  [],
  [typeof billsCountAsset],
  unknown
> = {
  name: 'actions',
  queue: 'congress-api-asset-queue',
  deps: [billsCountAsset],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: () => async () => {
    return false
    // policy: (chamber, congress) => async (billsCount) => {
    // go through billsAsset pages, get all bill numbers
    // maybe we should create a bill numbers asset? billsCount not actually helpful here
    // should have an actions page for each bill number
    // write meta file with new update date and an array containing action pages to fetch
    // each bill requires at least one actions request

    // bill//{congress}/{billType}/{billNumber}/actions
    // format: 'json'
    // offset: integer
    // limit: 250
  },
  write: () => async () => {
    return
  },
  read: async () => 0,
  create: () => () => async () => 0,
}

export const billsListAsset: Asset<
  Array<AllBill>,
  [Chamber, number, number | null | undefined, number | null | undefined],
  [typeof billsCountAsset],
  {
    pageStatuses: { file: string; status: string }[]
  }
> = {
  name: 'bills',
  queue: 'congress-api-asset-queue',
  deps: [billsCountAsset],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: (chamber, congress) => async (billsCount) => {
    const fileBase = `./data/${billsListAsset.name}/${congress}-${chamber}`
    const metaFile = `${fileBase}-meta.json`
    const pageFile = (num: number) => `${fileBase}-page-${num}.json`
    const pagesToFetch = Array(
      Math.floor(billsCount / CONGRESS_API_PAGE_SIZE_LIMIT),
    )
      .fill(null)
      .map((_, i) => {
        const file = pageFile(i + 1)
        return existsSync(file) ? null : i + 1
      })
      .filter(isNotNull)

    debug('billsAsset.policy', `writing ${metaFile}`)
    writeFileSyncWithDir(
      metaFile,
      JSON.stringify({
        lastPolicyRunTime: new Date().getTime(),
        pagesToFetch,
      }),
    )

    return pagesToFetch.length === 0
  },
  write: (chamber, congress) => async (bills) => {
    const fileName = `./data/${billsListAsset.name}/${congress}-${chamber}.json`
    // call writeFileSync with an option to create folders that don't exist
    writeFileSyncWithDir(fileName, JSON.stringify(bills))
  },
  read: async (chamber, congress) => {
    const pattern = new RegExp(`${congress}-${chamber}-page-(\d+)\.json`)
    const files = readdirSync(`./data/bills/`).filter(pattern.test)
    const bills = []
    for (const file of files) {
      const rawFile = readFileSync(file, 'utf8')
      const fileBills = z
        .object({
          bills: z.array(billListValidator),
        })
        .safeParse(JSON.parse(rawFile))
      if (!fileBills.success) {
        error('billsAsset.create', `failed to parse ${file}`)
        continue
      }
      bills.push(...fileBills.data.bills)
    }
    return bills
  },
  create:
    ({ emit }) =>
      (chamber, congress) =>
        async (billsCount) => {
          debug(
            'billsAsset.create',
            `creating ${billsCount} bills with args ${chamber}, ${congress}`,
          )

          // read the pages we need to fetch from the meta.json
          const metaFile = `./data/${billsListAsset.name}/${congress}-${chamber}-meta.json`
          const metaFileExists = existsSync(metaFile)
          if (!metaFileExists) {
            throw new Error(`expected meta file to exist: ${metaFile}`)
          }
          const metaFileRaw = readFileSync(metaFile, 'utf8')
          const metaFileJSON = JSON.parse(metaFileRaw)

          const metadata = billsAssetMetadataValidator.safeParse(metaFileJSON)
          if (!metadata.success) {
            throw new Error(`failed to parse meta file: ${metaFile}`)
          }
          // TODO: maybe just do this in the policy and cache a record
          // of file => status in the meta file
          const pageStatuses = getBillsPageStatuses(chamber, congress, billsCount)
          emit({ type: 'billsAssetAllPagesStatus', pageStatuses })

          const billType = chamber === 'HOUSE' ? 'hr' : 's'
          const writeFilePromises = []
          debug(
            'billsAsset.create',
            `we need to fetch pages ${metadata.data.pagesToFetch.join(', ')}`,
          )
          for (const pageNumber of metadata.data.pagesToFetch) {
            const fileName = `./data/${billsListAsset.name}/${congress}-${chamber}-page-${pageNumber}.json`
            const offset = (pageNumber - 1) * CONGRESS_API_PAGE_SIZE_LIMIT
            const url = `/bill/${congress}/${billType}?offset=${offset}&limit=${CONGRESS_API_PAGE_SIZE_LIMIT}`
            emit({
              type: 'billsAssetPageStatus',
              file: fileName,
              status: 'fetching',
            })
            debug('billsAsset.create', `fetching ${url}`)
            const res = await throttledFetchCongressAPI(url, {
              offset,
              limit: CONGRESS_API_PAGE_SIZE_LIMIT,
            })
            emit({
              type: 'billsAssetPageStatus',
              file: fileName,
              status: 'complete',
            })
            debug('billsAsset.create', `done fetching ${url}`)
            const writeStream = createWriteStream(fileName)
            res.body.pipe(writeStream)
            writeFilePromises.push(
              new Promise<void>((resolve) => {
                writeStream.on('finish', () => {
                  debug('billsAsset.create', `wrote ${fileName}`)
                  resolve()
                })
              }),
            )
          }
          await Promise.all(writeFilePromises)
          debug(
            'billsAsset.create',
            `done writing files, added ${writeFilePromises.length} pages`,
          )
          // TODO: return void once we fix the create API
          return []
        },
  readMetadata:
    (chamber, congress) =>
      async ({ count }) => ({
        pageStatuses: getBillsPageStatuses(chamber, congress, count),
      }),
}
function getBillsPageStatuses(
  chamber: Chamber,
  congress: number,
  billsCount: number,
): { file: string; status: string }[] {
  return Array(Math.floor(billsCount / CONGRESS_API_PAGE_SIZE_LIMIT))
    .fill(null)
    .map((_, i) => {
      const file = `./data/bills/${congress}-${chamber}-page-${i + 1}.json`
      const status = existsSync(file) ? 'complete' : 'incomplete'
      return { file, status }
    })
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
  refreshPeriod: ONE_DAY_REFRESH,
  policy: ALWAYS_FETCH_POLICY,
  write: () => async () => {
    return
  },
  read: async () => '',
  create: () => () => async () => '',
}

export type AssetNameOf<T extends AnyAsset> = T['name']

const allAssets = {
  membersCount: membersCountAsset,
  members: membersAsset,
  bioguides: bioguidesAsset,
  billsCount: billsCountAsset,
  bill: billAsset,
  billList: billsListAsset,
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

function isNotNull<T>(x: T | null): x is T {
  return x != null
}
