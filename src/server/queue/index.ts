import {
  BillJobData,
  BillJobName,
  BillJobResponse,
  TestJobData,
  TestJobName,
  TestJobResponse,
} from '../../workers/types'
import { Queue, QueueEvents } from 'bullmq'

const connection = {
  host: 'cel-cache',
  port: 6379,
}

cleanup()
setup()

export function cleanup() {
  if (globalThis.testQueue != null) {
    console.log('🧹 cleanup testQueue')
    globalThis.testQueue.close()
    globalThis.testQueue = undefined
  }
  if (globalThis.billQueue != null) {
    console.log('🧹 cleanup billQueue')
    globalThis.billQueue.close()
    globalThis.billQueue = undefined
  }
  if (globalThis.testQueueEvents != null) {
    console.log('🧹 cleanup testQueueEvents')
    globalThis.testQueueEvents.close()
    globalThis.testQueueEvents = undefined
  }
  if (globalThis.billQueueEvents != null) {
    console.log('🧹 cleanup billQueueEvents')
    globalThis.billQueueEvents.close()
    globalThis.billQueueEvents = undefined
  }
}

function setup() {
  console.log('🔼 setup test queue')
  globalThis.testQueue = new Queue<TestJobData, TestJobResponse, TestJobName>(
    'test-queue',
    {
      connection,
    },
  )
    .on('cleaned', () => {
      console.log('🚂 CLEANED')
    })
    .on('paused', () => {
      console.log('🚂 PAUSED')
    })
    .on('resumed', () => {
      console.log('🚂 RESUMED')
    })
  console.log('🔼 setup bill queue')
  globalThis.billQueue = new Queue<BillJobData, BillJobResponse, BillJobName>(
    'bill-queue',
    {
      connection,
    },
  )
    .on('cleaned', () => {
      console.log('🚂 CLEANED')
    })
    .on('paused', () => {
      console.log('🚂 PAUSED')
    })
    .on('resumed', () => {
      console.log('🚂 RESUMED')
    })

  globalThis.billQueueEvents = new QueueEvents('bill-queue', {
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

  globalThis.testQueueEvents = new QueueEvents('test-queue', {
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
  billQueue: globalThis.billQueue as NonNullable<typeof globalThis.billQueue>,
  testQueueEvents: globalThis.testQueueEvents as NonNullable<
    typeof globalThis.testQueueEvents
  >,
  billQueueEvents: globalThis.billQueueEvents as NonNullable<
    typeof globalThis.billQueueEvents
  >,
}
