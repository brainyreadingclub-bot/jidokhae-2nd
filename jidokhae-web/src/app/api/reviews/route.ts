import { NextResponse, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/admin'
import { getKSTToday } from '@/lib/kst'
import { getMyReviewRow, getReviewableMeeting, isReviewEnabled, MY_REVIEW_COLUMNS } from '@/lib/review'
import {
  buildCommentPatch,
  buildPublishPatch,
  getReviewWindow,
  normalizeCommentInput,
  normalizeMoodInput,
} from '@/lib/review-rules'

/**
 * 모임 후기 저장 — 흐름의 각 단계 「다음」에서 바로 저장한다(가장 중요한 표정이 뒤 단계 이탈로
 * 사라지지 않게 — 시안 README). 같은 (회원, 모임) 행을 upsert한다.
 *
 * - mood: ① 표정 (+ 낮은 표정이면 아쉬운 점)
 * - absent: ① 「이 모임에 못 갔어요」
 * - comment: ② 한 줄 소감 + 공개 체크
 * - publish / unpublish: 나 › 내가 남긴 후기 — 기간과 무관하게 언제든
 *
 * 쓰기는 service_role이다(RLS는 SELECT 정책만). 그래서 참여·기간·운영자 내림을 여기서 다시 본다.
 */

type Body = {
  action?: unknown
  meetingId?: unknown
  mood?: unknown
  regretCodes?: unknown
  regretOther?: unknown
  comment?: unknown
  isPublic?: unknown
}

function fail(message: string, status: number, reason?: string) {
  return NextResponse.json(
    { status: 'error', message, ...(reason ? { data: { reason } } : {}) },
    { status },
  )
}

export async function POST(request: NextRequest) {
  if (!(await isReviewEnabled())) return fail('사용할 수 없는 기능입니다', 403)

  const user = await getRouteUser(request)
  if (!user) return fail('로그인이 필요합니다', 401)

  let body: Body
  try {
    body = await request.json()
  } catch {
    return fail('잘못된 요청입니다', 400)
  }
  const action = body?.action
  const meetingId = typeof body?.meetingId === 'string' ? body.meetingId : ''
  if (!meetingId) return fail('잘못된 요청입니다', 400)

  const admin = createServiceClient()
  const meeting = await getReviewableMeeting(admin, user.id, meetingId)
  if (!meeting) return fail('후기를 남길 수 있는 모임이 아니에요', 400, 'not_eligible')

  const nowIso = new Date().toISOString()

  // ── 공개하기 / 공개 그만하기 — 기간 무관 ──
  if (action === 'publish' || action === 'unpublish') {
    const { review, error } = await getMyReviewRow(admin, user.id, meetingId)
    if (error) return fail('저장하지 못했어요', 500)
    if (!review) return fail('남긴 후기가 없어요', 404)
    const res = buildPublishPatch(review, action === 'publish', nowIso)
    if (!res.ok) {
      if (res.reason === 'noop') return NextResponse.json({ status: 'success', data: { review } })
      if (res.reason === 'hidden') return fail('운영자가 공개를 내린 소감이에요', 409, 'hidden')
      return fail('공개할 소감이 없어요', 400, res.reason)
    }
    return update(admin, review.id, res.patch)
  }

  // ── 흐름 단계 — 후기 받는 기간(모임 다음 날 ~ 3일 뒤)에만 ──
  if (getReviewWindow(meeting.date, getKSTToday()) !== 'open') {
    return fail('후기 받는 기간이 끝났어요', 409, 'expired')
  }

  if (action === 'mood') {
    const norm = normalizeMoodInput({
      mood: body.mood,
      regretCodes: body.regretCodes,
      regretOther: body.regretOther,
    })
    if (!norm.ok) return fail(norm.message, 400)
    // 소감 칸은 payload에 넣지 않는다 — upsert가 기존 소감을 덮지 않게
    return upsert(admin, {
      user_id: user.id,
      meeting_id: meetingId,
      did_not_attend: false,
      ...norm.value,
    })
  }

  if (action === 'absent') {
    // 못 갔어요면 나머지 없음 (DB CHECK `meeting_reviews_absent_no_extras`) — 한 번에 비운다
    return upsert(admin, {
      user_id: user.id,
      meeting_id: meetingId,
      did_not_attend: true,
      mood: null,
      regret_codes: [],
      regret_other: null,
      comment: null,
      comment_public: false,
    })
  }

  if (action === 'comment') {
    const norm = normalizeCommentInput({ comment: body.comment, isPublic: body.isPublic })
    if (!norm.ok) return fail(norm.message, 400)
    const { review, error } = await getMyReviewRow(admin, user.id, meetingId)
    if (error) return fail('저장하지 못했어요', 500)
    if (!review || review.did_not_attend) return fail('표정을 먼저 골라 주세요', 409, 'need_mood')
    const res = buildCommentPatch(review, norm.value, nowIso)
    if (!res.ok) return fail('운영자가 공개를 내린 소감이에요', 409, 'hidden')
    return update(admin, review.id, res.patch)
  }

  return fail('알 수 없는 요청입니다', 400)
}

async function upsert(admin: ReturnType<typeof createServiceClient>, row: Record<string, unknown>) {
  const { data, error } = await admin
    .from('meeting_reviews')
    .upsert(row, { onConflict: 'user_id,meeting_id' })
    .select(MY_REVIEW_COLUMNS)
    .single()
  if (error) {
    console.error('[review] 저장 실패:', error.code, error.message)
    return fail('저장하지 못했어요', 500)
  }
  return NextResponse.json({ status: 'success', data: { review: data } })
}

async function update(
  admin: ReturnType<typeof createServiceClient>,
  id: string,
  patch: Record<string, unknown>,
) {
  const { data, error } = await admin
    .from('meeting_reviews')
    .update(patch)
    .eq('id', id)
    .select(MY_REVIEW_COLUMNS)
    .single()
  if (error) {
    // 23514 = CHECK 위반 — 운영자가 내린 바로 그 순간 공개를 누른 경우 등. 회원 쪽 문구는 같다
    console.error('[review] 저장 실패:', error.code, error.message)
    return fail('저장하지 못했어요', 500)
  }
  return NextResponse.json({ status: 'success', data: { review: data } })
}
