import ky from 'ky'
import { db } from '../db'
import { redis } from '../redis'
import { transcripts } from '../db/schema'
import { eq } from 'drizzle-orm'
import { discord_service } from './discord.service'

const BOTLATRO_URL = 'http://balatro.virtualized.dev:4931/api/stats/'

const instance = ky.create({
  prefixUrl: BOTLATRO_URL,
  timeout: 60000,
})

export const TRANSCRIPT_CACHE_KEY = (gameNumber: number) => `transcript:${gameNumber}`

export const botlatro_service = {
  get_leaderboard: async (queue_id: string) => {
    const res = await instance
      .get(`leaderboard/${queue_id}?limit=100000`)
      .json<LeaderboardResponse>()

    res.leaderboard.sort((a, b) => b.mmr - a.mmr)

    const fixed: Array<LeaderboardEntry> = res.leaderboard.map(
      (entry, idx) => ({
        ...entry,
        rank: entry.rank,
        id: entry.id,
        name: entry.name ?? `User: ${entry.id}`,
        totalgames: entry.wins + entry.losses,
        winrate:
          entry.wins + entry.losses > 0
            ? entry.wins / (entry.wins + entry.losses)
            : 0,
      })
    )

    return fixed
  },

  get_history: async (player_ids: string[], queue_id: number, limit?: number) => {
    const results: Record<string, MatchHistoryEntry[]> = {}

    for (const user_id of player_ids) {
      try {
        const searchParams: Record<string, string> = {}
        if (limit) {
          searchParams.limit = limit.toString()
        }

        const response = await instance
          .get(`history/${user_id}/${queue_id}`, {
            searchParams,
          })
          .json<{ matches: MatchHistoryEntry[] }>()

        results[user_id] = response.matches
      } catch (error) {
        console.error(`Error fetching history for user ${user_id}:`, error)
        results[user_id] = []
      }
    }

    return results
  },

  get_overall_history: async (queue_id: number, limit?: number) => {
    try {
      const searchParams: Record<string, string> = {}
      if (limit) {
        searchParams.limit = limit.toString()
      }

      const response = await instance
        .get(`overall-history/${queue_id}`, {
          searchParams,
        })
        .json<{ matches: OverallMatchHistoryEntry[] }>()

      return response.matches
    } catch (error) {
      console.error(`Error fetching overall history for queue ${queue_id}:`, error)
      return []
    }
  },

  get_transcript: async (gameNumber: number) => {
    const cacheKey = TRANSCRIPT_CACHE_KEY(gameNumber)
    const cachedTranscript = await redis.get(cacheKey)

    if (cachedTranscript) {
      console.log(`Transcript #${gameNumber} found in Redis cache`)
      return cachedTranscript
    }

    const dbTranscript = await db.query.transcripts.findFirst({
      where: eq(transcripts.gameNumber, gameNumber),
    })

    if (dbTranscript) {
      console.log(`Transcript #${gameNumber} found in database`)
      await redis.set(cacheKey, dbTranscript.content)
      return dbTranscript.content
    }

    console.log(`Fetching transcript #${gameNumber} from neatqueue`)
    try {
      const response = await instance.get(`transcript/${gameNumber}`).json<string>()

      await db
        .insert(transcripts)
        .values({
          gameNumber,
          content: response,
        })
        .onConflictDoUpdate({
          target: transcripts.gameNumber,
          set: { content: response },
        })

      await redis.set(cacheKey, response)
      return response
    } catch (error) {
      console.error(`Error fetching transcript #${gameNumber}:`, error)
      throw error
    }
  },
}

export type LeaderboardEntry = {
  id: string
  name: string
    mmr: number
    wins: number
    losses: number
    streak: number
    totalgames: number
    decay?: number
    ign?: any
    peak_mmr: number
    peak_streak: number
    rank: number
    winrate: number
}

export type LeaderboardResponse = {
  leaderboard: LeaderboardEntry[]
}

export type MatchHistoryEntry = {
  match_id: number
  won: boolean
  elo_change: number | null
  team: number | null
  deck: string | null
  stake: string | null
  best_of_3: boolean
  best_of_5: boolean
  created_at: string
  winning_team: number | null
}

export type OverallMatchHistoryEntry = {
  match_id: number
  winning_team: number | null
  deck: string | null
  stake: string | null
  best_of_3: boolean
  best_of_5: boolean
  created_at: string
  players: Array<{
    user_id: string
    team: number | null
    elo_change: number | null
  }>
}
