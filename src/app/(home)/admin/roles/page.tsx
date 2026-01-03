import { HydrateClient, api } from '@/trpc/server'
import { auth } from '@/server/auth'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { RolesClient } from './roles-client'

export default async function RolesManagerPage() {
  const session = await auth()
  const isOwner = session?.user?.role === 'owner'

  if (!isOwner) {
    redirect('/')
  }

  await api.users.listUsers.prefetch()

  return (
    <Suspense>
      <HydrateClient>
        <div className={'container mx-auto px-4 py-10'}>
          <h1 className='mb-6 font-bold text-3xl'>Manage Roles</h1>
          <RolesClient />
        </div>
      </HydrateClient>
    </Suspense>
  )
}
