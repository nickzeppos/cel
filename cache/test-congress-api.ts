import { fetchCongressAPI } from './congress-api-fetch'
import dotenv from 'dotenv'
import { z } from 'zod'

// env
dotenv.config()
const API_KEYS = z
  .array(z.string())
  .refine((keys) => keys.length > 0)
  .parse(process.env.CONGRESS_GOV_API_KEYS?.split(','))

// types, consts
interface APIKeyManager {
  apiKeys: string[]
  switch: number
  getNextKey: () => string
}

type KeyBudgetMap = Map<
  string,
  { budget: number; refills: Array<number>; counted: number }
>

// funcs
// logger w/ timestamp
function log(message: string) {
  console.log(`[${new Date().toISOString()}] -- ${message}`)
}

// given an array of refill times, calculate the average refill period
// in practice, refillTimes are calls to Date.now() when token refresh events are detected
function calculateAverageRefillPeriod(refillTimes: number[]): number {
  const intervals = refillTimes.slice(1).map((time, i) => time - refillTimes[i])
  const totalInterval = intervals.reduce((acc, curr) => acc + curr, 0)
  return totalInterval / intervals.length
}

// given a url, apiKey, and number to deplete by, deplete the budget, return the final budget
async function depleteRequestBudget(
  url: string,
  key: string,
  depleteBy: number,
): Promise<number> {
  let budget: number | null = null
  for (let i = 0; i < depleteBy; i++) {
    const response = await fetchCongressAPI(url, 0, 1, key)
    if (i === depleteBy - 1) {
      budget = parseInt(response.headers.get('x-ratelimit-remaining')!)
    }
  }
  return budget!
}

async function depleteRequestBudget__MULTIPLE_KEYS(
  url: string,
  keyManager: APIKeyManager,
  depleteBy: number,
): Promise<KeyBudgetMap> {
  // Initialize a map to track key : budget, refills
  const keyBudgetMap: KeyBudgetMap = new Map<
    string,
    { budget: number; refills: Array<number>; counted: number }
  >()
  keyManager.apiKeys.forEach((key) =>
    keyBudgetMap.set(key, { budget: 0, refills: [], counted: 0 }),
  )
  // Make an initial depletion
  log(`Depleting by ${depleteBy} initially`)
  for (let i = 0; i < depleteBy; i++) {
    const key = keyManager.getNextKey()
    log(`fetching with ${key}`)
    const budget = await depleteRequestBudget(url, key, 1)
    keyBudgetMap.set(key, { budget, refills: [], counted: 0 })
  }
  return keyBudgetMap
}

// Static timeout, non-concurrent requests
export async function testRefillPeriod(
  url: string, // url to hit
  key: string, // api key to use
  depleteBy: number, // number of requests initiall deplete by
  periodsToCount: number, // number of refill periods to count
  timeout: number, // ms to wait between requests (this is what is "static")
) {
  // log
  log(`SINGLE KEY TESTING`)
  log(`Testing refill period for ${key}`)
  log(`Counting ${periodsToCount} refill periods`)
  log(`Waiting ${timeout}ms between requests`)

  // Make an initial depletion
  log(`Depleting by ${depleteBy} initially`)
  let onePreviousBudget = await depleteRequestBudget(url, key, depleteBy)
  log(`Initial budget: ${onePreviousBudget}`)

  // initialize an array to store detected refill times
  const refillTimes: number[] = []
  let refillsCalculated = 0

  log(`Starting monitor...`)
  while (true) {
    // while monitoring, deplete the budget by 1
    const newBudget = await depleteRequestBudget(url, key, 1)

    // log
    log(`Remaining: ${newBudget}`)

    // if our new budget is the same as the previous budget one fetch ago, we've detected a token replenish
    if (newBudget >= onePreviousBudget) {
      log(`Token replenish detected!`)
      refillTimes.push(Date.now())
    }

    // calculate average refill period each time we detect a refill beyond the first
    if (refillTimes.length > 1 && refillTimes.length > refillsCalculated) {
      const averageRefillPeriod = calculateAverageRefillPeriod(refillTimes)
      refillsCalculated = refillTimes.length
      log(`Average refill period: ${averageRefillPeriod}ms`)
    }

    // if we have enough refill times, break
    if (refillTimes.length === periodsToCount) {
      log(`Reached ${periodsToCount} refill periods, ending test`)
      break
    }

    // set the previous budget to the new budget
    onePreviousBudget = newBudget

    // wait for the timeout
    await new Promise((resolve) => setTimeout(resolve, timeout))
  }
}

async function testRefillPeriod__MULTIPLE_KEYS(
  url: string,
  keyManager: APIKeyManager,
  depleteBy: number,
  periodsToCount: number,
  timeout: number,
): Promise<void> {
  // log
  log(`MULTIKEY TESTING`)
  log(`Testing refill period for ${keyManager.apiKeys.join(', ')}`)
  log(`Counting ${periodsToCount} refill periods`)
  log(`Waiting ${timeout}ms between requests`)

  // Make an initial depletion
  const keyBudgetMap = await depleteRequestBudget__MULTIPLE_KEYS(
    url,
    keyManager,
    depleteBy,
  )

  // log key and budget for each key in keymap
  keyBudgetMap.forEach((value, key) => {
    log(`Initial budget for ${key.slice(0, 5)}...: ${value.budget}`)
  })

  while (true) {
    // while monitoring, get a key
    const key = keyManager.getNextKey()
    const keyEntry = keyBudgetMap.get(key)!
    const newBudget = await depleteRequestBudget(url, key, 1)

    log(`Remaining for ${key.slice(0, 5)}...: ${newBudget}`)

    // if new budget is >= budget one fetch ago, we've detected a token replenish event
    if (newBudget >= keyEntry.budget) {
      log(`Token replenish detected for ${key.slice(0, 5)}...!`)
      keyEntry.refills.push(Date.now())
    }

    // calculate average refill period each time we detect a refill beyond the first
    if (
      keyEntry.refills.length > 1 &&
      keyEntry.refills.length > keyEntry.counted
    ) {
      const averageRefillPeriod = calculateAverageRefillPeriod(
        keyBudgetMap.get(key)!.refills,
      )

      log(`Average refill period: ${averageRefillPeriod}ms`)
      keyEntry.counted++
    }

    // if we have refilled enough times, break
    if (
      keyEntry.refills.length === periodsToCount &&
      keyEntry.counted === periodsToCount
    ) {
      log(`Reached ${periodsToCount} refill periods, ending test`)
      break
    }

    // set the previous budget to the new budget
    keyEntry.budget = newBudget

    // set the key back into the map
    keyBudgetMap.set(key, keyEntry)

    // wait for the timeout
    await new Promise((resolve) => setTimeout(resolve, timeout))
  }
}

// test
const apiKeyManager = {
  apiKeys: API_KEYS,
  switch: 0,
  getNextKey(): string {
    const nextKey = this.apiKeys[this.switch]
    this.switch = (this.switch + 1) % this.apiKeys.length
    if (nextKey === undefined) throw new Error('No API keys available')
    return nextKey
  },
}

;(async () => {
  log('-----------------------------------')
  log('-----------------------------------')
  log(`Beginning test`)

  const firstKey = API_KEYS[0]
  const keyManager = apiKeyManager
  const depleteBy = 10
  const periodsToCount = 5
  const timeout = 5000
  const url = 'https://api.congress.gov/v3/bill'

  // single key test
  // await testRefillPeriod(url, firstKey, depleteBy, periodsToCount, timeout)

  // multiple key test
  await testRefillPeriod__MULTIPLE_KEYS(
    url,
    keyManager,
    depleteBy,
    periodsToCount,
    timeout,
  )
  log(`Finished testing`)
})()
