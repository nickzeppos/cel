// src/server/router/index.ts
import sharp from 'sharp'
import * as fs from 'fs'
import { createRouter } from './context'
import superjson from 'superjson'
import { z } from 'zod'
import { apiFetch } from '../patterns/fetching'
import fetch, { Headers, Request } from 'node-fetch'
import { Chamber, Member, Prisma } from '@prisma/client'
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

const MEMBER_IMAGES_DIR = './public/member-images'
const SQUARE_IMAGES_DIR = './public/square-images'
const IMAGES_DIR = './public'
const IMAGE_SIZE = 98

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
      return ctx.prisma.member.findMany()
    },
  })
  .mutation('download-member-photos', {
    async resolve({ ctx }) {
      const members = await ctx.prisma.member.findMany()

      if (!fs.existsSync(MEMBER_IMAGES_DIR)) {
        fs.mkdirSync(MEMBER_IMAGES_DIR, { recursive: true })
      }

      const saveImage = async (i: number): Promise<[number | null, number]> => {
        const m = members[i]
        if (m === undefined) return [null, 0]

        const { imageUrl, bioguideId } = m
        if (imageUrl == null || imageUrl.length === 0) return [null, 0]

        const filepath = `${MEMBER_IMAGES_DIR}/${bioguideId}.jpg`
        if (fs.existsSync(filepath)) return [null, 0]

        try {
          const res = await fetch(imageUrl)
          if (res.status === 429) {
            const retryHeader = res.headers.get('Retry-After')
            console.log(`!!! RATE LIMITED ${i} !!!`)
            console.log(retryHeader)
            console.log(res)
            if (retryHeader != null) {
              const rt = Number.parseInt(retryHeader)
              return Number.isNaN(rt) ? [null, 0] : [rt, 0]
            }
            return [null, 0]
          }

          if (res.status === 200) {
            res.body?.pipe(fs.createWriteStream(filepath))
            return [null, 1]
          }
          console.log(res)
          return [null, 0]
        } catch (e) {
          console.log(imageUrl)
          console.log(e)
          return [null, 0]
        }
      }

      let i = 1260
      let i0 = i
      let numImagesSaved = 0
      let t0 = Date.now()
      let retryAfter: null | number = null
      console.log(`start trying to download ${members.length - i} images`)
      while (retryAfter == null) {
        const [rt, saved] = await saveImage(i++)
        retryAfter = rt
        numImagesSaved += saved
        if (numImagesSaved % 10 === 0 && numImagesSaved > 0) {
          console.log(`${numImagesSaved} images saved`)
        }
        if (i % 100 === 0) {
          console.log(`---${i}---`)
        }
        // sleep 220 ms
        // avg req about 82ms so about 1 req every 300ms
        await new Promise((resolve) => {
          setTimeout(() => {
            resolve(true)
          }, 220)
        })
        if (i >= members.length - 1) {
          retryAfter = -1
        }
      }
      let t1 = Date.now()
      let dt = t1 - t0
      let di = i - i0

      console.log(`time: ${dt}ms`)
      console.log(`saved: ${numImagesSaved} images`)
      console.log(`processed: ${di} members`)
      console.log(`last i: ${i}`)

      return 0
    },
  })
  .mutation('square-image', {
    async resolve({ ctx }) {
      if (!fs.existsSync(SQUARE_IMAGES_DIR)) {
        fs.mkdirSync(SQUARE_IMAGES_DIR, { recursive: true })
      }

      // load one image from the dir
      const imageFiles = fs.readdirSync(MEMBER_IMAGES_DIR)
      console.log(imageFiles.length)

      for (let f of imageFiles) {
        // const f = imageFiles[0]
        const filepath = `${MEMBER_IMAGES_DIR}/${f}`
        const outpath = `${SQUARE_IMAGES_DIR}/${f}`
        if (fs.existsSync(outpath)) continue
        // if (f) {
        //   const match = /([^\.]+)\.jpg/.exec(f)
        //   if (match != null) {
        //     const bioguideId = match[1]
        //     console.log(bioguideId)
        //     const m = await ctx.prisma.member.findUnique({
        //       where: {
        //         bioguideId,
        //       },
        //     })
        //     if (m != null) {
        //       console.log(m)
        //     }
        //   }
        // }
        const i = await sharp(filepath)
          .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: 'cover' })
          .toBuffer()
        fs.writeFileSync(outpath, i)
      }

      return 0
    },
  })
  .mutation('pack-image', {
    async resolve({ ctx }) {
      if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true })
      }

      const imageFiles = fs.readdirSync(SQUARE_IMAGES_DIR)
      const rows = 41
      const cols = 40

      let x = sharp({
        create: {
          width: IMAGE_SIZE * cols,
          height: IMAGE_SIZE * rows,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 1 },
        },
      }).jpeg()
      const composites: sharp.OverlayOptions[] = []
      let a = 0
      let b = 0
      const t0 = Date.now()
      const updates: Prisma.MemberUpdateArgs[] = []
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const i = row * cols + col
          const f = imageFiles[i]
          if (f === undefined) continue
          const inpath = `${SQUARE_IMAGES_DIR}/${f}`
          const fi = await sharp(inpath).toBuffer()
          const left = col * IMAGE_SIZE
          const top = row * IMAGE_SIZE
          composites.push({
            input: fi,
            left,
            top,
          })

          const match = /([^\.]+)\.jpg/.exec(f)
          const bioguideId = match?.[1] ?? null
          if (bioguideId == null) {
            console.log(`unable to parse bioguide ${f}`)
            b++
            continue
          }
          updates.push({
            where: {
              bioguideId,
            },
            data: {
              spriteRow: row,
              spriteCol: col,
            },
          })
          a++
          if (i % 100 === 0) {
            console.log(`processed ${i}`)
          }
        }
      }
      const data = await x.composite(composites).toBuffer()
      const outpath = `${IMAGES_DIR}/congress.jpg`
      fs.writeFileSync(outpath, data)
      // not sure how to make this take less time
      // maybe if it didn't log every query?
      await ctx.prisma.$transaction(
        updates.map((u) => ctx.prisma.member.update(u)),
      )
      const t1 = Date.now()
      const dt = t1 - t0
      console.log(outpath)
      console.log(`time: ${dt}`)
      console.log(`succeeded: ${a}`)
      console.log(`failed: ${b}`)
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
