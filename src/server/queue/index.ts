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
    _queueName: string,
  ) {
    if (queue != null) {
      await queue.close()
      // console.log(`🔽 Queue ${queueName} closed`)
      return undefined
    }
    return queue
  }
  async function closeQueueEvents(
    queueEvents: QueueEvents | null | undefined,
    _queueName: string,
  ) {
    if (queueEvents != null) {
      await queueEvents.close()
      // console.log(`🔽 QueueEvents ${queueName} closed`)
      return undefined
    }
    return queueEvents
  }
  await closeQueue(globalThis.testQueue, 'test-queue')
  await closeQueue(globalThis.billQueue, 'bill-queue')
  await closeQueue(globalThis.termQueue, 'term-queue')
  await closeQueue(globalThis.assetQueue, 'asset-queue')
  await closeQueue(globalThis.congressAPIAssetQueue, 'congress-api-asset-queue')
  await closeQueue(globalThis.localAssetQueue, 'local-asset-queue')
  await closeQueueEvents(globalThis.testQueueEvents, 'test-queue')
  await closeQueueEvents(globalThis.billQueueEvents, 'bill-queue')
  await closeQueueEvents(globalThis.termQueueEvents, 'term-queue')
  await closeQueueEvents(globalThis.assetQueueEvents, 'asset-queue')
  await closeQueueEvents(
    globalThis.congressAPIAssetQueueEvents,
    'congress-api-asset-queue',
  )
  await closeQueueEvents(globalThis.localAssetQueueEvents, 'local-asset-queue')
}

function setup() {
  globalThis.testQueue = new Queue<TestJobData, TestJobResponse, TestJobName>(
    'test-queue',
    {
      connection,
    },
  )
  globalThis.billQueueEvents = new QueueEvents('bill-queue', {
    connection,
  })

  globalThis.billQueue = new Queue<BillJobData, BillJobResponse, BillJobName>(
    'bill-queue',
    {
      connection,
    },
  )
  globalThis.testQueueEvents = new QueueEvents('test-queue', {
    connection,
  })

  globalThis.termQueue = new Queue<TermJobData, TermJobResponse, TermJobName>(
    'term-queue',
    {
      connection,
    },
  )
  globalThis.termQueueEvents = new QueueEvents('term-queue', {
    connection,
  })

  globalThis.assetQueue = new Queue<
    AssetJobData,
    AssetJobResponse,
    AssetJobName
  >('asset-queue', {
    connection,
  })
  globalThis.assetQueueEvents = new QueueEvents('asset-queue', { connection })

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
  globalThis.congressAPIAssetQueueEvents = new QueueEvents(
    'congress-api-asset-queue',
    { connection },
  )

  globalThis.localAssetQueue = new Queue<
    LocalAssetJobData,
    LocalAssetJobResponse,
    LocalAssetJobName
  >('local-asset-queue', {
    connection,
  })
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
