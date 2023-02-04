import {
  AssetJobData,
  AssetJobName,
  AssetJobResponse,
  BillJobData,
  BillJobName,
  BillJobResponse,
  TermJobData,
  TermJobName,
  TermJobResponse,
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

// does this work?
// function close(
//   closeable: { close: () => any } | null | undefined
// ): void {
//   if(closeable != null) {
//     closeable.close()
//     closeable = undefined
//   }
// }

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
  if (globalThis.termQueueEvents != null) {
    console.log('🧹 cleanup termQueueEvents')
    globalThis.termQueueEvents.close()
    globalThis.termQueueEvents = undefined
  }
  if (globalThis.assetQueue != null) {
    globalThis.assetQueue.close()
    globalThis.assetQueue = undefined
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
  globalThis.termQueue = new Queue<TermJobData, TermJobResponse, TermJobName>(
    'term-queue',
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
      // get some info about the rate limit from return value
      // job.returnvalue includes remaining limit

      // if remaining < C wait for W
      // otherwise just keep going

      // W is a function of actual rate and some relationship with the remaining limit
      // W affects the actual rate of requests we're making
      // ARR = actual request rate (job rate)
      // LRR = limit refresh rate

      // ARR = LRR
      // we want to discover LRR so that we can set ARR equal to it
      // but ARR is not what we control directly either
      // we control delay between requests

      // pause the queue for some amount of time based on that
      // globalThis.billQueue?.pause() setTime .resume()
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

  globalThis.termQueueEvents = new QueueEvents('term-queue', {
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

  globalThis.assetQueue = new Queue<
    AssetJobData,
    AssetJobResponse,
    AssetJobName
  >('asset-queue', {
    connection,
  })
}

export const queue = {
  testQueue: globalThis.testQueue as NonNullable<typeof globalThis.testQueue>,
  billQueue: globalThis.billQueue as NonNullable<typeof globalThis.billQueue>,
  termQueue: globalThis.termQueue as NonNullable<typeof globalThis.termQueue>,
  assetQueue: globalThis.assetQueue as NonNullable<
    typeof globalThis.assetQueue
  >,
  testQueueEvents: globalThis.testQueueEvents as NonNullable<
    typeof globalThis.testQueueEvents
  >,
  billQueueEvents: globalThis.billQueueEvents as NonNullable<
    typeof globalThis.billQueueEvents
  >,
  termQueueEvents: globalThis.termQueueEvents as NonNullable<
    typeof globalThis.termQueueEvents
  >,
}
