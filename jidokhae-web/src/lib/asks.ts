import { getKSTToday } from '@/lib/kst'
import { createServiceClient } from '@/lib/supabase/admin'
import { isAskEligibleMeeting, computeAskStats } from '@/lib/asks-pure'
import type { AskStatsAskRow } from '@/lib/asks-pure'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PendingAsk, AskStats } from '@/types/ask'

// 순수 헬퍼는 client 번들 안전을 위해 asks-pure.ts에 분리(이 파일은 service_role import) — re-export
export { ASK_WINDOW_DAYS, isAskEligibleMeeting, askSourceLabel } from '@/lib/asks-pure'

// 물어보기 "참여" 판정 status. 모임날 지난 pending_transfer(계좌이체 입금확인 전)도 참여로 본다 —
// 안 나갈 사람은 미리 취소하므로 모임날까지 남아있다는 것 자체가 참여의 증거(2026-07-15 확정).
// 앱 전체가 pending_transfer를 confirmed와 동등 취급하는 것과 일관. confirmed만 필터하면 계좌이체 운영 중인 현 서비스에서 대부분 참여자 누락.
const PARTICIPATED_STATUSES = ['confirmed', 'pending_transfer'] as const

type RegRow = {
  meeting_id: string
  user_id: string
  meetings: { date: string; meeting_type: string; status: string } | null
}

/**
 * 이 회원에게 지금 띄울 물어보기 1건(미해소·최근·정기).
 * 참여(confirmed·입금대기) 정기모임 중 자격 통과 & book_asks에 없는 것 → 가장 최근 1건. 없으면 null.
 */
export async function getPendingAsk(userId: string): Promise<PendingAsk | null> {
  const admin = createServiceClient()
  const kstToday = getKSTToday()

  const { data: regs } = await admin
    .from('registrations')
    .select('meeting_id, user_id, meetings(date, meeting_type, status)')
    .eq('user_id', userId)
    .in('status', PARTICIPATED_STATUSES)

  const eligible = ((regs ?? []) as unknown as RegRow[])
    .filter((r) => r.meetings && isAskEligibleMeeting(r.meetings, kstToday))

  if (eligible.length === 0) return null

  const { data: asks } = await admin
    .from('book_asks')
    .select('meeting_id, status')
    .eq('user_id', userId)

  // 'viewed'(노출만 됨, 미응답)는 계속 띄운다 — 해소는 answered/dismissed만
  const resolved = new Set(
    (asks ?? [])
      .filter((a) => a.status === 'answered' || a.status === 'dismissed')
      .map((a) => a.meeting_id as string),
  )

  const open = eligible
    .filter((r) => !resolved.has(r.meeting_id))
    .sort((a, b) => (b.meetings!.date).localeCompare(a.meetings!.date))

  const top = open[0]
  if (!top || !top.meetings) return null
  return { meetingId: top.meeting_id, meetingDate: top.meetings.date }
}

/**
 * 이 회원이 특정 모임에 대해 아직 물어보기가 열려 있는지(모임 상세 진입점용).
 * 자격 통과 + book_asks가 answered/dismissed로 해소되지 않음(viewed는 열림 유지).
 */
export async function isAskPendingForMeeting(userId: string, meetingId: string): Promise<boolean> {
  const admin = createServiceClient()
  const eligible = await verifyEligibleParticipation(admin, userId, meetingId)
  if (!eligible) return false

  const { data } = await admin
    .from('book_asks')
    .select('status')
    .eq('user_id', userId)
    .eq('meeting_id', meetingId)
    .maybeSingle()

  if (data && (data.status === 'answered' || data.status === 'dismissed')) return false
  return true
}

/**
 * (user, meeting)이 실제 물어보기 자격이 있는 건인지 서버 재검증(통계 조작 방지).
 * 참여(confirmed·입금대기 pending_transfer) 등록 존재 + 정기 자격 통과.
 */
export async function verifyEligibleParticipation(
  admin: SupabaseClient,
  userId: string,
  meetingId: string,
): Promise<boolean> {
  const kstToday = getKSTToday()
  const { data } = await admin
    .from('registrations')
    .select('meeting_id, meetings(date, meeting_type, status)')
    .eq('user_id', userId)
    .eq('meeting_id', meetingId)
    .in('status', PARTICIPATED_STATUSES)
    .limit(1)
    .maybeSingle()

  const row = data as unknown as { meetings: { date: string; meeting_type: string; status: string } | null } | null
  if (!row || !row.meetings) return false
  return isAskEligibleMeeting(row.meetings, kstToday)
}

/**
 * 노출만 기록(status='viewed'). 최초 1회만 삽입 — 이미 행이 있으면(노출/해소) 무시.
 * first_viewed_at을 덮어쓰지 않기 위해 ignoreDuplicates. 반환: 성공 여부.
 */
export async function recordAskViewed(
  admin: SupabaseClient,
  userId: string,
  meetingId: string,
): Promise<boolean> {
  const { error } = await admin.from('book_asks').upsert(
    { user_id: userId, meeting_id: meetingId, status: 'viewed', first_viewed_at: new Date().toISOString() },
    { onConflict: 'user_id,meeting_id', ignoreDuplicates: true },
  )
  return !error
}

/** book_asks upsert(해소 기록). first_viewed_at은 payload에 없으므로 기존 값 보존. */
async function recordAsk(
  admin: SupabaseClient,
  userId: string,
  meetingId: string,
  status: 'answered' | 'dismissed',
): Promise<boolean> {
  const row: Record<string, unknown> = { user_id: userId, meeting_id: meetingId, status }
  if (status === 'dismissed') row.dismissed_at = new Date().toISOString()
  const { error } = await admin
    .from('book_asks')
    .upsert(row, { onConflict: 'user_id,meeting_id' })
  return !error
}

export function recordAskAnswered(admin: SupabaseClient, userId: string, meetingId: string) {
  return recordAsk(admin, userId, meetingId, 'answered')
}

export function recordAskDismissed(admin: SupabaseClient, userId: string, meetingId: string) {
  return recordAsk(admin, userId, meetingId, 'dismissed')
}

/**
 * admin 미니 카운트. 조회만 하고 계산은 순수 함수 computeAskStats에 위임(단위 테스트 대상).
 * 분자(answered/dismissed/viewed)는 자격 참여 모수와 교집합 — 60일 윈도우 밖·비자격 건 제외.
 * 250명 규모라 book_asks 전량 스캔 OK.
 */
export async function getAskStats(): Promise<AskStats> {
  const admin = createServiceClient()
  const kstToday = getKSTToday()

  const { data: regs } = await admin
    .from('registrations')
    .select('meeting_id, user_id, meetings(date, meeting_type, status)')
    .in('status', PARTICIPATED_STATUSES)

  const { data: asks } = await admin.from('book_asks').select('user_id, meeting_id, status')

  return computeAskStats(
    (regs ?? []) as unknown as RegRow[],
    (asks ?? []) as AskStatsAskRow[],
    kstToday,
  )
}
