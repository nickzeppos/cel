import { createRouter } from './context'
import { z } from 'zod'

export const assetPlaygroundRouter = createRouter().mutation(
  'materialize-step-regex',
  {
    input: z.object({
      chamber: z.enum(['HOUSE', 'SENATE']),
    }),
    async resolve({ input, ctx }) {
      await ctx.queue.assetQueue.add('asset-job', input)
      return
    },
  },
)
