import { z } from 'zod'

export const billsListAssetMetadataValidator = z.object({
  pagesToFetch: z.array(z.number()),
  lastPolicyRunTime: z.number(),
})

export const billAssetMetadataValidator = z.object({
  missingBillNumbers: z.array(z.number()),
  lastPolicyRunTime: z.number(),
})

export const pageStatusValidator = z.object({
  file: z.string(),
  status: z.string(),
})

export const bioguidesAssetMetadataValidator = z.object({
  missingBioguides: z.array(z.string()),
  lastPolicyRunTime: z.number(),
})
