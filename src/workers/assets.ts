import { fetchCongressAPI } from './congressAPI'
import { allMemberResponseValidator } from './validators'
import { existsSync, readFileSync, writeFileSync } from 'fs'
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
  policies: (...deps: DataTypesOf<D>) => (...args: A) => Promise<boolean>
  materialize: (...deps: DataTypesOf<D>) => (...args: A) => Promise<T>
  persist: (data: T) => Promise<void>
  read: () => Promise<T>
}

const ALWAYS_FETCH_POLICY = async () => false

export const membersCountAsset: Asset<number, [], []> = {
  policies: () => ALWAYS_FETCH_POLICY,
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
      const int = parseInt(text)
      const schema = z.number().int().positive()
      return schema.parse(int)
    } catch (e) {
      console.error(e)
    }
    throw new Error('failed to read')
  },
}

export const membersBiouguideListAsset: Asset<
  string[],
  [offset: number, limit: number],
  [typeof membersCountAsset]
> = {
  policies: (membersCountAsset) => async (_offset: number, _limit: number) => {
    console.log('running  bioguide list policy')
    const exists = existsSync('./data/members-bioguide.txt')
    console.log(exists)
    if (exists) {
      const asset = await membersBiouguideListAsset.read()
      return asset.length === membersCountAsset ? true : false
    } else {
      return false
    }
  },
  materialize: (_membersCountAsset) => async (offset, limit) => {
    const rawRes = await fetchCongressAPI('/member', { limit, offset })
    const json = await rawRes.json()
    const { members } = allMemberResponseValidator.parse(json)
    return members.map((member) => member.bioguideId)
  },
  persist: async (bioguides) => {
    console.log('saving bioguides to file')
    const path = `./data/members-bioguides.txt`
    try {
      writeFileSync(path, `${bioguides.join('\n')}`, {
        encoding: 'utf8',
        flag: 'w',
      })
    } catch (e) {
      console.error(e)
    }
  },
  read: async () => {
    console.log('reading bioguides from file')
    try {
      const text = readFileSync(`/data/member-bioguides.txt`, {
        encoding: 'utf8',
        flag: 'r',
      })
      const stringArray = text.split('\n')
      return z.array(z.string()).parse(stringArray)
    } catch (e) {
      console.error(e)
    }
    throw new Error('Failed to read bioguides')
  },
}
