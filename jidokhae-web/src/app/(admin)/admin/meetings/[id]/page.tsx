import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { getMeeting } from '@/lib/meeting'
import { getTopicCountsForAdmin } from '@/lib/discussion'
import { NO_TOPICS } from '@/lib/topic-status'
import AdminMeetingOverview from '@/components/admin/AdminMeetingOverview'
import { registrantProfileColumns } from '@/lib/admin-access'
import { getMeetingMissReport } from '@/lib/alimtalk-miss-server'
import { PARTICIPATED_STATUSES } from '@/lib/registration-status'
import type { RegistrationWithProfile } from '@/types/registration'

type Props = {
  params: Promise<{ id: string }>
}

/** 운영자 모임 상세 — 조회만 하고 그리기는 AdminMeetingOverview (2026-10-09 시안 C) */
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
  const isDiscussion = meeting.meeting_type === 'discussion'

  const [countsResult, regsResult, topicCounts] = await Promise.all([
    supabase.rpc('get_confirmed_counts', { meeting_ids: [id] }),
    supabase
      .from('registrations')
      // 전화번호는 총괄만 — 운영진이면 아예 읽지 않는다(「환불 필요」 줄에 뜨던 번호, 2026-10-16)
      .select(`*, profiles(${registrantProfileColumns(profile.role)})`)
      .eq('meeting_id', id)
      .order('created_at', { ascending: false }),
    isDiscussion ? getTopicCountsForAdmin([id]) : Promise.resolve(null),
  ])

  if (countsResult.error) {
    throw new Error(`참가자 수 조회 실패: ${countsResult.error.message}`)
  }

  const confirmedCount = Number(
    (countsResult.data as { meeting_id: string; confirmed_count: number }[] | null)
      ?.find((c) => c.meeting_id === id)?.confirmed_count ?? 0,
  )
  const registrations = (regsResult.data ?? []) as unknown as RegistrationWithProfile[]

  // 알림톡 못 받은 회원 — 이미 불러온 명단으로 판정한다(전화번호도 총괄일 때만 명단에 있다)
  const participated = new Set<string>(PARTICIPATED_STATUSES)
  const missReport = await getMeetingMissReport(
    { id, date: meeting.date },
    registrations
      .filter((r) => participated.has(r.status))
      .map((r) => ({
        registrationId: r.id,
        userId: r.user_id,
        createdAt: r.created_at,
        paymentMethod: r.payment_method,
        paymentId: r.payment_id,
        nickname: r.profiles?.nickname ?? '',
        realName: r.profiles?.real_name ?? null,
        phone: profile.role === 'admin' ? (r.profiles?.phone ?? null) : undefined,
      })),
  )

  return (
    <AdminMeetingOverview
      meeting={meeting}
      confirmedCount={confirmedCount}
      registrations={registrations}
      topicCounts={isDiscussion ? (topicCounts?.get(id) ?? NO_TOPICS) : null}
      isAdmin={profile.role === 'admin'}
      missReport={missReport}
    />
  )
}
