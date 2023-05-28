import { Chamber } from "@prisma/client"
import { existsSync } from "fs"
import { z } from "zod"
import { throttledFetchCongressAPI } from "../workers/congressAPI"
import { Asset } from "./assets.types"
import { getWriteMeta, debug as logDebug, warn as logWarn, readUtf8File, writeFileSyncWithDir } from "./utils"

const ASSET_NAME = 'billsCount'
type AssetData = number
type AssetArgs = [Chamber, number]
type AssetDeps = []
const metaValidator = z.object({
  fileExists: z.boolean(),
  lastChecked: z.number().optional(),
  lastCreated: z.number().optional()
})
type AssetMeta = z.infer<typeof metaValidator>
const DEFAULT_META: AssetMeta = {
  fileExists: false,
}
function warn(message: string): void {
  logWarn(ASSET_NAME, message)
}
function debug(message: string): void {
  logDebug(ASSET_NAME, message)
}
function getFilename(chamber: Chamber, congress: number): string {
  return `./data/${ASSET_NAME}-${congress}-${chamber}.json`
}
function getMetaFilename(chamber: Chamber, congress: number): string {
  return `./data/${ASSET_NAME}-${congress}-${chamber}-meta.json`
}
const writeMeta = getWriteMeta(getMetaFilename, DEFAULT_META, metaValidator.parse, ASSET_NAME)

export const billsCountAsset: Asset<AssetData, AssetArgs, AssetDeps, AssetMeta> = {
  name: ASSET_NAME,
  queue: 'congress-api-asset-queue',
  deps: [],
  policy: (chamber, congress) => async () => {
    const fileName = getFilename(chamber, congress)
    const fileExists = existsSync(fileName)
    const lastChecked = Date.now()
    writeMeta(chamber, congress, {
      fileExists,
      lastChecked
    })
    return fileExists
  },
  read: async (...args) =>
    z.number().parse(parseInt(readUtf8File(getFilename(...args)))),
  create: () => (chamber, congress) => async () => {
    const billType = chamber === 'HOUSE' ? 'hr' : 's'
    const url = `/bill/${congress}/${billType}`
    debug(`fetching ${url}`)
    const res = await throttledFetchCongressAPI(url, { limit: 1 })
    debug(`done fetching ${url}`)
    const json = await res.json()
    debug(`writing ${getFilename(chamber, congress)}`)
    writeFileSyncWithDir(
      getFilename(chamber, congress),
      JSON.stringify(json.pagination.count),
    )
    writeMeta(chamber, congress, {
      fileExists: true,
      lastCreated: Date.now()
    })
  },
  readMetadata: async (...args) => {
    try {
      return metaValidator.parse(JSON.parse(readUtf8File(getMetaFilename(...args))))
    } catch (e) {
      return null
    }
  },
}