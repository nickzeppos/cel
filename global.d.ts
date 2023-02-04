/* eslint-disable no-var */
import {
  TestJobData,
  TestJobName,
  TestJobResponse,
} from './src/server/workers/testWorker'
import { TermJobData, TermJobResponse } from './src/workers/types'
import { Queue, QueueEvents, Worker } from 'bullmq'

declare global {
  var testQueueEvents: QueueEvents | undefined | null
  var billQueueEvents: QueueEvents | undefined | null
  var termQueueEvents: QueueEvents | undefined | null
  var testQueue:
    | Queue<TestJobData, TestJobResponse, TestJobName>
    | undefined
    | null
  var testWorker:
    | Worker<TestJobData, TestJobResponse, TestJobName>
    | undefined
    | null
  var billQueue:
    | Queue<BillJobData, BillJobResponse, BillJobName>
    | undefined
    | null
  var billWorker:
    | Worker<BillJobData, BillJobResponse, BillJobName>
    | undefined
    | null
  var termQueue:
    | Queue<TermJobData, TermJobResponse, TermJobName>
    | undefined
    | null
  var termWorker:
    | Worker<TermJobData, TermJobResponse, TermJobName>
    | undefined
    | null
  var assetQueue:
    | Queue<AssetJobData, AssetJobResponse, AssetJobName>
    | undefined
    | null
  var assetWorker:
    | Worker<AssetJobData, AssetJobResponse, AssetJobName>
    | undefined
    | null
}

export {}
