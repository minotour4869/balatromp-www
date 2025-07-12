import { db } from '@/server/db'
import { player_games } from '@/server/db/schema'
import { desc, eq } from 'drizzle-orm'
import { Redis } from 'ioredis'
const redisClient = new Redis(process.env.REDIS_URL as string)

type PlayerState = {
  status: string
  currentMatch?: {
    opponentId: string
    startTime: number
  }
}

type StatusCount = {
  [key: string]: number
}

type QueueEntry = {
  key: string
  value: PlayerState
}

async function findQueueingPlayers(redis: Redis): Promise<QueueEntry[]> {
  try {
    const queueingPlayers: QueueEntry[] = []
    let cursor = '0'
    const pattern = 'player:*:state'

    do {
      const [newCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        '1000'
      )

      cursor = newCursor

      if (keys.length > 0) {
        const values = await redis.mget(keys)

        keys.forEach((key, index) => {
          const value = values[index]
          if (!value) return

          try {
            const state = JSON.parse(value) as PlayerState
            if (state.status === 'queuing') {
              queueingPlayers.push({
                key,
                value: state,
              })
            }
          } catch (parseError) {
            console.error('Failed to parse player state:', parseError)
            console.error('Problematic value:', value)
          }
        })
      }
    } while (cursor !== '0')

    return queueingPlayers
  } catch (error) {
    console.error('Failed to find queuing players:', error)
    throw error
  }
}

redisClient.on('connect', () => {
  console.log('Redis client connected')
})

redisClient.on('error', (err) => {
  console.error('Redis client error:', err)
})

async function logQueueingPlayers() {
  try {
    const queueingPlayers = await findQueueingPlayers(redisClient)
    console.log('Found', queueingPlayers.length, 'queuing players:')
    console.log(queueingPlayers)

    return await Promise.all(
      queueingPlayers.map(async (player) => {
        const lastGame = await db
          .select()
          .from(player_games)
          .where(
            eq(
              player_games.playerId,
              player.key.replace('player:', '').replace(':state', '')
            )
          )
          .orderBy(desc(player_games.gameTime))
          .limit(1)
        return lastGame[0]
      })
    )
  } catch (error) {
    console.error('Failed to log queuing players:', error)
    throw error
  } finally {
    await redisClient.quit()
  }
}

logQueueingPlayers()
  .then((e) => {
    for (const p of e)
      console.log('--', p?.playerName, Math.round(p?.playerMmr ?? 0), 'MMR')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Unhandled error in logQueueingPlayers:', error)
    process.exit(1)
  })
