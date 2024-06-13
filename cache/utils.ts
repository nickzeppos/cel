// utils for cel cache management
// imports
import dotenv from 'dotenv'
import { has } from 'fp-ts/lib/ReadonlyRecord'
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

// ssh file system methods, aliases
// Configuration for SSH connection

export namespace SSHfs {
  export async function directoryExists(
    sftp: SFTP,
    path: string,
  ): Promise<boolean | void> {
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

  export async function fileExists(sftp: SFTP, path: string) {
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
              resolve(false)
            }
            httpCheck = true
          }
        })
        stream.on('error', (err) => {
          console.error(err)
          resolve(false)
        })

        stream.on('end', () => {
          // try to parse and check for key
          try {
            const json = JSON.parse(buffer)
            if (json['bill'] !== undefined) {
              resolve(true)
            }
          } catch (e) {
            // if syntax error, it's invalid JSON
            if (!(e instanceof SyntaxError)) {
              stream.destroy()
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
              resolve(false)
            }
            httpCheck = true // only check once
          }
        })

        // Traditionally this would correspond to ENOENT, but I've already handled that with
        // fileExists() before streaming, so this is sort of unhandled behavior right now
        stream.on('error', (err) => {
          console.error(err)
          resolve(false)
        })

        stream.on('end', () => {
          // after we've streamed full file, check:
          // (1) it's valid json
          // (2) it has the expected key
          try {
            const json = JSON.parse(buffer)
            if (json['committees'] !== undefined) {
              resolve(true)
            }
          } catch (e) {
            // if syntax error, it's invalid JSON
            if (!(e instanceof SyntaxError)) {
              stream.destroy()
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
              resolve(false)
            }
            httpCheck = true
          }
        })

        stream.on('error', (err) => {
          console.error(err)
          resolve(false)
        })

        stream.on('end', () => {
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
            if (!(e instanceof SyntaxError)) {
              stream.destroy()
              resolve(false)
            }
          }
        })
      })
    })
  }
}
