import ky from 'ky'
import { db } from '../db'
import { redis } from '../redis'
import { transcripts } from '../db/schema'
import { eq } from 'drizzle-orm'

const NEATQUEUE_URL = 'https://api.neatqueue.com/api'

const instance = ky.create({
  prefixUrl: NEATQUEUE_URL,
  timeout: 60000,
})

const BMM_SERVER_ID = '1226193436521267223'

// Redis key for transcript cache
export const TRANSCRIPT_CACHE_KEY = (gameNumber: number) => `transcript:${gameNumber}`

export const neatqueue_service = {
  get_leaderboard: async (channel_id: string) => {
    const res = await instance
      .get(`leaderboard/${BMM_SERVER_ID}/${channel_id}`)
      .json<LeaderboardResponse>()

    //desc
    res.alltime.sort((a, b) => b.data.mmr - a.data.mmr)
    const fixed: Array<Data & { id: string; name: string }> = res.alltime.map(
      (entry, idx) => {
        return {
          ...entry.data,
          rank: idx + 1,
          id: entry.id,
          name: entry.name,
          totalgames: entry.data.wins + entry.data.losses,
          winrate: entry.data.wins / (entry.data.wins + entry.data.losses),
        }
      }
    )
    return fixed
  },
  get_history: async (
    player_ids: string[],
    server_id: string = BMM_SERVER_ID
  ) => {
    const response = await instance
      .get(`history/${server_id}`, {
        searchParams: {
          server_id,
        },
      })
      .json()
    return response
  },
  get_transcript: async (gameNumber: number, server_id: string = BMM_SERVER_ID) => {
    // Try to get from Redis cache first (fastest)
    const cacheKey = TRANSCRIPT_CACHE_KEY(gameNumber)
    const cachedTranscript = await redis.get(cacheKey)

    if (cachedTranscript) {
      console.log(`Transcript #${gameNumber} found in Redis cache`)
      return cachedTranscript
    }

    // If not in Redis, try to get from database
    const dbTranscript = await db.query.transcripts.findFirst({
      where: eq(transcripts.gameNumber, gameNumber)
    })

    if (dbTranscript) {
      console.log(`Transcript #${gameNumber} found in database`)
      // Store in Redis for future quick access
      await redis.set(cacheKey, dbTranscript.content)
      return dbTranscript.content
    }

    // If not in database, fetch from neatqueue
    console.log(`Fetching transcript #${gameNumber} from neatqueue`)
    try {
      const response = await instance
        .get(`transcript/${server_id}/${gameNumber}`)
        .json<string>()

      // Store in both database and Redis
      await db.insert(transcripts).values({
        gameNumber,
        content: response
      }).onConflictDoUpdate({
        target: transcripts.gameNumber,
        set: { content: response }
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
