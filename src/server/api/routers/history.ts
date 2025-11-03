import { createTRPCRouter, publicProcedure } from '@/server/api/trpc'
import { db } from '@/server/db'
import { metadata, player_games, raw_history } from '@/server/db/schema'
import { botlatro_service } from '@/server/services/botlatro.service'
import { and, desc, eq, gt, lt, sql } from 'drizzle-orm'
import ky from 'ky'
import { chunk } from 'remeda'
import { z } from 'zod'
import { RANKED_QUEUE_ID } from '@/shared/constants'

export const history_router = createTRPCRouter({
  getTranscript: publicProcedure
    .input(
      z.object({
        gameNumber: z.number(),
      })
    )
    .query(async ({ input }) => {
      return await botlatro_service.get_transcript(input.gameNumber)
    }),
  games_per_hour: publicProcedure
    .input(
      z
        .object({
          groupBy: z.enum(['hour', 'day', 'week', 'month']).default('hour'),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const groupBy = input?.groupBy || 'hour'
      const startDate = input?.startDate ? new Date(input.startDate) : undefined
      const endDate = input?.endDate ? new Date(input.endDate) : undefined
      const nextDay = endDate ? new Date(endDate) : undefined
      if (nextDay) nextDay.setDate(nextDay.getDate() + 1)
      const games = await ctx.db
        .select({
          gameTime: player_games.gameTime,
          gameNum: player_games.gameNum,
        })
        .from(player_games)
        .where(
          and(
            startDate ? gt(player_games.gameTime, startDate) : undefined,
            nextDay ? lt(player_games.gameTime, nextDay) : undefined
          )
        )
        .orderBy(player_games.gameTime)

      // Track unique game numbers to avoid counting the same game twice
      const processedGameNums = new Set<number>()

      // Group games by the selected time unit
      const gamesByTimeUnit = games.reduce<Record<string, number>>(
        (acc, game) => {
          if (!game.gameTime || !game.gameNum) return acc

          // Skip if we've already processed this game number
          if (processedGameNums.has(game.gameNum)) return acc

          // Mark this game as processed
          processedGameNums.add(game.gameNum)

          const date = new Date(game.gameTime)
          let timeKey: string

          switch (groupBy) {
            case 'hour':
              // Format: YYYY-MM-DD HH:00
              timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`
              break
            case 'day':
              // Format: YYYY-MM-DD
              timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
              break
            case 'week':
              // Get the first day of the week (Sunday)
              const firstDayOfWeek = new Date(date)
              const day = date.getDay() // 0 = Sunday, 1 = Monday, etc.
              firstDayOfWeek.setDate(date.getDate() - day)
              timeKey = `Week of ${firstDayOfWeek.getFullYear()}-${String(firstDayOfWeek.getMonth() + 1).padStart(2, '0')}-${String(firstDayOfWeek.getDate()).padStart(2, '0')}`
              break
            case 'month':
              // Format: YYYY-MM
              timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
              break
            default:
              timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`
          }

          acc[timeKey] = (acc[timeKey] || 0) + 1
          return acc
        },
        {}
      )

      // Convert to array format for chart
      return Object.entries(gamesByTimeUnit).map(([timeUnit, count]) => ({
        timeUnit,
        count,
        groupBy,
      }))
    }),
  user_games: publicProcedure
    .input(
      z.object({
        user_id: z.string(),
        queue_id: z.string().default(RANKED_QUEUE_ID),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(player_games)
        .where(and(eq(player_games.playerId, input.user_id), eq(player_games.queueId, input.queue_id)))
        .orderBy(desc(player_games.gameNum))
    }),
  sync: publicProcedure
    .input(
      z.object({
        queue_id: z.string().default(RANKED_QUEUE_ID),
      })
    )
    .mutation(async ({ input }) => {
      return syncHistory(input.queue_id)
    }),
  syncByDateRange: publicProcedure
    .input(
      z.object({
        queue_id: z.string().default(RANKED_QUEUE_ID),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return syncHistoryByDateRange(input.queue_id, input.start_date, input.end_date)
    }),
})

export async function syncHistory(queue_id: string) {
  const cursor = await db
    .select()
    .from(metadata)
    .where(eq(metadata.key, `history_cursor_${queue_id}`))
    .limit(1)
    .then((res) => res[0])
  const data = await ky
    .get(`http://balatro.virtualized.dev:4931/api/stats/overall-history/${queue_id}`, {
      timeout: 60000,
    })
    .json<any>()
  const matches = await fetch(
    `http://balatro.virtualized.dev:4931/api/stats/overall-history/${queue_id}`
  ).then((res) => res.json())
  const firstGame = Object.keys(matches).sort(
    (a, b) => Number.parseInt(a) - Number.parseInt(b)
  )[0]

  if (!firstGame) {
    throw new Error('No first game found')
  }
  if (firstGame === 'detail') {
    await db.insert(metadata).values({
      key: `history_cursor_failure_${queue_id}`,
      value: JSON.stringify(matches),
    })
    throw new Error('Something went wrong')
  }
  await db
    .insert(metadata)
    .values({
      key: `history_cursor_${queue_id}`,
      value: firstGame,
    })
    .onConflictDoUpdate({
      target: metadata.key,
      set: {
        key: `history_cursor_${queue_id}`,
        value: firstGame,
      },
    })

  const chunkedData = chunk(data.matches, 100)
  for (const chunk of chunkedData) {
    await insertGameHistory(chunk, queue_id).catch((e) => {
      console.error(e)
    })
  }
  return data
}

export async function syncHistoryByDateRange(
  queue_id: string,
  start_date?: string,
  end_date?: string
) {
  const searchParams: Record<string, string> = {}

  if (start_date) {
    searchParams.start_date = start_date
  }

  if (end_date) {
    searchParams.end_date = end_date
  }

  const response = await ky.get(
    `http://balatro.virtualized.dev:4931/api/stats/overall-history/${queue_id}`,
    {
      searchParams,
      timeout: 1000000,
    }
  )

  const data = await response.json<any>()

  const chunkedData = chunk(data.data, 100)
  for (const chunk of chunkedData) {
    await insertGameHistory(chunk, queue_id).catch((e) => {
      console.error(e)
    })
  }
  return data
}

function processGameEntry(gameId: number, game_num: number, entry: any, queue_id: string) {
  const parsedEntry = typeof entry === 'string' ? JSON.parse(entry) : entry
  if (!parsedEntry.winning_team) {
    return []
  }

  if (!parsedEntry.players[0].user_id || !parsedEntry.players[1].user_id) {
    return []
  }

  const player0 = parsedEntry.players[0]
  const player1 = parsedEntry.players[1]
  let p0result = null
  let p1result = null
  if (parsedEntry.winner === 1) {
    p0result = 'win'
    p1result = 'loss'
  } else if (parsedEntry.winner === 2) {
    p0result = 'loss'
    p1result = 'win'
  } else {
    p0result = 'unknown'
    p1result = 'unknown'
  }
  return [
    {
      gameId,
      gameNum: game_num,
      queueId: queue_id,
      gameTime: new Date(parsedEntry.created_at),
      gameType: RANKED_QUEUE_ID === queue_id ? 'ranked' : 'unranked',
      mmrChange: Number.parseFloat(player0.elo_change),
      opponentId: player1.user_id,
      opponentMmr: 350.0, //Number.parseFloat(player1.mmr),
      opponentName: 'test 1',
      playerId: player0.user_id,
      playerMmr: 400.0, //Number.parseFloat(player0.mmr),
      playerName: 'test 0',
      result: p0result,
    },
    {
      gameId,
      gameNum: game_num,
      queueId: queue_id,
      gameTime: new Date(parsedEntry.created_at),
      gameType: RANKED_QUEUE_ID === queue_id ? 'ranked' : 'unranked',
      mmrChange: Number.parseFloat(player1.elo_change),
      opponentId: player0.user_id,
      opponentMmr: 400.0, //Number.parseFloat(player1.mmr),
      opponentName: 'test 0',
      playerId: player1.user_id,
      playerMmr: 350.0, //Number.parseFloat(player0.mmr),
      playerName: 'test 1',
      result: p1result,
    },
  ]
}
export async function insertGameHistory(entries: any[], queue_id: string) {
  const rawResults = await Promise.all(
    entries.map(async (entry) => {
      return db
        .insert(raw_history)
        .values({ entry, game_num: entry.match_id })
        .returning()
        .onConflictDoUpdate({
          target: raw_history.game_num,
          set: {
            entry,
          },
        })
        .then((res) => res[0])
    })
  ).then((res) => res.filter(Boolean))

  const playerGameRows = rawResults.flatMap(({ entry, id, game_num }: any) => {
    return processGameEntry(id, game_num, entry, queue_id)
  })

  await Promise.all(
    playerGameRows.map(async (row) => {
      return db
        .insert(player_games)
        .values(row)
        .onConflictDoUpdate({
          target: [player_games.playerId, player_games.gameNum],
          set: row,
        })
        .then((res) => res[0])
    })
  )
}
