import { CONGRESS_API_PAGE_SIZE_LIMIT } from '../../assetDefinitions'
import { throttledFetchCongressAPI } from '../workers/congressAPI'
import { StoredAssetStatus, storedAssetStatusValidator } from '../workers/types'
import {
  BillList,
  billListResponseValidator,
  billListValidator,
} from '../workers/validators'
import { Asset } from './assets.types'
import { billsCountAsset } from './billsCount.asset'
import {
  getWriteMeta,
  debug as logDebug,
  error as logError,
  warn as logWarn,
  readUtf8File,
} from './utils'
import { Chamber } from '@prisma/client'
import { createWriteStream, existsSync, readdirSync } from 'fs'
import { z } from 'zod'

const ASSET_NAME = 'billsList'
type AssetData = Array<BillList>
type AssetArgs = [
  Chamber,
  number,
  number | null | undefined,
  number | null | undefined,
]
type AssetDeps = [typeof billsCountAsset]
const pageStatusValidator = z.object({
  pageNumber: z.number(),
  filename: z.string(),
  status: storedAssetStatusValidator,
})
type PageStatus = z.infer<typeof pageStatusValidator>
const metaValidator = z.object({
  pageStatuses: z.array(pageStatusValidator).optional(),
  lastChecked: z.number().optional(),
  lastCreated: z.number().optional(),
})
type AssetMeta = z.infer<typeof metaValidator>
const DEFAULT_META: AssetMeta = {}
function debug(message: string): void {
  logDebug(ASSET_NAME, message)
}
function error(message: string): void {
  logError(ASSET_NAME, message)
}
function warn(message: string): void {
  logWarn(ASSET_NAME, message)
}
function getMetaFilename(chamber: Chamber, congress: number) {
  return `data/bills/${congress}-${chamber}-meta.json`
}
function getFilename(chamber: Chamber, congress: number, page: number) {
  return `data/bills/${congress}-${chamber}-page-${page}.json`
}
const writeMeta = getWriteMeta(
  getMetaFilename,
  DEFAULT_META,
  metaValidator.parse,
  ASSET_NAME,
)

function getBillsPageStatuses(
  chamber: Chamber,
  congress: number,
  billsCount: number,
): PageStatus[] {
  return Array(Math.floor(billsCount / CONGRESS_API_PAGE_SIZE_LIMIT))
    .fill(null)
    .map((_, i) => {
      const pageNumber = i + 1
      const filename = getFilename(chamber, congress, pageNumber)
      let status: StoredAssetStatus = existsSync(filename) ? 'FAIL' : 'PENDING'
      try {
        if (
          billListResponseValidator.safeParse(
            JSON.parse(readUtf8File(filename)),
          ).success
        ) {
          status = 'PASS'
        } else {
          warn(`Bills list page failed to parse: ${filename}`)
        }
      } catch (e) {
        error(`Bills list page failed to read: ${filename}`)
      }
      return { filename, status, pageNumber }
    })
}

export const billsListAsset: Asset<AssetData, AssetArgs, AssetDeps, AssetMeta> =
  {
    name: ASSET_NAME,
    queue: 'congress-api-asset-queue',
    deps: [billsCountAsset],
    policy: (chamber, congress) => async (billsCount) => {
      const pageStatuses = getBillsPageStatuses(chamber, congress, billsCount)
      writeMeta(chamber, congress, {
        pageStatuses,
        lastChecked: Date.now(),
      })
      return pageStatuses.every(({ status }) => status === 'PASS')
    },
    read: async (chamber, congress) => {
      const pattern = new RegExp(`${congress}-${chamber}-page-(\d+)\.json`)
      const files = readdirSync(`./data/bills/`).filter(pattern.test)
      const bills = []
      for (const file of files) {
        const rawFile = readUtf8File(file)
        const fileBills = z
          .object({ bills: z.array(billListValidator) })
          .safeParse(JSON.parse(rawFile))
        if (!fileBills.success) {
          error(`failed to parse ${file}`)
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
        const billType = chamber === 'HOUSE' ? 'hr' : 's'
        debug(`creating ${billsCount} bills with args ${chamber}, ${congress}`)

        // read the pages we need to fetch from the meta.json
        const metaFile = getMetaFilename(chamber, congress)
        const metaFileExists = existsSync(metaFile)
        if (!metaFileExists) {
          throw new Error(`expected meta file to exist: ${metaFile}`)
        }
        const metadata = metaValidator.safeParse(
          JSON.parse(readUtf8File(metaFile)),
        )
        if (!metadata.success) {
          throw new Error(`failed to parse meta file: ${metaFile}`)
        }
        const { data: meta } = metadata
        // TODO: maybe just do this in the policy and cache a record
        // of file => status in the meta file
        emit({
          type: 'billsAssetAllPagesStatus',
          pageStatuses: meta.pageStatuses,
        })
        const pagesToFetch = (meta.pageStatuses ?? [])
          .filter(({ status }) => status !== 'PASS')
          .map(({ status, ...page }) => page)
        const writeFilePromises = []
        debug(
          `we need to fetch pages ${pagesToFetch
            .map(({ pageNumber }) => pageNumber)
            .join(', ')}`,
        )
        for (const { pageNumber, filename } of pagesToFetch) {
          const offset = (pageNumber - 1) * CONGRESS_API_PAGE_SIZE_LIMIT
          const url = `/bill/${congress}/${billType}?offset=${offset}&limit=${CONGRESS_API_PAGE_SIZE_LIMIT}`
          emit({
            type: 'billsAssetPageStatus',
            file: filename,
            status: 'FETCHING',
          })
          debug(`fetching ${url}`)
          const res = await throttledFetchCongressAPI(url, {
            offset,
            limit: CONGRESS_API_PAGE_SIZE_LIMIT,
          })
          emit({
            type: 'billsAssetPageStatus',
            file: filename,
            status: 'PASS',
          })
          debug(`done fetching ${url}`)
          const writeStream = createWriteStream(filename)
          res.body.pipe(writeStream)
          writeFilePromises.push(
            new Promise<void>((resolve) => {
              writeStream.on('finish', () => {
                debug(`wrote ${filename}`)
                resolve()
              })
            }),
          )
        }
        await Promise.all(writeFilePromises)
        debug(`done writing files, added ${writeFilePromises.length} pages`)
        const pageStatuses = getBillsPageStatuses(chamber, congress, billsCount)
        writeMeta(chamber, congress, {
          pageStatuses,
          lastChecked: Date.now(),
        })
      },
    readMetadata: async (chamber, congress) => {
      try {
        return metaValidator.parse(
          JSON.parse(readUtf8File(getMetaFilename(chamber, congress))),
        )
      } catch (e) {
        return null
      }
    },
  }
