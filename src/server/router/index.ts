// src/server/router/index.ts
import { createRouter } from './context'
import superjson from 'superjson'
import { z } from 'zod'
import { apiFetch } from '../patterns/fetching'
import fetch, { Headers, Request } from 'node-fetch'
import { Chamber, Member } from '@prisma/client'
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

const allMemberResponseValidator = z.object({
  members: z.array(
    z.object({
      bioguideId: z.string(),
      depiction: z
        .object({
          attribution: z.string().nullish(),
          imageUrl: z.string().nullish(),
        })
        .nullish(),
      district: z.number().int().nullable(),
      name: z.string(),
      party: z.string(),
      served: z.object({
        House: z
          .array(
            z.object({
              end: z.number().int().nullable(),
              start: z.number().int(),
            }),
          )
          .optional(),
        Senate: z
          .array(
            z.object({
              end: z.number().int().nullable(),
              start: z.number().int(),
            }),
          )
          .optional(),
      }),
      state: z.string(),
      url: z.string().url(),
    }),
  ),
  pagination: z.object({
    count: z.number().int(),
    next: z.string().url().nullish(),
  }),
  request: z.object({
    contentType: z.string(),
    format: z.string(),
  }),
})
type AllMemberResponse = z.infer<typeof allMemberResponseValidator>

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
  .query('members-page-one', {
    async resolve() {
      const rawRes = await fetchCongressAPI('/member', {})
      const json = await rawRes.json()
      return allMemberResponseValidator.parse(json)
    },
  })
  .mutation('create-members', {
    async resolve({ ctx }) {
      let totalCount = 0
      let page = 1
      let offset: string | number = 0
      let limit: string | number = 200
      let hasNextPage = true

      do {
        const rawRes = await fetchCongressAPI('/member', { offset, limit })
        const json = await rawRes.json()
        const data = allMemberResponseValidator.parse(json)
        const prismaInput = pipe(data.members, A.filterMap(transformMember))
        const { count } = await ctx.prisma.member.createMany({
          data: prismaInput,
          skipDuplicates: true,
        })
        console.log(`populated ${count} members from page ${page}`)
        totalCount += count
        const { next } = data.pagination
        console.log(`next url: ${next}`)
        if (next == null || next.length === 0) {
          hasNextPage = false
        } else {
          const nextURL = new URL(next)
          const nextOffset = nextURL.searchParams.get('offset')
          const nextLimit = nextURL.searchParams.get('limit')
          if (nextOffset == null || nextLimit == null) {
            hasNextPage = false
          } else {
            offset = nextOffset
            limit = nextLimit
            page++
          }
        }
      } while (hasNextPage)
      return { count: totalCount }
    },
  })
  .query('get-members', {
    async resolve({ ctx }) {
      return ctx.prisma.member.findMany({
        take: 500,
      })
    },
  })

// export type definition of API
export type AppRouter = typeof appRouter

function transformMember({
  bioguideId,
  name,
  party,
  state,
  district,
  url,
  depiction,
  served,
}: AllMemberResponse['members'][number]): option.Option<Member> {
  const imageUrl = depiction?.imageUrl ?? null
  const attribution = depiction?.attribution ?? null

  let servedHouseStart: number | null = null
  let servedHouseEnd: number | null = null
  let servedSenateStart: number | null = null
  let servedSenateEnd: number | null = null

  for (const term of served.Senate ?? []) {
    if (servedSenateStart == null || servedSenateStart > term.start) {
      servedSenateStart = term.start
    }
    if (servedSenateEnd == null || servedSenateEnd < (term.end ?? 0)) {
      servedSenateEnd = term.end
    }
  }
  for (const term of served.House ?? []) {
    if (servedHouseStart == null || servedHouseStart > term.start) {
      servedHouseStart = term.start
    }
    if (servedHouseEnd == null || servedHouseEnd < (term.end ?? 0)) {
      servedHouseEnd = term.end
    }
  }

  if (Math.max(servedHouseEnd ?? 0, servedSenateEnd ?? 0) < 1973)
    return option.none

  return option.some({
    bioguideId,
    name,
    party,
    state,
    district,
    url,
    imageUrl,
    attribution,
    servedHouseStart,
    servedHouseEnd,
    servedSenateStart,
    servedSenateEnd,
  })
}
