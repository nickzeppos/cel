import { z } from 'zod'

export const billTypeValidator = z.enum(['hr', 's'])
export type BillType = z.infer<typeof billTypeValidator>

export const cacheConfigValidator = z.object({
  header: z.object({
    script: z.string(),
    date: z.string(),
  }),
  bills: z.array(
    z.object({
      congress: z.number(),
      billType: billTypeValidator,
      count: z.number(),
    }),
  ),
})
export type CacheConfig = z.infer<typeof cacheConfigValidator>

export const sysArgsValidator = z
  .object({
    full: z.boolean().optional(),
    congress: z
      .string()
      .optional()
      .transform((congress) =>
        congress === undefined ? undefined : parseInt(congress, 10),
      ),
    billType: billTypeValidator.optional(),
    billNumber: z
      .string()
      .optional()
      .transform((billNumber) =>
        billNumber === undefined ? undefined : parseInt(billNumber, 10),
      ),
  })
  // refine api is unintuitive.
  // if the function returns true, the validation passes
  // if the function returns false, the validation fails
  // i expected it to be if function passes, message proceeds
  // but it's the opposite!
  // like our asset policies, i guess.
  .refine(
    (params) =>
      !(
        params.full &&
        (params.congress || params.billType || params.billNumber)
      ),
    {
      message: 'Full audit cannot be run with other params',
    },
  )
  .refine((params) => params.full || params.congress, {
    message: 'If full audit is false, congress must be set',
  })
  .refine(
    (params) => !(params.congress && params.billNumber) || params.billType,
    {
      message: 'If congress and billNumber are set, billType must be set',
    },
  )

export type BillFileType = 'bill' | 'actions' | 'committees'
export type BillFailures = {
  billNumber: number
  billType: BillType
  fileType: BillFileType
}
export type CongressHealthReport = {
  congress: number
  healthy: boolean
  ratio: number
  failures: Array<BillFailures>
}
export type CacheHealthReport = {
  header: {
    runDate: Date
    script: string
    type: 'full' | 'current'
  }
  overallHealth: {
    healthy: boolean
    ratio: number
  }
  healthByCongress: Array<CongressHealthReport>
}
