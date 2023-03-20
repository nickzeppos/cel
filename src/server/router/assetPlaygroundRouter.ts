import {
  AssetName,
  getAssetForName,
  isAssetName,
  membersCountAsset,
  reportAsset,
} from '../../assets/assetDefinitions'
import { materialize } from '../../assets/engine'
import { createRouter } from './context'
import * as trpc from '@trpc/server'
import { JobState, Queue, QueueEvents, QueueEventsListener } from 'bullmq'
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
    async resolve({ input }) {
      console.log(input)
      materialize(getAssetForName(input.assetName))
      return
    },
  })
  .subscription('on-change', {
    resolve({ ctx }) {
      return new trpc.Subscription<{
        assetName: AssetName
        jobState: JobState | 'unknown'
      }>((emit) => {
        const localHandlers = setupAssetJobChangeHandlers(
          ctx.queue.localAssetQueue,
          ctx.queue.localAssetQueueEvents,
          emit,
        )
        const congressApiHandlers = setupAssetJobChangeHandlers(
          ctx.queue.congressApiAssetQueue,
          ctx.queue.congressAPIAssetQueueEvents,
          emit,
        )

        return () => {
          cleanupAssetJobChangeHandlers(
            ctx.queue.localAssetQueueEvents,
            localHandlers,
          )
          cleanupAssetJobChangeHandlers(
            ctx.queue.congressAPIAssetQueueEvents,
            congressApiHandlers,
          )
        }
      })
    },
  })
  .mutation('materialize-members-count', {
    async resolve({}) {
      materialize(membersCountAsset)
      return
    },
  })
  .mutation('materialize-report', {
    async resolve({}) {
      materialize(reportAsset)
      return
    },
  })

const EVENTS = ['active', 'added', 'waiting', 'completed', 'failed'] as const

function setupAssetJobChangeHandlers<
  JobData,
  JobResponse,
  JobName extends string,
>(
  queue: Queue<JobData, JobResponse, JobName>,
  queueEvents: QueueEvents,
  emit: trpc.SubscriptionEmit<{
    assetName: AssetName
    jobState: JobState | 'unknown'
  }>,
) {
  const getAndEmitJob = async (jobId: string) => {
    const job = await queue.getJob(jobId)
    if (job == null) return

    const assetName = job.name as AssetName
    const jobState = await job.getState()
    emit.data({ assetName, jobState })
  }

  const handlers: Partial<QueueEventsListener> = {
    async active({ jobId }) {
      await getAndEmitJob(jobId)
    },
    async added({ jobId }) {
      await getAndEmitJob(jobId)
    },
    async waiting({ jobId }) {
      await getAndEmitJob(jobId)
    },
    async completed({ jobId }) {
      await getAndEmitJob(jobId)
    },
    async failed({ jobId }) {
      await getAndEmitJob(jobId)
    },
  }

  EVENTS.forEach((event) => {
    if (handlers[event] != null) queueEvents.on(event, handlers[event]!)
  })

  return handlers
}

function cleanupAssetJobChangeHandlers(
  queue: QueueEvents,
  handlers: Partial<QueueEventsListener>,
) {
  EVENTS.forEach((event) => {
    if (handlers[event] != null) queue.off(event, handlers[event]!)
  })
}
