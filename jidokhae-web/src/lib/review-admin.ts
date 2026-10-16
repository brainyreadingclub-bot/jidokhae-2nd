import { createServiceClient } from '@/lib/supabase/admin'
import { getKSTToday, shiftDate } from '@/lib/kst'
import { PARTICIPATED_STATUSES } from '@/lib/registration-status'
import {
  commentPublicState,
  findFirstTimers,
  getReviewWindow,
  judgeReregistration,
  REREG_WINDOW_DAYS,
  reviewDeadline,
  summarizeMeetingReviews,
  type CommentPublicState,
  type MeetingReviewSummary,
  type ParticipationForFirst,
  type RegHistoryRow,
  type Rereg,
  type ReviewWindow,
} from '@/lib/review-rules'

/**
 * 운영자 「모임 후기」 화면 조회 — **총괄운영자(admin)만** (대표님 답 2026-10-12). 호출부 page가 역할을 본다.
 * 계산은 전부 `review-rules.ts` 순수 함수 — 숫자 정의를 화면마다 따로 만들지 않는다 (계획서 §3-4).
 * 250명 규모라 대상 회원의 신청 이력을 통째로 읽어 JS에서 센다.
 *
 * 🔴 칭찬은 여기 없다 — 개수·순위를 운영자 화면에도 두지 않는다 (결정).
 */

/** 목록 기간 — 최근 30일 안에 열린 정기모임 */
export const ADMIN_REVIEW_RANGE_DAYS = 30

type MeetingLite = { id: string; date: string; region: string | null; title: string }

type ReviewFull = {
  id: string
  user_id: string
  meeting_id: string
  did_not_attend: boolean
  mood: number | null
  regret_codes: string[] | null
  regret_other: string | null
  comment: string | null
  comment_public: boolean
  comment_unpublished_at: string | null
  comment_hidden_at: string | null
}

const REVIEW_COLUMNS =
  'id, user_id, meeting_id, did_not_attend, mood, regret_codes, regret_other, comment, comment_public, comment_unpublished_at, comment_hidden_at'

type Admin = ReturnType<typeof createServiceClient>

class ReviewQueryError extends Error {}

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  // 조회 실패를 빈 값으로 삼키면 「후기 0건」과 구분이 안 된다 — 던져서 error.tsx로 보낸다
  if (res.error) throw new ReviewQueryError(`${what} 조회 실패: ${res.error.message}`)
  return (res.data ?? ([] as unknown)) as T
}

async function loadParticipants(admin: Admin, meetingIds: string[]) {
  if (meetingIds.length === 0) return [] as { user_id: string; meeting_id: string }[]
  return must(
    await admin
      .from('registrations')
      .select('user_id, meeting_id')
      .in('meeting_id', meetingIds)
      .in('status', PARTICIPATED_STATUSES),
    '참여자',
  ) as { user_id: string; meeting_id: string }[]
}

/** 대상 회원들의 정기·active 참여 전부 — 「첫 모임」 판정용 */
async function loadRegularParticipations(admin: Admin, userIds: string[]): Promise<ParticipationForFirst[]> {
  if (userIds.length === 0) return []
  const rows = must(
    await admin
      .from('registrations')
      .select('user_id, meeting_id, meetings(date, meeting_type, status)')
      .in('user_id', userIds)
      .in('status', PARTICIPATED_STATUSES),
    '참여 이력',
  ) as unknown as {
    user_id: string
    meeting_id: string
    meetings: { date: string; meeting_type: string | null; status: string } | null
  }[]
  return rows
    .filter((r) => r.meetings?.meeting_type === 'regular' && r.meetings.status === 'active')
    .map((r) => ({ user_id: r.user_id, meeting_id: r.meeting_id, date: r.meetings!.date }))
}

/** 첫 모임 회원들의 신청 이력 전부 — status 무관(취소해도 신청은 한 것), 유형 무관 */
async function loadRegHistory(admin: Admin, userIds: string[]): Promise<RegHistoryRow[]> {
  if (userIds.length === 0) return []
  const rows = must(
    await admin
      .from('registrations')
      .select('user_id, meeting_id, created_at, meetings(date, region)')
      .in('user_id', userIds),
    '신청 이력',
  ) as unknown as {
    user_id: string
    meeting_id: string
    created_at: string
    meetings: { date: string; region: string | null } | null
  }[]
  return rows
    .filter((r) => r.meetings)
    .map((r) => ({
      user_id: r.user_id,
      meeting_id: r.meeting_id,
      created_at: r.created_at,
      meeting_date: r.meetings!.date,
      region: r.meetings!.region,
    }))
}

// ─── 목록 (시안 A1) ───

export type AdminReviewListRow = {
  meeting: MeetingLite
  window: ReviewWindow
  deadline: string
  summary: MeetingReviewSummary
  firstTimers: number
  publicComments: number
}

export type AdminReviewOverview = {
  rows: AdminReviewListRow[]
  regions: string[]
  kpi: {
    moodAvg: number | null
    reviewed: number
    participants: number
    firstTimers: number
    reregistered: number
  }
}

export async function getAdminReviewOverview(region: string | null): Promise<AdminReviewOverview> {
  const admin = createServiceClient()
  const kstToday = getKSTToday()
  const from = shiftDate(kstToday, -ADMIN_REVIEW_RANGE_DAYS)

  const allMeetings = must(
    await admin
      .from('meetings')
      .select('id, date, region, title')
      .eq('meeting_type', 'regular')
      .eq('status', 'active')
      .gte('date', from)
      .lt('date', kstToday)
      .order('date', { ascending: false }),
    '모임',
  ) as MeetingLite[]
  const regions = [...new Set(allMeetings.map((m) => m.region).filter((r): r is string => !!r))].sort()
  const meetings = region ? allMeetings.filter((m) => m.region === region) : allMeetings
  const ids = meetings.map((m) => m.id)

  const [parts, reviews] = await Promise.all([
    loadParticipants(admin, ids),
    ids.length === 0
      ? ([] as ReviewFull[])
      : (must(
          await admin.from('meeting_reviews').select(REVIEW_COLUMNS).in('meeting_id', ids),
          '후기',
        ) as ReviewFull[]),
  ])

  const allUsers = [...new Set(parts.map((p) => p.user_id))]
  const regular = await loadRegularParticipations(admin, allUsers)

  const firstByMeeting = new Map<string, string[]>()
  for (const m of meetings) {
    const pids = parts.filter((p) => p.meeting_id === m.id).map((p) => p.user_id)
    firstByMeeting.set(m.id, findFirstTimers(m.id, pids, regular))
  }
  const firstUsers = [...new Set([...firstByMeeting.values()].flat())]
  const history = await loadRegHistory(admin, firstUsers)

  let moodSum = 0
  let reviewed = 0
  let participants = 0
  let firstTimers = 0
  let reregistered = 0

  const rows: AdminReviewListRow[] = meetings.map((m) => {
    const pids = parts.filter((p) => p.meeting_id === m.id).map((p) => p.user_id)
    const mine = reviews.filter((r) => r.meeting_id === m.id)
    const summary = summarizeMeetingReviews(pids, mine)
    const firsts = firstByMeeting.get(m.id) ?? []
    moodSum += summary.moodSum
    reviewed += summary.reviewed
    participants += summary.participants
    firstTimers += firsts.length
    reregistered += firsts.filter(
      (u) => judgeReregistration(u, m, history, kstToday).kind === 'yes',
    ).length
    return {
      meeting: m,
      window: getReviewWindow(m.date, kstToday),
      deadline: reviewDeadline(m.date),
      summary,
      firstTimers: firsts.length,
      publicComments: mine.filter((r) => commentPublicState(r) === 'public').length,
    }
  })

  return {
    rows,
    regions,
    kpi: {
      moodAvg: reviewed === 0 ? null : Math.round((moodSum / reviewed) * 10) / 10,
      reviewed,
      participants,
      firstTimers,
      reregistered,
    },
  }
}

// ─── 한 모임 (시안 A2 · A3) ───

export type AdminFirstTimerRow = {
  userId: string
  nickname: string
  mood: number | null
  didNotAttend: boolean
  regretCodes: string[]
  regretOther: string | null
  comment: string | null
  rereg: Rereg
}

export type AdminCommentRow = {
  id: string
  nickname: string
  mood: number | null
  comment: string
  state: CommentPublicState
  unpublishedAt: string | null
  hiddenAt: string | null
}

export type AdminMeetingReviewDetail = {
  meeting: MeetingLite & { meeting_type: string | null }
  window: ReviewWindow
  deadline: string
  rereDeadline: string
  summary: MeetingReviewSummary
  regretOthers: string[]
  firstTimers: AdminFirstTimerRow[]
  comments: AdminCommentRow[]
  reviewNoticeSentAt: string | null
}

export async function getAdminMeetingReviewDetail(meetingId: string): Promise<AdminMeetingReviewDetail | null> {
  const admin = createServiceClient()
  const kstToday = getKSTToday()

  const { data: meeting, error } = await admin
    .from('meetings')
    .select('id, date, region, title, meeting_type, status')
    .eq('id', meetingId)
    .maybeSingle()
  if (error) throw new ReviewQueryError(`모임 조회 실패: ${error.message}`)
  // 삭제된 모임은 전액 환불된 「없던 모임」 — 후기 화면에 넣지 않는다 (계획서 §7-2)
  if (!meeting || meeting.status !== 'active') return null

  const [parts, reviews, notice] = await Promise.all([
    loadParticipants(admin, [meetingId]),
    admin.from('meeting_reviews').select(REVIEW_COLUMNS).eq('meeting_id', meetingId),
    admin
      .from('notifications')
      .select('sent_at')
      .eq('meeting_id', meetingId)
      .eq('type', 'meeting_review')
      .eq('status', 'sent')
      .order('sent_at', { ascending: true })
      .limit(1),
  ])
  const reviewRows = must(reviews, '후기') as ReviewFull[]
  const pids = [...new Set(parts.map((p) => p.user_id))]

  const regular = await loadRegularParticipations(admin, pids)
  const firstIds = findFirstTimers(meetingId, pids, regular)
  const nickUsers = [...new Set([...pids, ...reviewRows.map((r) => r.user_id)])]
  const [history, profiles] = await Promise.all([
    loadRegHistory(admin, firstIds),
    nickUsers.length === 0
      ? ([] as { id: string; nickname: string | null }[])
      : (must(
          await admin.from('profiles').select('id, nickname').in('id', nickUsers),
          '닉네임',
        ) as { id: string; nickname: string | null }[]),
  ])
  // 이 화면은 닉네임만 쓴다 — admin은 개인정보 열람 권한이 있지만 여기 전화·실명을 붙일 이유가 없다 (계획서 §7-4)
  const nick = new Map(profiles.map((p) => [p.id, p.nickname || '회원']))
  const byUser = new Map(reviewRows.map((r) => [r.user_id, r]))
  const members = new Set(pids)

  const firstTimers: AdminFirstTimerRow[] = firstIds.map((u) => {
    const r = byUser.get(u)
    return {
      userId: u,
      nickname: nick.get(u) ?? '회원',
      mood: r?.mood ?? null,
      didNotAttend: r?.did_not_attend ?? false,
      regretCodes: r?.regret_codes ?? [],
      regretOther: r?.regret_other ?? null,
      comment: r?.comment ?? null,
      rereg: judgeReregistration(u, meeting, history, kstToday),
    }
  })

  const comments: AdminCommentRow[] = reviewRows
    .filter((r) => r.comment && members.has(r.user_id))
    .map((r) => ({
      id: r.id,
      nickname: nick.get(r.user_id) ?? '회원',
      mood: r.mood,
      comment: r.comment!,
      state: commentPublicState(r),
      unpublishedAt: r.comment_unpublished_at,
      hiddenAt: r.comment_hidden_at,
    }))
    // 공개 중인 것을 위로 — 내릴지 판단할 것이 먼저 보이게
    .sort((a, b) => Number(b.state === 'public') - Number(a.state === 'public'))

  return {
    meeting,
    window: getReviewWindow(meeting.date, kstToday),
    deadline: reviewDeadline(meeting.date),
    rereDeadline: shiftDate(meeting.date, REREG_WINDOW_DAYS),
    summary: summarizeMeetingReviews(pids, reviewRows),
    regretOthers: reviewRows
      .filter((r) => members.has(r.user_id) && r.regret_other)
      .map((r) => r.regret_other as string),
    firstTimers,
    comments,
    reviewNoticeSentAt: notice.error ? null : ((notice.data?.[0]?.sent_at as string | undefined) ?? null),
  }
}
