import {
  TestJobData,
  TestJobName,
  TestJobResponse,
} from './src/server/workers/testWorker'
import { Queue, QueueEvents, Worker } from 'bullmq'

declare global {
  var testQueueEvents: QueueEvents | undefined | null
  var billQueueEvents: QueueEvents | undefined | null
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
  var testWorker:
    | Worker<BillJobData, BillJobResponse, BillJobName>
    | undefined
    | null
}

export {}
