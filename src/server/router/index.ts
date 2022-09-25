// src/server/router/index.ts
import { createRouter } from './context'
import superjson from 'superjson'
import { z } from 'zod'
import { apiFetch } from '../patterns/fetching'
import fetch from 'node-fetch'
import { Chambress, Chamber } from '@prisma/client'

const API_KEY = process.env.CONGRESS_GOV_API_KEY
const API_BASE_URL = process.env.CONGRESS_GOV_API_BASE_URL

const ChamberEnum = z.enum(['House of Representatives', 'Senate'])
type ChamberEnum = z.infer<typeof ChamberEnum>
const ChamberEnumToPrismaChamber: Record<ChamberEnum, Chamber> = {
  'House of Representatives': Chamber.HOUSE,
  Senate: Chamber.SENATE,
}
const PrismaChamberToChamberEnum: Record<Chamber, ChamberEnum> = {
  [Chamber.HOUSE]: 'House of Representatives',
  [Chamber.SENATE]: 'Senate',
}

// Responses as a zod objects and types using z.infer()
const congressResponseValidator = z.object({
  endYear: z.string().length(4, { message: 'Must be 4 characters long' }),
  startYear: z.string().length(4, { message: 'Must be 4 characters long' }),
  name: z
    .string()
    .min(4)
    .max(5, { message: 'Must be between 4 and 5 characters long' }),
  number: z
    .number()
    .int()
    // this is probably excessive
    .min(93)
    .max(117, {
      message: `Must be in range 93-${117}`,
    }),
  sessions: z.array(
    z.object({
      chamber: ChamberEnum,
      endDate: z.string(),
      number: z.number().int(),
      startDate: z.string(),
    }),
  ),
})

const fullResponseValidator = z.array(
  z.object({
    congress: congressResponseValidator,
  }),
)

type CongressResponse = z.infer<typeof congressResponseValidator>
type FullResponse = z.infer<typeof fullResponseValidator>

export const appRouter = createRouter()
  .transformer(superjson)
  .query('get-all-cong', {
    async resolve({ ctx }) {
      return await ctx.prisma.congress.findMany({
        orderBy: {
          congress: 'desc',
        },
      })
    },
  })
  .mutation('create-chambresses', {
    async resolve({ ctx }) {
      const res = await fetch(`${API_BASE_URL}/congress?api_key=${API_KEY}`, {
        headers: { accept: 'application/json' },
      })
      const allCongresses = fullResponseValidator.parse(await res.json())
      const chambresses = allCongresses
        .filter((c) => c.congress.number >= 93)
        .flatMap(({ congress: { number } }) => [
          { congress: number, chamber: Chamber.HOUSE },
          { congress: number, chamber: Chamber.SENATE },
        ])
      return await ctx.prisma.chambress.createMany({
        data: chambresses,
        skipDuplicates: true,
      })
    },
  })
  .query('get-chambresses', {
    async resolve({ ctx }) {
      return await ctx.prisma.chambress.findMany()
    },
  })
  .mutation('get-cong-by-num', {
    input: z.object({ number: z.number() }),
    async resolve({ input, ctx }) {
      const congressResponse = await apiFetch(input.number)
      let congress = await ctx.prisma.congress.findFirst({
        where: { congress: congressResponse.number },
      })
      if (!congress) {
        await ctx.prisma.congress.create({
          data: {
            congress: congressResponse.number,
            startYear: congressResponse.startYear,
            endYear: congressResponse.endYear,
          },
        })
        return await ctx.prisma.congress.findFirst({
          where: {
            congress: congressResponse.number,
          },
        })
      }
      return congress
    },
  })

// export type definition of API
export type AppRouter = typeof appRouter
