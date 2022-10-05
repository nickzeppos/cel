// src/server/router/index.ts
import { chambressRouter } from './chambress'
import { congressRouter } from './congress'
import { createRouter } from './context'
import { memberRouter } from './member'
import { testQueueRouter } from './testQueue'
import superjson from 'superjson'

console.log('🔼 create router')
export const appRouter = createRouter()
  .transformer(superjson)
  .merge('member.', memberRouter)
  .merge('chambress.', chambressRouter)
  .merge('congress.', congressRouter)
  .merge('test-queue.', testQueueRouter)

// export type definition of API
export type AppRouter = typeof appRouter
