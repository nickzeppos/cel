import { AllMember } from '../workers/validators'
import { Chamber } from '@prisma/client'
import { format } from 'date-fns'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

// consts
const ROOT_CACHE_PATH = './data'

// utils
export function servedIncludes1973(served: AllMember['served']): boolean {
  if (served.Senate) {
    if (
      served.Senate.some(
        (term) => term.start <= 1973 && (term.end == null || term.end >= 1973),
      )
    ) {
      return true
    }
  }
  if (served.House) {
    if (
      served.House.some(
        (term) => term.start <= 1973 && (term.end == null || term.end >= 1973),
      )
    ) {
      return true
    }
  }
  return false
}

export function debug(key: string, message: string): void {
  console.debug(`[${key} | ${format(Date.now(), 'HH:mm:ss.SSS')}]: ${message}`)
}

export function error(key: string, message: string): void {
  console.error(`[${key} | ${format(Date.now(), 'HH:mm:ss.SSS')}]: ${message}`)
}

export function warn(key: string, message: string): void {
  console.warn(`[${key} | ${format(Date.now(), 'HH:mm:ss.SSS')}]: ${message}`)
}

export function isNotNull<T>(x: T | null): x is T {
  return x != null
}

export function writeFileSyncWithDir(
  ...args: Parameters<typeof writeFileSync>
) {
  const filename = args[0]
  if (typeof filename !== 'string') {
    throw new Error('we only know how to use string filenames!')
  }
  const dir = filename.split('/').slice(0, -1).join('/')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return writeFileSync(...args)
}

export function readUtf8File(filename: string): string {
  return readFileSync(filename, 'utf8')
}

export function getWriteMeta<M>(
  getMetaFilename: (chamber: Chamber, congress: number) => string,
  DEFAULT: M,
  validate: (data: unknown) => M,
  logKey: string,
): (chamber: Chamber, congress: number, updates: Partial<M>) => void {
  return function (chamber: Chamber, congress: number, updates: Partial<M>) {
    const filename = getMetaFilename(chamber, congress)
    let meta = { ...DEFAULT }
    try {
      const data = readUtf8File(filename)
      meta = validate(JSON.parse(data))
    } catch (e) {
      warn(
        logKey,
        `Unable to load metadata from ${filename}, using default value`,
      )
    }
    console.log('==============updates', updates)
    meta = {
      ...meta,
      ...updates,
    }
    // Object.assign(meta, updates)
    console.log('==============meta', meta)
    debug(logKey, `Writing meta ${filename}`)
    writeFileSyncWithDir(filename, JSON.stringify(meta))
  }
}

// higher order function for getting file names that ensures root cache path is prepended
// extends to constrain T to functions that takes any number of arguments and returns a string
// Parameters<T> to extract the type of the arguments of T, helping us infer the type of the returned
// function based on the arguments of the original function, T
export function withRootCachePath<T extends (...args: any[]) => string>(
  getFileName: T,
): (...funcArgs: Parameters<T>) => string {
  return (...args: Parameters<T>): string => {
    const path = getFileName(...args)
    return `${ROOT_CACHE_PATH}/${path}`
  }
}
