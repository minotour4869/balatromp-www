import { redis } from '../redis'
import { type LeaderboardEntry, neatqueue_service } from './neatqueue.service'
import { db } from '@/server/db'
import { leaderboardSnapshots, metadata } from '@/server/db/schema'
import { eq, desc } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'

export type LeaderboardResponse = {
  data: LeaderboardEntry[]
  isStale: boolean
}

export type LeaderboardSnapshotResponse = {
  data: LeaderboardEntry[]
  timestamp: string
  channel_id: string
}

export type UserRankResponse = {
  data: LeaderboardEntry
  isStale: boolean
} | null

export class LeaderboardService {
  private season2DataCache: Map<string, LeaderboardEntry[]> = new Map()

  private getZSetKey(channel_id: string) {
    return `zset:leaderboard:${channel_id}`
  }

  // Load Season 2 data from the snapshot file
  private loadSeason2Data(channel_id: string): LeaderboardEntry[] {
    // Check if data is already cached
    if (this.season2DataCache.has(channel_id)) {
      return this.season2DataCache.get(channel_id)!
    }

    try {
      // Path to the Season 2 snapshot file
      const filePath = path.join(process.cwd(), 'src', 'data', 'leaderboard-snapshot-eos2.json')

      // Read and parse the file
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(fileContent)

      // Extract and format the leaderboard entries
      const entries = data.alltime.map((entry: any) => ({
        id: entry.id,
        name: entry.name,
        mmr: entry.data.mmr,
        wins: entry.data.wins,
        losses: entry.data.losses,
        streak: entry.data.streak,
        totalgames: entry.data.totalgames,
        peak_mmr: entry.data.peak_mmr,
        peak_streak: entry.data.peak_streak,
        rank: entry.data.rank,
        winrate: entry.data.winrate,
      }))

      // Cache the data for future requests
      this.season2DataCache.set(channel_id, entries)

      return entries
    } catch (error) {
      console.error('Error loading Season 2 data:', error)
      return []
    }
  }

  // Get Season 2 leaderboard data
  async getSeason2Leaderboard(channel_id: string): Promise<LeaderboardEntry[]> {
    const entries = this.loadSeason2Data(channel_id)

    // Sort entries by MMR in descending order
    const sortedEntries = [...entries].sort((a, b) => b.mmr - a.mmr)

    // Recalculate ranks based on sorted order
    return sortedEntries.map((entry, idx) => ({
      ...entry,
      rank: idx + 1
    }))
  }

  // Get Season 2 user rank data
  async getSeason2UserRank(channel_id: string, user_id: string): Promise<LeaderboardEntry | null> {
    // Get the sorted leaderboard with recalculated ranks
    const sortedLeaderboard = await this.getSeason2Leaderboard(channel_id)

    // Find the user entry in the sorted leaderboard
    const userEntry = sortedLeaderboard.find(entry => entry.id === user_id)
    return userEntry || null
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

  private getSnapshotKey(channel_id: string, timestamp: string): string {
    return `snapshot_leaderboard_${channel_id}_${timestamp}`
  }

  private getSnapshotPrefix(channel_id: string): string {
    return `snapshot_leaderboard_${channel_id}_`
  }

  async refreshLeaderboard(channel_id: string): Promise<LeaderboardResponse> {
    try {
      const fresh = await neatqueue_service.get_leaderboard(channel_id)
      const zsetKey = this.getZSetKey(channel_id)
      const rawKey = this.getRawKey(channel_id)
      const backupKey = this.getBackupKey(channel_id)
      const timestamp = new Date().toISOString()
      const snapshotKey = this.getSnapshotKey(channel_id, timestamp.replace(/[:.]/g, '_'))

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

      // Store the snapshot in the dedicated leaderboardSnapshots table
      await db
        .insert(leaderboardSnapshots)
        .values({
          channelId: channel_id,
          timestamp: new Date(timestamp),
          data: fresh,
        })

      // Also store the snapshot with a unique timestamp-based key in metadata for backward compatibility
      await db
        .insert(metadata)
        .values({
          key: snapshotKey,
          value: JSON.stringify({
            data: fresh,
            timestamp,
            channel_id,
          }),
        })

      // Also store/update the latest successful leaderboard data for backward compatibility
      await db
        .insert(metadata)
        .values({
          key: backupKey,
          value: JSON.stringify({
            data: fresh,
            timestamp,
          }),
        })
        .onConflictDoUpdate({
          target: metadata.key,
          set: {
            value: JSON.stringify({
              data: fresh,
              timestamp,
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

  /**
   * Get historical leaderboard snapshots for a channel
   * @param channel_id The channel ID
   * @param limit Optional limit on the number of snapshots to return (default: 100)
   * @returns Array of leaderboard snapshots
   */
  async getLeaderboardSnapshots(
    channel_id: string,
    limit: number = 100
  ): Promise<LeaderboardSnapshotResponse[]> {
    try {
      // Query the dedicated leaderboardSnapshots table
      const snapshots = await db
        .select()
        .from(leaderboardSnapshots)
        .where(eq(leaderboardSnapshots.channelId, channel_id))
        .orderBy(desc(leaderboardSnapshots.timestamp)) // Most recent first
        .limit(limit)

      // Map the snapshots to the expected response format
      return snapshots.map((snapshot) => {
        return {
          data: snapshot.data as LeaderboardEntry[],
          timestamp: snapshot.timestamp.toISOString(),
          channel_id: snapshot.channelId,
        }
      })
    } catch (error) {
      console.error('Error getting leaderboard snapshots from dedicated table:', error)

      try {
        // Fallback to the old metadata table approach if the new table query fails
        const prefix = this.getSnapshotPrefix(channel_id)

        // Query the database for all entries with keys that start with the snapshot prefix
        const oldSnapshots = await db
          .select()
          .from(metadata)
          .where(sql`${metadata.key} LIKE ${prefix + '%'}`)
          .orderBy(sql`${metadata.key} DESC`) // Most recent first
          .limit(limit)

        // Parse the snapshots
        return oldSnapshots.map((snapshot) => {
          const parsedValue = JSON.parse(snapshot.value)
          return {
            data: parsedValue.data as LeaderboardEntry[],
            timestamp: parsedValue.timestamp,
            channel_id: parsedValue.channel_id,
          }
        })
      } catch (fallbackError) {
        console.error('Error getting leaderboard snapshots from metadata fallback:', fallbackError)
        return []
      }
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
