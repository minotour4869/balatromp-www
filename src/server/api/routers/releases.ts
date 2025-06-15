import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from '@/server/api/trpc'
import { db } from '@/server/db'
import { branches, releases } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export const releasesRouter = createTRPCRouter({
  getReleases: publicProcedure.query(async () => {
    const res = await db
      .select({
        id: releases.id,
        name: releases.name,
        description: releases.description,
        version: releases.version,
        url: releases.url,
        smods_version: releases.smods_version,
        lovely_version: releases.lovely_version,
        branchId: releases.branchId,
        branchName: branches.name,
        createdAt: releases.createdAt,
        updatedAt: releases.updatedAt,
      })
      .from(releases)
      .leftJoin(branches, eq(releases.branchId, branches.id))
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
        branchId: z.number().default(1),
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
          branchId: input.branchId,
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
        branchId: z.number().default(1),
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
          branchId: input.branchId,
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
      await db.delete(releases).where(eq(releases.id, input.id))

      return { success: true }
    }),
})
