import { formatKoreanDate, formatMonthDay, getDaysUntil, shiftDate, toKSTDate } from '@/lib/kst'

/**
 * 모임 후기 — 순수 규칙 (client 번들 안전 · 단위 테스트 대상).
 *
 * 정본 결정: `검토문서/DECISIONS.md` 2026-10-12 「모임 후기」 · 2026-10-16 「칭찬은 후기를 먼저 내고…」
 * DB 계획: 공유 가지 `docs/시안-공유/2026-10-12-모임후기-DB계획/계획서-전문.md`
 *
 * 🔴 코드 목록(표정·아쉬운 점)은 `supabase/migration-meeting-review.sql`의 CHECK와 **같아야 한다.**
 * 문구는 DB에 넣지 않는다 — 문구를 고쳐도 DB를 안 건드린다. 코드를 **늘릴** 때만 CHECK를 넓힌다.
 */

// ─── 후기 받는 기간 ───

/** 모임 다음 날부터 */
export const REVIEW_OPEN_FROM_DAY = 1
/** 모임 3일 뒤까지 (칭찬을 4일 뒤에 모아 보내려면 그 전에 닫혀야 한다 — 시안 README) */
export const REVIEW_OPEN_TO_DAY = 3
/** 「기간이 지났어요」 안내를 보이는 마지막 날 (계획서 §3-5 ①') */
export const REVIEW_EXPIRED_NOTICE_TO_DAY = 7

/**
 * - before: 모임 당일·이전 — 아직 후기를 받지 않는다
 * - open: 모임 다음 날 ~ 3일 뒤 (KST)
 * - expired: 4일 뒤 ~ 7일 뒤 — 「기간이 지났어요」(시안 12)를 보여줄 수 있는 때
 * - closed: 그 뒤
 */
export type ReviewWindow = 'before' | 'open' | 'expired' | 'closed'

export function getReviewWindow(meetingDate: string, kstToday: string): ReviewWindow {
  const since = -getDaysUntil(meetingDate, kstToday)
  if (since < REVIEW_OPEN_FROM_DAY) return 'before'
  if (since <= REVIEW_OPEN_TO_DAY) return 'open'
  if (since <= REVIEW_EXPIRED_NOTICE_TO_DAY) return 'expired'
  return 'closed'
}

/** 후기 마감일 "YYYY-MM-DD" (모임 3일 뒤) */
export function reviewDeadline(meetingDate: string): string {
  return shiftDate(meetingDate, REVIEW_OPEN_TO_DAY)
}

/**
 * 화면에서 모임을 부르는 이름 — "10월 14일 (수) 경주 정기모임" / 요일 없이 "10월 14일 경주 정기모임".
 * 제목을 쓰지 않는다 — 정기모임 제목은 매번 같아(「매주 수요일 정기모임」) 구분이 안 된다
 * (알림톡 `#{모임명}`을 뺀 것과 같은 판단)
 */
export function reviewMeetingLabel(date: string, region: string | null, withWeekday = true): string {
  const d = withWeekday ? formatKoreanDate(date) : formatMonthDay(date)
  return `${d} ${region ? `${region} ` : ''}정기모임`
}

// ─── ① 표정 ───

export const MOODS = [
  { value: 1, label: '별로였어요' },
  { value: 2, label: '아쉬웠어요' },
  { value: 3, label: '무난했어요' },
  { value: 4, label: '좋았어요' },
  { value: 5, label: '최고였어요' },
] as const

/** 낮은 표정 = 1·2. 「무난했어요」까지 물으면 대부분이 한 번 더 고르게 돼 무거워진다 (시안 README) */
export const LOW_MOOD_MAX = 2

export function isValidMood(mood: unknown): mood is number {
  return typeof mood === 'number' && Number.isInteger(mood) && mood >= 1 && mood <= 5
}

export function isLowMood(mood: number | null | undefined): boolean {
  return isValidMood(mood) && mood <= LOW_MOOD_MAX
}

export function moodLabel(mood: number | null | undefined): string {
  return MOODS.find((m) => m.value === mood)?.label ?? ''
}

/** 「무엇이 아쉬웠나요?」 — 운영자가 고칠 수 있는 것 순서 (진행 → 공간 → 책 → 안내 → 기타) */
export const REGRET_OPTIONS = [
  { code: 'short_time', label: '이야기할 시간이 짧았어요' },
  { code: 'long_talk', label: '몇 사람 이야기가 길었어요' },
  { code: 'unsmooth', label: '진행이 매끄럽지 않았어요' },
  { code: 'hard_to_join', label: '대화에 끼기 어려웠어요' },
  { code: 'space', label: '공간이 불편했어요' },
  { code: 'book_fit', label: '책이 잘 안 맞았어요' },
  { code: 'info', label: '시간·장소 안내가 헷갈렸어요' },
  { code: 'other', label: '기타' },
] as const

export type RegretCode = (typeof REGRET_OPTIONS)[number]['code']

const REGRET_CODES = new Set<string>(REGRET_OPTIONS.map((o) => o.code))

export function regretLabel(code: string): string {
  return REGRET_OPTIONS.find((o) => o.code === code)?.label ?? code
}

export const REGRET_OTHER_MAX = 50
export const COMMENT_MAX = 100

/** Postgres `char_length`와 같은 셈 — 코드 포인트 단위 (JS `length`는 이모지를 둘로 센다) */
export function charLength(s: string): number {
  return Array.from(s).length
}

export type NormalizedMood = {
  mood: number
  regret_codes: RegretCode[]
  regret_other: string | null
}

type Result<T> = { ok: true; value: T } | { ok: false; message: string }

/**
 * ① 저장 값 정리.
 * 🔴 표정을 3 이상으로 올리면 아쉬운 점을 **같이 비운다** — 안 비우면 DB CHECK
 * (`meeting_reviews_regret_low_mood_only`)에 걸려 저장이 실패한다 (계획서 §7-3)
 */
export function normalizeMoodInput(input: {
  mood: unknown
  regretCodes?: unknown
  regretOther?: unknown
}): Result<NormalizedMood> {
  if (!isValidMood(input.mood)) return { ok: false, message: '표정을 골라 주세요' }
  const mood = input.mood

  if (!isLowMood(mood)) return { ok: true, value: { mood, regret_codes: [], regret_other: null } }

  const picked = new Set(
    (Array.isArray(input.regretCodes) ? input.regretCodes : []).filter(
      (c): c is RegretCode => typeof c === 'string' && REGRET_CODES.has(c),
    ),
  )
  // 화면 순서로 정렬 — 같은 선택이 늘 같은 배열이 되게
  const regret_codes = REGRET_OPTIONS.map((o) => o.code).filter((c) => picked.has(c))

  let regret_other: string | null = null
  if (picked.has('other') && typeof input.regretOther === 'string') {
    const t = input.regretOther.trim()
    if (charLength(t) > REGRET_OTHER_MAX) {
      return { ok: false, message: `기타는 ${REGRET_OTHER_MAX}자까지 쓸 수 있어요` }
    }
    regret_other = t || null
  }

  return { ok: true, value: { mood, regret_codes, regret_other } }
}

// ─── ② 한 줄 소감 ───

export function normalizeCommentInput(input: {
  comment: unknown
  isPublic: unknown
}): Result<{ comment: string | null; isPublic: boolean }> {
  const t = typeof input.comment === 'string' ? input.comment.trim() : ''
  if (charLength(t) > COMMENT_MAX) {
    return { ok: false, message: `한 줄 소감은 ${COMMENT_MAX}자까지 쓸 수 있어요` }
  }
  const comment = t || null
  // 공개는 소감이 있어야 한다 (DB CHECK `meeting_reviews_public_needs_comment`)
  return { ok: true, value: { comment, isPublic: input.isPublic === true && comment !== null } }
}

/** 공개 상태 판정에 쓰는 칸 */
export type CommentState = {
  comment: string | null
  comment_public: boolean
  comment_hidden_at: string | null
  comment_unpublished_at?: string | null
}

/**
 * 소감 공개 상태.
 * 🔴 「운영자가 내림」 판정은 `comment_hidden_at`으로 한다 — 내린 운영자 칸(`hidden_by`)은
 * 운영자 계정이 지워지면 비는데, 그때 내림이 저절로 풀리면 안 된다 (계획서 §2-1)
 */
export type CommentPublicState = 'none' | 'public' | 'private' | 'member_unpublished' | 'admin_hidden'

export function commentPublicState(r: CommentState): CommentPublicState {
  if (!r.comment) return 'none'
  if (r.comment_hidden_at) return 'admin_hidden'
  if (r.comment_public) return 'public'
  if (r.comment_unpublished_at) return 'member_unpublished'
  return 'private'
}

type Patch = Record<string, string | boolean | null>

/**
 * ② 소감 저장 patch. 운영자가 내린 소감은 회원이 다시 공개할 수 없다 (DB CHECK와 두 겹).
 * 공개 시각(`comment_published_at`)은 새로 공개하거나 공개 중인 글을 고쳤을 때만 바꾼다 — 공개 소감 정렬 기준
 */
export function buildCommentPatch(
  prev: CommentState | null,
  next: { comment: string | null; isPublic: boolean },
  nowIso: string,
): { ok: true; patch: Patch } | { ok: false; reason: 'hidden' } {
  if (next.isPublic && prev?.comment_hidden_at) return { ok: false, reason: 'hidden' }
  const patch: Patch = { comment: next.comment, comment_public: next.isPublic }
  if (next.isPublic && (!prev?.comment_public || prev.comment !== next.comment)) {
    patch.comment_published_at = nowIso
  }
  if (!next.isPublic && prev?.comment_public) patch.comment_unpublished_at = nowIso
  return { ok: true, patch }
}

/** 「내가 남긴 후기」에서 공개하기 / 공개 그만하기 — 기간과 무관하게 언제든 (계획서 §7-3) */
export function buildPublishPatch(
  prev: CommentState,
  publish: boolean,
  nowIso: string,
): { ok: true; patch: Patch } | { ok: false; reason: 'no_comment' | 'hidden' | 'noop' } {
  if (!prev.comment) return { ok: false, reason: 'no_comment' }
  if (publish && prev.comment_hidden_at) return { ok: false, reason: 'hidden' }
  if (publish === prev.comment_public) return { ok: false, reason: 'noop' }
  return publish
    ? { ok: true, patch: { comment_public: true, comment_published_at: nowIso } }
    : { ok: true, patch: { comment_public: false, comment_unpublished_at: nowIso } }
}

// ─── 흐름 단계 ───

/**
 * 후기 흐름 단계. **배열로 둔다** — 칭찬(`'praise'`)을 2단계에서 `'comment'`와 `'book'` 사이에
 * 끼울 자리다 (DECISIONS 2026-10-16: 칭찬은 후기가 잘 돌아가는 것을 확인한 뒤 붙인다).
 * 화면의 「1 / N」은 이 배열 길이로 센다.
 */
export type ReviewStep = 'mood' | 'comment' | 'book'

export function buildReviewSteps(opts: { bookStep: boolean }): ReviewStep[] {
  const steps: ReviewStep[] = ['mood', 'comment']
  // (2단계 자리) 칭찬 — steps.push('praise')
  if (opts.bookStep) steps.push('book')
  return steps
}

// ─── 대상 고르기 (/my 분기) ───

export type ReviewParticipation = {
  meetingId: string
  date: string
  meetingType: string | null
  meetingStatus: string
}

export type ReviewTarget = { meetingId: string; date: string }

/**
 * `/my`에 들어온 회원에게 띄울 후기 (계획서 §3-5).
 * - open: 참여 · 정기 · active · 오늘이 D+1~D+3 · 아직 안 남김 → 가장 최근 1건
 * - expired: 같은 조건인데 D+4~D+7 **그리고 후기 알림톡을 받았다** → 가장 최근 1건.
 *   알림톡 조건이 없으면 스위치를 켠 첫 주에, 후기를 요청받은 적도 없는 사람이 「기간이 지났어요」를 본다
 */
export function pickReviewTargets(
  participations: ReviewParticipation[],
  reviewedMeetingIds: ReadonlySet<string>,
  reviewNotifiedMeetingIds: ReadonlySet<string>,
  kstToday: string,
): { open: ReviewTarget | null; expired: ReviewTarget | null } {
  const seen = new Set<string>()
  const eligible = participations
    .filter((p) => p.meetingType === 'regular' && p.meetingStatus === 'active')
    .filter((p) => !reviewedMeetingIds.has(p.meetingId))
    .filter((p) => (seen.has(p.meetingId) ? false : (seen.add(p.meetingId), true)))
    .sort((a, b) => b.date.localeCompare(a.date))

  const open = eligible.find((p) => getReviewWindow(p.date, kstToday) === 'open')
  const expired = eligible.find(
    (p) =>
      getReviewWindow(p.date, kstToday) === 'expired' && reviewNotifiedMeetingIds.has(p.meetingId),
  )
  return {
    open: open ? { meetingId: open.meetingId, date: open.date } : null,
    expired: expired ? { meetingId: expired.meetingId, date: expired.date } : null,
  }
}

/**
 * `/my`로 들어온 사람을 어디로 보낼지. null = 구 화면 그대로.
 * 후기를 물어보기(서재)보다 앞에 둔다 — 후기 기간(3일) 안의 같은 모임은 물어보기도 열려 있어서
 * 물어보기가 앞이면 후기 알림톡을 누른 사람이 서재로 간다 (계획서 §3-5)
 */
export function resolveMyRedirect(input: {
  nextUi: boolean
  loggedIn: boolean
  reviewEnabled: boolean
  openReviewMeetingId: string | null
  expiredReviewMeetingId: string | null
  hasPendingAsk: boolean
}): string | null {
  if (!input.nextUi || !input.loggedIn) return null
  if (input.reviewEnabled && input.openReviewMeetingId) return `/review/${input.openReviewMeetingId}`
  if (input.reviewEnabled && input.expiredReviewMeetingId) {
    return `/review/${input.expiredReviewMeetingId}`
  }
  return input.hasPendingAsk ? '/shelf' : '/me'
}

// ─── 마침 화면: 같은 지역 다음 정기모임 ───

export type NextMeetingCandidate = {
  id: string
  date: string
  time: string
  region: string | null
  meeting_type: string | null
  status: string
}

/**
 * 마침 화면 카드 (시안 10). 같은 지역 · 정기 · active · 오늘 이후(오늘 포함) · 내가 신청 안 한 것 중
 * 가장 빠른 것. **마감된 모임도 후보다** — 홈 「다가오는 정기모임」 칸과 같은 규칙
 * (`home-upcoming.ts` — 2026-10-15 「마감 제외」 되돌림). 신청 버튼은 모임 상세가 다시 판정한다.
 */
export function pickNextRegularMeeting<T extends NextMeetingCandidate>(
  candidates: T[],
  region: string | null,
  kstToday: string,
  myLiveMeetingIds: ReadonlySet<string>,
): T | null {
  if (!region) return null
  const list = candidates
    .filter(
      (m) =>
        m.meeting_type === 'regular' &&
        m.status === 'active' &&
        m.region === region &&
        m.date >= kstToday &&
        !myLiveMeetingIds.has(m.id),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
  return list[0] ?? null
}

// ─── 10:00 크론: 다음 날 알림톡을 무엇으로 보낼지 ───

export type DayAfterNotice = 'meeting_review' | 'book_ask'

/**
 * 셋 다 맞을 때만 `meeting_review`. 하나라도 아니면 지금처럼 `book_ask` — 한 모임에 둘 다 가지 않는다.
 * 🔴 템플릿 env가 없는데 `meeting_review`를 보내면 발송은 실패하고 중복 차단 인덱스가 자리를
 * 차지해 **그 회원은 그 모임 후기 알림을 영영 다시 못 받는다** (계획서 §4-6)
 */
export function chooseDayAfterNotice(input: {
  reviewEnabled: boolean
  nextUiEnabled: boolean
  reviewTemplateId: string | null | undefined
}): DayAfterNotice {
  const hasTemplate = typeof input.reviewTemplateId === 'string' && input.reviewTemplateId.trim() !== ''
  return input.reviewEnabled && input.nextUiEnabled && hasTemplate ? 'meeting_review' : 'book_ask'
}

// ─── 운영자 숫자 (계획서 §3-4 — 숫자 정의를 화면마다 따로 만들지 않는다) ───

export type ReviewRowForStats = {
  user_id: string
  did_not_attend: boolean
  mood: number | null
  regret_codes: string[] | null
}

export type MeetingReviewSummary = {
  participants: number
  reviewed: number
  absent: number
  notYet: number
  moodSum: number
  moodAvg: number | null
  moodCounts: Record<1 | 2 | 3 | 4 | 5, number>
  lowCount: number
  regretCounts: { code: string; count: number }[]
}

/**
 * 한 모임 후기 집계. 🔴 분자(후기)는 분모(참여자)와 **교집합**한다 — 물어보기 응답률이 100%를 넘은
 * 사고(DECISIONS 2026-07-24)가 분자·분모를 다른 곳에서 가져와 났다. 참여를 취소한 사람의 후기는 세지 않는다.
 */
export function summarizeMeetingReviews(
  participantIds: string[],
  reviews: ReviewRowForStats[],
): MeetingReviewSummary {
  const members = new Set(participantIds)
  const moodCounts: MeetingReviewSummary['moodCounts'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const regret = new Map<string, number>()
  let reviewed = 0
  let absent = 0
  let moodSum = 0
  let lowCount = 0
  const counted = new Set<string>()

  for (const r of reviews) {
    if (!members.has(r.user_id) || counted.has(r.user_id)) continue
    counted.add(r.user_id)
    if (r.did_not_attend) {
      absent += 1
      continue
    }
    if (!isValidMood(r.mood)) continue
    reviewed += 1
    moodSum += r.mood
    moodCounts[r.mood as 1 | 2 | 3 | 4 | 5] += 1
    if (isLowMood(r.mood)) {
      lowCount += 1
      for (const c of r.regret_codes ?? []) regret.set(c, (regret.get(c) ?? 0) + 1)
    }
  }

  const order = REGRET_OPTIONS.map((o) => o.code as string)
  const regretCounts = [...regret.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || order.indexOf(a.code) - order.indexOf(b.code))

  return {
    participants: members.size,
    reviewed,
    absent,
    notYet: Math.max(0, members.size - reviewed - absent),
    moodSum,
    moodAvg: reviewed === 0 ? null : Math.round((moodSum / reviewed) * 10) / 10,
    moodCounts,
    lowCount,
    regretCounts,
  }
}

export type ParticipationForFirst = { user_id: string; meeting_id: string; date: string }

/**
 * 첫 모임 회원 = 이 모임이 **DB상 처음 참여한 정기모임**인 사람 (계획서 §3-4, 관리자 결정).
 * `participations`는 정기 · active · 참여(confirmed·pending_transfer) 행만 넘긴다.
 * 구글폼 시절 이력은 DB에 없어 오래된 회원이 「첫 모임」으로 잡힐 수 있다 — 받아들인 한계다.
 */
export function findFirstTimers(
  meetingId: string,
  participantIds: string[],
  participations: ParticipationForFirst[],
): string[] {
  const firstOf = new Map<string, ParticipationForFirst>()
  for (const p of participations) {
    const cur = firstOf.get(p.user_id)
    if (!cur || p.date < cur.date || (p.date === cur.date && p.meeting_id < cur.meeting_id)) {
      firstOf.set(p.user_id, p)
    }
  }
  return [...new Set(participantIds)].filter((u) => firstOf.get(u)?.meeting_id === meetingId)
}

export const REREG_WINDOW_DAYS = 14

export type RegHistoryRow = {
  user_id: string
  meeting_id: string
  /** 신청 시각 (timestamptz ISO) */
  created_at: string
  meeting_date: string
  region: string | null
}

export type Rereg =
  | { kind: 'yes'; meetingDate: string; region: string | null }
  | { kind: 'pending'; daysLeft: number }
  | { kind: 'no' }

/**
 * 14일 안 재신청 (계획서 §3-4, 관리자 결정). 둘 중 하나라도 해당하면 「했어요」:
 * (가) 그 모임 다음 날 ~ 14일 뒤(KST, 신청 시각 기준)에 다른 모임 신청이 새로 생겼다
 * (나) 그 모임 전에 이미 신청해 둔 다음 모임(날짜가 더 늦은 다른 모임)이 있다
 * 둘 다 **status 무관**(취소해도 신청은 한 것) · 모임 유형 무관. 기한이 남았으면 「아직 · N일 남음」
 */
export function judgeReregistration(
  userId: string,
  meeting: { id: string; date: string },
  history: RegHistoryRow[],
  kstToday: string,
): Rereg {
  const deadline = shiftDate(meeting.date, REREG_WINDOW_DAYS)
  const hits = history
    .filter((r) => r.user_id === userId && r.meeting_id !== meeting.id)
    .filter((r) => {
      const created = toKSTDate(new Date(r.created_at))
      const newAfter = created > meeting.date && created <= deadline
      const bookedAhead = created <= meeting.date && r.meeting_date > meeting.date
      return newAfter || bookedAhead
    })
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))

  if (hits[0]) return { kind: 'yes', meetingDate: hits[0].meeting_date, region: hits[0].region }
  const daysLeft = getDaysUntil(deadline, kstToday)
  return daysLeft >= 0 ? { kind: 'pending', daysLeft } : { kind: 'no' }
}
