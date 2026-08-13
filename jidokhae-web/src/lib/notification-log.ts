/**
 * 알림톡 발송 이력 조회 (운영자 화면용).
 *
 * 왜 필요한가 — `notifications` 테이블에 발송 이력이 계속 쌓이고 있었지만
 * 이걸 읽는 화면이 어디에도 없었다. 그래서 2026년 3~6월에 123건이 실패한 것을
 * 넉 달 동안 아무도 몰랐다.
 *
 * 물어보기가 알림톡을 주 진입점으로 쓰기 시작하면 이 사각지대의 대가가 커진다.
 * "전환율이 낮다"와 "애초에 안 나갔다"를 구분할 수단이 없으면 계측 자체가 무의미해진다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** 목록 1회 조회 상한. 이력은 계속 쌓이므로 전량 조회하지 않는다. */
export const LOG_PAGE_SIZE = 50

/** 집계 창(일). 최근 흐름을 보는 용도 — 오래된 실패는 실패 탭이 따로 잡는다. */
export const STATS_WINDOW_DAYS = 30

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  registration_confirm: '신청 완료',
  meeting_remind: '모임 전날',
  waitlist_confirm: '대기 신청',
  waitlist_promoted: '대기 승격',
  waitlist_refunded: '미승격 환불',
  book_ask: '물어보기',
  new_member_welcome: '가입 환영',
}

export const NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  sent: '발송됨',
  failed: '실패',
  skipped: '건너뜀',
  pending: '발송 중',
}

export function notificationTypeLabel(type: string): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? type
}

export function notificationStatusLabel(status: string): string {
  return NOTIFICATION_STATUS_LABELS[status] ?? status
}

export type NotificationLogRow = {
  id: string
  type: string
  status: string
  createdAt: string
  sentAt: string | null
  errorMessage: string | null
  recipientPhone: string
  nickname: string
  realName: string | null
  meetingTitle: string | null
  meetingDate: string | null
}

export type TypeStat = {
  type: string
  sent: number
  failed: number
  skipped: number
  pending: number
  total: number
}

export type NotificationStats = {
  windowDays: number
  sent: number
  failed: number
  skipped: number
  pending: number
  total: number
  byType: TypeStat[]
  /** 전체 기간 누적 실패 — 창 밖의 오래된 실패를 놓치지 않기 위해 따로 센다 */
  failedAllTime: number
  /**
   * 마지막 실패 시각(UTC ISO). 없으면 null.
   *
   * 누적 실패 수만 보여주면 이미 끝난 사고(2026-03~06월 123건)의 숫자가 영원히
   * 남아 경고가 상시 점등된다. 항상 켜져 있는 경고는 아무도 안 본다.
   * "마지막 실패가 언제였나"가 있어야 지금 불이 난 건지 과거 흔적인지 구분된다.
   */
  lastFailedAt: string | null
}

type RawRow = {
  id: string
  type: string
  status: string
  created_at: string
  sent_at: string | null
  error_message: string | null
  recipient_phone: string | null
  profiles: { nickname: string | null; real_name: string | null } | null
  meetings: { title: string | null; date: string | null } | null
}

function toLogRow(r: RawRow): NotificationLogRow {
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    createdAt: r.created_at,
    sentAt: r.sent_at,
    errorMessage: r.error_message,
    recipientPhone: r.recipient_phone ?? '',
    nickname: r.profiles?.nickname || '(닉네임 없음)',
    realName: r.profiles?.real_name ?? null,
    meetingTitle: r.meetings?.title ?? null,
    meetingDate: r.meetings?.date ?? null,
  }
}

const SELECT_COLUMNS =
  'id, type, status, created_at, sent_at, error_message, recipient_phone, profiles(nickname, real_name), meetings(title, date)'

/**
 * 최근 발송 목록. 상한 `LOG_PAGE_SIZE`.
 * `statuses`를 주면 그 상태만 — 실패 탭은 전체 기간에서 실패만 뽑는다.
 */
export async function getNotificationLog(
  supabase: SupabaseClient,
  statuses?: string[],
): Promise<NotificationLogRow[]> {
  let query = supabase
    .from('notifications')
    .select(SELECT_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(LOG_PAGE_SIZE)

  if (statuses && statuses.length > 0) {
    query = query.in('status', statuses)
  }

  const { data, error } = await query
  if (error) {
    console.error('[notification-log] 조회 실패:', error)
    return []
  }
  return ((data ?? []) as unknown as RawRow[]).map(toLogRow)
}

/**
 * 최근 N일 집계 + 전체 기간 누적 실패.
 *
 * 집계는 창 안의 행을 전부 읽어 JS에서 센다. 발송량이 하루 수십 건 규모라
 * 30일치도 수백 행에 그친다. 이 규모를 넘어서면 DB 집계 함수로 옮길 것.
 */
export async function getNotificationStats(
  supabase: SupabaseClient,
): Promise<NotificationStats> {
  const since = new Date(Date.now() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [windowResult, failedResult, lastFailedResult] = await Promise.all([
    supabase.from('notifications').select('type, status').gte('created_at', since),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed'),
    supabase
      .from('notifications')
      .select('created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const rows = (windowResult.data ?? []) as { type: string; status: string }[]

  const byTypeMap = new Map<string, TypeStat>()
  const totals = { sent: 0, failed: 0, skipped: 0, pending: 0 }

  for (const row of rows) {
    if (!byTypeMap.has(row.type)) {
      byTypeMap.set(row.type, {
        type: row.type,
        sent: 0,
        failed: 0,
        skipped: 0,
        pending: 0,
        total: 0,
      })
    }
    const stat = byTypeMap.get(row.type)!
    stat.total += 1

    // CHECK 제약이 status를 4종으로 강제하지만, 새 상태가 늘어도 집계가
    // 조용히 어긋나지 않도록 모르는 값은 세지 않고 넘긴다.
    if (row.status === 'sent' || row.status === 'failed' || row.status === 'skipped' || row.status === 'pending') {
      stat[row.status] += 1
      totals[row.status] += 1
    }
  }

  const byType = Array.from(byTypeMap.values()).sort((a, b) => b.total - a.total)

  return {
    windowDays: STATS_WINDOW_DAYS,
    ...totals,
    total: rows.length,
    byType,
    failedAllTime: failedResult.count ?? 0,
    lastFailedAt: (lastFailedResult.data?.created_at as string | undefined) ?? null,
  }
}
