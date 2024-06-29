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
import { throttledFetchCongressAPI } from '../src/workers/congressAPI'
import { BillType, CacheConfig } from './types'
import dotenv from 'dotenv'
import { writeFileSync } from 'fs'
import path from 'path'

// ENV + CONSTS
const envPath = path.join(__dirname, '.env')
dotenv.config({ path: envPath })
const CACHE_CONFIG_PATH =
  process.env.CACHE_CONFIG_PATH || './data/cache-config.json'
const API_BASE_URL = 'https://api.congress.gov/v3'
const CURRENT_CONGRESS = process.env.CURRENT_CONGRESS ?? '117'
const FIRST_CONGRESS = process.env.FIRST_CONGRESS ?? '93'
const MAX_RETRIES = 5
const API_KEYS = process.env.CONGRESS_GOV_API_KEYS?.split(',')

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

// Fetcher
const fetchRouteWithKey = throttledFetchCongressAPI

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
