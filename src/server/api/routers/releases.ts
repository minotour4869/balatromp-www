import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from '@/server/api/trpc'
import { db } from '@/server/db'
import { releases } from '@/server/db/schema'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

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
        smods_version: z.string().default('latest'),
        lovely_version: z.string().default('latest'),
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
          smods_version: input.smods_version,
          lovely_version: input.lovely_version,
        })
        .returning()

      return res[0]
    }),
  updateRelease: adminProcedure
    .input(
      z.object({
        id: z.number(),
        version: z.string(),
        url: z.string(),
        name: z.string(),
        description: z.string(),
        smods_version: z.string().default('latest'),
        lovely_version: z.string().default('latest'),
      })
    )
    .mutation(async ({ input }) => {
      const res = await db
        .update(releases)
        .set({
          version: input.version,
          url: input.url,
          name: input.name,
          description: input.description,
          smods_version: input.smods_version,
          lovely_version: input.lovely_version,
        })
        .where(eq(releases.id, input.id))
        .returning()

      return res[0]
    }),
  deleteRelease: adminProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await db
        .delete(releases)
        .where(eq(releases.id, input.id))

      return { success: true }
    }),
})
