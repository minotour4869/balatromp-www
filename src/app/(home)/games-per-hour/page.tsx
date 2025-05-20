import { GamesPerHourChart } from './_components/games-per-hour-chart'
import { auth } from '@/server/auth'
import { HydrateClient, api } from '@/trpc/server'
import { Suspense } from 'react'

export default async function GamesPerHourPage() {
  const session = await auth()

  // Prefetch the games per hour data with default grouping (hour)
  await api.history.games_per_hour.prefetch({
    groupBy: 'hour',
  })

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Games Played Over Time</h1>
      <Suspense>
        <HydrateClient>
          <GamesPerHourChart />
        </HydrateClient>
      </Suspense>
    </div>
  )
}
