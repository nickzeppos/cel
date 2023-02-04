import { Worker } from 'bullmq'

const connection = {
  host: 'cel-cache',
  port: 6379,
}

console.log(`🦌 ${__dirname}`)

const testWorker = new Worker('test-queue', `${__dirname}/testWorker.js`, {
  connection,
  concurrency: 1,
})

testWorker
  .on('active', (j) => {
    console.log(`🐜 ACTIVE`, j.data, j.id)
  })
  .on('completed', () => {
    console.log(`🐜 COMPLETE`)
  })
  .on('failed', () => {
    console.log(`🐜 FAIL`)
  })
  .on('paused', () => {
    console.log(`🐜 PAUSED`)
  })

const billWorker = new Worker('bill-queue', `${__dirname}/billWorker.js`, {
  connection,
  concurrency: 1,
})

billWorker
  .on('active', (j) => {
    console.log(`🐜 ACTIVE`, j.data, j.id)
  })
  .on('completed', () => {
    console.log(`🐜 COMPLETE`)
  })
  .on('failed', (job, error) => {
    console.log(`🐜 FAIL`)
    console.log(error)
  })
  .on('paused', () => {
    console.log(`🐜 PAUSED`)
  })

const termWorker = new Worker('term-queue', `${__dirname}/termWorker.js`, {
  connection,
  concurrency: 1,
})

termWorker
  .on('active', (j) => {
    console.log(`🐜 ACTIVE`, j.data, j.id)
  })
  .on('completed', () => {
    console.log(`🐜 COMPLETE`)
  })
  .on('failed', (job, error) => {
    console.log(`🐜 FAIL`)
    console.log(error)
  })
  .on('paused', () => {
    console.log(`🐜 PAUSED`)
  })

const assetWorker = new Worker('asset-queue', `${__dirname}/assetWorker.js`, {
  connection,
  concurrency: 1,
})
