// import fetch from 'isomorphic-fetch'
import { sleep } from '../utils/fp'
import IORedis from 'ioredis'
import fetch, { Headers, Request, Response } from 'node-fetch'

const API_KEY = process.env.CONGRESS_GOV_API_KEY_2 ?? ''
const API_BASE_URL = process.env.CONGRESS_GOV_API_BASE_URL ?? ''
const client = new IORedis({
  host: process.env.TEST ? 'localhost' : 'cel-cache',
  port: 6379,
  connectTimeout: 2000,
  lazyConnect: true,
})

const KEY = 'last-congress-api-call'

export function fetchCongressAPI(
  route: string,
  params: Record<string, string | number> = {},
): Promise<Response> {
  const searchParams = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, `${v}`])),
  )
  const req = new Request(
    `${API_BASE_URL}${route}?${searchParams.toString()}`,
    {
      method: 'get',
      headers: new Headers({
        accept: 'application/json',
        'x-api-key': `${API_KEY}`,
      }),
    },
  )
  console.log(`fetching ${req.url}`)
  return fetch(req)
}

const THROTTLE_TIMEOUT = 5000
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
