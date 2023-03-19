import { Worker } from 'bullmq'

const connection = {
  host: 'cel-cache',
  port: 6379,
}

;(
  [
    ['test-queue', `${__dirname}/testWorker.js`],
    ['bill-queue', `${__dirname}/billWorker.js`],
    ['term-queue', `${__dirname}/termWorker.js`],
    ['asset-queue', `${__dirname}/assetWorker.js`],
    [
      'congress-api-asset-queue',
      `${__dirname}/congressAPIAssetWorker.js`,
      {
        groupKey: 'congress-api-rate-limit',
        max: 1,
        duration: 5000, //ms
      },
    ],
    ['local-asset-queue', `${__dirname}/localAssetWorker.js`],
  ] as const
).map(
  ([queue, file, limiter = undefined]) =>
    new Worker(queue, file, { connection, concurrency: 1, limiter }),
)
