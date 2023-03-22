import {
  AssetName,
  getAssetForName,
  getAssetNames,
  isAssetName,
  membersCountAsset,
  reportAsset,
} from '../../assets/assetDefinitions'
import { JobQueueName, isQueueName } from '../../assets/assets.types'
import { materialize } from '../../assets/engine'
import {
  CongressAPIAssetJobData,
  CongressAPIAssetJobName,
  CongressAPIAssetJobResponse,
  LocalAssetJobData,
  LocalAssetJobName,
  LocalAssetJobResponse,
} from '../../workers/types'
import { createRouter } from './context'
import * as trpc from '@trpc/server'
import { JobState, Queue, QueueEvents, QueueEventsListener } from 'bullmq'
import { z } from 'zod'

const EVENTS = ['active', 'added', 'waiting', 'completed', 'failed'] as const
type AssetJobChangeEvent = {
  assetName: AssetName
  jobState: JobState | 'unknown'
  childJobName: AssetName | null | undefined
}

export const assetPlaygroundRouter = createRouter()
  // query to get all asset names
  .query('asset-names', {
    resolve() {
      return getAssetNames()
    },
  })
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
      return new trpc.Subscription<AssetJobChangeEvent>((emit) => {
        const queues = {
          ['local-asset-queue']: ctx.queue.localAssetQueue,
          ['congress-api-asset-queue']: ctx.queue.congressApiAssetQueue,
        } as const
        const localHandlers = setupAssetJobChangeHandlers(
          ctx.queue.localAssetQueue,
          ctx.queue.localAssetQueueEvents,
          emit,
          queues,
        )
        const congressApiHandlers = setupAssetJobChangeHandlers(
          ctx.queue.congressApiAssetQueue,
          ctx.queue.congressAPIAssetQueueEvents,
          emit,
          queues,
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

function setupAssetJobChangeHandlers<
  JobData,
  JobResponse,
  JobName extends string,
>(
  queue: Queue<JobData, JobResponse, JobName>,
  queueEvents: QueueEvents,
  emit: trpc.SubscriptionEmit<AssetJobChangeEvent>,
  queues: {
    'local-asset-queue': Queue<
      LocalAssetJobData,
      LocalAssetJobResponse,
      LocalAssetJobName
    >
    'congress-api-asset-queue': Queue<
      CongressAPIAssetJobData,
      CongressAPIAssetJobResponse,
      CongressAPIAssetJobName
    >
  },
) {
  const getAndEmitJob = async (jobId: string) => {
    const job = await queue.getJob(jobId)
    if (job == null) return

    const assetName = job.name as AssetName
    const jobState = await job.getState()
    const deps = await job.getDependencies()

    const childJobKey =
      getOnlyJobKey(Object.keys(deps.processed ?? {})) ??
      getOnlyJobKey(deps.unprocessed)

    let childJobName: AssetName | null = null
    if (childJobKey != null) {
      const { jobId, queueName } = childJobKey
      const childJob = await queues[queueName].getJob(jobId)
      if (childJob == null) return
      childJobName = childJob.name as AssetName
    }

    emit.data({ assetName, jobState, childJobName })
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

function parseJobKey(key: string) {
  const [, queueName, jobId] = key.split(':')
  if (queueName == null || jobId == null) throw new Error('Invalid job key')
  if (!isQueueName(queueName)) throw new Error('Invalid queue name')
  return { queueName, jobId }
}

function getOnlyJobKey(
  keys?: string[],
): { queueName: JobQueueName; jobId: string } | null {
  if (keys == null || keys.length === 0) return null
  if (keys.length > 1)
    throw new Error('Multiple keys found when expecting 1 or 0')
  return parseJobKey(keys[0]!)
}

function cleanupAssetJobChangeHandlers(
  queue: QueueEvents,
  handlers: Partial<QueueEventsListener>,
) {
  EVENTS.forEach((event) => {
    if (handlers[event] != null) queue.off(event, handlers[event]!)
  })
}
