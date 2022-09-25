import fetch from "node-fetch"
import { z } from "zod"

const API_KEY = process.env.CONGRESS_GOV_API_KEY
const API_BASE_URL = process.env.CONGRESS_GOV_API_BASE_URL
const CURRENT_CONGRESS = process.env.CURRENT_CONGRESS
  ? parseInt(process.env.CURRENT_CONGRESS)
  : 117

// Responses as a zod objects and types using z.infer()
const congressResponseValidator = z.object({
  endYear: z.string().length(4, { message: "Must be 4 characters long" }),
  startYear: z.string().length(4, { message: "Must be 4 characters long" }),
  name: z
    .string()
    .min(4)
    .max(5, { message: "Must be between 4 and 5 characters long" }),
  number: z
    .number()
    .int()
    // this is probably excessive
    .min(93)
    .max(CURRENT_CONGRESS, {
      message: `Must be in range 93-${CURRENT_CONGRESS}`,
    }),
  sessions: z.array(
    z.object({
      chamber: z.enum(["House of Representatives", "Senate"]),
      endDate: z.string(),
      number: z.number().int(),
      startDate: z.string(),
    })
  ),
})

const fullResponseValidator = z.object({
  congress: congressResponseValidator,
  request: z.object({
    congress: z.string(),
    contentType: z.string(),
    format: z.string(),
  }),
})

type CongressResponse = z.infer<typeof congressResponseValidator>
type FullResponse = z.infer<typeof fullResponseValidator>

export const apiFetch = async (
  congressNumber: number
): Promise<CongressResponse> => {
  const res = await fetch(
    `${API_BASE_URL}/${congressNumber.toString()}?api_key=${API_KEY}`,
    { headers: { accept: "application/json" } }
  )
  const apiRes = (await res.json()) as FullResponse
  return apiRes.congress
}
