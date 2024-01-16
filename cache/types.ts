import { z } from 'zod'

export type CacheConfig = {
  header: {
    date: Date
    script: string
  }
  bills: Array<BillCongressConfig>
}

export type BillCongressConfig = {
  congress: number
  billType: BillType
  count: number
}

// Zod stuff
export const billTypeValidator = z.enum(['hr', 's'])
export type BillType = z.infer<typeof billTypeValidator>
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
