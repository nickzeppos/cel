import {
  getAssetNames,
  isAssetName,
  membersCountAsset,
  reportAsset,
} from '../../assets/assetDefinitions'
import { materialize } from '../../assets/engine'
import {
  AssetJobData,
  AssetJobName,
  AssetJobResponse,
} from '../../workers/types'
import { createRouter } from './context'
import * as trpc from '@trpc/server'
import { Job, QueueEventsListener } from 'bullmq'
import { z } from 'zod'

export const assetPlaygroundRouter = createRouter()
  .mutation('materialize', {
    input: z.object({
      chamber: z.enum(['HOUSE', 'SENATE']),
      congress: z.number().min(93).max(117),
      assetName: z.string().refine(isAssetName),
      minBillNum: z.number().nullish(),
      maxBillNum: z.number().nullish(),
    }),
    async resolve({ input, ctx }) {
      console.log(input)
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
  .mutation('materialize-members-count', {
    async resolve({ ctx }) {
      materialize(membersCountAsset)
      return
    },
  })
  .mutation('materialize-report', {
    async resolve({ ctx }) {
      materialize(reportAsset)
      return
    },
  })
