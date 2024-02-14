import { stepValidator } from '../workers/validators'
import { Asset } from './assets.types'
import { getWriteMeta, readUtf8File, withRootResourcesPath } from './utils'
import { debug as logDebug, error as logError } from './utils'
import { Chamber, Step } from '@prisma/client'
import { existsSync } from 'fs'
import { z } from 'zod'

const ASSET_NAME = 'stepRegexes'
type AssetData = Map<Step, RegExp[]>
type AssetArgs = [Chamber]
type AssetDeps = []
const fileStatusValidator = z.object({
  step: stepValidator,
  exists: z.boolean(),
  invalidLineNumbers: z.array(z.number()),
})
const metaValidator = z.object({
  fileStatuses: z.array(fileStatusValidator),
  lastChecked: z.number().optional(),
  // no last created on local
})
type AssetMeta = z.infer<typeof metaValidator>
const DEFAULT_META: AssetMeta = {
  fileStatuses: [],
}

// Loggers
function debug(message: string): void {
  logDebug(ASSET_NAME, message)
}

function error(message: string): void {
  logError(ASSET_NAME, message)
}

function makeFileName(chamber: Chamber, step: Step) {
  return `${ASSET_NAME}/${chamber.toString().toLowerCase()}-${step}.txt`
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

function isValidRegexString(str: string): boolean {
  try {
    new RegExp(str)
    return true
  } catch (e) {
    return false
  }
}

export const stepRegexesAsset: Asset<
  AssetData,
  AssetArgs,
  AssetDeps,
  AssetMeta
> = {
  name: ASSET_NAME,
  queue: 'local-asset-queue',
  deps: [],
  policy: (chamber) => async () => {
    let fileStatuses: {
      step: Step
      exists: boolean
      invalidLineNumbers: Array<number>
    }[] = []
    Object.values(Step).forEach((step) => {
      const fileName = getFileName(chamber, step)
      let invalidLineNumbers: Array<number> = []
      readUtf8File(fileName)
        .split('\n')
        .reduce((acc, line, i) => {
          if (!isValidRegexString(line)) {
            acc.push(i + 1)
          }
          return acc
        }, invalidLineNumbers)
      fileStatuses.push({
        step,
        exists: existsSync(fileName),
        invalidLineNumbers,
      })
    })

    writeMeta({ fileStatuses, lastChecked: Date.now() }, chamber)
    const everyFileExists = fileStatuses.every(
      (fileStatus) => fileStatus.exists === true,
    )
    const allLinesAreValidRegexes = fileStatuses.every(
      (fileStatus) => fileStatus.invalidLineNumbers.length === 0,
    )
    return everyFileExists && allLinesAreValidRegexes
  },
  read: async (chamber) => {
    let stepRegexes: AssetData = new Map()
    Object.values(Step).forEach((step) => {
      const fileName = getFileName(chamber, step)
      const regexes = readUtf8File(fileName)
        .split('\n')
        .map((line) => new RegExp(line.trim().slice(1, -2), 'g'))
      stepRegexes.set(step, regexes)
    })
    return stepRegexes
  },
  create:
    ({ emit }) =>
    (chamber) =>
    async () => {
      error(`Shouldn't be calling me!`)
      throw new Error()
    },
  readMetadata: async (chamber) => {
    try {
      const meta = metaValidator.parse(
        JSON.parse(readUtf8File(getMetaFileName(chamber))),
      )
      return meta
    } catch (e) {
      return null
    }
  },
}
