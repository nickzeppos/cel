import fetch, { Request, Response } from 'node-fetch'

const API_KEY = process.env.CONGRESS_GOV_API_KEY ?? ''
const API_BASE_URL = process.env.CONGRESS_GOV_API_BASE_URL ?? ''

export function fetchCongressAPI(
  route: string,
  params: Record<string, string | number>,
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
  console.log(req)
  return fetch(req)
}
