// utils for cel cache management
// imports
import { BillAudit, CongressHealthReport } from './audit-cache'
import { BillType } from './types'
import dotenv from 'dotenv'
import { existsSync, mkdirSync, readdirSync } from 'fs'
import SFTP from 'ssh2-promise/lib/BaseSFTP'
import { z } from 'zod'

// env + consts
dotenv.config()
const CACHE_CONFIG_PATH = process.env.CACHE_CONFIG_PATH || './config.json'
const ROOT_CACHE_PATH = ''
const MAX_BATCH_SIZE = 10
const BASE_CONGRESS_API_URL = 'https://api.congress.gov/v3/bill/'
// functions
// create a directory if it doesn't exist, by default recursively
export function ensureDirectoryExists(path: string, recursive: boolean = true) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive })
  }
}

// list all directories in a directory
export function listDirsInDir(path: string): string[] {
  return readdirSync(path, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory()) // dirent stands "directory entry", type Dirent
    .map((dirent) => dirent.name)
}

export const listDirsInCache = () => listDirsInDir(ROOT_CACHE_PATH)

// check for existence of cache config
export function preAudit(): 200 | 400 {
  // ensure we have a cache
  ensureDirectoryExists(ROOT_CACHE_PATH)

  // check for existence of cache config
  if (!existsSync(CACHE_CONFIG_PATH)) {
    console.error(
      `No cache config found at ${CACHE_CONFIG_PATH}. Run create-cache-config.ts first.`,
    )
    return 400
  }
  return 200
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function makeAPIUrl(
  congress: number,
  billType: BillType,
  billNumber: number,
  endpoint: 'details' | 'committees' | 'actions',
): string {
  // only actions and committees correspond to actual endpoints,
  // details is invented name for data from the base bill endpoint
  const toAdd = endpoint === 'details' ? '' : `/${endpoint}`
  return `${BASE_CONGRESS_API_URL}/${congress}/${billType}/${billNumber}${toAdd}`
}

// filter null and guarantee that the resulting array is type narrowed in the intuitive way.
// i.e., arr: Array<string | null> = ["string", null] => arr.filter(isNotNullTypeGuard) => arr: Array<string> = ["string"}
function isNotNullTypeGuard<T>(x: T | null): x is T {
  return x !== null
}
// generic batcher

export async function batch<T>(
  // apparently this type of empty function that's used to call a function later
  // is called a "thunk", as in the past tense of "think"
  // https://en.wikipedia.org/wiki/Thunk
  // I have to use a thunk here because promises are "eager", and I want to control
  // when the async functions are called. That is, I want to batch them.  So, I have to
  // pass in a function that returns a promise, not the promise itself. This is the "thunk"!
  asyncs: Array<() => Promise<T | null>>,
  batchSize: number,
): Promise<Array<T>> {
  z.number().min(1).max(MAX_BATCH_SIZE).parse(batchSize)
  const results: Array<T> = [] // initialize results array
  // for each batch, await all promises in batch
  for (let i = 0; i < asyncs.length; i += batchSize) {
    const batch = asyncs.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map((async) => async()))
    const nonNullBatchResults = batchResults.filter(isNotNullTypeGuard) // This has to be used because filtering on null doesn't actually change the underlying type
    results.push(...nonNullBatchResults)
  }
  return results
}

export function sample<T>(arr: Array<T>, n: number): Array<T> {
  const res = []
  for (let i = 0; i < n; i++) {
    res.push(arr.splice(Math.floor(Math.random() * arr.length), 1)[0])
  }
  return res
}

// sftp file system methods + auditing functions
export namespace STFPFn {
  export async function directoryExists(
    sftp: SFTP,
    path: string,
  ): Promise<boolean> {
    try {
      const stats = await sftp.stat(path)
      return stats.isDirectory()
    } catch (error: any) {
      if (error.code === 2) {
        // ENOENT
        return false
      }
      throw error // unhandled
    }
  }

  export async function fileExists(sftp: SFTP, path: string): Promise<boolean> {
    try {
      const stats = await sftp.stat(path)
      return stats.isFile()
    } catch (error: any) {
      if (error.code === 2) {
        // ENOENT
        return false
      }
      throw error // unhandled
    }
  }

  export async function auditDetailsFile(
    path: string,
    sftp: SFTP,
  ): Promise<boolean> {
    // existence
    if (!(await fileExists(sftp, path))) {
      return false
    }

    return new Promise((resolve) => {
      let buffer = ''
      let httpCheck = false

      // open a stream
      sftp.createReadStream(path).then((stream) => {
        stream.on('data', (chunk) => {
          buffer += chunk.toString()

          // check if the file is .json storing bad http request
          // do this by verifying whether first token is '{'
          if (!httpCheck) {
            if (buffer[0] !== '{') {
              stream.destroy()
              resolve(false)
            } else {
              httpCheck = true
            }
          }
        })
        stream.on('error', (err) => {
          console.error(err)
          stream.destroy()
          resolve(false)
        })

        stream.on('close', () => {
          // try to parse and check for key
          try {
            const json = JSON.parse(buffer)
            if (json['bill'] !== undefined) {
              resolve(true)
            } else {
              resolve(false)
            }
          } catch (e) {
            // if syntax error, it's invalid JSON
            if (e instanceof SyntaxError) {
              resolve(false)
            }
          }
        })
      })
    })
  }

  export async function auditCommitteesFile(
    path: string,
    sftp: SFTP,
  ): Promise<boolean> {
    // existence
    if (!(await fileExists(sftp, path))) {
      return false
    }

    return new Promise((resolve) => {
      let buffer = ''
      let httpCheck = false

      // open a stream
      sftp.createReadStream(path).then((stream) => {
        stream.on('data', (chunk) => {
          buffer += chunk.toString()

          // on first chunk, check if the file is .json storing bad http request
          // do this by verifying whether first token is '{'
          if (!httpCheck) {
            if (buffer[0] !== '{') {
              stream.destroy()
              resolve(false)
            } else {
              httpCheck = true // only check once
            }
          }
        })

        // Traditionally this would correspond to ENOENT, but I've already handled that with
        // fileExists() before streaming, so this is sort of unhandled behavior right now
        stream.on('error', (err) => {
          console.error(err)
          stream.destroy()
          resolve(false)
        })

        stream.on('close', () => {
          // after we've streamed full file, check:
          // (1) it's valid json
          // (2) it has the expected key
          try {
            const json = JSON.parse(buffer)
            if (json['committees'] !== undefined) {
              resolve(true)
            } else {
              resolve(false)
            }
          } catch (e) {
            // if syntax error, it's invalid JSON
            if (e instanceof SyntaxError) {
              resolve(false)
            }
          }
        })
      })
    })
  }

  export async function auditActionsFile(
    path: string,
    sftp: SFTP,
  ): Promise<boolean> {
    // existence
    if (!(await fileExists(sftp, path))) {
      return false
    }

    let buffer = ''
    let httpCheck = false

    return new Promise((resolve) => {
      sftp.createReadStream(path).then((stream) => {
        stream.on('data', (chunk) => {
          buffer += chunk.toString()

          if (!httpCheck) {
            if (buffer[0] !== '{') {
              stream.destroy()
              resolve(false)
            } else {
              httpCheck = true
            }
          }
        })

        stream.on('error', (err) => {
          console.error(err)
          stream.destroy()
          resolve(false)
        })

        stream.on('close', () => {
          try {
            const json = JSON.parse(buffer)
            // chceck for expected token and expected actions array length
            if (json['actions'] !== undefined) {
              if (json['actions'].length === json['pagination']['count']) {
                // if actions key and actions array length match count, it's valid
                resolve(true)
              } else {
                // if actions array length doesn't match count, it's invalid
                resolve(false)
              }
            } else {
              // if no actions key, it's invalid
              resolve(false)
            }
          } catch (e) {
            // if syntax error, it's invalid JSON
            if (e instanceof SyntaxError) {
              resolve(false)
            }
          }
        })
      })
    })
  }

  export async function auditBill(
    congress: number,
    billType: 'hr' | 's',
    billNumber: number,
    baseCachePath: string,
    sftp: SFTP,
  ): Promise<BillAudit | null> {
    const billPath = `${baseCachePath}/bill/${congress}/${billType}/${billNumber}`
    console.log(`Auditing bill ${billPath}`)
    const [detailsAudit, committeesAudit, actionsAudit] = await Promise.all([
      auditDetailsFile(`${billPath}.json`, sftp),
      auditCommitteesFile(`${billPath}/committees.json`, sftp),
      auditActionsFile(`${billPath}/actions.json`, sftp),
    ])
    if (!detailsAudit || !committeesAudit || !actionsAudit) {
      return {
        billNumber,
        details: detailsAudit,
        committees: committeesAudit,
        actions: actionsAudit,
      }
    } else {
      return null
    }
  }
  export async function auditCongress(
    billRange: number[],
    congress: number,
    billType: 'hr' | 's',
    baseCacePath: string,
    sftp: SFTP,
  ): Promise<CongressHealthReport> {
    console.log(`Auditing ${billRange.length} bills in ${congress} ${billType}`)
    const congressHealthReport: CongressHealthReport = {
      congress,
      billType,
      billAuditFails: [],
      runTime: 0,
    }
    let runTime = Date.now()

    const billAuditPromises: Array<() => Promise<BillAudit | null>> = []
    for (const billNumber of billRange) {
      billAuditPromises.push(() =>
        auditBill(congress, billType, billNumber, baseCacePath, sftp),
      )
    }

    // batch process bill promises
    const billAudits = await batch(billAuditPromises, 10)
    congressHealthReport.billAuditFails = billAudits
    congressHealthReport.runTime = (Date.now() - runTime) / 1000
    return congressHealthReport
  }
}
