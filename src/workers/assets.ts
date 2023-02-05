import { fetchCongressAPI } from './congressAPI'
import { allMemberResponseValidator } from './validators'
import { readFileSync, writeFileSync } from 'fs'
import { z } from 'zod'

export type DataTypeOf<A> = A extends Asset<infer DataType, any, any>
  ? DataType
  : never
export type AnyAsset = Asset<any, any, any>
export type AssetArray = Array<AnyAsset>
export type DataTypesOf<T extends AssetArray> = {
  [K in keyof T]: DataTypeOf<T[K]>
}

export type Asset<
  T,
  A extends Array<any>,
  D extends Array<Asset<any, any, any>>,
> = {
  policies: (...args: A) => boolean
  materialize: (...deps: DataTypesOf<D>) => (...args: A) => Promise<T>
  persist: (data: T) => Promise<void>
  read: (...args: A) => Promise<T>
}

const ALWAYS_FETCH_POLICY = () => false

export const membersCountAsset: Asset<number, [], []> = {
  policies: ALWAYS_FETCH_POLICY,
  materialize: () => async () => {
    console.log('IM INSIDE MATERIALIZED')
    const rawRes = await fetchCongressAPI('/member', { limit: 1 })
    const json = await rawRes.json()
    const data = allMemberResponseValidator.parse(json)
    const { count } = data.pagination
    return count
  },
  persist: async (count) => {
    console.log('saving count to file')
    try {
      writeFileSync('./data/members-count.txt', `${count}`, {
        encoding: 'utf8',
        flag: 'w',
      })
    } catch (e) {
      console.error(e)
    }
  },
  read: async () => {
    console.log('reading count from file')
    try {
      const text = readFileSync('./data/members-count.txt', {
        encoding: 'utf8',
        flag: 'r',
      })
      return z.number().int().positive().parse(text)
    } catch (e) {
      console.error(e)
    }
    throw new Error('failed to read')
  },
}
