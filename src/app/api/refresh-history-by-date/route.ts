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
    // Check if request has a body
    let startDate: string | undefined
    let endDate: string | undefined

    try {
      // Try to parse request body if it exists
      const body = await request.json().catch(() => null)
      if (body) {
        startDate = body.start_date
        endDate = body.end_date
      }
    } catch (e) {
      // If no body or parsing fails, we'll use default dates
      console.log('No request body or empty body, using default date (yesterday)')
    }

    // If no dates provided, default to a 3-day range (yesterday, today, and tomorrow)
    if (!startDate && !endDate) {
      const today = new Date()

      // Calculate yesterday
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      // Calculate tomorrow
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // Format dates as YYYY-MM-DD
      startDate = yesterday.toISOString().split('T')[0]
      endDate = tomorrow.toISOString().split('T')[0]

      console.log(`No dates provided, defaulting to 3-day range: ${startDate} to ${endDate}`)
    }

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
