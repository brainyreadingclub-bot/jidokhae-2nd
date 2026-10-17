/**
 * 알림톡 못 받은 회원 판정 — 순수 함수만 둔다 (client 번들 안전, Supabase import 없음).
 * 조회는 `alimtalk-miss-server.ts`.
 *
 * 왜 「발송 이력」이 아니라 「못 받은 명단」인가 (2026-07-30 전문가 검토 공통 결론):
 * 운영자가 할 수 있는 행동은 「○○님에게 따로 연락」뿐이다. 성공률·차트는 행동으로 이어지지 않는다.
 *
 * 🔴 「기대 발송 수」를 거꾸로 계산하지 않는다 — 7월 실측에서 시점 차이·취소 때문에 늘 어긋나
 * 거짓 경고 공장이 됐다. 대신 두 가지만 믿는다.
 * - 신청 안내: 신청 1건 = 알림 1건(registration_id로 1:1). 행이 없거나 실패면 못 받은 것
 * - 전날 안내: 크론이 **돌았던 시각**보다 먼저 신청한 사람만 대상. 그 뒤에 신청한 사람은 대상이 아니다
 */

/** 신청 안내로 치는 알림 — 바로 신청 · 대기 신청 · 대기에서 승격 */
export const SIGNUP_NOTICE_TYPES = ['registration_confirm', 'waitlist_confirm', 'waitlist_promoted'] as const

/**
 * 계좌이체 신청 안내가 생긴 시각 (2026-10-09 21:38 KST 배포). 그 전 계좌이체 신청은 원래 안내가 없었다 —
 * 못 받은 것이 아니라 보낼 것이 없던 것이라 셈에서 뺀다. 카드는 처음부터 있었다.
 */
export const TRANSFER_SIGNUP_NOTICE_SINCE = '2026-10-09T12:38:00Z'

/** 발송 중(pending)이 이보다 오래 남아 있으면 멈춘 것으로 본다 */
export const STUCK_PENDING_MINUTES = 10

/**
 * 전날 안내 마감 — 모임 전날 이 시각(KST)까지 크론 기록이 없으면 「안 돌았다」로 본다.
 * 크론은 19:00 KST에 걸려 있고 Vercel이 19:00~19:59 사이에 돌린다
 */
export const REMIND_DEADLINE_KST_HOUR = 21

/** 마지막 점검이 이 시간보다 오래됐으면 대시보드에 「점검이 멈췄다」를 띄운다 — 하루 한 번 + 여유 */
export const REMIND_RUN_STALE_HOURS = 26

export type MissKind = 'signup' | 'remind'
export type MissReason = 'failed' | 'no_phone' | 'no_record' | 'stuck'

export const MISS_KIND_LABELS: Record<MissKind, string> = {
  signup: '신청 안내',
  remind: '전날 안내',
}

export const MISS_REASON_LABELS: Record<MissReason, string> = {
  failed: '발송 실패',
  no_phone: '전화번호 없음',
  no_record: '보낸 기록 없음',
  stuck: '발송 중 멈춤',
}

export type MissParticipant = {
  registrationId: string
  userId: string
  createdAt: string
  paymentMethod: string
  /** 계좌이체에서 값이 있으면 앱 밖(구글폼 등)에서 옮겨 넣은 신청이다 — 앱 계좌이체는 비어 있다 */
  paymentId: string | null
  nickname: string
  realName: string | null
  /** 총괄만 채운다. 운영진 화면에는 불러오지 않는다 (2026-10-16) */
  phone?: string | null
}

export type MissNotification = {
  type: string
  status: string
  recipientId: string
  registrationId: string | null
  createdAt: string
}

export type MissItem = {
  registrationId: string
  userId: string
  nickname: string
  realName: string | null
  phone?: string | null
  kind: MissKind
  reason: MissReason
}

export type RemindState =
  /** 아직 전날 저녁이 아니다 */
  | { state: 'not_yet' }
  /** 돌았다. `ranAt` 이전 신청자가 대상 */
  | { state: 'ran'; ranAt: string; targets: number }
  /** 마감이 지났는데 기록이 없다 — 크론이 안 돌았거나 이 모임을 못 봤다 */
  | { state: 'missing' }

export type MeetingMissReport = {
  /** 참여 인원(확정 + 입금 확인 중) — 「N명 중」의 N */
  participants: number
  /** 못 받은 사람 수(중복 없이) — 「M명에게」의 M */
  missedPeople: number
  items: MissItem[]
  remind: RemindState
}

function minutesBetween(fromIso: string, toMs: number): number {
  return (toMs - new Date(fromIso).getTime()) / 60000
}

/** 모임 전날 `REMIND_DEADLINE_KST_HOUR`시(KST)의 UTC 밀리초 */
export function remindDeadlineMs(meetingDate: string): number {
  const [y, m, d] = meetingDate.split('-').map(Number)
  // 전날 = d - 1, KST → UTC는 -9시간. Date.UTC가 일·월 넘김을 알아서 맞춘다
  return Date.UTC(y, m - 1, d - 1, REMIND_DEADLINE_KST_HOUR - 9, 0)
}

/** 신청 안내를 기대하는 신청인가 */
export function expectsSignupNotice(p: Pick<MissParticipant, 'paymentMethod' | 'createdAt' | 'paymentId'>): boolean {
  if (p.paymentMethod === 'card') return true
  if (p.paymentMethod === 'transfer') {
    // 운영자가 SQL로 옮겨 넣은 신청(예: 10/27 토론 `googleform-…`)은 앱 신청이 아니라 안내가 없다.
    // 앱 계좌이체(register_transfer)는 payment_id를 비워 둔다
    if (p.paymentId) return false
    return p.createdAt >= TRANSFER_SIGNUP_NOTICE_SINCE
  }
  // 'none' = 발제자 행. 운영자가 지정해 들어온 자리라 안내를 보내지 않는다
  return false
}

/** 알림 행 하나의 상태 → 못 받은 이유. 받았으면 null */
function reasonOf(row: MissNotification | undefined, nowMs: number): MissReason | null {
  if (!row) return 'no_record'
  if (row.status === 'sent') return null
  if (row.status === 'failed') return 'failed'
  if (row.status === 'skipped') return 'no_phone'
  if (row.status === 'pending') {
    return minutesBetween(row.createdAt, nowMs) >= STUCK_PENDING_MINUTES ? 'stuck' : null
  }
  return 'failed'
}

/** 같은 신청에 행이 여럿이면 받은 것(sent)이 하나라도 있으면 받은 것으로 친다 */
function bestRow(rows: MissNotification[]): MissNotification | undefined {
  return rows.find((r) => r.status === 'sent') ?? rows.find((r) => r.status === 'pending') ?? rows[0]
}

export function buildMeetingMissReport(input: {
  meetingDate: string
  participants: MissParticipant[]
  notifications: MissNotification[]
  /** 크론이 이 모임을 돌린 기록(공통 기록표). 없으면 null */
  remindRun: { ranAt: string; targets: number } | null
  now: Date
}): MeetingMissReport {
  const nowMs = input.now.getTime()
  const items: MissItem[] = []

  const signupByReg = new Map<string, MissNotification[]>()
  const remindByUser = new Map<string, MissNotification[]>()
  for (const n of input.notifications) {
    if ((SIGNUP_NOTICE_TYPES as readonly string[]).includes(n.type) && n.registrationId) {
      const list = signupByReg.get(n.registrationId) ?? []
      list.push(n)
      signupByReg.set(n.registrationId, list)
    } else if (n.type === 'meeting_remind') {
      const list = remindByUser.get(n.recipientId) ?? []
      list.push(n)
      remindByUser.set(n.recipientId, list)
    }
  }

  // ─── 전날 안내가 돌았나 ───
  // 기록표가 없던 시절(이 기능 전) 모임은 첫 전날 알림 행의 시각을 돌았던 시각으로 쓴다
  const firstRemindAt = input.notifications
    .filter((n) => n.type === 'meeting_remind')
    .map((n) => n.createdAt)
    .sort()[0]
  let remind: RemindState
  if (input.remindRun) {
    remind = { state: 'ran', ranAt: input.remindRun.ranAt, targets: input.remindRun.targets }
  } else if (firstRemindAt) {
    remind = { state: 'ran', ranAt: firstRemindAt, targets: remindByUser.size }
  } else if (nowMs >= remindDeadlineMs(input.meetingDate)) {
    remind = { state: 'missing' }
  } else {
    remind = { state: 'not_yet' }
  }

  // 마감이 지났는데 기록이 없으면, 마감 전에 신청한 사람이 대상이었다
  const remindCutoff =
    remind.state === 'ran'
      ? remind.ranAt
      : remind.state === 'missing'
        ? new Date(remindDeadlineMs(input.meetingDate)).toISOString()
        : null

  const seenRemindUser = new Set<string>()
  for (const p of input.participants) {
    const who = { registrationId: p.registrationId, userId: p.userId, nickname: p.nickname, realName: p.realName, phone: p.phone }

    // 신청 안내 — 신청 직후라 아직 보내는 중일 수 있는 건 기다린다
    if (expectsSignupNotice(p) && minutesBetween(p.createdAt, nowMs) >= STUCK_PENDING_MINUTES) {
      const reason = reasonOf(bestRow(signupByReg.get(p.registrationId) ?? []), nowMs)
      if (reason) items.push({ ...who, kind: 'signup', reason })
    }

    // 전날 안내 — 한 사람에게 한 번 (같은 사람이 신청을 두 번 갖고 있어도)
    if (remindCutoff && p.createdAt < remindCutoff && !seenRemindUser.has(p.userId)) {
      seenRemindUser.add(p.userId)
      const reason = reasonOf(bestRow(remindByUser.get(p.userId) ?? []), nowMs)
      if (reason) items.push({ ...who, kind: 'remind', reason })
    }
  }

  return {
    participants: new Set(input.participants.map((p) => p.userId)).size,
    missedPeople: new Set(items.map((i) => i.userId)).size,
    items,
    remind,
  }
}

/** 마지막 점검이 멈췄나 — 기록이 한 번도 없으면 판단하지 않는다(배포 직후 첫 실행 전) */
export function isRemindRunStale(lastRunAt: string | null, now: Date): boolean {
  if (!lastRunAt) return false
  return (now.getTime() - new Date(lastRunAt).getTime()) / 3600000 > REMIND_RUN_STALE_HOURS
}

/** 「9명 중 2명에게 알림톡이 안 갔어요」 */
export function missHeadline(report: Pick<MeetingMissReport, 'participants' | 'missedPeople'>): string {
  return `${report.participants}명 중 ${report.missedPeople}명에게 알림톡이 안 갔어요`
}
