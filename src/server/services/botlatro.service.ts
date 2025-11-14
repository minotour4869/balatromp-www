import { eq } from 'drizzle-orm'
import { db } from '../db'
import { transcripts } from '../db/schema'
import { redis } from '../redis'

const BOTLATRO_URL = 'http://balatro.virtualized.dev:4931/api/stats/'

export const TRANSCRIPT_CACHE_KEY = (gameNumber: number) =>
  `transcript:${gameNumber}`

export const botlatro_service = {
  get_leaderboard: async (queue_id: string) => {
    const response = await fetch(
      `${BOTLATRO_URL}leaderboard/${queue_id}?limit=100000`
    )
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
    }
    const res = (await response.json()) as LeaderboardResponse

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

  get_history: async (
    player_ids: string[],
    queue_id: number,
    limit?: number
  ) => {
    const results: Record<string, MatchHistoryEntry[]> = {}

    for (const user_id of player_ids) {
      try {
        const params = new URLSearchParams()
        if (limit) {
          params.set('limit', limit.toString())
        }

        const url = `${BOTLATRO_URL}history/${user_id}/${queue_id}${params.toString() ? `?${params.toString()}` : ''}`
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(
            `HTTP Error: ${response.status} ${response.statusText}`
          )
        }
        const data = (await response.json()) as { matches: MatchHistoryEntry[] }

        results[user_id] = data.matches
      } catch (error) {
        console.error(`Error fetching history for user ${user_id}:`, error)
        results[user_id] = []
      }
    }

    return results
  },

  get_overall_history: async (queue_id: number, limit?: number) => {
    try {
      const params = new URLSearchParams()
      if (limit) {
        params.set('limit', limit.toString())
      }

      const url = `${BOTLATRO_URL}overall-history/${queue_id}${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
      }
      const data = (await response.json()) as {
        matches: OverallMatchHistoryEntry[]
      }

      return data.matches
    } catch (error) {
      console.error(
        `Error fetching overall history for queue ${queue_id}:`,
        error
      )
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
      const response = await fetch(`${BOTLATRO_URL}transcript/${gameNumber}`)
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
      }
      const data = (await response.json()) as string

      await db
        .insert(transcripts)
        .values({
          gameNumber,
          content: data,
        })
        .onConflictDoUpdate({
          target: transcripts.gameNumber,
          set: { content: data },
        })

      await redis.set(cacheKey, data)
      return data
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
  player_name: string
  mmr_after: number
  won: boolean
  elo_change: number
  team: number
  opponents: Array<{
    user_id: string
    name: string
    team: number
    elo_change: number
    mmr_after: number
  }>
  deck: string | null
  stake: string | null
  best_of_3: boolean
  best_of_5: boolean
  created_at: string
  winning_team: number
}

export type OverallMatchHistoryEntry = {
  match_id: number
  player_name: string
  mmr_after: number
  won: boolean
  elo_change: number
  team: number
  opponents: Array<{
    user_id: string
    name: string
    team: number
    elo_change: number
    mmr_after: number
  }>
  deck: string | null
  stake: string | null
  best_of_3: boolean
  best_of_5: boolean
  created_at: string
  winning_team: number
}
