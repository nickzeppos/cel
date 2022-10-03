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
