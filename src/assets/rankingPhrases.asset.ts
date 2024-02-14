import { rankingPhrasesValidator } from '../workers/validators'
import { Asset } from './assets.types'
import {
  getWriteMeta,
  debug as logDebug,
  error as logError,
  readUtf8File,
  withRootResourcesPath,
} from './utils'
import { Chamber } from '@prisma/client'
import { parse as CSVparse } from 'csv-parse'
import { createReadStream, existsSync } from 'fs'
import { z } from 'zod'

const ASSET_NAME = 'rankingPhrases'
type AssetData = Array<string>
type AssetArgs = [Chamber]
type AssetDeps = []
const metaValidator = z.object({
  fileExists: z.boolean(),
  lastChecked: z.number().optional(),
  // no last created on local
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

function makeFileName(chamber: Chamber) {
  return `${ASSET_NAME}/${chamber.toString().toLowerCase()}.csv`
}
function makeMetaFileName(chamber: Chamber) {
  return `${ASSET_NAME}/${chamber.toString().toLowerCase()}-meta.json`
}
const getFileName = withRootResourcesPath(makeFileName)
const getMetaFileName = withRootResourcesPath(makeMetaFileName)

const writeMeta = getWriteMeta(
  getMetaFileName,
  DEFAULT_META,
  metaValidator.parse,
  ASSET_NAME,
)

export const rankingPhrasesAsset: Asset<
  AssetData,
  AssetArgs,
  AssetDeps,
  AssetMeta
> = {
  name: ASSET_NAME,
  queue: 'local-asset-queue',
  deps: [],
  policy: (chamber) => async () => {
    const filename = getFileName(chamber)
    const exists = existsSync(filename)
    writeMeta({ fileExists: exists, lastChecked: Date.now() }, chamber)
    return exists
  },
  read: async (...args) => {
    const fileName = getFileName(...args)
    const importantList: Array<string> = []
    return new Promise((resolve, reject) => {
      createReadStream(fileName)
        .pipe(CSVparse({ columns: true }))
        .on('data', (row) => {
          try {
            const parsedRow = rankingPhrasesValidator.parse(row)
            importantList.push(parsedRow.phrase)
          } catch (e) {
            reject(e)
          }
        })
        .on('end', () => {
          resolve(importantList)
        })
        .on('error', (e) => {
          reject(e)
        })
    })
  },
  create: () => (chamber) => async () => {
    error(`Shouldn't be calling me!`)
    throw new Error()
  },
  readMetadata: async (chamber) => {
    try {
      return metaValidator.parse(
        JSON.parse(readUtf8File(getMetaFileName(chamber))),
      )
    } catch (e) {
      return null
    }
  },
}
