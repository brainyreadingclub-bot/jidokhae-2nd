/**
 * 알림톡 못 받은 회원 — 조회 (서버 전용). 판정 규칙은 `alimtalk-miss.ts`.
 *
 * service_role로 읽는다 — `notifications`·`app_events`는 RLS가 총괄(또는 service_role)만 열어 둬서
 * 운영진 화면에서도 상태를 보여 주려면 서버가 대신 읽어야 한다.
 * 🔴 그래서 **칸을 직접 고른다.** `notifications.recipient_phone`은 절대 읽지 않는다 —
 * 전화번호는 신청자 명단 쪽에서 총괄일 때만 붙는다(`registrantProfileColumns`, 2026-10-16).
 */

import { createServiceClient } from '@/lib/supabase/admin'
import { PARTICIPATED_STATUSES } from '@/lib/registration-status'
import { shiftDate } from '@/lib/kst'
import {
  buildMeetingMissReport,
  isRemindRunStale,
  type MeetingMissReport,
  type MissNotification,
  type MissParticipant,
} from '@/lib/alimtalk-miss'

/** 공통 기록표에 크론이 남기는 이름 — `lib/app-events.ts` APP_EVENTS와 같아야 한다 */
export const REMIND_RUN_EVENT = 'cron.meeting_remind_run'

/** 대시보드가 보는 모임 범위 — 지난 7일 ~ 앞으로 30일 */
const ALERT_PAST_DAYS = 7
const ALERT_FUTURE_DAYS = 30

/** 이 칸만 읽는다 — recipient_phone 금지 */
const NOTIFICATION_COLUMNS = 'meeting_id, type, status, recipient_id, registration_id, created_at'

type NotificationRow = {
  meeting_id: string | null
  type: string
  status: string
  recipient_id: string
  registration_id: string | null
  created_at: string
}

type RunRow = { meeting_id: string | null; created_at: string; props: Record<string, unknown> | null }

function toMissNotification(r: NotificationRow): MissNotification {
  return {
    type: r.type,
    status: r.status,
    recipientId: r.recipient_id,
    registrationId: r.registration_id,
    createdAt: r.created_at,
  }
}

/** 모임별 가장 최근 크론 기록 */
function latestRunByMeeting(rows: RunRow[]): Map<string, { ranAt: string; targets: number }> {
  const map = new Map<string, { ranAt: string; targets: number }>()
  for (const r of rows) {
    if (!r.meeting_id) continue
    const prev = map.get(r.meeting_id)
    if (!prev || r.created_at > prev.ranAt) {
      const targets = Number(r.props?.targets ?? 0)
      map.set(r.meeting_id, { ranAt: r.created_at, targets: Number.isFinite(targets) ? targets : 0 })
    }
  }
  return map
}

async function loadNotesAndRuns(meetingIds: string[]) {
  const supabase = createServiceClient()
  const [notesResult, runsResult] = await Promise.all([
    supabase.from('notifications').select(NOTIFICATION_COLUMNS).in('meeting_id', meetingIds),
    supabase
      .from('app_events')
      .select('meeting_id, created_at, props')
      .eq('event', REMIND_RUN_EVENT)
      .in('meeting_id', meetingIds),
  ])
  if (notesResult.error) console.error('[alimtalk-miss] 알림 조회 실패:', notesResult.error)
  // 기록표 조회가 실패해도 첫 전날 알림 행으로 대신 판정한다 — 경고를 끄지 않는다
  if (runsResult.error) console.error('[alimtalk-miss] 점검 기록 조회 실패:', runsResult.error)
  return {
    ok: !notesResult.error,
    notes: (notesResult.data ?? []) as NotificationRow[],
    runs: latestRunByMeeting((runsResult.data ?? []) as RunRow[]),
  }
}

/** 크론이 마지막으로 돈 시각 (모임이 없던 날 포함). 없으면 null */
export async function getLastRemindRunAt(): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('app_events')
    .select('created_at')
    .eq('event', REMIND_RUN_EVENT)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[alimtalk-miss] 마지막 점검 조회 실패:', error)
    return null
  }
  return (data?.created_at as string | undefined) ?? null
}

/**
 * 운영자 모임 상세 — 이미 불러온 신청자 명단으로 판정한다(전화번호도 명단에 총괄일 때만 있다).
 * 알림을 못 읽으면 null — 「다 갔어요」라고 거짓말하지 않는다.
 */
export async function getMeetingMissReport(
  meeting: { id: string; date: string },
  participants: MissParticipant[],
  now: Date = new Date(),
): Promise<MeetingMissReport | null> {
  const { ok, notes, runs } = await loadNotesAndRuns([meeting.id])
  if (!ok) return null
  return buildMeetingMissReport({
    meetingDate: meeting.date,
    participants,
    notifications: notes.map(toMissNotification),
    remindRun: runs.get(meeting.id) ?? null,
    now,
  })
}

export type MissAlert = {
  meetingId: string
  title: string
  date: string
  region: string | null
  participants: number
  missedPeople: number
}

export type MissAlerts = {
  meetings: MissAlert[]
  lastRunAt: string | null
  runStale: boolean
}

/** 대시보드 긴급 칸 — 못 받은 사람이 있는 모임만 + 점검이 멈췄는지 */
export async function getMissAlerts(kstToday: string, now: Date = new Date()): Promise<MissAlerts> {
  const supabase = createServiceClient()
  const [meetingsResult, lastRunAt] = await Promise.all([
    supabase
      .from('meetings')
      .select('id, title, date, region')
      .eq('status', 'active')
      .gte('date', shiftDate(kstToday, -ALERT_PAST_DAYS))
      .lte('date', shiftDate(kstToday, ALERT_FUTURE_DAYS))
      .order('date', { ascending: true }),
    getLastRemindRunAt(),
  ])
  const runStale = isRemindRunStale(lastRunAt, now)

  if (meetingsResult.error) {
    console.error('[alimtalk-miss] 모임 조회 실패:', meetingsResult.error)
    return { meetings: [], lastRunAt, runStale }
  }
  const meetings = (meetingsResult.data ?? []) as { id: string; title: string; date: string; region: string | null }[]
  if (meetings.length === 0) return { meetings: [], lastRunAt, runStale }

  const ids = meetings.map((m) => m.id)
  const [regsResult, { ok, notes, runs }] = await Promise.all([
    supabase
      .from('registrations')
      // 대시보드에는 사람 수만 쓴다 — 이름·전화번호를 읽지 않는다
      .select('id, user_id, meeting_id, created_at, payment_method, payment_id')
      .in('meeting_id', ids)
      .in('status', PARTICIPATED_STATUSES),
    loadNotesAndRuns(ids),
  ])
  if (regsResult.error || !ok) {
    if (regsResult.error) console.error('[alimtalk-miss] 신청 조회 실패:', regsResult.error)
    return { meetings: [], lastRunAt, runStale }
  }

  const regs = (regsResult.data ?? []) as {
    id: string
    user_id: string
    meeting_id: string
    created_at: string
    payment_method: string
    payment_id: string | null
  }[]

  const alerts: MissAlert[] = []
  for (const m of meetings) {
    const report = buildMeetingMissReport({
      meetingDate: m.date,
      participants: regs
        .filter((r) => r.meeting_id === m.id)
        .map((r) => ({
          registrationId: r.id,
          userId: r.user_id,
          createdAt: r.created_at,
          paymentMethod: r.payment_method,
          paymentId: r.payment_id,
          nickname: '',
          realName: null,
        })),
      notifications: notes.filter((n) => n.meeting_id === m.id).map(toMissNotification),
      remindRun: runs.get(m.id) ?? null,
      now,
    })
    if (report.missedPeople > 0) {
      alerts.push({
        meetingId: m.id,
        title: m.title,
        date: m.date,
        region: m.region,
        participants: report.participants,
        missedPeople: report.missedPeople,
      })
    }
  }

  return { meetings: alerts, lastRunAt, runStale }
}
