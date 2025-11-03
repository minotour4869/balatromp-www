import { env } from '@/env'
import { syncHistory } from '@/server/api/routers/history'
import { RANKED_QUEUE_ID } from '@/shared/constants'
import { headers } from 'next/headers'

const SECURE_TOKEN = env.CRON_SECRET

export async function POST() {
  const headersList = await headers()
  const authToken = headersList.get('authorization')?.replace('Bearer ', '')

  if (authToken !== SECURE_TOKEN) {
    return new Response('unauthorized', { status: 401 })
  }

  try {
    try {
      console.log('refreshing history...')
      await syncHistory(RANKED_QUEUE_ID)
    } catch (err) {
      console.error('history refresh failed:', err)
      return new Response('internal error', { status: 500 })
    }
    return Response.json({ success: true })
  } catch (err) {
    console.error('refresh failed:', err)
    return new Response('internal error', { status: 500 })
  }
}
