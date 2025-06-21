import { LogsClient } from '@/app/(home)/admin/logs/logs-client'
import { auth } from '@/server/auth'
import { Suspense } from 'react'

export default async function LogsPage() {
  const session = await auth()
  const isAdmin = session?.user.role === 'admin'

  if (!isAdmin) {
    return (
      <div className={'container mx-auto pt-8'}>
        <div className={'prose'}>
          <h1>Forbidden</h1>
        </div>
      </div>
    )
  }

  return (
    <Suspense>
      <div
        className={
          'mx-auto flex w-[calc(100%-1rem)] max-w-fd-container flex-col gap-4 pt-16'
        }
      >
        <LogsClient />
      </div>
    </Suspense>
  )
}