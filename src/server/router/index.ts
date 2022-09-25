// src/server/router/index.ts
import { createRouter } from './context'
import superjson from 'superjson'
import { z } from 'zod'
import { apiFetch } from '../patterns/fetching'
import fetch, { Headers, Request } from 'node-fetch'
import { Chamber } from '@prisma/client'
import { pipe } from 'fp-ts/lib/function'
import * as E from 'fp-ts/lib/Either'
import * as TE from 'fp-ts/lib/TaskEither'
import * as A from 'fp-ts/lib/Array'
import { option } from 'fp-ts'
import {
  ChamberDisplay,
  CongressAPIError,
  congressToChambress,
} from '../chambress'
import { errorIdentity, ETry, TETry } from '../../utils/fp'
import { fetchCongressAPI } from '../congressAPI'

const congressResponseValidator = z.object({
  congresses: z.array(
    z.object({
      endYear: z.string(),
      startYear: z.string(),
      name: z.string(), // ###th Congress
      sessions: z.array(z.object({ chamber: ChamberDisplay })),
    }),
  ),
})

export const appRouter = createRouter()
  .transformer(superjson)
  .query('get-all-cong', {
    async resolve({ ctx }) {
      return await ctx.prisma.congress.findMany({
        orderBy: {
          congress: 'desc',
        },
      })
    },
  })
  .mutation('delete-chambresses', {
    async resolve({ ctx }) {
      return await ctx.prisma.chambress.deleteMany()
    },
  })
  .mutation('create-chambresses', {
    async resolve({ ctx }) {
      const res = await pipe(
        TETry(() => fetchCongressAPI('/congress', { limit: 40 })),
        TE.chainEitherK((res) =>
          res.status === 200 ? E.right(res) : E.left(CongressAPIError.of(res)),
        ),
        TE.chain((res) => TETry(() => res.json())),
        TE.chainEitherK((json) =>
          ETry(() => congressResponseValidator.parse(json)),
        ),
        TE.map(({ congresses }) =>
          pipe(congresses, A.filterMap(congressToChambress), A.flatten),
        ),
        TE.chain((chambresses) =>
          TETry(() =>
            ctx.prisma.chambress.createMany({
              data: chambresses,
              skipDuplicates: true,
            }),
          ),
        ),
      )()

      if (E.isRight(res)) {
        return res.right
      } else {
        throw res.left
      }
    },
  })
  .query('get-chambresses', {
    async resolve({ ctx }) {
      return await ctx.prisma.chambress.findMany()
    },
  })
  .mutation('get-cong-by-num', {
    input: z.object({ number: z.number() }),
    async resolve({ input, ctx }) {
      const congressResponse = await apiFetch(input.number)
      let congress = await ctx.prisma.congress.findFirst({
        where: { congress: congressResponse.number },
      })
      if (!congress) {
        await ctx.prisma.congress.create({
          data: {
            congress: congressResponse.number,
            startYear: congressResponse.startYear,
            endYear: congressResponse.endYear,
          },
        })
        return await ctx.prisma.congress.findFirst({
          where: {
            congress: congressResponse.number,
          },
        })
      }
      return congress
    },
  })

// export type definition of API
export type AppRouter = typeof appRouter
