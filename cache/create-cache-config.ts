/**
 * Script to generate a cache config file.
 *
 * WARNING: NOT idempotent. Will overwrite the existing config file.
 * WARNING: Makes external web API calls. Will not work if you are not connected to the internet.
 *
 * Config file can be understood as "source of truth" the the health report generator
 * script can use to compare against the actual cache.
 *
 */
// IMPORTS
import { BillType, CacheConfig } from './types'
import assert from 'assert'
import dotenv from 'dotenv'
import { writeFileSync } from 'fs'
import fetch, { Headers, Request, Response } from 'node-fetch'
import path, { basename } from 'path'
import { sleep } from 'react-query/types/core/utils'

// ENV + CONSTS
const envPath = path.join(__dirname, '.env')
dotenv.config({ path: envPath })
const ROOT_CACHE_PATH = process.env.CACHE_PATH || './data/bill/'
const CACHE_CONFIG_PATH =
  process.env.CACHE_CONFIG_PATH || './data/cache-config.json'
const API_BASE_URL =
  process.env.CONGRESS_GOV_API_BASE_URL ?? 'https://api.congress.gov/v3'
const CURRENT_CONGRESS = process.env.CURRENT_CONGRESS ?? '117'
const FIRST_CONGRESS = process.env.FIRST_CONGRESS ?? '93'
const MAX_RETRIES = 5

// need keys!
// TODO - - - Eventually only require one key. For now, since just Nick or Mike running, require both.
assert(
  process.env.CONGRESS_GOV_API_KEY_1,
  `CONGRESS_GOV_API_KEY_1 must be set in ${envPath}`,
)
assert(
  process.env.CONGRESS_GOV_API_KEY_2,
  `CONGRESS_GOV_API_KEY_2 must be set in ${envPath}`,
)

const API_KEY_1 = process.env.CONGRESS_GOV_API_KEY_1
const API_KEY_2 = process.env.CONGRESS_GOV_API_KEY_2

// console.log('-- ENV --')
// console.log('ROOT_CACHE_PATH', ROOT_CACHE_PATH)
// console.log('CACHE_CONFIG_PATH', CACHE_CONFIG_PATH)
// console.log('API_BASE_URL', API_BASE_URL)
// console.log('API_KEY_1', API_KEY_1)
// console.log('API_KEY_2', API_KEY_2)
// console.log('CURRENT_CONGRESS', CURRENT_CONGRESS)
// console.log('----------')

// FUNCS

// Range of integers, inclusive
function makeCongressRange(first: string, last: string): Array<number> {
  const firstNumber = parseInt(first)
  const lastNumber = parseInt(last)
  const range: Array<number> = []
  for (let i = firstNumber; i <= lastNumber; i++) {
    range.push(i)
  }
  return range
}

// key manager
const apiKeyManager = {
  apiKeys: [API_KEY_1, API_KEY_2],
  switch: 0,
  getNextKey(): string {
    const key = this.apiKeys[this.switch]
    this.switch = this.switch == 0 ? 1 : 0
    assert(
      key,
      `apiKeyManager: key - switch mismatch. key: ${key}, switch: ${this.switch}`,
    )
    return key
  },
}

// Fetcher
async function fetchRouteWithKey(route: string): Promise<Response> {
  const apiKey = apiKeyManager.getNextKey()
  const req = new Request(route, {
    method: 'get',
    headers: new Headers({
      accept: 'application/json',
      'x-api-key': `${apiKey}`,
    }),
  })
  for (let i = 0; i < MAX_RETRIES; i++) {
    await sleep(2500) // enforce rate limit
    try {
      const res = await fetch(req)
      return res
    } catch (e) {
      if (e instanceof Error) {
        console.log(`fetchRouteWithKey: ${e.message}`)
      } else {
        console.log(`fetchRouteWithKey: ${e}`)
      }
      await sleep(5000) // sleep 5s between retries
    }
  }
  throw new Error(`fetchRouteWithKey: failed to fetch ${route}`)
}

async function fetchBillCount(
  congress: number,
  billType: BillType,
): Promise<number> {
  const route = `${API_BASE_URL}/bill/${congress}/${billType}?limit=1`
  const res = await fetchRouteWithKey(route)
  const json = await res.json()
  const count = json['pagination']['count']
  return parseInt(count)
}

async function main() {
  const cacheConfigToWrite: CacheConfig = {
    header: {
      date: new Date(),
      script: basename(__filename),
    },
    bills: [],
  }

  const billTypes: Array<BillType> = ['hr', 's']
  // FOR EACH CONGRESS BETWEEN FIRST AND CURRENT
  const congresses = makeCongressRange(FIRST_CONGRESS, CURRENT_CONGRESS)
  for (const congress of congresses) {
    console.log(`fetching bill counts for congress ${congress}`)
    // FOR EACH BILL TYPE
    for (const billType of billTypes) {
      // FETCH BILL COUNT
      const count = await fetchBillCount(congress, billType)
      // ADD TO CONFIG
      cacheConfigToWrite.bills.push({
        congress: congress,
        billType: billType,
        count: count,
      })
    }
  }
  // WRITE CONFIG
  const cacheConfigString = JSON.stringify(cacheConfigToWrite, null, 2)
  writeFileSync(CACHE_CONFIG_PATH, cacheConfigString)
}

main()

export {}
