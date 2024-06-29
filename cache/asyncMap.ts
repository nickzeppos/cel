import { AuditKey } from './types'
import SFTP from 'ssh2-promise/lib/sftp'

async function process(
  auditKey: AuditKey,
  index: number,
  results: Array<AuditKey>,
  sftp: SFTP,
): Promise<void> {
  const [path, auditFn, _url] = auditKey
  try {
    const auditPassed = await auditFn(path, sftp)
    // we only keep failures!
    if (!auditPassed) {
      results.push(auditKey)
    }
  } catch (error: any) {
    console.error(`Error processing ${index}: ${error.message}`)
  }
}

// Two async map functions that work with auditKeys, accept concurreny parameters, and use sftp
// They differ primarily in their approach to managing how promises exit the queue

// asyncMap1 will add processes until the queue is full, watch the queue with Promise.race, then add a new one.
// Importantly, the processes added by asyncMap1 come attached with a callback that removes the process from the queue upon resolution
// So asyncMap1 processes can be thought of as self-managing.

// asyncMap2 will start out the same-- add processes until the queue is full. But, when the queue is full, asyncMap2 maps over the queue to add a callback to each
// process that will allow the process to return its own index. Then, that array of promises is watched with Promise.race. So asyncMap2 sort of sets up a copy of the queue
// to watch every time its waiting for a new process to finish.

export async function asyncMap1(
  auditKeys: Array<AuditKey>,
  concurrency: number,
  sftp: SFTP,
): Promise<Array<AuditKey>> {
  const queue: Array<Promise<void>> = []
  const results: Array<AuditKey> = []

  let startTime = Date.now()
  for (let i = 0; i < auditKeys.length; i++) {
    if (queue.length >= concurrency) {
      await Promise.race(queue)
    }
    const p = process(auditKeys[i], i, results, sftp).then(() => {
      queue.splice(queue.indexOf(p), 1)
    })
    queue.push(p)

    if (i > 0 && i % 25000 === 0) {
      // periodic log
      const endTime = Date.now()
      console.log(
        `Batch ${i / 25000} processed in ${
          (endTime - startTime) / 1000
        } seconds`,
      )
      startTime = endTime
    }
  }
  await Promise.all(queue)
  return results
}

export async function asyncMap2(
  auditKeys: Array<AuditKey>,
  concurrency: number,
  sftp: SFTP,
): Promise<Array<AuditKey>> {
  const queue: Array<Promise<void>> = []
  const results: Array<AuditKey> = []
  for (let i = 0; i < auditKeys.length; i++) {
    if (queue.length < concurrency) {
      queue.push(process(auditKeys[i], i, results, sftp))
    } else {
      const latestResolvedIndex = await Promise.race(
        queue.map((p, index) => p.then(() => index)),
      )
      queue.splice(latestResolvedIndex, 1)
      queue.push(process(auditKeys[i], i, results, sftp))
    }
  }
  await Promise.all(queue)
  return results
}

// Stats

// asyncMap1
// 25k slice -- from 0 to 25000

// concurrency - 75
// run1 - 17.326s, 16% cpu
// run2 - 22.76s, 14% cpu

// concurrency - 100
// run1 - 22.054s, 13% cpu
// run2 - 23.345s, 13% cpu

// concurrency - 200
// run1 - 8.868s, 21% cpu
// run2 - 9.815s, 21% cpu

// concurrency - 250
// run1 - 8.201s, 28% cpu
// run2 - 7.782s, 33% cpu

// concurrency - 300
// run1 - 8.402s, 36% cpu
// run2 - 7.697s, 32% cpu

// asyncMap2
// 25k slice -- from 0 to 25000
// concurrency - 75
// run1 - 24.931s, 11% cpu
// run2 - 24.681s, 11% cpu

// concurrency - 100
// run1 - 22.129s, 13% cpu
// run2 - 22.666s, 13% cpu

// concurrency - 150
// run1 - 16.844s, 19% cpu
// run2 - 16.618s, 19% cpu

// concurrency - 200
// run1 - 15.169s, 18% cpu
// run2 - 15.710s, 19% cpu

// concurrency - 250
// run1 - 17.178s, 16% cpu
// run2 - 17.863s, 15% cpu

// concurrency - 300
// run1 - 20.737s, 13% cpu
// run2 - 20.632s, 14% cpu
