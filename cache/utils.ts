// utils for cel cache management
// imports
import { BillAudit, CongressHealthReport } from './audit-cache'
import dotenv from 'dotenv'
import { existsSync, mkdirSync, readdirSync } from 'fs'
import SFTP from 'ssh2-promise/lib/BaseSFTP'

// env + consts
dotenv.config()
const CACHE_CONFIG_PATH = process.env.CACHE_CONFIG_PATH || './config.json'
const ROOT_CACHE_PATH = ''
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

// generic batcher
export async function batch<T>(
  asyncs: Array<() => Promise<T>>,
  batchSize: number,
): Promise<Array<T>> {
  const results: Array<T> = []
  for (let i = 0; i < asyncs.length; i += batchSize) {
    const batch = asyncs.slice(i, i + batchSize).map((async) => async())
    results.push(...(await Promise.all(batch)))
  }
  return results
}

// ssh file system methods, aliases
// Configuration for SSH connection

export namespace SSHfs {
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
  export async function auditChamber(
    billRange: number[],
    congress: number,
    billType: 'hr' | 's',
    baseCacePath: string,
    sftp: SFTP,
  ): Promise<CongressHealthReport> {
    console.log(`Auditing ${billRange.length} bills in ${congress} ${billType}`)
    const chamberPath = `${baseCacePath}/bill/${congress}/${billType}`
    const congressHealthReport: CongressHealthReport = {
      congress,
      billType,
      billAuditFails: [],
      runTime: 0,
    }
    let runTime = Date.now()
    let billAudits: Array<BillAudit> = []
    for (const billNum of billRange) {
      const billPath = `${chamberPath}/${billNum}`
      console.log(`Auditing bill at ${billPath}`)

      const [detailsAudit, committeesAudit, actionsAudit] = await Promise.all([
        auditDetailsFile(`${billPath}.json`, sftp),
        auditCommitteesFile(`${billPath}/committees.json`, sftp),
        auditActionsFile(`${billPath}/actions.json`, sftp),
      ])

      if (detailsAudit && committeesAudit && actionsAudit) {
        continue
      } else {
        billAudits.push({
          billNumber: billNum,
          details: detailsAudit,
          committees: committeesAudit,
          actions: actionsAudit,
        })
      }
    }
    congressHealthReport.billAuditFails = billAudits
    congressHealthReport.runTime = (Date.now() - runTime) / 1000
    return congressHealthReport
  }
}
