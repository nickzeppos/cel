// src/server/router/context.ts
import { prisma } from '../db/client'
import { queue } from '../queue'
import * as trpc from '@trpc/server'
import * as trpcNext from '@trpc/server/adapters/next'
import { NodeHTTPCreateContextFnOptions } from '@trpc/server/adapters/node-http'
import { IncomingMessage } from 'http'
import ws from 'ws'

/**
 * Replace this with an object if you want to pass things to createContextInner
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CreateContextOptions = Record<string, never>

/** Use this helper for:
 * - testing, where we dont have to Mock Next.js' req/res
 * - trpc's `createSSGHelpers` where we don't have req/res
 **/
export const createContextInner = async (
  opts:
    | trpcNext.CreateNextContextOptions
    | NodeHTTPCreateContextFnOptions<IncomingMessage, ws>,
) => {
  return {
    prisma,
    queue,
    ...opts,
  }
}

/**
 * This is the actual context you'll use in your router
 * @link https://trpc.io/docs/context
 **/
export const createContext = async (
  opts:
    | trpcNext.CreateNextContextOptions
    | NodeHTTPCreateContextFnOptions<IncomingMessage, ws>,
) => {
  return await createContextInner(opts)
}

type Context = trpc.inferAsyncReturnType<typeof createContext>

export const createRouter = () => trpc.router<Context>()
