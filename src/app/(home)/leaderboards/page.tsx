import { LeaderboardPage } from '@/app/_components/leaderboard'
import { auth } from '@/server/auth'
import {
  RANKED_QUEUE_ID,
  SMALLWORLD_QUEUE_ID,
  VANILLA_QUEUE_ID,
} from '@/shared/constants'
import { HydrateClient, api } from '@/trpc/server'
import { Suspense } from 'react'

export default async function Home() {
  const session = await auth()
  await Promise.all([
    api.leaderboard.get_leaderboard.prefetch({
      channel_id: RANKED_QUEUE_ID,
    }),
    api.leaderboard.get_leaderboard.prefetch({
      channel_id: VANILLA_QUEUE_ID,
    }),
    api.leaderboard.get_leaderboard.prefetch({
      channel_id: SMALLWORLD_QUEUE_ID,
    }),
  ])
  if (session?.user) {
  }

  return (
    <Suspense>
      <HydrateClient>
        <LeaderboardPage />
      </HydrateClient>
    </Suspense>
  )
}
