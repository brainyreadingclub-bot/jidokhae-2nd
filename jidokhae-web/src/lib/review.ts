import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/admin'
import { getSiteSettings } from '@/lib/site-settings'
import { getKSTToday, shiftDate } from '@/lib/kst'
import { PARTICIPATED_STATUSES } from '@/lib/registration-status'
import {
  REVIEW_EXPIRED_NOTICE_TO_DAY,
  pickNextRegularMeeting,
  pickReviewTargets,
  type ReviewParticipation,
  type ReviewTarget,
} from '@/lib/review-rules'

/**
 * 모임 후기 — 서버 조회 (service_role).
 * 순수 규칙은 `review-rules.ts`. 이 파일은 client 번들에 들어가면 안 된다.
 *
 * 🔴 forward-compatible: 스위치(`site_settings.review_enabled`) 판정을 **표 조회보다 먼저** 한다.
 * 행이 없거나 'on'이 아니면 꺼짐 — 지금 동작 그대로다.
 * 조회가 실패하면 null/빈 값으로 떨어지되 **조용히 삼키지 않고** `console.error`로 남긴다 —
 * 「조회 실패」와 「대상 없음」을 합쳐 덮은 것이 결제 사고를 몇 달 숨겼다(루트 CLAUDE.md 「결제 안전망」).
 * 여기는 돈이 아니라 화면 분기라 500으로 끝내지는 않는다 (계획서 §3-5).
 */

/** 회원 화면 스위치. Preview 전용 env OR `site_settings.review_enabled` — 기존 플래그 패턴과 같다 */
export async function isReviewEnabled(): Promise<boolean> {
  if (process.env.REVIEW_PREVIEW === 'on') return true
  return isReviewEnabledInDb()
}

/**
 * DB 스위치만 본다 — **알림톡 크론은 이것만 쓴다.** Preview env로 실발송이 켜지면 안 된다.
 */
export async function isReviewEnabledInDb(): Promise<boolean> {
  const settings = await getSiteSettings()
  return settings.review_enabled === 'on'
}

export type ReviewMeeting = {
  id: string
  title: string
  date: string
  time: string
  region: string | null
  location: string | null
  meeting_type: string | null
  status: string
  fee: number
}

/** 회원 본인에게 돌려주는 후기 칸 — 🔴 `comment_hidden_by`(내린 운영자 id)는 빼고 준다 (계획서 §7-4) */
export type MyReview = {
  id: string
  meeting_id: string
  did_not_attend: boolean
  mood: number | null
  regret_codes: string[]
  regret_other: string | null
  comment: string | null
  comment_public: boolean
  comment_published_at: string | null
  comment_unpublished_at: string | null
  comment_hidden_at: string | null
}

export const MY_REVIEW_COLUMNS =
  'id, meeting_id, did_not_attend, mood, regret_codes, regret_other, comment, comment_public, comment_published_at, comment_unpublished_at, comment_hidden_at'

const MEETING_COLUMNS = 'id, title, date, time, region, location, meeting_type, status, fee'

/**
 * (user, meeting)이 후기 대상인지 — 참여(confirmed·입금대기) · 정기 · active. 기간은 호출부가 본다.
 * 대상이 아니면 null.
 * `attended`로 거르지 않는다 — 결석 데이터가 없는 칸이다(2026-10-16 실측 true 4 · false 0 · null 388).
 * 근거는 `api/cron/book-ask/route.ts` 대상 조회 주석에 있다
 */
export async function getReviewableMeeting(
  admin: SupabaseClient,
  userId: string,
  meetingId: string,
): Promise<ReviewMeeting | null> {
  const { data, error } = await admin
    .from('registrations')
    .select(`meeting_id, meetings(${MEETING_COLUMNS})`)
    .eq('user_id', userId)
    .eq('meeting_id', meetingId)
    .in('status', PARTICIPATED_STATUSES)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[review] 참여 확인 조회 실패:', error.message)
    return null
  }
  const m = (data as unknown as { meetings: ReviewMeeting | null } | null)?.meetings
  if (!m || m.meeting_type !== 'regular' || m.status !== 'active') return null
  return m
}

/** 본인 후기 1건. 표가 없거나 실패하면 `{ error: true }` */
export async function getMyReviewRow(
  admin: SupabaseClient,
  userId: string,
  meetingId: string,
): Promise<{ review: MyReview | null; error: boolean }> {
  const { data, error } = await admin
    .from('meeting_reviews')
    .select(MY_REVIEW_COLUMNS)
    .eq('user_id', userId)
    .eq('meeting_id', meetingId)
    .maybeSingle()
  if (error) {
    console.error('[review] 내 후기 조회 실패:', error.message)
    return { review: null, error: true }
  }
  return { review: (data as MyReview | null) ?? null, error: false }
}

/**
 * `/my` 분기용 — 지금 띄울 후기(기간 안) / 기간 지난 후기(알림톡 받은 것만).
 * 스위치가 꺼져 있으면 부르지 않는다(호출부가 먼저 본다).
 */
export const getReviewTargets = cache(
  async (userId: string): Promise<{ open: ReviewTarget | null; expired: ReviewTarget | null }> => {
    const none = { open: null, expired: null }
    const admin = createServiceClient()
    const kstToday = getKSTToday()
    const from = shiftDate(kstToday, -REVIEW_EXPIRED_NOTICE_TO_DAY)

    const { data: regs, error: regError } = await admin
      .from('registrations')
      .select('meeting_id, meetings(date, meeting_type, status)')
      .eq('user_id', userId)
      .in('status', PARTICIPATED_STATUSES)
    if (regError) {
      console.error('[review] /my 분기 — 참여 조회 실패:', regError.message)
      return none
    }

    const participations: ReviewParticipation[] = (
      (regs ?? []) as unknown as {
        meeting_id: string
        meetings: { date: string; meeting_type: string | null; status: string } | null
      }[]
    )
      .filter((r) => r.meetings && r.meetings.date >= from && r.meetings.date < kstToday)
      .map((r) => ({
        meetingId: r.meeting_id,
        date: r.meetings!.date,
        meetingType: r.meetings!.meeting_type,
        meetingStatus: r.meetings!.status,
      }))
    if (participations.length === 0) return none

    const ids = [...new Set(participations.map((p) => p.meetingId))]
    const [reviewsRes, notisRes] = await Promise.all([
      admin.from('meeting_reviews').select('meeting_id').eq('user_id', userId).in('meeting_id', ids),
      admin
        .from('notifications')
        .select('meeting_id')
        .eq('recipient_id', userId)
        .eq('type', 'meeting_review')
        .in('meeting_id', ids),
    ])
    if (reviewsRes.error) {
      // 남겼는지 모르면 보내지 않는다 — 이미 남긴 사람을 다시 후기로 보내는 것보다 낫다
      console.error('[review] /my 분기 — 후기 조회 실패:', reviewsRes.error.message)
      return none
    }
    if (notisRes.error) console.error('[review] /my 분기 — 알림톡 이력 조회 실패:', notisRes.error.message)

    const reviewed = new Set((reviewsRes.data ?? []).map((r) => r.meeting_id as string))
    const notified = new Set((notisRes.data ?? []).map((r) => r.meeting_id as string))
    return pickReviewTargets(participations, reviewed, notified, kstToday)
  },
)

/** 마침 화면 카드 — 같은 지역 다음 정기모임 (규칙은 `pickNextRegularMeeting`) */
export async function getNextRegularMeeting(
  admin: SupabaseClient,
  userId: string,
  region: string | null,
): Promise<ReviewMeeting | null> {
  if (!region) return null
  const kstToday = getKSTToday()
  const [meetingsRes, myRegsRes] = await Promise.all([
    admin
      .from('meetings')
      .select(MEETING_COLUMNS)
      .eq('status', 'active')
      .eq('meeting_type', 'regular')
      .eq('region', region)
      .gte('date', kstToday)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .limit(20),
    admin
      .from('registrations')
      .select('meeting_id')
      .eq('user_id', userId)
      .in('status', ['confirmed', 'pending_transfer', 'waitlisted']),
  ])
  if (meetingsRes.error || myRegsRes.error) {
    console.error(
      '[review] 다음 정기모임 조회 실패:',
      meetingsRes.error?.message ?? myRegsRes.error?.message,
    )
    return null
  }
  const mine = new Set((myRegsRes.data ?? []).map((r) => r.meeting_id as string))
  return pickNextRegularMeeting(
    (meetingsRes.data ?? []) as ReviewMeeting[],
    region,
    kstToday,
    mine,
  )
}

export type MyReviewListItem = MyReview & {
  meeting: { date: string; region: string | null; title: string }
}

/** 나 › 내가 남긴 후기 — 「못 갔어요」는 뺀다(남긴 후기가 아니다). 삭제된 모임은 「없던 모임」 */
export async function getMyReviews(userId: string): Promise<{ items: MyReviewListItem[]; error: boolean }> {
  const admin = createServiceClient()
  const { data, error } = await admin
    .from('meeting_reviews')
    .select(`${MY_REVIEW_COLUMNS}, meetings(date, region, title, status)`)
    .eq('user_id', userId)
    .eq('did_not_attend', false)
  if (error) {
    console.error('[review] 내가 남긴 후기 조회 실패:', error.message)
    return { items: [], error: true }
  }
  const items = (
    (data ?? []) as unknown as (MyReview & {
      meetings: { date: string; region: string | null; title: string; status: string } | null
    })[]
  )
    .filter((r) => r.meetings && r.meetings.status === 'active')
    .map(({ meetings, ...r }) => ({
      ...r,
      meeting: { date: meetings!.date, region: meetings!.region, title: meetings!.title },
    }))
    .sort((a, b) => b.meeting.date.localeCompare(a.meeting.date))
  return { items, error: false }
}

export type PublicComment = { nickname: string; comment: string; meeting_date: string }

/**
 * 공개 소감 — 같은 지역 · 정기 · 그 모임보다 앞선 모임 · 최근 180일 (RPC `get_region_public_comments`).
 * 운영자가 내린 것 · 회원이 내린 것은 RPC가 거른다. 표정·아쉬운 점·실명은 돌려받지 않는다.
 * RPC가 아직 없으면(`PGRST202`) 빈 목록 + console.error.
 */
export async function getRegionPublicComments(
  client: SupabaseClient,
  meetingId: string,
  limit = 20,
): Promise<PublicComment[]> {
  const { data, error } = await client.rpc('get_region_public_comments', {
    p_meeting_id: meetingId,
    p_limit: limit,
  })
  if (error) {
    console.error('[review] 공개 소감 조회 실패:', error.code, error.message)
    return []
  }
  return (data ?? []) as PublicComment[]
}
