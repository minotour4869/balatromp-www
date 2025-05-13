import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from '@/server/api/trpc'
import { db } from '@/server/db'
import { releases } from '@/server/db/schema'
import { z } from 'zod'

export const releasesRouter = createTRPCRouter({
  getReleases: publicProcedure.query(async () => {
    const res = await db.select().from(releases)
    return res
  }),
  addRelease: adminProcedure
    .input(
      z.object({
        version: z.string(),
        url: z.string(),
        name: z.string(),
        description: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const res = await db
        .insert(releases)
        .values({
          version: input.version,
          url: input.url,
          name: input.name,
          description: input.description,
        })
        .returning()

      return res[0]
    }),
})
