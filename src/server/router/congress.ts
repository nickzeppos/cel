import { fetchCongressAPI } from '../../workers/congressAPI'
import { createRouter } from './context'
import { z } from 'zod'

const congressResponseValidator = z.object({
  congress: z.object({
    endYear: z.string().length(4, { message: 'Must be 4 characters long' }),
    startYear: z.string().length(4, { message: 'Must be 4 characters long' }),
    name: z
      .string()
      .min(4)
      .max(5, { message: 'Must be between 4 and 5 characters long' }),
    number: z.number().int(),
    sessions: z.array(
      z.object({
        chamber: z.enum(['House of Representatives', 'Senate']),
        endDate: z.string(),
        number: z.number().int(),
        startDate: z.string(),
      }),
    ),
  }),
  request: z.object({
    congress: z.string(),
    contentType: z.string(),
    format: z.string(),
  }),
})

export const congressRouter = createRouter()
  .query('get-all', {
    async resolve({ ctx }) {
      return await ctx.prisma.congress.findMany({
        orderBy: {
          congress: 'desc',
        },
      })
    },
  })
  .mutation('get-cong-by-num', {
    input: z.object({ number: z.number() }),
    async resolve({ input, ctx }) {
      const {
        congress: { number, startYear, endYear },
      } = await fetchCongressAPI(`/${input.number}`)
        .then((res) => res.json())
        .then((json) => congressResponseValidator.parse(json))

      const congress = await ctx.prisma.congress.findFirst({
        where: { congress: number },
      })
      if (!congress) {
        await ctx.prisma.congress.create({
          data: {
            congress: number,
            startYear: startYear,
            endYear: endYear,
          },
        })
        return await ctx.prisma.congress.findFirst({
          where: {
            congress: number,
          },
        })
      }
      return congress
    },
  })
