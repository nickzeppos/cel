// src/pages/api/trpc/[trpc].ts
import { createNextApiHandler } from '@trpc/server/adapters/next'
import { appRouter } from '../../../server/router'
import { createContext } from '../../../server/router/context'

// export API handler
console.log('🐫 create next api handler with createContext')
export default createNextApiHandler({
  router: appRouter,
  createContext,
})
