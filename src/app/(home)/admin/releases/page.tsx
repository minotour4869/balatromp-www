import { ReleasesClient } from '@/app/(home)/admin/releases/releases-client'
import { auth } from '@/server/auth'
import { HydrateClient, api } from '@/trpc/server'
import { Suspense } from 'react'

export default async function ReleasesPage() {
  const session = await auth()
  const isAdmin = session?.user.role === 'admin'
  console.log(session)
  if (!isAdmin) {
    return (
      <div className={'container mx-auto pt-8'}>
        <div className={'prose'}>
          <h1>Forbidden</h1>
        </div>
      </div>
    )
  }

  await api.releases.getReleases.prefetch()

  return (
    <Suspense>
      <HydrateClient>
        <div className={'container mx-auto pt-8'}>
          <ReleasesClient />
        </div>
      </HydrateClient>
    </Suspense>
  )
}
