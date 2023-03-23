import { fetchCongressAPI } from '../workers/congressAPI'
import { allMemberResponseValidator } from '../workers/validators'
import { AnyAsset, Asset } from './assets.types'
import { readFileSync, writeFileSync } from 'fs'
import { z } from 'zod'

const ALWAYS_FETCH_POLICY = async () => false
const NEVER_FETCH_POLICY = async () => true

export const membersCountAsset: Asset<number, [], []> = {
  name: 'membersCount',
  queue: 'congress-api-asset-queue',
  deps: [],
  policy: ALWAYS_FETCH_POLICY,
  write: () => async (count) => {
    writeFileSync('./data/membersCount.json', count.toString())
  },
  read: async () => {
    const countString = readFileSync('./data/membersCount.json', 'utf8')
    const count = parseInt(countString)
    return z.number().parse(count)
  },
  create: () => async () => {
    console.log('creating members count')
    const res = await fetchCongressAPI('/member', { limit: 1 })
    const json = await res.json()
    return allMemberResponseValidator.parse(json).pagination.count
  },
}

export const membersAsset: Asset<number, [], [typeof membersCountAsset]> = {
  name: 'members',
  queue: 'congress-api-asset-queue',
  deps: [membersCountAsset],
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
  policy: NEVER_FETCH_POLICY,
  write: () => async () => {
    return
  },
  read: async () => 0,
  create: () => async () => 0,
}

export const billsCountAsset: Asset<number, [], []> = {
  name: 'billsCount',
  queue: 'congress-api-asset-queue',
  deps: [],
  policy: ALWAYS_FETCH_POLICY,
  write: () => async () => {
    return
  },
  read: async () => 0,
  create: () => async () => 0,
}

export const actionsAsset: Asset<number, [], [typeof billsCountAsset]> = {
  name: 'actions',
  queue: 'congress-api-asset-queue',
  deps: [billsCountAsset],
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
