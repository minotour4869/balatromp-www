import { env } from '@/env'
import { Redis } from 'ioredis'

export const redis = new Redis(env.REDIS_URL)

export const PLAYER_STATE_KEY = (userId: string) => `player:${userId}:state`
setInterval(() => {
  console.log(
    'redis listeners',
    redis.listenerCount('end'),
    redis.listenerCount('error')
  )
}, 30000)
