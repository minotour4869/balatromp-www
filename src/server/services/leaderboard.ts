import { redis } from '../redis'
import { type LeaderboardEntry, neatqueue_service } from './neatqueue.service'
import { db } from '@/server/db'
import { metadata } from '@/server/db/schema'
import { eq } from 'drizzle-orm'

export type LeaderboardResponse = {
  data: LeaderboardEntry[]
  isStale: boolean
}

export type UserRankResponse = {
  data: LeaderboardEntry
  isStale: boolean
} | null

export class LeaderboardService {
  private getZSetKey(channel_id: string) {
    return `zset:leaderboard:${channel_id}`
  }

  private getRawKey(channel_id: string) {
    return `raw:leaderboard:${channel_id}`
  }

  private getUserKey(user_id: string, channel_id: string) {
    return `user:${user_id}:${channel_id}`
  }

  private getBackupKey(channel_id: string) {
    return `backup_leaderboard_${channel_id}`
  }

  async refreshLeaderboard(channel_id: string): Promise<LeaderboardResponse> {
    try {
      const fresh = await neatqueue_service.get_leaderboard(channel_id)
      const zsetKey = this.getZSetKey(channel_id)
      const rawKey = this.getRawKey(channel_id)
      const backupKey = this.getBackupKey(channel_id)

      const pipeline = redis.pipeline()
      pipeline.setex(rawKey, 180, JSON.stringify(fresh))
      pipeline.del(zsetKey)

      for (const entry of fresh) {
        pipeline.zadd(zsetKey, entry.mmr, entry.id)
        pipeline.hset(this.getUserKey(entry.id, channel_id), {
          ...entry,
          channel_id,
        })
      }

      pipeline.expire(zsetKey, 180)
      await pipeline.exec()

      // Store the latest successful leaderboard data in the database
      await db
        .insert(metadata)
        .values({
          key: backupKey,
          value: JSON.stringify({
            data: fresh,
            timestamp: new Date().toISOString(),
          }),
        })
        .onConflictDoUpdate({
          target: metadata.key,
          set: {
            value: JSON.stringify({
              data: fresh,
              timestamp: new Date().toISOString(),
            }),
          },
        })

      return { data: fresh, isStale: false }
    } catch (error) {
      console.error('Error refreshing leaderboard:', error)

      // If neatqueue fails, try to get the latest backup from the database
      const backupKey = this.getBackupKey(channel_id)
      const backup = await db
        .select()
        .from(metadata)
        .where(eq(metadata.key, backupKey))
        .limit(1)
        .then((res) => res[0])

      if (backup) {
        const parsedBackup = JSON.parse(backup.value)
        console.log(`Using backup leaderboard data from ${parsedBackup.timestamp} in refreshLeaderboard`)
        return { data: parsedBackup.data as LeaderboardEntry[], isStale: true }
      }

      // If no backup exists, return an empty array with isStale flag
      console.log('No backup leaderboard data available for refreshLeaderboard, returning empty array')
      return { data: [], isStale: true }
    }
  }

  async getLeaderboard(channel_id: string): Promise<LeaderboardResponse> {
    try {
      // Try to get from Redis cache first
      const cached = await redis.get(this.getRawKey(channel_id))
      if (cached) return { data: JSON.parse(cached) as LeaderboardEntry[], isStale: false }

      // If not in cache, try to refresh from neatqueue
      return await this.refreshLeaderboard(channel_id)
    } catch (error) {
      console.error('Error getting leaderboard from neatqueue:', error)

      // If neatqueue fails, try to get the latest backup from the database
      const backupKey = this.getBackupKey(channel_id)
      const backup = await db
        .select()
        .from(metadata)
        .where(eq(metadata.key, backupKey))
        .limit(1)
        .then((res) => res[0])

      if (backup) {
        const parsedBackup = JSON.parse(backup.value)
        console.log(`Using backup leaderboard data from ${parsedBackup.timestamp}`)
        return { data: parsedBackup.data as LeaderboardEntry[], isStale: true }
      }

      // If no backup exists, return an empty array with isStale flag
      console.log('No backup leaderboard data available for getLeaderboard, returning empty array')
      return { data: [], isStale: true }
    }
  }

  async getUserRank(channel_id: string, user_id: string): Promise<UserRankResponse> {
    try {
      // Try to get user data from Redis first
      const userData = await redis.hgetall(this.getUserKey(user_id, channel_id))
      if (userData) {
        return {
          data: {
            ...userData,
            mmr: Number(userData.mmr),
            streak: userData.streak,
          } as unknown as LeaderboardEntry,
          isStale: false
        }
      }

      // If not found in Redis, try to refresh the leaderboard
      try {
        const { data: freshLeaderboard } = await this.refreshLeaderboard(channel_id)
        const userEntry = freshLeaderboard.find(entry => entry.id === user_id)
        if (userEntry) {
          return { data: userEntry, isStale: false }
        }
      } catch (refreshError) {
        console.error('Error refreshing leaderboard for user rank:', refreshError)
        // Continue to backup if refresh fails
      }

      // If not found in fresh data or refresh failed, try to get from backup
      const backupKey = this.getBackupKey(channel_id)
      const backup = await db
        .select()
        .from(metadata)
        .where(eq(metadata.key, backupKey))
        .limit(1)
        .then((res) => res[0])

      if (backup) {
        const parsedBackup = JSON.parse(backup.value)
        const userEntry = parsedBackup.data.find((entry: any) => entry.id === user_id)
        if (userEntry) {
          console.log(`Using backup leaderboard data for user ${user_id} from ${parsedBackup.timestamp}`)
          return { data: userEntry as LeaderboardEntry, isStale: true }
        }
      }

      // If user not found anywhere
      return null
    } catch (error) {
      console.error('Error getting user rank:', error)
      // Return null instead of rethrowing the error to prevent the page from breaking
      return null
    }
  }
}

export const leaderboardService = new LeaderboardService()
