import { StreamCardClient } from '@/app/stream-card/[id]/_components/stream-card-client'
import { RANKED_QUEUE_ID } from '@/shared/constants'
import { HydrateClient, api } from '@/trpc/server'
import { Suspense } from 'react'

export default async function StreamCardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (id) {
    await Promise.all([
      api.history.user_games.prefetch({
        user_id: id,
      }),

      api.leaderboard.get_user_rank.prefetch({
        channel_id: RANKED_QUEUE_ID,
        user_id: id,
      }),
    ])
  }

  return (
    <Suspense>
      <HydrateClient>
        <StreamCardClient />
      </HydrateClient>
    </Suspense>
  )
}
