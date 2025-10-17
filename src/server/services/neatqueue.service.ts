import ky from 'ky'
import { db } from '../db'
import { redis } from '../redis'
import { transcripts } from '../db/schema'
import { eq } from 'drizzle-orm'

const BOTLATRO_URL = 'http://balatro.virtualized.dev:4931/api/stats'

const instance = ky.create({
  prefixUrl: BOTLATRO_URL,
  timeout: 60000,
})

export const TRANSCRIPT_CACHE_KEY = (gameNumber: number) => `transcript:${gameNumber}`

export const QUEUE_IDS = {
  ranked: 1,
  smallworld: 2,
  sandbox: 3,
  vanilla: 4,
  casual: 5,
} as const

export const neatqueue_service = {
  get_leaderboard: async (queue_id: number) => {
    const res = await instance
      .get(`leaderboard/${queue_id}`)
      .json<LeaderboardResponse>()

    res.alltime.sort((a, b) => b.data.mmr - a.data.mmr)

    const fixed: Array<Data & { id: string; name: string }> = res.alltime.map(
      (entry, idx) => ({
        ...entry.data,
        rank: idx + 1,
        id: entry.id,
        name: entry.name,
        totalgames: entry.data.wins + entry.data.losses,
        winrate:
          entry.data.wins + entry.data.losses > 0
            ? entry.data.wins / (entry.data.wins + entry.data.losses)
            : 0,
      })
    )

    return fixed
  },

  get_history: async (player_ids: string[], queue_id: number) => {
    const results: Record<string, MatchHistoryEntry[]> = {}

    for (const user_id of player_ids) {
      try {
        const response = await instance
          .get(`history/${user_id}/${queue_id}`)
          .json<{ matches: MatchHistoryEntry[] }>()

        results[user_id] = response.matches
      } catch (error) {
        console.error(`Error fetching history for user ${user_id}:`, error)
        results[user_id] = []
      }
    }

    return results
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

export type Data = {
  mmr: number
  wins: number
  losses: number
  streak: number
  totalgames: number
  decay: number
  ign?: any
  peak_mmr: number
  peak_streak: number
  rank: number
  winrate: number
}

export type LeaderboardEntryInternal = {
  id: string
  data: Data
  name: string
}

export type LeaderboardResponse = {
  alltime: LeaderboardEntryInternal[]
}

export type LeaderboardEntry = Data & {
  id: string
  name: string
}

export type MatchHistoryEntry = {
  match_id: number
  won: boolean
  elo_change: number
  team: number
  deck: string | null
  stake: string | null
  best_of_3: boolean
  best_of_5: boolean
  created_at: string
  winning_team: number
}
