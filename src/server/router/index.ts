// src/server/router/index.ts
import { billQueueRouter } from './billQueue'
import { chambressRouter } from './chambress'
import { congressRouter } from './congress'
import { createRouter } from './context'
import { memberRouter } from './member'
import { termQueueRouter } from './termQueue'
import { testQueueRouter } from './testQueue'
import superjson from 'superjson'

console.log('🔼 create router')
export const appRouter = createRouter()
  .transformer(superjson)
  .merge('member.', memberRouter)
  .merge('chambress.', chambressRouter)
  .merge('congress.', congressRouter)
  .merge('test-queue.', testQueueRouter)
  .merge('bill-queue.', billQueueRouter)
  .merge('term-queue.', termQueueRouter)

// export type definition of API
export type AppRouter = typeof appRouter
