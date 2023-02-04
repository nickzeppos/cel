import {
  AssetJobData,
  AssetJobName,
  AssetJobResponse,
} from '../../workers/types'
import { createRouter } from './context'
import * as trpc from '@trpc/server'
import { Job, QueueEvents, QueueEventsListener } from 'bullmq'
import { z } from 'zod'

export const assetPlaygroundRouter = createRouter()
  .mutation('materialize-step-regex', {
    input: z.object({
      chamber: z.enum(['HOUSE', 'SENATE']),
    }),
    async resolve({ input, ctx }) {
      await ctx.queue.assetQueue.add('asset-job', input)
      return
    },
  })
  .subscription('on-change', {
    resolve({ ctx }) {
      return new trpc.Subscription<{ stepRegexes?: string; error?: string }>(
        (emit) => {
          const onCompleted: QueueEventsListener['completed'] = async (job) => {
            const j = await Job.fromId<
              AssetJobData,
              AssetJobResponse,
              AssetJobName
            >(ctx.queue.assetQueue, job.jobId)
            const stepRegexes = j?.returnvalue?.stepRegexes
            console.log(job.returnvalue)
            if (stepRegexes == null) {
              console.log('response is null')
              return
            }
            emit.data({ stepRegexes })
          }
          const onFailed: QueueEventsListener['failed'] = async (job) => {
            emit.data({ error: job.failedReason })
          }
          ctx.queue.assetQueueEvents.on('completed', onCompleted)
          ctx.queue.assetQueueEvents.on('failed', onFailed)
          return () => {
            ctx.queue.assetQueueEvents.off('completed', onCompleted)
            ctx.queue.assetQueueEvents.off('failed', onFailed)
          }
        },
      )
    },
  })
