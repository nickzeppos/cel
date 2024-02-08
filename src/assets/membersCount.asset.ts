import { throttledFetchCongressAPI } from '../workers/congressAPI'
import { Asset } from './assets.types'
import {
  getWriteMeta,
  debug as logDebug,
  readUtf8File,
  withRootCachePath,
  writeFileSyncWithDir,
} from './utils'
import { existsSync } from 'fs'
import { z } from 'zod'

const ASSET_NAME = 'membersCount'
type AssetData = number
type AssetArgs = []
type AssetDeps = []
const metaValidator = z.object({
  fileExists: z.boolean(),
  lastChecked: z.number().optional(),
  lastCreated: z.number().optional(),
})
type AssetMeta = z.infer<typeof metaValidator>
const DEFAULT_META: AssetMeta = {
  fileExists: false,
}
function debug(message: string): void {
  logDebug(ASSET_NAME, message)
}
function makeFileName() {
  return `${ASSET_NAME}/${ASSET_NAME}.txt`
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

export const membersCountAsset: Asset<
  AssetData,
  AssetArgs,
  AssetDeps,
  AssetMeta
> = {
  name: ASSET_NAME,
  queue: 'congress-api-asset-queue',
  deps: [],
  policy: () => async () => {
    const fileName = getFileName()
    const fileExists = existsSync(fileName)
    const lastChecked = Date.now()
    writeMeta({
      fileExists,
      lastChecked,
    })
    return fileExists
  },
  read: async () => z.number().parse(parseInt(readUtf8File(getFileName()))),
  create:
    ({ emit }) =>
    () =>
    async () => {
      const url = `/member`
      debug(`fetching ${url}`)
      emit({ type: ASSET_NAME, status: 'FETCHING' })
      const res = await throttledFetchCongressAPI(url, { limit: 1 })
      debug(`done fetching ${url}`)
      const json = await res.json()
      debug(`writing ${getFileName()}`)
      writeFileSyncWithDir(getFileName(), JSON.stringify(json.pagination.count))
      writeMeta({
        fileExists: true,
        lastCreated: Date.now(),
      })
      emit({ type: ASSET_NAME, status: 'COMPLETE' })
    },
  readMetadata: async (...args) => {
    try {
      return metaValidator.parse(
        JSON.parse(readUtf8File(getMetaFileName(...args))),
      )
    } catch (e) {
      return null
    }
  },
}
