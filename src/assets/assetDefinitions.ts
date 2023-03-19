import { Asset } from './assets.types'
import { readFileSync, writeFileSync } from 'fs'
import { z } from 'zod'

const ALWAYS_FETCH_POLICY = async () => false

export const membersCountAsset: Asset<number, [], []> = {
  name: 'membersCount',
  queue: 'congress-api-asset-queue',
  deps: [],
  policy: ALWAYS_FETCH_POLICY,
  write: () => async () => {
    return
  },
  read: async () => 0,
  create: () => async () => 0,
}

export const membersAsset: Asset<number, [], [typeof membersCountAsset]> = {
  name: 'members',
  queue: 'congress-api-asset-queue',
  deps: [membersCountAsset],
  policy: ALWAYS_FETCH_POLICY,
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
  policy: ALWAYS_FETCH_POLICY,
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
  policy: ALWAYS_FETCH_POLICY,
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
