import { Queue, QueueEvents, Worker } from 'bullmq'

declare global {
  var queueEvents: QueueEvents | undefined | null
  var testQueue: Queue | undefined | null
  var testWorker: Worker | undefined | null
}

export {}
