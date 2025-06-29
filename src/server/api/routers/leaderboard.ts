import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from '@/server/api/trpc'
import { LeaderboardService } from '@/server/services/leaderboard'
import type { LeaderboardEntry } from '@/server/services/neatqueue.service'
import { SeasonSchema } from '@/shared/seasons'
import { z } from 'zod'
const service = new LeaderboardService()

export const leaderboard_router = createTRPCRouter({
  get_leaderboard: publicProcedure
    .input(
      z.object({
        channel_id: z.string(),
        season: SeasonSchema.optional().default('season3'),
      })
    )
    .query(async ({ input }) => {
      if (input.season === 'season2') {
        // For Season 2, use the snapshot data
        const season2Data = await service.getSeason2Leaderboard(input.channel_id)
        return {
          data: season2Data,
          isStale: false,
        }
      } else {
        // For Season 3 or all, use the current data
        const result = await service.getLeaderboard(input.channel_id)
        return {
          data: result.data as LeaderboardEntry[],
          isStale: result.isStale,
        }
      }
    }),
  get_leaderboard_snapshots: adminProcedure
    .input(
      z.object({
        channel_id: z.string(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return await service.getLeaderboardSnapshots(
        input.channel_id,
        input.limit
      )
    }),
  get_user_rank: publicProcedure
    .input(
      z.object({
        channel_id: z.string(),
        user_id: z.string(),
        season: SeasonSchema.optional().default('season3'),
      })
    )
    .query(async ({ input }) => {
      if (input.season === 'season2') {
        // For Season 2, use the snapshot data
        const userData = await service.getSeason2UserRank(input.channel_id, input.user_id)
        if (!userData) return null
        return {
          data: userData,
          isStale: false,
        }
      } else {
        // For Season 3 or all, use the current data
        const result = await service.getUserRank(input.channel_id, input.user_id)
        if (!result) return null
        return {
          data: result.data,
          isStale: result.isStale,
        }
      }
    }),
})
