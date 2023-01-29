import { billJobDataValidator } from '../../workers/validators'
import { createRouter } from './context'
import * as trpc from '@trpc/server'
import { QueueEventsListener } from 'bullmq'
import { z } from 'zod'

export const billQueueRouter = createRouter()
  .mutation('add-job', {
    input: billJobDataValidator,
    async resolve({ input, ctx }) {
      const { congress, billType, billNum } = input
      return await ctx.queue.billQueue.add('bill-job', {
        congress,
        billType,
        billNum,
      })
    },
  })
  .mutation('pause', {
    async resolve({ ctx }) {
      await ctx.queue.billQueue.pause()
      return true
    },
  })
  .mutation('resume', {
    async resolve({ ctx }) {
      await ctx.queue.billQueue.resume()
      return true
    },
  })
  .mutation('clean', {
    async resolve({ ctx }) {
      await ctx.queue.billQueue.clean(1000, 100)
      return true
    },
  })
  .query('state', {
    async resolve({ ctx }) {
      const q = ctx.queue.billQueue
      const isPaused = await q.isPaused()
      const rawJobs = await q.getJobs()
      const jobs = await Promise.all(
        rawJobs.map(async (j) => {
          const state = await j.getState()
          j.processedOn
          return {
            state,
            id: j.id,
            name: j.name,
            returnvalue: j.returnvalue,
            progress: j.progress,
            failedReason: j.failedReason,
            delay: j.delay,
            data: j.data,
            timestamp: j.timestamp,
            finishedOn: j.finishedOn,
            processedOn: j.processedOn,
          }
        }),
      ).then((js) => js.sort((a, b) => a.timestamp - b.timestamp))
      const name = q.name

      return {
        name,
        isPaused,
        jobs,
      }
    },
  })
  .mutation('remove-job', {
    input: z.object({ id: z.string() }),
    async resolve({ ctx, input }) {
      const j = await ctx.queue.billQueue.getJob(input.id)
      j?.remove()
      return
    },
  })
  .subscription('on-change', {
    resolve({ ctx }) {
      return new trpc.Subscription<{ id: string }>((emit) => {
        const onCompleted: QueueEventsListener['completed'] = (job) => {
          emit.data({ id: job.jobId })
        }
        const onAdded: QueueEventsListener['added'] = (job) => {
          emit.data({ id: job.jobId })
        }
        const onRemoved: QueueEventsListener['removed'] = (job) => {
          emit.data({ id: job.jobId })
        }
        const onCleaned: QueueEventsListener['cleaned'] = (n) => {
          emit.data({ id: '*' })
        }
        const onFailed: QueueEventsListener['failed'] = (job) => {
          emit.data({ id: job.jobId })
        }
        const onChanged = () => {
          emit.data({ id: '*' })
        }

        ctx.queue.billQueueEvents.on('completed', onCompleted)
        ctx.queue.billQueueEvents.on('added', onAdded)
        ctx.queue.billQueueEvents.on('removed', onRemoved)
        ctx.queue.billQueueEvents.on('cleaned', onCleaned)
        ctx.queue.billQueueEvents.on('failed', onFailed)
        ctx.queue.billQueue.on('paused', onChanged)
        ctx.queue.billQueue.on('resumed', onChanged)
        return () => {
          ctx.queue.billQueueEvents.off('completed', onCompleted)
          ctx.queue.billQueueEvents.off('added', onAdded)
          ctx.queue.billQueueEvents.off('removed', onRemoved)
          ctx.queue.billQueueEvents.on('cleaned', onCleaned)
          ctx.queue.billQueueEvents.on('failed', onFailed)
          ctx.queue.billQueue.off('paused', onChanged)
          ctx.queue.billQueue.off('resumed', onChanged)
        }
      })
    },
  })
