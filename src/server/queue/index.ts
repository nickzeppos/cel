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

export function cleanup() {
  if (globalThis.testQueue != null) {
    globalThis.testQueue.close()
    globalThis.testQueue = undefined
  }
  if (globalThis.billQueue != null) {
    globalThis.billQueue.close()
    globalThis.billQueue = undefined
  }
  if (globalThis.testQueueEvents != null) {
    globalThis.testQueueEvents.close()
    globalThis.testQueueEvents = undefined
  }
  if (globalThis.billQueueEvents != null) {
    globalThis.billQueueEvents.close()
    globalThis.billQueueEvents = undefined
  }
  if (globalThis.termQueueEvents != null) {
    globalThis.termQueueEvents.close()
    globalThis.termQueueEvents = undefined
  }
  if (globalThis.assetQueue != null) {
    globalThis.assetQueue.close()
    globalThis.assetQueue = undefined
  }
  if (globalThis.assetQueueEvents != null) {
    globalThis.assetQueueEvents.close()
    globalThis.assetQueueEvents = undefined
  }
  if (globalThis.congressAPIAssetQueue != null) {
    globalThis.congressAPIAssetQueue.close()
    globalThis.congressAPIAssetQueue = undefined
  }
  if (globalThis.congressAPIAssetQueueEvents != null) {
    globalThis.congressAPIAssetQueueEvents.close()
    globalThis.congressAPIAssetQueueEvents = undefined
  }
  if (globalThis.localAssetQueue != null) {
    globalThis.localAssetQueue.close()
    globalThis.localAssetQueue = undefined
  }
  if (globalThis.localAssetQueueEvents != null) {
    globalThis.localAssetQueueEvents.close()
    globalThis.localAssetQueueEvents = undefined
  }
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
