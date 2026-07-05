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
    <div className="px-5 pt-6 pb-10 lg:px-10 lg:pt-10">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-500">
          시스템
        </div>
        <h1
          className="mt-1 text-2xl font-extrabold tracking-tight text-primary-900 lg:text-3xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          사이트 설정
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          결제 모드 등 사이트 운영 설정과 공간을 관리합니다.
        </p>
      </div>

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
