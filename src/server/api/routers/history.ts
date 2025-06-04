import { createTRPCRouter, publicProcedure } from '@/server/api/trpc'
import { db } from '@/server/db'
import { metadata, player_games, raw_history } from '@/server/db/schema'
import { and, desc, eq, gt, lt, sql } from 'drizzle-orm'
import ky from 'ky'
import { chunk } from 'remeda'
import { z } from 'zod'

export const history_router = createTRPCRouter({
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
  sync: publicProcedure.mutation(async () => {
    return syncHistory()
  }),
  user_games: publicProcedure
    .input(
      z.object({
        user_id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(player_games)
        .where(eq(player_games.playerId, input.user_id))
        .orderBy(desc(player_games.gameNum))
    }),
})

export async function syncHistory() {
  const cursor = await db
    .select()
    .from(metadata)
    .where(eq(metadata.key, 'history_cursor'))
    .limit(1)
    .then((res) => res[0])
  const data = await ky
    .get('https://api.neatqueue.com/api/history/1226193436521267223', {
      searchParams: {
        start_game_number: cursor?.value ?? 1,
      },
      timeout: 60000,
    })
    .json<any>()
  const matches = await fetch(
    'https://api.neatqueue.com/api/matches/1226193436521267223'
  ).then((res) => res.json())
  const firstGame = Object.keys(matches).sort(
    (a, b) => Number.parseInt(a) - Number.parseInt(b)
  )[0]

  if (!firstGame) {
    throw new Error('No first game found')
  }
  if (firstGame === 'detail') {
    await db.insert(metadata).values({
      key: 'history_cursor_failure',
      value: JSON.stringify(matches),
    })
    throw new Error('Something went wrong')
  }
  await db
    .insert(metadata)
    .values({
      key: 'history_cursor',
      value: firstGame,
    })
    .onConflictDoUpdate({
      target: metadata.key,
      set: {
        key: 'history_cursor',
        value: firstGame,
      },
    })

  const chunkedData = chunk(data.data, 100)
  for (const chunk of chunkedData) {
    await insertGameHistory(chunk).catch((e) => {
      console.error(e)
    })
  }
  return data
}

function processGameEntry(gameId: number, game_num: number, entry: any) {
  const parsedEntry = typeof entry === 'string' ? JSON.parse(entry) : entry
  if (parsedEntry.game === '1v1-attrition') {
    return []
  }
  if (!parsedEntry.teams?.[0]?.[0] || !parsedEntry.teams?.[1]?.[0]) {
    return []
  }

  if (parsedEntry.winner === -2) {
    return []
  }
  const player0 = parsedEntry.teams[0][0]
  const player1 = parsedEntry.teams[1][0]
  let p0result = null
  let p1result = null

  if (parsedEntry.winner === 2) {
    p0result = 'tie'
    p1result = 'tie'
  } else if (parsedEntry.winner === 0) {
    p0result = 'win'
    p1result = 'loss'
  } else if (parsedEntry.winner === 1) {
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
      gameTime: new Date(parsedEntry.time),
      gameType: parsedEntry.game,
      mmrChange: Number.parseFloat(player0.mmr_change),
      opponentId: player1.id,
      opponentMmr: Number.parseFloat(player1.mmr),
      opponentName: player1.name,
      playerId: player0.id,
      playerMmr: Number.parseFloat(player0.mmr),
      playerName: player0.name,
      result: p0result,
      won: parsedEntry.winner === 0,
    },
    {
      gameId,
      gameNum: game_num,
      gameTime: new Date(parsedEntry.time),
      gameType: parsedEntry.game,
      mmrChange: Number.parseFloat(player1.mmr_change),
      opponentId: player0.id,
      opponentMmr: Number.parseFloat(player0.mmr),
      opponentName: player0.name,
      playerId: player1.id,
      playerMmr: Number.parseFloat(player1.mmr),
      playerName: player1.name,
      result: p1result,
      won: parsedEntry.winner === 1,
    },
  ]
}
export async function insertGameHistory(entries: any[]) {
  const rawResults = await Promise.all(
    entries.map(async (entry) => {
      return db
        .insert(raw_history)
        .values({ entry, game_num: entry.game_num })
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
    return processGameEntry(id, game_num, entry)
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
