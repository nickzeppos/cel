// import fetch from 'isomorphic-fetch'
import { sleep } from '../utils/fp'
import { deriveThrottleTimeout } from './utils'
import IORedis from 'ioredis'
import fetch, { Headers, Request, Response } from 'node-fetch'
import { z } from 'zod'

const API_KEYS = process.env.CONGRESS_GOV_API_KEYS?.split(',')
const API_BASE_URL = 'https://api.congress.gov/v3'

const client = new IORedis({
  host: process.env.TEST ? 'localhost' : 'cel-cache',
  port: 6379,
  connectTimeout: 2000,
  lazyConnect: true,
})

const KEY = 'last-congress-api-call'

// key manager
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

export function fetchCongressAPI(
  route: string,
  params: Record<string, string | number> = {},
): Promise<Response> {
  const searchParams = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, `${v}`])),
  )
  const apiKey = apiKeyManager.getNextKey()
  const req = new Request(
    `${API_BASE_URL}${route}?${searchParams.toString()}`,
    {
      method: 'get',
      headers: new Headers({
        accept: 'application/json',
        'x-api-key': `${apiKey}`,
      }),
    },
  )
  return fetch(req)
}

export const THROTTLE_TIMEOUT = deriveThrottleTimeout(API_KEYS)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const throttle = <R, T extends (...args: Array<any>) => Promise<R>>(
  func: T,
): ((...args: Parameters<T>) => Promise<R>) => {
  function wrapped(...args: Parameters<T>): Promise<R> {
    return client
      .connect()
      .then(() => client.get(KEY))
      .then((lastCallStr) => Number.parseInt(lastCallStr ?? '0'))
      .then((lastCallTimestamp) => Date.now() - lastCallTimestamp)
      .then(async (lastCallDelta) => {
        if (lastCallDelta < THROTTLE_TIMEOUT) {
          const d = THROTTLE_TIMEOUT - lastCallDelta
          await sleep(d)
        }
      })
      .then(async () => {
        client.set(KEY, Date.now()).then(() => {
          client.disconnect()
        })
        return await func(...args)
      })
  }
  return wrapped
}

// TODO: figure out how to not require explicitly typing the generics here
export const throttledFetchCongressAPI = throttle<
  Response,
  typeof fetchCongressAPI
>(fetchCongressAPI)
