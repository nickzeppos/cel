import { createRouter } from './context'
import { z } from 'zod'

export const assetPlaygroundRouter = createRouter().mutation(
  'materialize-step-regex',
  {
    input: z.object({
      chamber: z.enum(['HOUSE', 'SENATE']),
    }),
    resolve({ input, ctx }) {
      console.log('materialize step regex for ', input.chamber)
      // add a job w/ input
      ctx.queue.assetQueue.add('asset-job', {
        chamber: input.chamber,
      })
      // necessitates creation of queue
      // job needs a worker to consume
      // worker will call materialize
      // get back data from worker
      // log it

      return
    },
  },
)
