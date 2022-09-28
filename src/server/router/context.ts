// src/server/router/context.ts
import * as trpc from '@trpc/server'
import * as trpcNext from '@trpc/server/adapters/next'
import { prisma } from '../db/client'
import { Queue, Worker, QueueEvents } from 'bullmq'

const testQueue = new Queue('test-queue', {
  connection: {
    host: 'cel-cache',
    port: 6379,
  },
})
  .on('cleaned', () => {
    console.log('cleaned')
  })
  .on('progress', (job) => {
    console.log(`[PROGRESS] ${job.id} ${job.progress}`)
  })

const workerPath = `${__dirname}/../../../../../worker.js`
console.log(`worker-path:${workerPath}`)
const testWorker = new Worker('test-queue', workerPath, {
  connection: {
    host: 'cel-cache',
    port: 6379,
  },
})

const queueEvents = new QueueEvents('test-queue', {
  connection: {
    host: 'cel-cache',
    port: 6379,
  },
})
  .on('completed', (job) => {
    console.log(`[QUEUE] JOB COMPLETE ${job.jobId} ${job.returnvalue}`)
  })
  .on('progress', (job) => {
    console.log(`[QUEUE] JOB PROGRESS ${job.jobId} ${job.data}`)
  })

/**
 * Replace this with an object if you want to pass things to createContextInner
 */
type CreateContextOptions = Record<string, never>

/** Use this helper for:
 * - testing, where we dont have to Mock Next.js' req/res
 * - trpc's `createSSGHelpers` where we don't have req/res
 **/
export const createContextInner = async (opts: CreateContextOptions) => {
  return {
    prisma,
    testQueue,
  }
}

/**
 * This is the actual context you'll use in your router
 * @link https://trpc.io/docs/context
 **/
export const createContext = async (
  opts: trpcNext.CreateNextContextOptions,
) => {
  return await createContextInner({})
}

type Context = trpc.inferAsyncReturnType<typeof createContext>

export const createRouter = () => trpc.router<Context>()
