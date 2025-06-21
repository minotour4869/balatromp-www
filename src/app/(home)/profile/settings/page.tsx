import { ProfileSettingsPageClient } from '@/app/(home)/profile/settings/page-client'
import { auth } from '@/server/auth'
import { HydrateClient, api } from '@/trpc/server'
import { SessionProvider } from 'next-auth/react'
import { redirect } from 'next/navigation'

export default async function ProfileSettingsPage() {
  const session = await auth()
  if (!session) {
    redirect('/')
  }
  await Promise.all([api.profile.getSocialLinks.prefetch()])
  return (
    <HydrateClient>
      <ProfileSettingsPageClient userId={session.user.discord_id} />
    </HydrateClient>
  )
}
