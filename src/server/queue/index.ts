import { Queue, Worker, QueueEvents } from 'bullmq'
import {
  TestJob,
  TestJobData,
  TestJobName,
  TestJobResponse,
} from '../workers/testWorker'

const connection = {
  host: 'cel-cache',
  port: 6379,
}
const workersDir = `${__dirname}/../../../../../.workers`

cleanup()
setup()

function cleanup() {
  if (globalThis.testQueue != null) {
    console.log('cleanup testQueue')
    globalThis.testQueue.close()
    globalThis.testQueue = undefined
  }
  if (globalThis.testWorker != null) {
    console.log('cleanup testWorker')
    globalThis.testWorker.close()
    globalThis.testWorker = undefined
  }
  if (globalThis.queueEvents != null) {
    console.log('cleanup queueEvents')
    globalThis.queueEvents.close()
    globalThis.queueEvents = undefined
  }
}

function setup() {
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

  globalThis.testWorker = new Worker(
    'test-queue',
    `${workersDir}/testWorker.js`,
    {
      connection,
      concurrency: 1,
    },
  )

  globalThis.queueEvents = new QueueEvents('test-queue', {
    connection,
  })
    .on('completed', (job) => {
      console.log(`[QUEUE] JOB COMPLETE ${job.jobId} ${job.returnvalue}`)
    })
    .on('progress', (job) => {
      console.log(`[QUEUE] JOB PROGRESS ${job.jobId} ${job.data}`)
    })
}

export const queue = {
  testQueue: globalThis.testQueue as NonNullable<typeof globalThis.testQueue>,
}
