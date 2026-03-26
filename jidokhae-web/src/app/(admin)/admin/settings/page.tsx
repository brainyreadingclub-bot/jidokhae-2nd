import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { getSiteSettings } from '@/lib/site-settings'
import SiteSettingsForm from '@/components/admin/SiteSettingsForm'
import VenueManager from '@/components/admin/VenueManager'
import type { Venue } from '@/types/venue'

export default async function SettingsPage() {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (profile.role !== 'admin') redirect('/admin')

  const [settings, venuesResult] = await Promise.all([
    getSiteSettings(),
    supabase
      .from('venues')
      .select('*')
      .order('status', { ascending: true })
      .order('name', { ascending: true }),
  ])

  const venues = (venuesResult.data ?? []) as Venue[]

  return (
    <div className="px-5 pt-4 pb-6">
      <h1 className="text-lg font-extrabold text-primary-900 tracking-tight mb-5">
        사이트 설정
      </h1>

      <SiteSettingsForm settings={settings} />

      {/* 공간 관리 */}
      <div className="mt-10 pt-8" style={{ borderTop: '1px solid var(--color-surface-300)' }}>
        <h2 className="text-sm font-bold text-primary-800 mb-4 tracking-tight">
          공간 관리
        </h2>
        <VenueManager venues={venues} />
      </div>
    </div>
  )
}
