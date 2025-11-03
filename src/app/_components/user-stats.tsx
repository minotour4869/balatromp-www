'use client'

import { RANKED_QUEUE_ID } from '@/shared/constants'
import { api } from '@/trpc/react'

export function UserStats() {
  const sync_mutation = api.history.sync.useMutation()
  return (
    <div className='flex flex-col gap-2'>
      <button
        onClick={() => sync_mutation.mutate({ queue_id: RANKED_QUEUE_ID })}
        type={'button'}
      >
        Sync
      </button>
      <p>User stats</p>
    </div>
  )
}
