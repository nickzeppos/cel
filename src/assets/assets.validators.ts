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

export type BillsAssetEmitEvent = z.infer<typeof billsAssetEmitValidator>
export type StoredAssetStatus = z.infer<typeof storedAssetStatusValidator>
