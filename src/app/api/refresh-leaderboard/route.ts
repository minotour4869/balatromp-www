import { env } from '@/env'
import { leaderboardService } from '@/server/services/leaderboard'
import { RANKED_QUEUE_ID, VANILLA_QUEUE_ID } from '@/shared/constants'
import { headers } from 'next/headers'

const SECURE_TOKEN = env.CRON_SECRET
const CHANNEL_IDS = [RANKED_QUEUE_ID, VANILLA_QUEUE_ID]
export async function POST() {
  const headersList = await headers()
  const authToken = headersList.get('authorization')?.replace('Bearer ', '')

  if (authToken !== SECURE_TOKEN) {
    return new Response('unauthorized', { status: 401 })
  }

  try {
    for (const channelId of CHANNEL_IDS) {
      try {
        console.log(`refreshing leaderboard for ${channelId}...`)
        await leaderboardService.refreshLeaderboard(channelId)
      } catch (err) {
        console.error('refresh failed:', err)
        return new Response('internal error', { status: 500 })
      }
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('refresh failed:', err)
    return new Response('internal error', { status: 500 })
  }
}
