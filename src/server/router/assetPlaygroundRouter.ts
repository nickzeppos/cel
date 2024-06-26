import {
  AssetName,
  getAssetForName,
  getAssetNames,
} from '../../../assetDefinitions'
import { allMembersAsset } from '../../assets/allMembers.asset'
import { JobQueueName, isQueueName } from '../../assets/assets.types'
import {
  allMembersAssetEmitValidator,
  billsAssetEmitValidator,
  billsCountAssetEmitValidator,
  membersCountAssetEmitValidator,
} from '../../assets/assets.validators'
import { billsAsset } from '../../assets/bills.asset'
import { billsCountAsset } from '../../assets/billsCount.asset'
import { billsListAsset } from '../../assets/billsList.asset'
import { materialize } from '../../assets/engine'
import { importantListAsset } from '../../assets/importantList.asset'
import { membersCountAsset } from '../../assets/membersCount.asset'
import { rankingPhrasesAsset } from '../../assets/rankingPhrases.asset'
import { stepRegexesAsset } from '../../assets/stepRegexes.asset'
import {
  CongressAPIAssetJobData,
  CongressAPIAssetJobName,
  CongressAPIAssetJobResponse,
  LocalAssetJobData,
  LocalAssetJobName,
  LocalAssetJobResponse,
} from '../../workers/types'
import { materializeValidator } from '../../workers/validators.materialize'
import { createRouter } from './context'
import { Chamber } from '.prisma/client'
import * as trpc from '@trpc/server'
import { JobState, Queue, QueueEvents, QueueEventsListener } from 'bullmq'
import { z } from 'zod'

export const EVENTS = [
  'active',
  'added',
  'waiting',
  'completed',
  'failed',
] as const
export type AssetJobChangeEvent = {
  assetName: AssetName
  jobState: JobState | 'unknown'
  childJobName: AssetName | null | undefined
}
type BillsCountAssetJobProgressEvent = z.infer<
  typeof billsCountAssetEmitValidator
>
type BillsAssetJobProgressEvent = z.infer<typeof billsAssetEmitValidator>
type MembersCountAssetJobProgressEvent = z.infer<
  typeof membersCountAssetEmitValidator
>
type AllMembersAssetJobProgressEvent = z.infer<
  typeof allMembersAssetEmitValidator
>

export const assetPlaygroundRouter = createRouter()
  // query to get all asset names
  .query('asset-names', {
    resolve() {
      return getAssetNames()
    },
  })
  // engine runner endpoint, materializes an asset with given args
  .mutation('materialize', {
    input: materializeValidator,
    async resolve({ input }) {
      const { assetName, ...restOfInput } = input
      const args = Object.values(restOfInput).filter((x) => x != null)
      await materialize(getAssetForName(assetName), args)
      return
    },
  })
  // Job events subscription
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
  // Asset progress events
  .subscription('billsCount-asset-progress', {
    resolve({ ctx }) {
      return new trpc.Subscription<BillsCountAssetJobProgressEvent>((emit) => {
        const queueEvents = ctx.queue.congressAPIAssetQueueEvents
        const handleProgress: QueueEventsListener['progress'] = async ({
          data,
        }) => {
          // check type for billsCount
          const parsed = billsCountAssetEmitValidator.safeParse(data)
          if (!parsed.success) return
          emit.data(parsed.data)
        }
        queueEvents.on('progress', handleProgress)
        return () => {
          queueEvents.off('progress', handleProgress)
        }
      })
    },
  })
  .subscription('bills-asset-progress', {
    resolve({ ctx }) {
      return new trpc.Subscription<BillsAssetJobProgressEvent>((emit) => {
        const queueEvents = ctx.queue.congressAPIAssetQueueEvents
        const handleProgress: QueueEventsListener['progress'] = async ({
          data,
        }) => {
          // check type for bills
          const parsed = billsAssetEmitValidator.safeParse(data)
          if (!parsed.success) return
          emit.data(parsed.data)
        }
        queueEvents.on('progress', handleProgress)
        return () => {
          queueEvents.off('progress', handleProgress)
        }
      })
    },
  })
  .subscription('membersCount-asset-progress', {
    resolve({ ctx }) {
      return new trpc.Subscription<MembersCountAssetJobProgressEvent>(
        (emit) => {
          const queueEvents = ctx.queue.congressAPIAssetQueueEvents
          const handleProgress: QueueEventsListener['progress'] = async ({
            data,
          }) => {
            // check type for membersCount
            const parsed = membersCountAssetEmitValidator.safeParse(data)
            if (!parsed.success) return
            emit.data(parsed.data)
          }
          queueEvents.on('progress', handleProgress)
          return () => {
            queueEvents.off('progress', handleProgress)
          }
        },
      )
    },
  })
  .subscription('allMembers-asset-progress', {
    resolve({ ctx }) {
      return new trpc.Subscription<AllMembersAssetJobProgressEvent>((emit) => {
        const queueEvents = ctx.queue.congressAPIAssetQueueEvents
        const handleProgress: QueueEventsListener['progress'] = async ({
          data,
        }) => {
          // check type for allMembers
          const parsed = allMembersAssetEmitValidator.safeParse(data)
          if (!parsed.success) return
          emit.data(parsed.data)
        }
        queueEvents.on('progress', handleProgress)
        return () => {
          queueEvents.off('progress', handleProgress)
        }
      })
    },
  })
  // Asset metadata queries
  .query('get-bills-count-asset-metadata', {
    input: z.object({
      chamber: z.nativeEnum(Chamber),
      congress: z.number().min(93).max(117),
    }),
    async resolve({ input }) {
      const { chamber, congress } = input
      return await billsCountAsset.readMetadata?.(chamber, congress)
    },
  })
  .query('get-bills-list-asset-metadata', {
    input: z.object({
      chamber: z.nativeEnum(Chamber),
      congress: z.number().min(93).max(117),
    }),
    async resolve({ input }) {
      const { chamber, congress } = input
      return await billsListAsset.readMetadata?.(chamber, congress, null, null)
    },
  })
  .query('get-bills-asset-metadata', {
    input: z.object({
      chamber: z.nativeEnum(Chamber),
      congress: z.number().min(93).max(117),
    }),
    async resolve({ input }) {
      const { chamber, congress } = input
      return await billsAsset.readMetadata?.(chamber, congress)
    },
  })
  .query('get-membersCount-asset-metadata', {
    async resolve() {
      return await membersCountAsset.readMetadata?.()
    },
  })
  .query('get-allMembers-asset-metadata', {
    async resolve() {
      return await allMembersAsset.readMetadata?.()
    },
  })
  .query('get-importantList-asset-metadata', {
    input: z.object({
      chamber: z.nativeEnum(Chamber),
      congress: z.number().min(93).max(117),
    }),
    async resolve({ input }) {
      const { chamber, congress } = input
      return await importantListAsset.readMetadata?.(chamber, congress)
    },
  })
  .query('get-rankingPhrases-asset-metadata', {
    input: z.object({
      chamber: z.nativeEnum(Chamber),
    }),
    async resolve({ input }) {
      const { chamber } = input
      return await rankingPhrasesAsset.readMetadata?.(chamber)
    },
  })
  .query('get-stepRegexes-asset-metadata', {
    input: z.object({
      chamber: z.nativeEnum(Chamber),
    }),
    async resolve({ input }) {
      const { chamber } = input
      return await stepRegexesAsset.readMetadata?.(chamber)
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
      console.log('active')
      await getAndEmitJob(jobId)
    },
    async added({ jobId }) {
      console.log('added')
      await getAndEmitJob(jobId)
    },
    async waiting({ jobId }) {
      console.log('waiting')
      await getAndEmitJob(jobId)
    },
    async completed({ jobId }) {
      console.log('completed')
      await getAndEmitJob(jobId)
    },
    async failed({ jobId }) {
      console.log('failed')
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
