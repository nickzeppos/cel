import { Queue, QueueEvents } from 'bullmq'
import { TestJobData, TestJobName, TestJobResponse } from '../../workers/types'

const connection = {
  host: 'cel-cache',
  port: 6379,
}

cleanup()
setup()

function cleanup() {
  if (globalThis.testQueue != null) {
    console.log('🧹 cleanup testQueue')
    globalThis.testQueue.close()
    globalThis.testQueue = undefined
  }
  if (globalThis.queueEvents != null) {
    console.log('🧹 cleanup queueEvents')
    globalThis.queueEvents.close()
    globalThis.queueEvents = undefined
  }
}

function setup() {
  console.log('🔼 setup queue')
  globalThis.testQueue = new Queue<TestJobData, TestJobResponse, TestJobName>(
    'test-queue',
    {
      connection,
    },
  )
    .on('cleaned', () => {
      console.log('[TEST QUEUE] CLEANED!')
    })
    .on('paused', () => {
      console.log('[TEST QUEUE] PAUSED!')
    })
    .on('resumed', () => {
      console.log('[TEST QUEUE] RESUMED!')
    })

  globalThis.queueEvents = new QueueEvents('test-queue', {
    connection,
  })
    .on('completed', (job) => {
      console.log(`🚂 JOB COMPLETE ${job.jobId} ${job.returnvalue} ${job.prev}`)
    })
    .on('progress', (job) => {
      console.log(`🚂 JOB PROGRESS ${job.jobId} ${job.data}`)
    })
    .on('added', (job) => {
      console.log(`🚂 JOB ADDED ${job.jobId} ${job.name}`)
    })
    .on('removed', (job) => {
      console.log(`🚂 JOB REMOVED ${job.jobId} ${job.prev}`)
    })
    .on('cleaned', (n) => {
      console.log(`🚂 JOBS CLEANED ${n}`)
    })
    .on('failed', (job) => {
      console.log(`🚂 JOB FAILED ${job.jobId}`)
    })
}

export const queue = {
  testQueue: globalThis.testQueue as NonNullable<typeof globalThis.testQueue>,
  queueEvents: globalThis.queueEvents as NonNullable<
    typeof globalThis.queueEvents
  >,
}
