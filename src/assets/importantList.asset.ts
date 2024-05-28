import { Asset } from './assets.types'
import {
  getWriteMeta,
  debug as logDebug,
  error as logError,
  readUtf8File,
  withRootResourcesPath,
} from './utils'
import { Chamber } from '@prisma/client'
import { existsSync } from 'fs'
import { z } from 'zod'

const ASSET_NAME = 'importantList'
type AssetData = Array<number>
type AssetArgs = [Chamber, number]
type AssetDeps = []
const metaValidator = z.object({
  fileExists: z.boolean(),
  lastChecked: z.number().optional(),
  // Do local assets need lastCreated?
  // lastCreated: z.number().optional(),
})
type AssetMeta = z.infer<typeof metaValidator>
const DEFAULT_META: AssetMeta = {
  fileExists: false,
}

// Loggers
function debug(message: string): void {
  logDebug(ASSET_NAME, message)
}

function error(message: string): void {
  logError(ASSET_NAME, message)
}

function makeFileName(Chamber: Chamber, congress: number) {
  return `${ASSET_NAME}/${Chamber.toString().toLowerCase()}-${congress}.txt`
}
function makeMetaFileName(Chamber: Chamber, congress: number) {
  return `${ASSET_NAME}/${Chamber.toString().toLowerCase()}-${congress}-meta.json`
}

const getFileName = withRootResourcesPath(makeFileName)
const getMetaFileName = withRootResourcesPath(makeMetaFileName)

const writeMeta = getWriteMeta(
  getMetaFileName,
  DEFAULT_META,
  metaValidator.parse,
  ASSET_NAME,
)

export const importantListAsset: Asset<
  AssetData,
  AssetArgs,
  AssetDeps,
  AssetMeta
> = {
  name: ASSET_NAME,
  queue: 'local-asset-queue',
  deps: [],
  policy: (chamber, congress) => async () => {
    console.log('important list policy', chamber, congress)
    const filename = getFileName(chamber, congress)
    console.log(`checking for ${filename}`)
    const exists = existsSync(filename)
    console.log(`exists: ${exists}`)
    writeMeta(
      { fileExists: exists, lastChecked: Date.now() },
      chamber,
      congress,
    )
    return exists
  },

  read: async (...args) => {
    return z.array(z.number()).parse(
      readUtf8File(getFileName(...args))
        .split('\n')
        .map(Number),
    )
  },
  create: () => (_chamber, _congress) => async () => {
    error(`Shouldn't be calling me!`)
    throw new Error()
  },
  readMetadata: async (...args) => {
    try {
      const meta = metaValidator.parse(
        JSON.parse(readUtf8File(getMetaFileName(...args))),
      )
      return meta
    } catch (e) {
      return null
    }
  },
}
