import { z } from 'zod'

export const storedAssetStatusValidator = z.enum([
  'PENDING',
  'PASS',
  'FAIL',
  'FETCHING',
  'COMPLETE',
])
export const billsCountAssetEmitValidator = z.object({
  type: z.literal('billsCount'),
  status: storedAssetStatusValidator,
})

export const billsAssetEmitValidator = z.object({
  type: z.literal('bills'),
  billStatuses: z.record(storedAssetStatusValidator),
})

export const membersCountAssetEmitValidator = z.object({
  type: z.literal('membersCount'),
  status: storedAssetStatusValidator,
})

export const pageStatusValidator = z.object({
  status: storedAssetStatusValidator,
  fileName: z.string(),
  pageNumber: z.number(),
})

export const allMembersAssetEmitValidator = z.object({
  type: z.literal('allMembers'),
  pageStatuses: z.array(pageStatusValidator),
})

export type StoredAssetStatus = z.infer<typeof storedAssetStatusValidator>
