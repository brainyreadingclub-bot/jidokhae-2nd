import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile'
import { getKSTToday } from '@/lib/kst'
import AdminMeetingCard from '@/components/admin/AdminMeetingCard'
import type { Meeting } from '@/types/meeting'

export default async function AdminPage() {
  const kstToday = getKSTToday()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const profile = await getProfile(user.id)

  const { data: meetings, error: meetingsError } = await supabase
    .from('meetings')
    .select('*')
    .in('status', ['active', 'deleting'])
    .order('date', { ascending: false })
    .order('time', { ascending: false })

  if (meetingsError) {
    throw new Error(`모임 목록 조회 실패: ${meetingsError.message}`)
  }

  const typedMeetings = (meetings ?? []) as Meeting[]

  const meetingIds = typedMeetings.map((m) => m.id)

  const { data: counts, error: countsError } = meetingIds.length > 0
    ? await supabase.rpc('get_confirmed_counts', { meeting_ids: meetingIds })
    : { data: [], error: null }

  if (countsError) {
    throw new Error(`참가자 수 조회 실패: ${countsError.message}`)
  }

  const countMap = new Map<string, number>(
    (counts ?? []).map(
      (c: { meeting_id: string; confirmed_count: number }) => [
        c.meeting_id,
        Number(c.confirmed_count),
      ] as [string, number],
    ),
  )

  return (
    <div className="px-5 pt-4 pb-6">
      {/* Header with create button */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-extrabold text-primary-900 tracking-tight">모임 목록</h1>
        <Link
          href="/admin/meetings/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-xs font-bold text-white tracking-wide transition-all hover:bg-primary-700 active:scale-[0.97]"
          style={{ boxShadow: '0 2px 8px rgba(27, 67, 50, 0.2)' }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          새 모임
        </Link>
      </div>

      {/* 회원 관리 진입점 (admin만) */}
      {profile.role === 'admin' && (
        <Link
          href="/admin/members"
          className="flex items-center justify-between mb-4 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50"
          style={{ border: '1px solid var(--color-surface-300)', backgroundColor: 'var(--color-surface-50)' }}
        >
          <span>회원 관리</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      )}

      {typedMeetings.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-primary-400">등록된 모임이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {typedMeetings.map((meeting) => (
            <AdminMeetingCard
              key={meeting.id}
              meeting={meeting}
              confirmedCount={countMap.get(meeting.id) ?? 0}
              kstToday={kstToday}
            />
          ))}
        </div>
      )}
    </div>
  )
}
