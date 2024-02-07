// utils for generating cache report
// IMPORTS
import { existsSync, mkdirSync, readdirSync } from 'fs'

// CONSTS, ENV, TYPES
const ROOT_CACHE_PATH = process.env.CACHE_PATH || './data/bill/'
const CACHE_HEALTH_REPORT_PATH =
  process.env.CACHE_HEALTH_REPORT_PATH || './cache-health-reports/'
const CACHE_CONFIG_PATH =
  process.env.CACHE_CONFIG_PATH || './data/cache-config.json'

// FUNCS
// create a directory if it doesn't exist, always recursively
export function ensureDirectoryExists(path: string) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
  }
}

// list all directories in a directory
export function listDirsInCache(path?: string): string[] {
  const CACHE_PATH =
    path !== undefined ? `${ROOT_CACHE_PATH}/${path}` : `${ROOT_CACHE_PATH}`
  return readdirSync(CACHE_PATH, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory()) // dirent stands "directory entry", type Dirent
    .map((dirent) => dirent.name)
}

// check for existence of cache config
export function preReportRun(): 200 | 400 {
  // ensure we have a cache and health report directories
  ensureDirectoryExists(ROOT_CACHE_PATH)
  ensureDirectoryExists(CACHE_HEALTH_REPORT_PATH)

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
