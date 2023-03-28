import { fetchCongressAPI } from '../workers/congressAPI'
import {
  allBillResponseValidator,
  allMemberResponseValidator,
} from '../workers/validators'
import { AnyAsset, Asset } from './assets.types'
import { Chamber } from '@prisma/client'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { z } from 'zod'

// Policy constants
const ALWAYS_FETCH_POLICY = async () => false
const NEVER_FETCH_POLICY = async () => true
const ONE_DAY_REFRESH = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export const membersCountAsset: Asset<number, [], []> = {
  name: 'membersCount',
  queue: 'congress-api-asset-queue',
  deps: [],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: async () => {
    // if meta file doesn't exist, policy fails
    if (!existsSync(`./data/${membersCountAsset.name}-meta.json`)) {
      return false
    }
    // if meta file exists, compare to current time
    const lastUpdated = readFileSync(
      `./data/${membersCountAsset.name}-meta.json`,
      'utf8',
    )
    const lastUpdatedDate = new Date(lastUpdated)
    const now = new Date()
    const diff = now.getTime() - lastUpdatedDate.getTime()
    // if diff is greater than refresh period, policy fails
    return diff > membersCountAsset.refreshPeriod
  },
  write: () => async (count) => {
    writeFileSync(`./data/${membersCountAsset.name}.json`, count.toString())
    writeFileSync(
      `./data/${membersCountAsset.name}-meta.json`,
      new Date().toString(),
    )
  },
  read: async () => {
    const countString = readFileSync(
      `./data/${membersCountAsset.name}.json`,
      'utf8',
    )
    const count = parseInt(countString)
    return z.number().parse(count)
  },
  create: () => async () => {
    const res = await fetchCongressAPI('/member', { limit: 1 })
    const json = await res.json()
    return allMemberResponseValidator.parse(json).pagination.count
  },
}

export const membersAsset: Asset<number, [], [typeof membersCountAsset]> = {
  name: 'members',
  queue: 'congress-api-asset-queue',
  deps: [membersCountAsset],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: NEVER_FETCH_POLICY,
  write: () => async () => {
    return
  },
  read: async () => 0,
  create: () => async () => 0,
}

export const bioguidesAsset: Asset<number, [], [typeof membersAsset]> = {
  name: 'bioguides',
  queue: 'congress-api-asset-queue',
  deps: [membersAsset],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: NEVER_FETCH_POLICY,
  write: () => async () => {
    return
  },
  read: async () => 0,
  create: () => async () => 0,
}

export const billsCountAsset: Asset<number, [Chamber, number], []> = {
  name: 'billsCount',
  queue: 'congress-api-asset-queue',
  deps: [],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: ALWAYS_FETCH_POLICY,
  write: (args) => async (count) => {
    const [chamber, congress] = args
    writeFileSync(
      `./data/${billsCountAsset.name}-${congress}-${chamber}.json`,
      count.toString(),
    )
  },
  read: async (args) => {
    const [chamber, congress] = args
    const countString = readFileSync(
      `./data/${billsCountAsset.name}-${congress}-${chamber}.json`,
      'utf8',
    )
    const count = parseInt(countString)
    return z.number().parse(count)
  },
  create: (args) => async () => {
    const [chamber, congress] = args
    const billType = chamber === 'HOUSE' ? 'hr' : 's'
    const res = await fetchCongressAPI(`/bill/${congress}/${billType}`, {
      limit: 1,
    })
    const json = await res.json()
    return allBillResponseValidator.parse(json).pagination.count
  },
}

export const actionsAsset: Asset<number, [], [typeof billsCountAsset]> = {
  name: 'actions',
  queue: 'congress-api-asset-queue',
  deps: [billsCountAsset],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: NEVER_FETCH_POLICY,
  write: () => async () => {
    return
  },
  read: async () => 0,
  create: () => async () => 0,
}

export const billsAsset: Asset<number, [], [typeof billsCountAsset]> = {
  name: 'bills',
  queue: 'congress-api-asset-queue',
  deps: [billsCountAsset],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: ALWAYS_FETCH_POLICY,
  write: () => async () => {
    return
  },
  read: async () => 0,
  create: () => async () => 0,
}

export const reportAsset: Asset<
  string,
  [],
  [
    typeof bioguidesAsset,
    typeof membersAsset,
    typeof billsAsset,
    typeof actionsAsset,
  ]
> = {
  name: 'report',
  queue: 'local-asset-queue',
  deps: [bioguidesAsset, membersAsset, billsAsset, actionsAsset],
  refreshPeriod: ONE_DAY_REFRESH,
  policy: ALWAYS_FETCH_POLICY,
  write: () => async () => {
    return
  },
  read: async () => '',
  create: () => async () => '',
}

export type AssetNameOf<T extends AnyAsset> = T['name']

const allAssets = {
  membersCount: membersCountAsset,
  members: membersAsset,
  bioguides: bioguidesAsset,
  billsCount: billsCountAsset,
  actions: actionsAsset,
  bills: billsAsset,
  report: reportAsset,
} as const

export type AssetName = keyof typeof allAssets

export function getAssetForName(name: AssetName): AnyAsset {
  return allAssets[name]
}

export function getAssetNames(): AssetName[] {
  return Object.keys(allAssets) as AssetName[]
}

export function isAssetName(name: string): name is AssetName {
  return name in allAssets
}
