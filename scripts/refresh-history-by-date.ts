import { syncHistoryByDateRange } from '@/server/api/routers/history'
import { RANKED_QUEUE_ID } from '@/shared/constants'

async function refreshHistoryByDate(startDate?: string, endDate?: string) {
  try {
    console.log('Refreshing history by date range...')
    if (startDate) {
      console.log(`Start date: ${startDate}`)
    }
    if (endDate) {
      console.log(`End date: ${endDate}`)
    }

    await syncHistoryByDateRange(RANKED_QUEUE_ID, startDate, endDate)
    console.log('History refresh completed successfully')
  } catch (err) {
    console.error('History refresh failed:', err)
    throw err
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2)
  let startDate: string | undefined
  let endDate: string | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start-date' && i + 1 < args.length) {
      startDate = args[i + 1]
      i++
    } else if (args[i] === '--end-date' && i + 1 < args.length) {
      endDate = args[i + 1]
      i++
    }
  }

  return { startDate, endDate }
}

// Run if called directly
if (require.main === module) {
  const { startDate, endDate } = parseArgs()
  
  refreshHistoryByDate(startDate, endDate)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Refresh failed:', err)
      process.exit(1)
    })
}