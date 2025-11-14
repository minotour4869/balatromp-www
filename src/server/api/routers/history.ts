import { createTRPCRouter, publicProcedure } from '@/server/api/trpc'
import { db } from '@/server/db'
import { memoryLogs, metadata, player_games, raw_history } from '@/server/db/schema'
import { botlatro_service } from '@/server/services/botlatro.service'
import { RANKED_QUEUE_ID } from '@/shared/constants'
import { and, desc, eq, gt, lt, sql } from 'drizzle-orm'
import ky from 'ky'
import { chunk } from 'remeda'
import { z } from 'zod'

// Memory profiling utility
let currentRunId: string | null = null

function logMemory(label: string, metadata?: Record<string, any>) {
  if (!currentRunId) return

  const mem = process.memoryUsage()
  const data = {
    runId: currentRunId,
    label,
    heapUsedMb: mem.heapUsed / 1024 / 1024,
    heapTotalMb: mem.heapTotal / 1024 / 1024,
    rssMb: mem.rss / 1024 / 1024,
    externalMb: mem.external / 1024 / 1024,
    metadata: metadata || null,
  }

  // Fire and forget
  db.insert(memoryLogs).values(data).catch(err => {
    console.error('[Memory Log Error]', err)
  })

  console.log(`[MEMORY ${label}]`, {
    heap: `${Math.round(data.heapUsedMb)}MB`,
    rss: `${Math.round(data.rssMb)}MB`,
    ...metadata
  })
}

// Limit concurrent promises to avoid memory spikes
async function pLimit<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<any>
): Promise<any[]> {
  const results: any[] = []
  const executing: Promise<void>[] = []

  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item)).then(result => {
      results.push(result)
    })

    executing.push(p)

    if (executing.length >= concurrency) {
      await Promise.race(executing)
      executing.splice(executing.findIndex(e => e === p), 1)
    }
  }

  await Promise.all(executing)
  return results
}

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
        .where(
          and(
            eq(player_games.playerId, input.user_id),
            eq(player_games.queueId, input.queue_id)
          )
        )
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
      return syncHistoryByDateRange(
        input.queue_id,
        input.start_date,
        input.end_date
      )
    }),
  getMemoryLogs: publicProcedure
    .input(
      z.object({
        limit: z.number().default(1000),
        runId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      let query = db
        .select()
        .from(memoryLogs)
        .orderBy(desc(memoryLogs.timestamp))
        .limit(input.limit)

      if (input.runId) {
        query = query.where(eq(memoryLogs.runId, input.runId)) as any
      }

      return await query
    }),
})

export async function syncSingleMatch(queue_id: string, match_id: number) {
  const data = await ky
    .get(
      `http://balatro.virtualized.dev:4931/api/stats/overall-history/${queue_id}`,
      {
        timeout: 60000,
        searchParams: { match_id },
      }
    )
    .json<OverallHistoryResponse>()

  if (!data.matches.length) {
    throw new Error(`No match found for match_id ${match_id}`)
  }

  await insertGameHistory(data.matches, queue_id).catch((e) => {
    console.error(e)
    throw e
  })

  return data.matches[0]
}

export async function syncHistory(queue_id: string) {
  currentRunId = crypto.randomUUID()
  logMemory('sync_start', { queue_id })

  const cursor = await db
    .select()
    .from(metadata)
    .where(eq(metadata.key, `history_cursor_${queue_id}`))
    .limit(1)
    .then((res) => res[0])

  logMemory('after_cursor_fetch', { cursor_value: cursor?.value })

  const data = await ky
    .get(
      `http://balatro.virtualized.dev:4931/api/stats/overall-history/${queue_id}`,
      {
        timeout: 60000,
        searchParams: { after_match_id: cursor?.value ?? 1 },
      }
    )
    .json<OverallHistoryResponse>()

  logMemory('after_api_fetch', { matches_count: data.matches.length })

  const lastGameId = data.matches.sort((a, b) => b.match_id - a.match_id)[0]
    ?.match_id

  if (!lastGameId) {
    throw new Error('No last game found')
  }

  logMemory('after_sort', { last_game_id: lastGameId })

  await db
    .insert(metadata)
    .values({
      key: `history_cursor_${queue_id}`,
      value: lastGameId.toString(),
    })
    .onConflictDoUpdate({
      target: metadata.key,
      set: {
        key: `history_cursor_${queue_id}`,
        value: lastGameId.toString(),
      },
    })

  logMemory('after_cursor_update')

  const chunkedData = chunk(data.matches, 100)
  logMemory('after_chunking', { chunk_count: chunkedData.length })

  for (let i = 0; i < chunkedData.length; i++) {
    await insertGameHistory(chunkedData[i]!, queue_id).catch((e) => {
      console.error(e)
    })
    logMemory(`after_chunk_${i}`, { chunk_index: i, chunk_size: chunkedData[i]!.length })
  }

  logMemory('sync_end')
  currentRunId = null

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

  const data = await response.json<OverallHistoryResponse>()

  const chunkedData = chunk(data.matches, 100)
  for (const chunk of chunkedData) {
    await insertGameHistory(chunk, queue_id).catch((e) => {
      console.error(e)
    })
  }
  return data
}

function processGameEntry(
  gameId: number,
  game_num: number,
  entry: any,
  queue_id: string
) {
  const parsedEntry = typeof entry === 'string' ? JSON.parse(entry) : entry

  // Validate required fields
  if (!parsedEntry.winning_team) {
    return []
  }

  if (!parsedEntry.players || parsedEntry.players.length < 2) {
    return []
  }

  if (!parsedEntry.players[0]?.user_id || !parsedEntry.players[1]?.user_id) {
    return []
  }

  const player0 = parsedEntry.players[0]
  const player1 = parsedEntry.players[1]

  // Determine results based on winning_team
  const p0result = parsedEntry.winning_team === player0.team ? 'win' : 'loss'
  const p1result = parsedEntry.winning_team === player1.team ? 'win' : 'loss'

  return [
    {
      gameId,
      gameNum: game_num,
      queueId: queue_id,
      gameTime: new Date(parsedEntry.created_at),
      gameType: RANKED_QUEUE_ID === queue_id ? 'ranked' : 'unranked',
      mmrChange: Number.parseFloat(player0.elo_change ?? 0),
      opponentId: player1.user_id,
      opponentMmr: Number.parseFloat(player1.mmr_after ?? player1.mmr ?? 0),
      opponentName: player1.name ?? 'Unknown',
      playerId: player0.user_id,
      playerMmr: Number.parseFloat(player0.mmr_after ?? player0.mmr ?? 0),
      playerName: player0.name ?? 'Unknown',
      result: p0result,
      won: parsedEntry.winning_team === player0.team,
    },
    {
      gameId,
      gameNum: game_num,
      queueId: queue_id,
      gameTime: new Date(parsedEntry.created_at),
      gameType: RANKED_QUEUE_ID === queue_id ? 'ranked' : 'unranked',
      mmrChange: Number.parseFloat(player1.elo_change ?? 0),
      opponentId: player0.user_id,
      opponentMmr: Number.parseFloat(player0.mmr_after ?? player0.mmr ?? 0),
      opponentName: player0.name ?? 'Unknown',
      playerId: player1.user_id,
      playerMmr: Number.parseFloat(player1.mmr_after ?? player1.mmr ?? 0),
      playerName: player1.name ?? 'Unknown',
      result: p1result,
      won: parsedEntry.winning_team === player1.team,
    },
  ]
}
export async function insertGameHistory(entries: any[], queue_id: string) {
  logMemory('insert_start', { entries_count: entries.length })

  // Limit concurrent DB operations to prevent memory bloat
  const rawResults = await pLimit(entries, 10, async (entry) => {
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
  }).then((res) => res.filter(Boolean))

  logMemory('after_raw_insert', { raw_results_count: rawResults.length })

  const playerGameRows = rawResults.flatMap(({ entry, id, game_num }: any) => {
    return processGameEntry(id, game_num, entry, queue_id)
  })

  logMemory('after_flatmap', { player_rows_count: playerGameRows.length })

  // Limit concurrent player game inserts as well
  await pLimit(playerGameRows, 20, async (row) => {
    return db
      .insert(player_games)
      .values(row)
      .onConflictDoUpdate({
        target: [player_games.playerId, player_games.gameNum],
        set: row,
      })
      .then((res) => res[0])
  })

  logMemory('insert_end')
}

export interface OverallHistoryResponse {
  matches: Match[]
}

export interface Match {
  match_id: number
  winning_team: number
  deck: string | null
  stake: string | null
  best_of_3: boolean
  best_of_5: boolean
  created_at: string
  players: Player[]
}

export interface Player {
  user_id: string
  name: string
  team: number
  elo_change: number
  mmr_after: number
}
