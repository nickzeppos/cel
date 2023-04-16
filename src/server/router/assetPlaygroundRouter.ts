import {
  AssetName,
  billsAsset,
  billsCountAsset,
  getAssetForName,
  getAssetNames,
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
import { materializeValidator } from '../../workers/validators'
import { createRouter } from './context'
import { Chamber } from '@prisma/client'
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
    input: materializeValidator,
    async resolve({ input }) {
      const { assetName, ...restOfInput } = input
      const args = Object.values(restOfInput).filter((x) => x != null)
      materialize(getAssetForName(input.assetName), args)
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
  .query('get-bills-count-asset-state', {
    input: z.object({
      chamber: z.nativeEnum(Chamber),
      congress: z.number().min(93).max(117),
    }),
    async resolve({ input }) {
      const { chamber, congress } = input
      const billsCount = await billsCountAsset.read(chamber, congress)
      return {
        billsCount,
      }
    },
  })
  .query('get-bills-asset-state', {
    input: z.object({
      chamber: z.nativeEnum(Chamber),
      congress: z.number().min(93).max(117),
    }),
    async resolve({ input }) {
      const { chamber, congress } = input
      // console.log('get bills asset', chamber, congress)
      // const t0 = Date.now()
      const bills = await billsAsset.read(chamber, congress, null, null)
      const data: {
        pageStatuses: { file: string; status: string }[]
        // expectedPageCount: number
      } = await billsAsset.readMetadata?.(chamber, congress, null, null)
      // const t1 = Date.now()
      // console.log(`reading bills asset took ${t1 - t0} ms`)
      return {
        count: bills.length,
        pageStatuses: data.pageStatuses ?? [],
      }
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
