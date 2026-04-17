import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { getMeeting } from '@/lib/meeting'
import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import AdminMeetingSection from '@/components/meetings/AdminMeetingSection'
import type { RegistrationWithProfile } from '@/types/registration'

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminMeetingDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(user.id)
  if (profile.role !== 'admin' && profile.role !== 'editor') redirect('/')

  const meeting = await getMeeting(id)
  if (!meeting || meeting.status === 'deleted') {
    notFound()
  }

  const [countsResult, regsResult] = await Promise.all([
    supabase.rpc('get_confirmed_counts', { meeting_ids: [id] }),
    supabase
      .from('registrations')
      .select('*, profiles(nickname, real_name, phone)')
      .eq('meeting_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (countsResult.error) {
    throw new Error(`참가자 수 조회 실패: ${countsResult.error.message}`)
  }

  const confirmedCount = Number(
    (countsResult.data as { meeting_id: string; confirmed_count: number }[] | null)
      ?.find((c) => c.meeting_id === id)?.confirmed_count ?? 0,
  )
  const registrations = (regsResult.data ?? []) as RegistrationWithProfile[]

  return (
    <div className="px-5 pt-6 pb-10 lg:px-10 lg:pt-10">
      {/* Breadcrumb */}
      <Link
        href="/admin/meetings"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-500 hover:text-primary-700"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        모임 관리로 돌아가기
      </Link>

      {/* 모임 메타 정보 */}
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-bold text-primary-700">
          {meeting.region}
        </span>
        {meeting.is_featured && (
          <span className="rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-bold text-accent-700">
            PICK
          </span>
        )}
        {meeting.status === 'deleting' && (
          <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-[11px] font-bold text-warning" style={{ border: '1px solid var(--color-accent-200)' }}>
            환불 미처리
          </span>
        )}
      </div>
      <h1
        className="mb-2 text-2xl font-extrabold tracking-tight text-primary-900 lg:text-3xl"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {meeting.title}
      </h1>
      <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-primary-600">
        <span>
          {formatKoreanDate(meeting.date)} {formatKoreanTime(meeting.time)}
        </span>
        <span>· {meeting.location}</span>
        <span>· 정원 {meeting.capacity}명</span>
        <span>· 참가비 {formatFee(meeting.fee)}원</span>
      </div>
      <div className="mb-6 text-xs text-primary-500/80">
        회원 페이지에서 보기 ·{' '}
        <Link href={`/meetings/${id}`} className="underline hover:text-primary-700">
          /meetings/{id.slice(0, 8)}
        </Link>
      </div>

      <AdminMeetingSection
        meetingId={meeting.id}
        meetingStatus={meeting.status}
        confirmedCount={confirmedCount}
        registrations={registrations}
        role={profile.role}
        meetingDate={meeting.date}
      />
    </div>
  )
}
