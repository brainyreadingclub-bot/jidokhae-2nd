/**
 * PortOne V2 웹훅 핸들러.
 *
 * 백업 경로 — 브라우저 redirect 실패 시 안전망 역할.
 * Standard Webhooks 표준에 따른 서명 검증 (PortOne 서버 SDK가 처리).
 *
 * 웹훅 버전 2024-04-25 기준.
 *
 * 🔴 2026-09-11 안전망 복구 — 이 라우트는 M4 최초 구현부터 한 번도 작동한 적이 없었다.
 * uuid 컬럼에 `.like()`를 걸어 Postgres가 `42883`으로 거절했고, 호출부가 error를
 * 버리고 `!data?.length`만 보는 바람에 **우리 장애가 "처리할 것 없음"으로 둔갑**해
 * 200 `{"status":"ignored"}`로 조용히 끝났다. 상세: `payment-id.ts` 머리말.
 *
 * 지금 이 라우트가 지키는 규칙:
 *  - 조회 실패(`query_failed`)와 대상 없음(`not_found`)을 **다르게 응답한다**
 *  - 실패는 `payment_failures` 테이블에 남긴다 (Vercel 로그는 약 1시간이면 사라진다)
 *  - 기록은 `after()`로 응답 뒤에 — 본 흐름을 막지 않는다
 */

import { NextResponse, after, type NextRequest } from 'next/server'
import { Webhook } from '@portone/server-sdk'
import { createServiceClient } from '@/lib/supabase/admin'
import { processPaymentConfirmation } from '@/lib/payment'
import { sendRegistrationConfirmNotification, sendWaitlistConfirmNotification } from '@/lib/notification'
import { classifyIdLookup, parsePaymentId, uuidPrefixRange } from '@/lib/payment-id'
import { recordPaymentFailure } from '@/lib/payment-failure'

export async function POST(request: NextRequest) {
  const secret = process.env.PORTONE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[portone-webhook] PORTONE_WEBHOOK_SECRET not set')
    return NextResponse.json({ status: 'error', message: 'Webhook secret missing' }, { status: 500 })
  }

  // 본문 raw text 필요 (서명 검증용)
  const rawBody = await request.text()

  // 헤더를 plain object로 변환
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  // 서명 검증 + 페이로드 디코딩
  let webhook
  try {
    webhook = await Webhook.verify(secret, rawBody, headers)
  } catch (e) {
    if (e instanceof Webhook.WebhookVerificationError) {
      console.error('[portone-webhook] 검증 실패:', e.reason)
      return NextResponse.json({ status: 'error', message: 'Invalid signature' }, { status: 400 })
    }
    console.error('[portone-webhook] 알 수 없는 검증 오류:', e)
    return NextResponse.json({ status: 'error', message: 'Verification error' }, { status: 500 })
  }

  // 결제 완료 이벤트만 처리 (취소/실패 등은 우리 시스템에서 직접 처리하므로 무시)
  if (webhook.type !== 'Transaction.Paid') {
    return NextResponse.json({ status: 'ignored', message: `Unhandled type: ${String(webhook.type)}` }, { status: 200 })
  }

  const { paymentId } = webhook.data

  // paymentId 형식 검증: jdkh-{meetingId8}-{userId8}-{timestamp}
  const parsed = parsePaymentId(paymentId)
  if (!parsed) {
    // 재시도해도 형식은 안 바뀐다 → 200으로 종결하되 기록은 남긴다.
    console.error(`[portone-webhook] paymentId 형식 오류: ${paymentId}`)
    after(
      recordPaymentFailure({
        source: 'webhook',
        stage: 'payment_id_malformed',
        paymentId,
        detail: 'jdkh-{meetingId8}-{userId8}-{ts} 형식이 아니다',
      }),
    )
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  // prefix → UUID 구간. parsePaymentId가 hex 8자를 보장하므로 null이 될 수 없지만
  // 타입을 좁히기 위해 방어한다.
  const meetingRange = uuidPrefixRange(parsed.meetingId8)
  const userRange = uuidPrefixRange(parsed.userId8)
  if (!meetingRange || !userRange) {
    after(
      recordPaymentFailure({
        source: 'webhook',
        stage: 'payment_id_malformed',
        paymentId,
        detail: 'prefix가 hex 8자가 아니다',
      }),
    )
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  const supabase = createServiceClient()

  // prefix로 full UUID 조회 (병렬).
  // 🔴 `.like()` 금지 — uuid 컬럼에는 LIKE 연산자가 없다. 구간 비교로 조회한다.
  //    error를 구조분해로 버리지 않고 통째로 받아 classifyIdLookup에 넘긴다.
  // 🔴 `.limit(2)`인 이유 — 1건이면 prefix 충돌을 감지할 수 없다. 충돌을 모른 채
  //    첫 행을 고르면 **남의 명의로 신청이 만들어진다.** 2건을 받아 충돌을 확인한다.
  const [meetingRes, profileRes] = await Promise.all([
    supabase
      .from('meetings')
      .select('id')
      .gte('id', meetingRange.lo)
      .lte('id', meetingRange.hi)
      .limit(2),
    supabase
      .from('profiles')
      .select('id')
      .gte('id', userRange.lo)
      .lte('id', userRange.hi)
      .limit(2),
  ])

  const lookup = classifyIdLookup(meetingRes, profileRes)

  if (lookup.kind === 'query_failed') {
    // 🔴 우리 쪽 장애다. 조용히 200으로 덮지 않는다.
    // 비2xx를 돌려주면 PortOne 콘솔의 웹훅 이력에 실패로 남고, 일시 장애라면
    // 재시도로 자동 복구될 여지가 생긴다. 무엇보다 "아무 일도 없었던 것처럼"
    // 끝나지 않는다 — 이번 사고가 정확히 그래서 몇 달간 안 보였다.
    console.error(`[portone-webhook] ID 조회 실패(장애): ${paymentId} — ${lookup.detail}`)
    after(
      recordPaymentFailure({
        source: 'webhook',
        stage: 'id_lookup_failed',
        paymentId,
        detail: lookup.detail,
      }),
    )
    return NextResponse.json({ status: 'error', message: 'ID lookup failed' }, { status: 500 })
  }

  if (lookup.kind === 'ambiguous') {
    // 🔴 누구 결제인지 확정할 수 없다. 추측해서 신청을 만들면 남의 명의가 된다.
    // 처리하지 않고 기록만 남긴다 — 사람이 paymentId로 직접 판단해야 한다.
    // 재시도해도 충돌은 그대로이므로 200으로 종결한다.
    console.error(`[portone-webhook] prefix 충돌: ${paymentId} — ${lookup.detail}`)
    after(
      recordPaymentFailure({
        source: 'webhook',
        stage: 'id_lookup_ambiguous',
        paymentId,
        detail: lookup.detail,
      }),
    )
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  if (lookup.kind === 'not_found') {
    // 조회는 정상이다. 재시도해도 결과가 같으므로 200으로 종결하되 기록은 남긴다.
    console.error(`[portone-webhook] 대상 없음: ${paymentId} — ${lookup.detail}`)
    after(
      recordPaymentFailure({
        source: 'webhook',
        stage: 'id_lookup_empty',
        paymentId,
        detail: lookup.detail,
      }),
    )
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  const { meetingId, userId } = lookup

  // 결제 확정 처리 (idempotent — 이미 처리된 paymentId는 success 반환)
  let result
  try {
    result = await processPaymentConfirmation(paymentId, meetingId, userId)
  } catch (e) {
    const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    console.error(`[portone-webhook] 결제 확정 중 예외: ${paymentId} —`, e)
    after(
      recordPaymentFailure({
        source: 'webhook',
        stage: 'unhandled_exception',
        paymentId,
        meetingId,
        userId,
        detail,
      }),
    )
    return NextResponse.json({ status: 'error', message: 'Confirmation error' }, { status: 500 })
  }

  // 알림톡 발송 (실패해도 응답에 영향 없음)
  if (result.status === 'success') {
    try {
      await sendRegistrationConfirmNotification(meetingId, userId, result.registrationId)
    } catch (error) {
      console.error('[portone-webhook] 신청 완료 알림톡 실패:', error)
    }
  } else if (result.status === 'waitlisted') {
    try {
      await sendWaitlistConfirmNotification(meetingId, userId, result.registrationId)
    } catch (error) {
      console.error('[portone-webhook] 대기 신청 알림톡 실패:', error)
    }
  } else {
    // success/waitlisted가 아니면 **결제는 됐는데 신청이 안 만들어진 상태**다.
    // payment.ts가 대부분의 경로에서 자동 취소(safeCancel)하지만 그 취소가
    // 실패했을 수도 있다. 어느 쪽이든 사람이 봐야 하는 건이므로 남긴다.
    console.error(`[portone-webhook] 확정 거절: ${paymentId} — ${result.status}`)
    after(
      recordPaymentFailure({
        source: 'webhook',
        stage: 'confirm_rejected',
        paymentId,
        meetingId,
        userId,
        detail: `${result.status}: ${result.message}`,
      }),
    )
  }

  return NextResponse.json({ status: 'ok' }, { status: 200 })
}
