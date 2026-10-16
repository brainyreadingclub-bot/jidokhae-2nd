/**
 * Vercel Cron — 모임 다음날 "읽으신 책 담아보세요" 알림톡.
 * 매일 10:00 KST (UTC 01:00) 실행.
 *
 * 왜 알림톡인가: 회원은 모임 사이에 앱을 자주 켜지 않는다. 인앱 스트립만으로는
 * 노출 자체가 안 생겨서 응답률 천장이 구조적으로 낮다(2026-07-16 패널).
 * 인앱 스트립은 안전망으로 남기고, 도달은 알림톡이 맡는다.
 *
 * 중복 방지: notifications의 부분 UNIQUE INDEX (recipient_id, meeting_id)
 *   WHERE type = 'book_ask'. INSERT 단계에서 걸려 Solapi 발송 전에 차단된다.
 *   따라서 크론이 하루에 두 번 돌아도 두 번 가지 않는다.
 *
 * 모임 후기 (2026-10-12 결정 — 다음 날 알림톡을 「책 담기」에서 「모임 후기」로 바꾼다):
 *   `review_enabled` 켜짐 + `next_ui` 켜짐 + `SOLAPI_TEMPLATE_MEETING_REVIEW` env 있음 → `meeting_review`.
 *   하나라도 아니면 지금처럼 `book_ask`. **한 모임에 둘 다 가지 않는다** (`chooseDayAfterNotice`).
 *   크론 이름·시각은 그대로 둔다(새 크론 아님). 후기의 ④ 책 담기가 물어보기를 그대로 이어받는다.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/admin'
import { getYesterdayKST, getKSTToday } from '@/lib/kst'
import { isLibraryEnabled } from '@/lib/library'
import { isAskEligibleMeeting } from '@/lib/asks-pure'
import { PARTICIPATED_STATUSES } from '@/lib/registration-status'
import { sendBookAskNotification, sendMeetingReviewNotification } from '@/lib/notification'
import { isReviewEnabledInDb } from '@/lib/review'
import { isNextUiEnabled } from '@/lib/next-ui'
import { chooseDayAfterNotice } from '@/lib/review-rules'
import type { Meeting } from '@/types/meeting'

type AskTask = { userId: string; meetingId: string; meetingDate: string }

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 무엇을 보낼지 먼저 정한다. 스위치는 DB만 본다 — Preview env로 실발송이 켜지면 안 된다
  const [reviewEnabled, nextUiEnabled] = await Promise.all([isReviewEnabledInDb(), isNextUiEnabled()])
  const notice = chooseDayAfterNotice({
    reviewEnabled,
    nextUiEnabled,
    reviewTemplateId: process.env.SOLAPI_TEMPLATE_MEETING_REVIEW,
  })

  // 서재가 꺼져 있으면 책 담기를 보내지 않는다.
  // 알림톡 버튼이 /my로 가는데 서재·물어보기 UI가 렌더되지 않으면
  // 회원은 아무것도 없는 화면에 도착한다. (후기는 후기 화면이 받으므로 이 관문을 타지 않는다)
  if (notice === 'book_ask' && !(await isLibraryEnabled())) {
    return NextResponse.json({
      status: 'success',
      message: 'Library disabled — skipped',
      data: { sent: 0 },
    })
  }

  const supabase = createServiceClient()
  const yesterday = getYesterdayKST()
  const kstToday = getKSTToday()

  // 어제 열린 모임만. 자격 판정(정기·active·과거·60일 이내)은 인앱과 같은 함수를 쓴다.
  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, date, meeting_type, status')
    .eq('date', yesterday)
    .eq('status', 'active')

  const eligibleMeetings = ((meetings ?? []) as unknown as Meeting[]).filter((m) =>
    isAskEligibleMeeting(
      { date: m.date, meeting_type: m.meeting_type, status: m.status },
      kstToday,
    ),
  )

  if (eligibleMeetings.length === 0) {
    return NextResponse.json({
      status: 'success',
      message: 'No eligible meeting yesterday',
      data: { date: yesterday, notice, sent: 0 },
    })
  }

  const tasks: AskTask[] = []
  let lookupFailed = 0

  for (const meeting of eligibleMeetings) {
    const { data: registrations } = await supabase
      .from('registrations')
      .select('user_id')
      .eq('meeting_id', meeting.id)
      .in('status', PARTICIPATED_STATUSES)

    if (!registrations || registrations.length === 0) continue

    let resolved: Set<string>
    if (notice === 'meeting_review') {
      // 이미 후기를 남긴(표정 또는 못 갔어요) 회원은 제외.
      // 🔴 조회가 실패하면 그 모임은 **보내지 않는다** — 남긴 사람에게 또 보내는 것보다 하루 늦는 게 낫고,
      // 「조회 실패」를 「대상 없음」으로 합쳐 덮지 않는다(루트 CLAUDE.md 「결제 안전망」)
      const { data: reviews, error } = await supabase
        .from('meeting_reviews')
        .select('user_id')
        .eq('meeting_id', meeting.id)
      if (error) {
        console.error('[book-ask] meeting_reviews 조회 실패 — 이 모임 건너뜀:', meeting.id, error.message)
        lookupFailed++
        continue
      }
      resolved = new Set((reviews ?? []).map((r) => r.user_id as string))
    } else {
      // 이미 담았거나(answered) 닫은(dismissed) 회원은 제외.
      // 'viewed'(노출만 됨)는 아직 미해소라 대상에 남긴다 — 인앱 스트립 정책과 같다.
      const { data: asks } = await supabase
        .from('book_asks')
        .select('user_id, status')
        .eq('meeting_id', meeting.id)
        .in('status', ['answered', 'dismissed'])
      resolved = new Set((asks ?? []).map((a) => a.user_id as string))
    }

    for (const reg of registrations) {
      if (resolved.has(reg.user_id)) continue
      tasks.push({
        userId: reg.user_id,
        meetingId: meeting.id,
        meetingDate: meeting.date,
      })
    }
  }

  // 병렬 발송 (Vercel 10s 타임아웃 대응 — Promise.allSettled로 부분 실패 허용)
  const send = notice === 'meeting_review' ? sendMeetingReviewNotification : sendBookAskNotification
  const results = await Promise.allSettled(
    tasks.map((t) => send(t.userId, t.meetingId, t.meetingDate)),
  )

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (r.value?.status === 'sent') sent++
      else if (r.value?.status === 'skipped') skipped++
      else failed++
    } else {
      failed++
      console.error('[book-ask] task rejected:', r.reason)
    }
  }

  return NextResponse.json({
    status: failed === 0 && lookupFailed === 0 ? 'success' : 'partial',
    data: {
      date: yesterday,
      notice,
      lookupFailed,
      meetings: eligibleMeetings.length,
      targets: tasks.length,
      sent,
      skipped,
      failed,
    },
  })
}
