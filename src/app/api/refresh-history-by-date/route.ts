import { env } from '@/env'
import { syncHistoryByDateRange } from '@/server/api/routers/history'
import { headers } from 'next/headers'

const SECURE_TOKEN = env.CRON_SECRET

export async function POST(request: Request) {
  const headersList = await headers()
  const authToken = headersList.get('authorization')?.replace('Bearer ', '')

  if (authToken !== SECURE_TOKEN) {
    return new Response('unauthorized', { status: 401 })
  }

  try {
    // Parse request body to get date range parameters
    const body = await request.json().catch(() => ({}))
    const startDate = body.start_date
    const endDate = body.end_date

    try {
      console.log('refreshing history by date range...')
      if (startDate) {
        console.log(`Start date: ${startDate}`)
      }
      if (endDate) {
        console.log(`End date: ${endDate}`)
      }
      
      await syncHistoryByDateRange(startDate, endDate)
    } catch (err) {
      console.error('history refresh by date range failed:', err)
      return new Response('internal error', { status: 500 })
    }
    
    return Response.json({ success: true })
  } catch (err) {
    console.error('refresh failed:', err)
    return new Response('internal error', { status: 500 })
  }
}