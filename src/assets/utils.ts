import { AllMember } from '../workers/validators'
import { format } from 'date-fns'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

// consts
const ROOT_CACHE_PATH = './data'

// utils

// Range of integers, inclusive
export function makeRange(first: number, last: number): Array<number> {
  return Array.from({ length: last - first + 1 }, (_, i) => i + first)
}

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

export function getWriteMeta<M, A extends unknown[]>(
  getMetaFilename: (...args: A) => string,
  DEFAULT: M,
  validate: (data: unknown) => M,
  logKey: string,
): (updates: Partial<M>, ...args: A) => void {
  // return a function that
  return function (updates: Partial<M>, ...args: A) {
    // calculates metadata filename
    const filename = getMetaFilename(...args)
    let meta = { ...DEFAULT }
    try {
      // tries to read existing metadata file
      const data = readUtf8File(filename)
      meta = validate(JSON.parse(data))
    } catch (e) {
      warn(
        logKey,
        `Unable to load metadata from ${filename}, using default value`,
      )
    }
    // console.log('==============updates', updates)
    // updates metadata
    meta = {
      ...meta,
      ...updates,
    }
    // Object.assign(meta, updates)
    // console.log('==============meta', meta)
    debug(logKey, `Writing meta ${filename}`)
    // writes new metadata file
    writeFileSyncWithDir(filename, JSON.stringify(meta))
  }
}

// higher order function for getting file names that ensures root cache path is prepended
// extends to constrain T to functions that takes any number of arguments and returns a string
// Parameters<T> to extract the type of the arguments of T, helping us infer the type of the returned
// function based on the arguments of the original function, T
export function withRootCachePath<T extends (...args: any[]) => string>(
  makeFilePath: T,
): (...funcArgs: Parameters<T>) => string {
  return (...args: Parameters<T>): string => {
    const path = makeFilePath(...args)
    return `${ROOT_CACHE_PATH}/${path}`
  }
}

// given args a, b, return a/b.json
export function makeJSONFilePath<T extends any[]>(...args: T): string {
  return `${args.join('/')}.json`
}

// Given some possibly valid JSON content, try parsing.
// If successful, return { data, error = null }
// If unsuccessful, return { data = null, error }
export function safeParseJSON(
  content: string,
): { data: unknown; error: null } | { data: null; error: SyntaxError | Error } {
  try {
    return { data: JSON.parse(content), error: null }
  } catch (e) {
    // I know SyntaxError is what is thrown on invalid JSON, so I'm handling that specifically.
    if (e instanceof SyntaxError) {
      return { data: null, error: e }
    }
    // It's probably more appropriate to throw here, since if I don't get a syntax error either: I don't know what's going on, or
    // something has changed in the try that means something other than a syntax error can happen.
    throw e
  }
}

// Given some possibly valid JSON content, try parsing. Return true if successful, false otherwise.
export function isValidJSON(content: string): boolean {
  return safeParseJSON(content).data !== null
}

// Given a page number, convert it to the appropriate offset for the API, provided
// the imported page size limit.
export function pageNumberToOffset(pageNumber: number, limit: number) {
  return (pageNumber - 1) * limit
}
