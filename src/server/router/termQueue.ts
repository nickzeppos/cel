import { termJobDataValidator } from '../../workers/validators'
import { createRouter } from './context'
import * as trpc from '@trpc/server'
import { QueueEventsListener } from 'bullmq'
import { z } from 'zod'

export const termQueueRouter = createRouter()
  .mutation('add-job', {
    input: termJobDataValidator,
    async resolve({ input, ctx }) {
      const { bioguide } = input
      return await ctx.queue.termQueue.add('term-job', {
        bioguide,
      })
    },
  })
  .mutation('pause', {
    async resolve({ ctx }) {
      await ctx.queue.termQueue.pause()
      return true
    },
  })
  .mutation('resume', {
    async resolve({ ctx }) {
      await ctx.queue.termQueue.resume()
      return true
    },
  })
  .mutation('clean', {
    async resolve({ ctx }) {
      await ctx.queue.termQueue.clean(1000, 100)
      return true
    },
  })
  .query('state', {
    async resolve({ ctx }) {
      const q = ctx.queue.termQueue
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
      const j = await ctx.queue.termQueue.getJob(input.id)
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

        ctx.queue.termQueueEvents.on('completed', onCompleted)
        ctx.queue.termQueueEvents.on('added', onAdded)
        ctx.queue.termQueueEvents.on('removed', onRemoved)
        ctx.queue.termQueueEvents.on('cleaned', onCleaned)
        ctx.queue.termQueueEvents.on('failed', onFailed)
        ctx.queue.termQueue.on('paused', onChanged)
        ctx.queue.termQueue.on('resumed', onChanged)
        return () => {
          ctx.queue.termQueueEvents.off('completed', onCompleted)
          ctx.queue.termQueueEvents.off('added', onAdded)
          ctx.queue.termQueueEvents.off('removed', onRemoved)
          ctx.queue.termQueueEvents.on('cleaned', onCleaned)
          ctx.queue.termQueueEvents.on('failed', onFailed)
          ctx.queue.termQueue.off('paused', onChanged)
          ctx.queue.termQueue.off('resumed', onChanged)
        }
      })
    },
  })
