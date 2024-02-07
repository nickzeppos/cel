import { isAssetName } from '../../assetDefinitions'
import { Chamber } from '.prisma/client'
import { z } from 'zod'

// TODO: next time we change any typing around args
// we should refactor to derive all args types from this
// validator.

export const materializeValidator = z.object({
  chamber: z.nativeEnum(Chamber),
  congress: z.number().min(93).max(117),
  assetName: z.string().refine(isAssetName),
  minBillNum: z.number().nullish(),
  maxBillNum: z.number().nullish(),
})
