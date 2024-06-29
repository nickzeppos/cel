// imports
import dotenv from 'dotenv'
import fetch, { Headers, Request, Response } from 'node-fetch'
import { z } from 'zod'

// env
dotenv.config()
const API_KEYS = z
  .array(z.string())
  .refine((keys) => keys.length > 0)
  .parse(process.env.CONGRESS_GOV_API_KEYS?.split(','))

// fetcher and fetcher utils

// api key manager
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
// sleep (ms)
async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
const RATE_LIMIT_PER_HOUR = 5000 // As of 6/24/2024, api.congress.gov has a rate limit of 5k per hour per key
// Calculate the fetch timeout (ms) based on the number of api keys and the rate limit
function calculateFetchTimeout(apiKeys: string[], rateLimit: number): number {
  const maxRequestsPerSecond = (apiKeys.length * rateLimit) / 3600
  return 1000 / maxRequestsPerSecond
}
const TIMEOUT_MS = calculateFetchTimeout(API_KEYS, RATE_LIMIT_PER_HOUR)
const RETRY_LIMIT = 2

export async function fetchCongressAPI(
  route: string,
  offset: number = 0,
  limit: number = 250,
  apiKey: string,
): Promise<Response> {
  const url = `${route}?limit=${limit}&offset=${offset}`
  const request = new Request(url, {
    method: 'get',
    headers: new Headers({
      accept: 'application/json',
      'x-api-key': `${apiKey}`,
    }),
  })
  return await fetch(request)
}

export async function fetchWithRetry(
  route: string,
  offset: number = 0,
  limit: number = 250,
): Promise<ReturnType<Response['json']> | undefined> {
  // fetch with retries
  let attempt = 1
  let response: Response | undefined = undefined
  const key = apiKeyManager.getNextKey()

  while (attempt < RETRY_LIMIT) {
    console.log(`Fetching -- ${route}`)
    console.log(`Attempt -- ${attempt}`)
    console.log(`Using key -- ${key}`)
    response = await fetchCongressAPI(route, offset, limit, key)
    console.log(response.headers)

    // break on success
    if (response.status === 200) {
      console.log(`Successfully fetched ${route} on attempt ${attempt}`)
      break
    }

    // backoff on 429
    if (response.status === 429) {
      sleep(2 ** attempt * TIMEOUT_MS)
      continue
    }
    // increment attempt on failure
    attempt++
    console.log(`Failed to fetch ${route}, retrying for attempt ${attempt}`)
  }

  // After fetch + retries
  // if response is undefined, log and return
  if (!response) {
    console.log(`Failed to fetch ${route}, undefined return`)
    return response
  }

  // if repsonse is not 200, log, parse, and return
  if (response.status !== 200) {
    console.log(`Failed to fetch ${route}, status code: ${response.status}`)
    return await response.json()
  }

  // if successful, parse and return
  console.log(`Done fetching ${route}`)
  return await response.json()
}
