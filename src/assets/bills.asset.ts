/**
 * Bills Asset: a collection of bills specified by chamber and congress (e.g., the 117th Senate).
 * Policy: Provided a count of bills:
 *  - Generate a range from 1 to the count
 *  - For each bill number in the range, ensure the bill file, in sequence:
 *   (1) exists
 *   (2) is valid JSON
 *   (3) contains the expected keys (bill, actions, committees)
 *   (4) the length of the actions array equals the count provided in the bill property
 *  - If any of the above are false, the policy is violated
 **/
// Imports
import { CONGRESS_API_PAGE_SIZE_LIMIT } from '../../assetDefinitions'
import { throttledFetchCongressAPI } from '../workers/congressAPI'
import {
  billActionsResponseValidator,
  billActionsValidator,
  billCommitteesResponseValidator,
  billCommitteesValidator,
  billDetailResponseValidator,
  billDetailValidator,
} from '../workers/validators'
import { Asset } from './assets.types'
import { billsCountAsset } from './billsCount.asset'
import {
  getWriteMeta,
  isValidJSON,
  debug as logDebug,
  makeRange,
  readUtf8File,
  withRootCachePath,
  writeFileSyncWithDir,
} from './utils'
import { Chamber } from '@prisma/client'
import { existsSync, readdirSync } from 'fs'
import { z } from 'zod'

const ASSET_NAME = 'bills'
const assetDataValidator = z.object({
  bill: billDetailValidator,
  actions: billActionsValidator,
  committees: billCommitteesValidator,
})

type AssetData = Array<z.infer<typeof assetDataValidator>>
type AssetArgs = [Chamber, number]
type AssetDeps = [typeof billsCountAsset]
const metaValidator = z.object({
  missingBillNumbers: z.array(z.number()),
  fullCount: z.number(),
  lastChecked: z.number().optional(),
  lastCreated: z.number().optional(),
})
type AssetMeta = z.infer<typeof metaValidator>
const DEFAULT_META: AssetMeta = {
  missingBillNumbers: [],
  fullCount: 0,
}

// Path manipulation functions
function makeFileName(chamber: Chamber, congress: number, billNumber: number) {
  return `${ASSET_NAME}/${congress}/${chamber}/${billNumber}.json`
}
function makeMetaFileName(chamber: Chamber, congress: number) {
  return `${ASSET_NAME}/${congress}/${chamber}-meta.json`
}

const getFileName = withRootCachePath(makeFileName)
const getMetaFileName = withRootCachePath(makeMetaFileName)

const writeMeta = getWriteMeta(
  getMetaFileName,
  DEFAULT_META,
  metaValidator.parse,
  ASSET_NAME,
)

// .read() functions. Necessary because I'm storing each bill in its own file,
// but want to return them together as an array.
function makeDirName(chamber: Chamber, congress: number) {
  return `${ASSET_NAME}/${congress}/${chamber}`
}
const getDirName = withRootCachePath(makeDirName)

function listFiles(chamber: Chamber, congress: number): string[] {
  const dir = getDirName(chamber, congress)
  return readdirSync(dir, { withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => `${dir}/${dirent.name}`)
}

// Loggers
function debug(message: string): void {
  logDebug(ASSET_NAME, message)
}

// Function for bundling up policy checks: existence, validity expected keys present
// TODO: I guess could additionally confirm encoding is utf8?
function policyRollup(path: string): boolean {
  // exists?
  if (!existsSync(path)) {
    return false
  }

  // For now, just treating existence as go ahead to read as utf8
  const data = readUtf8File(path)

  // valid JSON?
  if (!isValidJSON(data)) {
    return false
  }
  // expected keys?
  const json = JSON.parse(data)
  if (
    json['bill'] === undefined ||
    json['actions'] === undefined ||
    json['committees'] === undefined
  ) {
    return false
  }

  // does the length of actions property equal the count provided in the bill property?
  if (
    json['bill']['actions']['count'] !== undefined &&
    json['actions'].length !== undefined &&
    json['bill']['actions']['count'] !== json['actions'].length
  ) {
    return false
  }
  return true
}

// fetcher for paginating through bill actions
async function fetchAndParseBillActions(
  congress: number,
  billType: 'hr' | 's',
  billNumber: number,
): Promise<z.infer<typeof billActionsValidator>> {
  let offset = 0
  let hasNextPage = true
  let allActions: z.infer<typeof billActionsValidator> = []
  const baseURL = `/bill/${congress}/${billType}/${billNumber}/actions`

  while (hasNextPage) {
    const billActionsURL = `${baseURL}?offset=${offset}&limit=${CONGRESS_API_PAGE_SIZE_LIMIT}`
    const billActionsRes = await throttledFetchCongressAPI(billActionsURL, {
      offset,
      limit: CONGRESS_API_PAGE_SIZE_LIMIT,
    })
    const json = await billActionsRes.json()
    const { actions, pagination } = billActionsResponseValidator.parse(json)
    allActions.push(...actions)
    if (pagination && pagination.next) {
      offset += CONGRESS_API_PAGE_SIZE_LIMIT
    } else {
      hasNextPage = false
    }
  }
  return allActions
}

export const billsAsset: Asset<AssetData, AssetArgs, AssetDeps, AssetMeta> = {
  name: ASSET_NAME,
  queue: 'congress-api-asset-queue',
  deps: [billsCountAsset],
  policy: (chamber, congress) => async (billsCount) => {
    // Generate range of 1 to billCount
    const billNumbers = makeRange(1, billsCount)
    // Get missing bill numbers by filtering on policy failure
    const missingBillNumbers = billNumbers.filter((billNumber) => {
      const path = getFileName(chamber, congress, billNumber)
      return !policyRollup(path)
    })

    // Write metadata
    writeMeta(
      {
        missingBillNumbers,
        fullCount: billsCount,
        lastChecked: Date.now(),
      },
      chamber,
      congress,
    )

    // if no missing bills, policy passes
    return missingBillNumbers.length === 0
  },
  read: async (chamber, congress) =>
    listFiles(chamber, congress) // list files in dir specified by chamber and congress
      .map(readUtf8File) // read
      .map((file) => JSON.parse(file))
      .map((json) => assetDataValidator.parse(json)), // parse
  create:
    ({ emit }) =>
    (chamber, congress) =>
    async (billsCount) => {
      // get missing bill numbers from meta file
      const { missingBillNumbers } = metaValidator.parse(
        JSON.parse(readUtf8File(getMetaFileName(chamber, congress))),
      )
      debug(
        `Have ${billsCount - missingBillNumbers.length} on file... creating ${
          missingBillNumbers.length
        } bills with args ${chamber}, ${congress}`,
      )
      // make billType from chamber, create base url
      const billType = chamber === 'HOUSE' ? 'hr' : 's'
      const baseURL = `/bill/${congress}/${billType}`
      // for each missing bill number
      for (const billNumber of missingBillNumbers) {
        emit({
          type: 'bills',
          billNumber: billNumber,
          status: 'FETCHING',
        })
        // fetch bill details
        debug(`fetching bill details for ${congress}-${billType}-${billNumber}`)
        const billURL = `${baseURL}/${billNumber}?offset=0&limit=${CONGRESS_API_PAGE_SIZE_LIMIT}`
        const billRes = await throttledFetchCongressAPI(billURL, {
          offset: 0,
          limit: CONGRESS_API_PAGE_SIZE_LIMIT,
        })

        const billResJSON = await billRes.json()
        const { bill } = billDetailResponseValidator.parse(billResJSON)

        // fetch actions
        debug(`fetching actions for ${congress}-${billType}-${billNumber}`)
        const actions = await fetchAndParseBillActions(
          congress,
          billType,
          billNumber,
        )

        // fetch committees

        debug(`fetching committees for ${congress}-${billType}-${billNumber}`)
        const committeesURL = `${baseURL}/${billNumber}/committees?offset=0&limit=${CONGRESS_API_PAGE_SIZE_LIMIT}`
        const committeesRes = await throttledFetchCongressAPI(committeesURL, {
          offset: 0,
          limit: CONGRESS_API_PAGE_SIZE_LIMIT,
        })
        const committeesResJSON = await committeesRes.json()

        const { committees } =
          billCommitteesResponseValidator.parse(committeesResJSON)

        // write to file
        const billData = {
          bill,
          actions,
          committees,
        }
        const fileName = getFileName(chamber, congress, billNumber)
        debug(`writing ${fileName}`)
        writeFileSyncWithDir(fileName, JSON.stringify(billData), 'utf8')
        emit({
          type: 'bills',
          billNumber: billNumber,
          status: 'SUCCESS',
        })
      }
      // write metadata
      writeMeta(
        {
          // TODO: Right now just set missing bill numbers to empty after loop, but this should probably be an accumulated list of bill numbers that failed during the loop.
          // One quick way to do this would be to go from schema.parse() to safe parse, then accumulate on !success
          missingBillNumbers: [],
          fullCount: billsCount,
          lastCreated: Date.now(),
        },
        chamber,
        congress,
      )
    },

  readMetadata: async (chamber, congress) => {
    try {
      return metaValidator.parse(
        JSON.parse(readUtf8File(getMetaFileName(chamber, congress))),
      )
    } catch (e) {
      return null
    }
  },
}
