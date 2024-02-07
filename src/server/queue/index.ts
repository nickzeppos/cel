import {
  AssetJobData,
  AssetJobName,
  AssetJobResponse,
  BillJobData,
  BillJobName,
  BillJobResponse,
  CongressAPIAssetJobData,
  CongressAPIAssetJobName,
  CongressAPIAssetJobResponse,
  LocalAssetJobData,
  LocalAssetJobName,
  LocalAssetJobResponse,
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

export async function cleanup() {
  async function closeQueue(
    queue: null | undefined | Queue<any, any, any>,
    queueName: string,
  ) {
    if (queue != null) {
      await queue.close()
      console.log(`🔽 Queue ${queueName} closed`)
      return undefined
    }
    return queue
  }
  async function closeQueueEvents(
    queueEvents: QueueEvents | null | undefined,
    queueName: string,
  ) {
    if (queueEvents != null) {
      await queueEvents.close()
      console.log(`🔽 QueueEvents ${queueName} closed`)
      return undefined
    }
    return queueEvents
  }
  closeQueue(globalThis.testQueue, 'test-queue')
  closeQueue(globalThis.billQueue, 'bill-queue')
  closeQueue(globalThis.termQueue, 'term-queue')
  closeQueue(globalThis.assetQueue, 'asset-queue')
  closeQueue(globalThis.congressAPIAssetQueue, 'congress-api-asset-queue')
  closeQueue(globalThis.localAssetQueue, 'local-asset-queue')
  closeQueueEvents(globalThis.testQueueEvents, 'test-queue')
  closeQueueEvents(globalThis.billQueueEvents, 'bill-queue')
  closeQueueEvents(globalThis.termQueueEvents, 'term-queue')
  closeQueueEvents(globalThis.assetQueueEvents, 'asset-queue')
  closeQueueEvents(
    globalThis.congressAPIAssetQueueEvents,
    'congress-api-asset-queue',
  )
  await closeQueueEvents(globalThis.localAssetQueueEvents, 'local-asset-queue')
}

export function setup() {
  console.log('🔼 Setting up test-queue')
  globalThis.testQueue = new Queue<TestJobData, TestJobResponse, TestJobName>(
    'test-queue',
    {
      connection,
    },
  )
  console.log('🔼 Setting up bill-queue events')
  globalThis.billQueueEvents = new QueueEvents('bill-queue', {
    connection,
  })
  console.log('🔼 Setting up bill-queue')
  globalThis.billQueue = new Queue<BillJobData, BillJobResponse, BillJobName>(
    'bill-queue',
    {
      connection,
    },
  )
  console.log('🔼 Setting up test-queue events')
  globalThis.testQueueEvents = new QueueEvents('test-queue', {
    connection,
  })
  console.log('🔼 Setting up term-queue')
  globalThis.termQueue = new Queue<TermJobData, TermJobResponse, TermJobName>(
    'term-queue',
    {
      connection,
    },
  )
  console.log('🔼 Setting up term-queue events')
  globalThis.termQueueEvents = new QueueEvents('term-queue', {
    connection,
  })

  console.log('🔼 Setting up asset-queue')
  globalThis.assetQueue = new Queue<
    AssetJobData,
    AssetJobResponse,
    AssetJobName
  >('asset-queue', {
    connection,
  })

  console.log('🔼 Setting up asset-queue events')
  globalThis.assetQueueEvents = new QueueEvents('asset-queue', { connection })

  console.log('🔼 Setting up congress-api-asset-queue')
  globalThis.congressAPIAssetQueue = new Queue<
    CongressAPIAssetJobData,
    CongressAPIAssetJobResponse,
    CongressAPIAssetJobName
  >('congress-api-asset-queue', {
    connection,
    limiter: {
      groupKey: 'congress-api-rate-limit',
    },
  })

  console.log('🔼 Setting up congress-api-asset-queue events')
  globalThis.congressAPIAssetQueueEvents = new QueueEvents(
    'congress-api-asset-queue',
    { connection },
  )

  console.log('🔼 Setting up local-asset-queue')
  globalThis.localAssetQueue = new Queue<
    LocalAssetJobData,
    LocalAssetJobResponse,
    LocalAssetJobName
  >('local-asset-queue', {
    connection,
  })

  console.log('🔼 Setting up local-asset-queue events')
  globalThis.localAssetQueueEvents = new QueueEvents('local-asset-queue', {
    connection,
  })
}

export const queue = {
  testQueue: globalThis.testQueue as NonNullable<typeof globalThis.testQueue>,
  testQueueEvents: globalThis.testQueueEvents as NonNullable<
    typeof globalThis.testQueueEvents
  >,

  billQueue: globalThis.billQueue as NonNullable<typeof globalThis.billQueue>,
  billQueueEvents: globalThis.billQueueEvents as NonNullable<
    typeof globalThis.billQueueEvents
  >,

  termQueue: globalThis.termQueue as NonNullable<typeof globalThis.termQueue>,
  termQueueEvents: globalThis.termQueueEvents as NonNullable<
    typeof globalThis.termQueueEvents
  >,

  assetQueue: globalThis.assetQueue as NonNullable<
    typeof globalThis.assetQueue
  >,
  assetQueueEvents: globalThis.assetQueueEvents as NonNullable<
    typeof globalThis.assetQueueEvents
  >,

  congressApiAssetQueue: globalThis.congressAPIAssetQueue as NonNullable<
    typeof globalThis.congressAPIAssetQueue
  >,
  congressAPIAssetQueueEvents:
    globalThis.congressAPIAssetQueueEvents as NonNullable<
      typeof globalThis.congressAPIAssetQueueEvents
    >,

  localAssetQueue: globalThis.localAssetQueue as NonNullable<
    typeof globalThis.localAssetQueue
  >,
  localAssetQueueEvents: globalThis.localAssetQueueEvents as NonNullable<
    typeof globalThis.localAssetQueueEvents
  >,
}
