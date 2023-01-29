import { createRouter } from './context'
import * as trpc from '@trpc/server'
import { QueueEventsListener } from 'bullmq'
import { z } from 'zod'

export const testQueueRouter = createRouter()
  .mutation('add-job', {
    async resolve({ ctx }) {
      return await ctx.queue.testQueue.add('test-job', {
        color: 'red',
        count: 3,
      })
    },
  })
  .mutation('pause', {
    async resolve({ ctx }) {
      await ctx.queue.testQueue.pause()
      return true
    },
  })
  .mutation('resume', {
    async resolve({ ctx }) {
      await ctx.queue.testQueue.resume()
      return true
    },
  })
  .mutation('clean', {
    async resolve({ ctx }) {
      await ctx.queue.testQueue.clean(1000, 100)
      return true
    },
  })
  .query('state', {
    async resolve({ ctx }) {
      const q = ctx.queue.testQueue
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
      const j = await ctx.queue.testQueue.getJob(input.id)
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

        ctx.queue.testQueueEvents.on('completed', onCompleted)
        ctx.queue.testQueueEvents.on('added', onAdded)
        ctx.queue.testQueueEvents.on('removed', onRemoved)
        ctx.queue.testQueueEvents.on('cleaned', onCleaned)
        ctx.queue.testQueueEvents.on('failed', onFailed)
        ctx.queue.testQueue.on('paused', onChanged)
        ctx.queue.testQueue.on('resumed', onChanged)
        return () => {
          ctx.queue.testQueueEvents.off('completed', onCompleted)
          ctx.queue.testQueueEvents.off('added', onAdded)
          ctx.queue.testQueueEvents.off('removed', onRemoved)
          ctx.queue.testQueueEvents.on('cleaned', onCleaned)
          ctx.queue.testQueueEvents.on('failed', onFailed)
          ctx.queue.testQueue.off('paused', onChanged)
          ctx.queue.testQueue.off('resumed', onChanged)
        }
      })
    },
  })
