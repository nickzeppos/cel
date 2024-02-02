import { z } from 'zod'

const storedAssetStatusValidator = z.enum([
  'PENDING',
  'PASS',
  'FAIL',
  'FETCHING',
])
export const billsCountAssetEmitValidator = z.object({
  type: z.literal('billsCount'),
  status: storedAssetStatusValidator,
})
