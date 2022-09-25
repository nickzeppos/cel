// src/server/router/index.ts
import { createRouter } from './context'
import superjson from 'superjson'
import { z } from 'zod'
import { apiFetch } from '../patterns/fetching'
import fetch, { Response } from 'node-fetch'
import { Chambress, Chamber } from '@prisma/client'
import { flow, identity, pipe, absurd } from 'fp-ts/lib/function'
import * as E from 'fp-ts/lib/Either'
import * as TE from 'fp-ts/lib/TaskEither'
import * as IO from 'fp-ts/lib/IO'
import * as IE from 'fp-ts/lib/IOEither'
import * as A from 'fp-ts/lib/Array'
import * as O from 'fp-ts/lib/Option'
import { option } from 'fp-ts'

const API_KEY = process.env.CONGRESS_GOV_API_KEY
const API_BASE_URL = process.env.CONGRESS_GOV_API_BASE_URL

const ChamberEnum = z.enum(['House of Representatives', 'Senate'])
type ChamberEnum = z.infer<typeof ChamberEnum>
const ChamberEnumToPrismaChamber: Record<ChamberEnum, Chamber> = {
  'House of Representatives': Chamber.HOUSE,
  Senate: Chamber.SENATE,
}
const PrismaChamberToChamberEnum: Record<Chamber, ChamberEnum> = {
  [Chamber.HOUSE]: 'House of Representatives',
  [Chamber.SENATE]: 'Senate',
}
function congressNameToNumber(name: string): number | null {
  const n = Number.parseInt(name)
  return Number.isNaN(n) ? null : n
}
export function isNotNullOrUndefined<T>(
  maybe: T | null | undefined,
): maybe is T {
  return maybe !== undefined && maybe != null
}
export function filterNulls<T>(xs: (T | null)[]): T[] {
  return xs.filter(isNotNullOrUndefined)
}
class CongressAPIError extends Error {
  public _tag: 'CongressAPIError'
  public response: Response
  private constructor(response: Response) {
    super(
      `congress API error response [${response.status}]: ${response.statusText}`,
    )
    this._tag = 'CongressAPIError'
    this.response = response
  }
  public static of(response: Response): CongressAPIError {
    return new CongressAPIError(response)
  }
}

const congressResponseValidator = z.object({
  congresses: z.array(
    z.object({
      endYear: z.string(),
      startYear: z.string(),
      name: z.string(), // ###th Congress
      sessions: z.array(z.object({ chamber: ChamberEnum })),
    }),
  ),
})

function errorIdentity(err: unknown): Error {
  return err instanceof Error ? err : new Error(`${err}`)
}

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
        TE.tryCatch(
          () =>
            fetch(`${API_BASE_URL}?limit=40&api_key=${API_KEY}`, {
              headers: { accept: 'application/json' },
            }),
          errorIdentity,
        ),
        TE.chain((res) =>
          res.status === 200
            ? TE.right(res)
            : TE.left(CongressAPIError.of(res)),
        ),
        TE.chain((res) => TE.tryCatch(() => res.json(), errorIdentity)),
        TE.chainEitherK((json) => {
          const parsed = congressResponseValidator.safeParse(json)
          return parsed.success ? E.right(parsed.data) : E.left(parsed.error)
        }),
        TE.chainEitherK(({ congresses }) =>
          E.of(
            pipe(
              congresses,
              A.filterMap(({ name }) => {
                const congress = congressNameToNumber(name)
                if (congress == null || congress < 93) return option.none
                return option.some([
                  { congress, chamber: Chamber.HOUSE },
                  { congress, chamber: Chamber.SENATE },
                ])
              }),
              A.flatten,
            ),
          ),
        ),
        TE.chain((chambresses) =>
          TE.tryCatch(
            () =>
              ctx.prisma.chambress.createMany({
                data: chambresses,
                skipDuplicates: true,
              }),
            errorIdentity,
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
