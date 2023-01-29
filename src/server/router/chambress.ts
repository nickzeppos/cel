import { ETry, TETry } from '../../utils/fp'
import { fetchCongressAPI } from '../../workers/congressAPI'
import {
  ChamberDisplay,
  CongressAPIError,
  congressToChambress,
} from '../chambress'
import { createRouter } from './context'
import * as A from 'fp-ts/lib/Array'
import * as E from 'fp-ts/lib/Either'
import * as TE from 'fp-ts/lib/TaskEither'
import { pipe } from 'fp-ts/lib/function'
import { z } from 'zod'

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

export const chambressRouter = createRouter()
  .query('get-all', {
    async resolve({ ctx }) {
      return await ctx.prisma.chambress.findMany()
    },
  })
  .mutation('delete-all', {
    async resolve({ ctx }) {
      return await ctx.prisma.chambress.deleteMany()
    },
  })
  .mutation('create-all', {
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
