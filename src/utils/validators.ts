import { z } from 'zod'

export const billAssetMetadataValidator = z.object({
  missingBillNumbers: z.array(z.number()),
  lastPolicyRunTime: z.number(),
})

export const bioguidesAssetMetadataValidator = z.object({
  missingBioguides: z.array(z.string()),
  lastPolicyRunTime: z.number(),
})
