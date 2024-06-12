// utils for cel cache management
// imports
import { BillType } from './types'
import dotenv from 'dotenv'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs'
import SFTP from 'ssh2-promise/lib/sftp'

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

    let json
    // validity
    try {
      const f = await sftp.readFile(path, 'utf-8')
      json = JSON.parse(f)
    } catch (e) {
      if (e instanceof SyntaxError) {
        return false
      }
    }

    // content
    if (json['bill'] === undefined) {
      return false
    }

    return true
  }

  export async function auditCommitteesFile(
    path: string,
    sftp: SFTP,
  ): Promise<boolean> {
    // existence
    if (!(await fileExists(sftp, path))) {
      return false
    }

    let json
    // validity
    try {
      const f = await sftp.readFile(path, 'utf-8')
      json = JSON.parse(f)
    } catch (e) {
      if (e instanceof SyntaxError) {
        return false
      }
    }

    // content
    if (json['committees'] === undefined) {
      return false
    }

    return true
  }

  export async function auditActionsFile(
    path: string,
    sftp: SFTP,
  ): Promise<boolean> {
    // existence
    if (!(await fileExists(sftp, path))) {
      return false
    }

    let json
    // validity
    try {
      const f = await sftp.readFile(path, 'utf-8')
      json = JSON.parse(f)
    } catch (e) {
      if (e instanceof SyntaxError) {
        return false
      }
    }

    // content
    if (json['actions'] === undefined) {
      return false
    }

    // length
    const count = json['pagination']['count']
    const actions = json['actions']
    if (count !== actions.length) {
      return false
    }

    return true
  }
}
