/**
 * 결제 확정 1차 경로 — 브라우저 redirect가 부른다.
 *
 * 2026-09-11: 확정이 거절되거나 예외로 끝난 건을 `payment_failures`에 남긴다.
 * 이 경로의 진짜 사각지대는 **아예 호출되지 않는 것**이라 여기서는 잡을 수 없고,
 * 그건 웹훅 백업(`/api/webhooks/portone`)이 받는다. 여기서 남기는 것은
 * "불렸는데 신청이 안 만들어진" 건이다 — 그것도 돈이 떠 있는 상태다.
 */

import { NextResponse, after, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { processPaymentConfirmation } from '@/lib/payment'
import { sendRegistrationConfirmNotification, sendWaitlistConfirmNotification } from '@/lib/notification'
import { recordDuplicateCallBlocked, recordPaymentFailure } from '@/lib/payment-failure'

export async function POST(request: NextRequest) {
  // Authenticate user via Supabase session cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // No-op: API route doesn't need to set cookies
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { status: 'error', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }

  let body: {
    paymentId?: string
    meetingId?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const { paymentId, meetingId } = body
  if (!paymentId || !meetingId) {
    return NextResponse.json(
      { status: 'error', message: 'paymentId, meetingId가 필요합니다' },
      { status: 400 },
    )
  }

  let result
  try {
    result = await processPaymentConfirmation(paymentId, meetingId, user.id)
  } catch (e) {
    const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    console.error(`[confirm] 결제 확정 중 예외: ${paymentId} —`, e)
    // after(): 응답 뒤에 기록 — void fire-and-forget은 Vercel 람다 freeze로 유실
    after(
      recordPaymentFailure({
        source: 'confirm',
        stage: 'unhandled_exception',
        paymentId,
        meetingId,
        userId: user.id,
        detail,
      }),
    )
    return NextResponse.json(
      { status: 'error', message: '신청 처리 중 오류가 발생했습니다' },
      { status: 500 },
    )
  }

  // 관찰 — 중복 호출을 막아낸 건이면 **누가 보냈는지**를 남긴다. 사고 기록이 아니다.
  // 돈은 나가지 않았고 신청도 1건뿐이다. 여기서 남기지 않으면 흔적이 아예 없다
  // (서버 로그 보관 약 1시간). 설계: docs/agent-team/2026-10-06-중복호출-관찰계획.md
  if (
    (result.status === 'success' || result.status === 'waitlisted') &&
    result.duplicateCallBlocked
  ) {
    after(
      recordDuplicateCallBlocked({
        source: 'confirm',
        paymentId,
        meetingId,
        userId: user.id,
        userAgent: request.headers.get('user-agent'),
      }),
    )
  }

  // 알림톡 — 실패해도 결제 응답에 영향 없음
  if (result.status === 'success') {
    try {
      await sendRegistrationConfirmNotification(meetingId, user.id, result.registrationId)
    } catch (error) {
      console.error('[confirm] 신청 완료 알림톡 발송 실패:', error)
    }
  } else if (result.status === 'waitlisted') {
    try {
      await sendWaitlistConfirmNotification(meetingId, user.id, result.registrationId)
    } catch (error) {
      console.error('[confirm] 대기 신청 알림톡 발송 실패:', error)
    }
  } else {
    // 결제는 끝났는데 신청이 안 만들어진 건. payment.ts가 대부분 자동 취소하지만
    // 그 취소가 실패하면 돈만 떠 있게 된다 — 사람이 봐야 한다.
    console.error(`[confirm] 확정 거절: ${paymentId} — ${result.status}`)
    after(
      recordPaymentFailure({
        source: 'confirm',
        stage: 'confirm_rejected',
        paymentId,
        meetingId,
        userId: user.id,
        detail: `${result.status}: ${result.message}`,
      }),
    )
  }

  const httpStatus = result.status === 'error' ? 500 : 200

  // 관찰 신호는 **응답에 싣지 않는다.** 브라우저가 알 이유가 없고, 응답에 보이면 다음
  // 사람이 그걸 읽어 클라이언트에 가드를 덧대기 쉽다 — 원인을 모르는 채로 증상만 가리는
  // 바로 그 길이다(관찰계획 §7에서 안 하기로 한 것). 기존 응답 형식도 그대로 유지된다.
  const responseBody =
    result.status === 'success' || result.status === 'waitlisted'
      ? { status: result.status, registrationId: result.registrationId }
      : result

  return NextResponse.json(responseBody, { status: httpStatus })
}
