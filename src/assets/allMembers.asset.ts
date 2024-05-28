/**
 * all members asset: A set of jsons consisting of all pages of the /member endpoint
 * Policy:
 * 1. Do we have the expected number of page files?
 * 2. Valid?
 * 3. Do we have the expected number of members across all files?
 *
 **/
import { CONGRESS_API_PAGE_SIZE_LIMIT } from '../../assetDefinitions'
import { throttledFetchCongressAPI } from '../workers/congressAPI'
import {
  allMemberResponseValidator,
  allMemberValidator,
} from '../workers/validators'
import { Asset } from './assets.types'
import { StoredAssetStatus, pageStatusValidator } from './assets.validators'
import { membersCountAsset } from './membersCount.asset'
import {
  getWriteMeta,
  makeRange,
  pageNumberToOffset,
  readUtf8File,
  withRootCachePath,
  writeFileSyncWithDir,
} from './utils'
import { debug } from 'console'
import { existsSync, readdirSync } from 'fs'
import { z } from 'zod'

const ASSET_NAME = 'allMembers'
const assetDataValidator = z.array(allMemberValidator)
type AssetData = z.infer<typeof assetDataValidator>
type AssetArgs = []
type AssetDeps = [typeof membersCountAsset]

const metaValidator = z.object({
  pageStatuses: z.array(pageStatusValidator),
  lastChecked: z.number().optional(),
  lastCreated: z.number().optional(),
})
type AssetMeta = z.infer<typeof metaValidator>
const DEFAULT_META: AssetMeta = {
  pageStatuses: [],
}

function makeFileName(pageNumber: number) {
  return `${ASSET_NAME}/${ASSET_NAME}-${pageNumber}.json`
}
function makeMetaFileName() {
  return `${ASSET_NAME}/${ASSET_NAME}-meta.json`
}
const getFileName = withRootCachePath(makeFileName)
const getMetaFileName = withRootCachePath(makeMetaFileName)

const writeMeta = getWriteMeta(
  getMetaFileName,
  DEFAULT_META,
  metaValidator.parse,
  ASSET_NAME,
)

// read functions. Necessary because I'm storing separate pages, buty want to return as one obj
function makeDirName() {
  return `${ASSET_NAME}`
}

const getDirName = withRootCachePath(makeDirName)

function listFiles() {
  const dir = getDirName()
  return readdirSync(dir, { withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => `${dir}/${dirent.name}`)
}

// policy function
function policyRollup(
  membersCount: number,
): Array<{ status: StoredAssetStatus; fileName: string; pageNumber: number }> {
  const expectedPageNumbers = makeRange(
    1,
    Math.ceil(membersCount / CONGRESS_API_PAGE_SIZE_LIMIT),
  )
  let pageStatuses: Array<{
    status: StoredAssetStatus
    fileName: string
    pageNumber: number
  }> = []

  for (const pageNumber of expectedPageNumbers) {
    const fileName = getFileName(pageNumber)

    // if it doesn't exist, set to pending
    if (!existsSync(fileName)) {
      pageStatuses = [
        ...pageStatuses,
        { status: 'PENDING', fileName, pageNumber },
      ]
      continue
    }

    const file = readUtf8File(fileName)
    const parsed = assetDataValidator.safeParse(JSON.parse(file))

    // if it's invalid, set to pending
    if (!parsed.success) {
      pageStatuses = [
        ...pageStatuses,
        { status: 'PENDING', fileName, pageNumber },
      ]
      continue
    }

    // if it's valid, check if the count is correct
    // count should be = to page limit, unless it's the last page, which should have a length of the remainder of members / page limit
    const expectedCount =
      pageNumber === expectedPageNumbers.length
        ? membersCount % CONGRESS_API_PAGE_SIZE_LIMIT
        : CONGRESS_API_PAGE_SIZE_LIMIT

    if (parsed.data.length !== expectedCount) {
      continue
    }

    // if we got here, it's a pass
    pageStatuses = [...pageStatuses, { status: 'PASS', fileName, pageNumber }]
  }
  return pageStatuses
}
export const allMembersAsset: Asset<
  AssetData,
  AssetArgs,
  AssetDeps,
  AssetMeta
> = {
  name: ASSET_NAME,
  queue: 'congress-api-asset-queue',
  deps: [membersCountAsset],
  policy: () => async (membersCount) => {
    const pageStatuses = policyRollup(membersCount)
    // write metadata
    writeMeta({
      pageStatuses,
      lastChecked: Date.now(),
    })

    // if all page statuses are 'PASS', true
    return pageStatuses.every((pageStatus) => pageStatus.status === 'PASS')
  },
  read: async () =>
    listFiles()
      .map(readUtf8File)
      .map((file) => JSON.parse(file))
      .reduce((acc, json) => [...acc, ...assetDataValidator.parse(json)], []),
  create:
    ({ emit }) =>
    () =>
    async (membersCount) => {
      const { pageStatuses } = metaValidator.parse(
        JSON.parse(readUtf8File(getMetaFileName())),
      )
      const missingPageNumbers = pageStatuses
        .filter((pageStatus) => pageStatus.status === 'PENDING')
        .map((pageStatus) => pageStatus.pageNumber)

      debug(`Missing ${missingPageNumbers.length} pages`)

      // base url
      const baseUrl = `/member`

      for (const missingPageNumber of missingPageNumbers) {
        // set missing page number to fetching, emit statuses
        pageStatuses.forEach((pageStatus) => {
          if (pageStatus.pageNumber === missingPageNumber) {
            pageStatus.status = 'FETCHING'
          }
        })

        emit({
          type: 'allMembers',
          pageStatuses,
        })

        // calculate offset given page number
        const offset = pageNumberToOffset(
          missingPageNumber,
          CONGRESS_API_PAGE_SIZE_LIMIT,
        )

        // fetch
        debug(`fetching ${missingPageNumber}, offset: ${offset}`)
        const url = `${baseUrl}?offset=${offset}&limit=${CONGRESS_API_PAGE_SIZE_LIMIT}`
        const response = await throttledFetchCongressAPI(url, {
          offset,
          limit: CONGRESS_API_PAGE_SIZE_LIMIT,
        })
        const json = await response.json()
        const { members } = allMemberResponseValidator.parse(json)

        // write to file
        debug(`writing ${missingPageNumber} to file`)
        const fileName = getFileName(missingPageNumber)
        writeFileSyncWithDir(fileName, JSON.stringify(members), 'utf8')
        pageStatuses.forEach((pageStatus) => {
          if (pageStatus.pageNumber === missingPageNumber) {
            pageStatus.status = 'PASS'
          }
        })
        emit({
          type: 'allMembers',
          pageStatuses,
        })
      }
      writeMeta({
        pageStatuses,
        lastCreated: Date.now(),
      })
    },
  readMetadata: async () => {
    try {
      return metaValidator.parse(JSON.parse(readUtf8File(getMetaFileName())))
    } catch (e) {
      return null
    }
  },
}
