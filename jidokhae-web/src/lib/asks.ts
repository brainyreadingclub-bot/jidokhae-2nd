import { getDaysUntil, getKSTToday } from '@/lib/kst'
import { createServiceClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PendingAsk, AskStats } from '@/types/ask'

/** 물어보기 대상 모임의 최근 윈도우(일). 과거 소급 스팸 방지 — "앞으로의 정기모임만"의 실용 근사 */
export const ASK_WINDOW_DAYS = 60

type EligibleMeetingShape = {
  date: string
  meeting_type: string
  status: string
}

/**
 * 물어보기(및 분모) 대상 정기모임인지 순수 판정.
 * 정기 + active + 과거 + 최근 windowDays 이내.
 */
export function isAskEligibleMeeting(
  meeting: EligibleMeetingShape,
  kstToday: string,
  windowDays = ASK_WINDOW_DAYS,
): boolean {
  if (meeting.meeting_type !== 'regular') return false
  if (meeting.status !== 'active') return false
  const days = getDaysUntil(meeting.date, kstToday) // 과거면 음수
  return days < 0 && days >= -windowDays
}

/** "2026-07-11" → "7월 정기모임에서". null/빈 값은 null */
export function askSourceLabel(date: string | null | undefined): string | null {
  if (!date) return null
  const month = Number(date.slice(5, 7))
  if (!month) return null
  return `${month}월 정기모임에서`
}

type RegRow = {
  meeting_id: string
  user_id: string
  meetings: { date: string; meeting_type: string; status: string } | null
}

/**
 * 이 회원에게 지금 띄울 물어보기 1건(미해소·최근·정기).
 * confirmed 정기모임 중 자격 통과 & book_asks에 없는 것 → 가장 최근 1건. 없으면 null.
 */
export async function getPendingAsk(userId: string): Promise<PendingAsk | null> {
  const admin = createServiceClient()
  const kstToday = getKSTToday()

  const { data: regs } = await admin
    .from('registrations')
    .select('meeting_id, user_id, meetings(date, meeting_type, status)')
    .eq('user_id', userId)
    .eq('status', 'confirmed')

  const eligible = ((regs ?? []) as unknown as RegRow[])
    .filter((r) => r.meetings && isAskEligibleMeeting(r.meetings, kstToday))

  if (eligible.length === 0) return null

  const { data: asks } = await admin
    .from('book_asks')
    .select('meeting_id')
    .eq('user_id', userId)

  const resolved = new Set((asks ?? []).map((a) => a.meeting_id as string))

  const open = eligible
    .filter((r) => !resolved.has(r.meeting_id))
    .sort((a, b) => (b.meetings!.date).localeCompare(a.meetings!.date))

  const top = open[0]
  if (!top || !top.meetings) return null
  return { meetingId: top.meeting_id, meetingDate: top.meetings.date }
}

/**
 * (user, meeting)이 실제 물어보기 자격이 있는 건인지 서버 재검증(통계 조작 방지).
 * confirmed 등록 존재 + 정기 자격 통과.
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
    .eq('status', 'confirmed')
    .limit(1)
    .maybeSingle()

  const row = data as unknown as { meetings: { date: string; meeting_type: string; status: string } | null } | null
  if (!row || !row.meetings) return false
  return isAskEligibleMeeting(row.meetings, kstToday)
}

/** book_asks upsert(해소 기록). 반환: 성공 여부 */
async function recordAsk(
  admin: SupabaseClient,
  userId: string,
  meetingId: string,
  status: 'answered' | 'dismissed',
): Promise<boolean> {
  const { error } = await admin
    .from('book_asks')
    .upsert({ user_id: userId, meeting_id: meetingId, status }, { onConflict: 'user_id,meeting_id' })
  return !error
}

export function recordAskAnswered(admin: SupabaseClient, userId: string, meetingId: string) {
  return recordAsk(admin, userId, meetingId, 'answered')
}

export function recordAskDismissed(admin: SupabaseClient, userId: string, meetingId: string) {
  return recordAsk(admin, userId, meetingId, 'dismissed')
}

/**
 * admin 미니 카운트. 분모 = 최근 윈도우 정기 참여(중복 (user,meeting) dedupe),
 * 분자 = book_asks answered/dismissed. 250명 규모라 전량 스캔 OK.
 */
export async function getAskStats(): Promise<AskStats> {
  const admin = createServiceClient()
  const kstToday = getKSTToday()

  const { data: regs } = await admin
    .from('registrations')
    .select('meeting_id, user_id, meetings(date, meeting_type, status)')
    .eq('status', 'confirmed')

  const denomSet = new Set<string>()
  for (const r of (regs ?? []) as unknown as RegRow[]) {
    if (r.meetings && isAskEligibleMeeting(r.meetings, kstToday)) {
      denomSet.add(`${r.user_id}:${r.meeting_id}`)
    }
  }
  const denominator = denomSet.size

  const { data: asks } = await admin.from('book_asks').select('status')
  let answered = 0
  let dismissed = 0
  for (const a of asks ?? []) {
    if (a.status === 'answered') answered += 1
    else if (a.status === 'dismissed') dismissed += 1
  }

  const pending = Math.max(0, denominator - answered - dismissed)
  const responseRate = denominator === 0 ? 0 : Math.round((answered / denominator) * 100)

  return { denominator, answered, dismissed, pending, responseRate }
}
