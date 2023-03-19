/* eslint-disable no-var */
import {
  TestJobData,
  TestJobName,
  TestJobResponse,
} from './src/server/workers/testWorker'
import { TermJobData, TermJobResponse } from './src/workers/types'
import {
  AssetJobData,
  AssetJobName,
  AssetJobResponse,
  CongressAPIAssetJobData,
  CongressAPIAssetJobName,
  CongressAPIAssetJobResponse,
} from './src/workers/types.ts'
import { Queue, QueueEvents, Worker } from 'bullmq'

declare global {
  var testQueue:
    | Queue<TestJobData, TestJobResponse, TestJobName>
    | undefined
    | null
  var testWorker:
    | Worker<TestJobData, TestJobResponse, TestJobName>
    | undefined
    | null
  var testQueueEvents: QueueEvents | undefined | null

  var billQueue:
    | Queue<BillJobData, BillJobResponse, BillJobName>
    | undefined
    | null
  var billWorker:
    | Worker<BillJobData, BillJobResponse, BillJobName>
    | undefined
    | null
  var billQueueEvents: QueueEvents | undefined | null

  var termQueue:
    | Queue<TermJobData, TermJobResponse, TermJobName>
    | undefined
    | null
  var termWorker:
    | Worker<TermJobData, TermJobResponse, TermJobName>
    | undefined
    | null
  var termQueueEvents: QueueEvents | undefined | null

  var assetQueue:
    | Queue<AssetJobData, AssetJobResponse, AssetJobName>
    | undefined
    | null
  var assetWorker:
    | Worker<AssetJobData, AssetJobResponse, AssetJobName>
    | undefined
    | null
  var assetQueueEvents: QueueEvents | undefined | null

  var congressAPIAssetQueue:
    | Queue<
        CongressAPIAssetJobData,
        CongressAPIAssetJobResponse,
        CongressAPIAssetJobName
      >
    | undefined
    | null
  var congressAPIAssetWorker:
    | Worker<
        CongressAPIAssetJobData,
        CongressAPIAssetJobResponse,
        CongressAPIAssetJobName
      >
    | undefined
    | null
  var congressAPIAssetQueueEvents: QueueEvents | undefined | null

  var localAssetQueue:
    | Queue<LocalAssetJobData, LocalAssetJobResponse, LocalAssetJobName>
    | undefined
    | null
  var localAssetWorker:
    | Worker<LocalAssetJobData, LocalAssetJobResponse, LocalAssetJobName>
    | undefined
    | null
  var localAssetQueueEvents: QueueEvents | undefined | null
}

export {}
