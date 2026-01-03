import { auth } from '@/server/auth'
import {
  RANKED_QUEUE_ID,
  SMALLWORLD_QUEUE_ID,
  VANILLA_QUEUE_ID,
} from '@/shared/constants'
import { HydrateClient, api } from '@/trpc/server'
import { Suspense } from 'react'
import { UserInfo } from './user'

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (id) {
    await Promise.all([
      api.history.user_games.prefetch({
        queue_id: RANKED_QUEUE_ID,
        user_id: id,
      }),
      api.discord.get_user_by_id.prefetch({
        user_id: id,
      }),
      api.leaderboard.get_leaderboard.prefetch({
        channel_id: RANKED_QUEUE_ID,
      }),
      api.leaderboard.get_leaderboard.prefetch({
        channel_id: SMALLWORLD_QUEUE_ID,
      }),
      api.leaderboard.get_leaderboard.prefetch({
        channel_id: VANILLA_QUEUE_ID,
      }),
      api.leaderboard.get_user_rank.prefetch({
        channel_id: RANKED_QUEUE_ID,
        user_id: id,
      }),
      api.leaderboard.get_user_rank.prefetch({
        channel_id: SMALLWORLD_QUEUE_ID,
        user_id: id,
      }),
      api.leaderboard.get_user_rank.prefetch({
        channel_id: VANILLA_QUEUE_ID,
        user_id: id,
      }),
    ])
  }
  return (
    <Suspense>
      <HydrateClient>
        <UserInfo />
      </HydrateClient>
    </Suspense>
  )
}
