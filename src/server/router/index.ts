// src/server/router/index.ts
import { createRouter } from "./context"
import superjson from "superjson"
import { z } from "zod"
import { apiFetch } from "../patterns/fetching"

export const appRouter = createRouter()
  .transformer(superjson)
  .query("get-all-cong", {
    async resolve({ ctx }) {
      return await ctx.prisma.congress.findMany({
        orderBy: {
          congress: "desc",
        },
      })
    },
  })
  .mutation("get-cong-by-num", {
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
