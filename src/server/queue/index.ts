import { Queue, QueueEvents } from 'bullmq'
import { TestJobData, TestJobName, TestJobResponse } from '../../workers/types'

const connection = {
  host: 'cel-cache',
  port: 6379,
}

cleanup()
setup()

export function cleanup() {
  if (globalThis.testQueue != null) {
    console.log('๐งน cleanup testQueue')
    globalThis.testQueue.close()
    globalThis.testQueue = undefined
  }
  if (globalThis.queueEvents != null) {
    console.log('๐งน cleanup queueEvents')
    globalThis.queueEvents.close()
    globalThis.queueEvents = undefined
  }
}

function setup() {
  console.log('๐ผ setup queue')
  globalThis.testQueue = new Queue<TestJobData, TestJobResponse, TestJobName>(
    'test-queue',
    {
      connection,
    },
  )
    .on('cleaned', () => {
      console.log('๐ CLEANED')
    })
    .on('paused', () => {
      console.log('๐ PAUSED')
    })
    .on('resumed', () => {
      console.log('๐ RESUMED')
    })

  globalThis.queueEvents = new QueueEvents('test-queue', {
    connection,
  })
    .on('completed', (job) => {
      console.log(`๐ JOB COMPLETE ${job.jobId} ${job.returnvalue} ${job.prev}`)
    })
    .on('progress', (job) => {
      console.log(`๐ JOB PROGRESS ${job.jobId} ${job.data}`)
    })
    .on('added', (job) => {
      console.log(`๐ JOB ADDED ${job.jobId} ${job.name}`)
    })
    .on('removed', (job) => {
      console.log(`๐ JOB REMOVED ${job.jobId} ${job.prev}`)
    })
    .on('cleaned', (n) => {
      console.log(`๐ JOBS CLEANED ${n}`)
    })
    .on('failed', (job) => {
      console.log(`๐ JOB FAILED ${job.jobId}`)
    })
}

export const queue = {
  testQueue: globalThis.testQueue as NonNullable<typeof globalThis.testQueue>,
  queueEvents: globalThis.queueEvents as NonNullable<
    typeof globalThis.queueEvents
  >,
}
