import { Queue, QueueEvents, Worker } from 'bullmq'
import {
  TestJobData,
  TestJobResponse,
  TestJobName,
} from './src/server/workers/testWorker'

declare global {
  var queueEvents: QueueEvents | undefined | null
  var testQueue:
    | Queue<TestJobData, TestJobResponse, TestJobName>
    | undefined
    | null
  var testWorker:
    | Worker<TestJobData, TestJobResponse, TestJobName>
    | undefined
    | null
}

export {}
