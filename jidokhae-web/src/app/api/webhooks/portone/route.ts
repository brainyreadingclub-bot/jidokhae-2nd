/**
 * PortOne V2 웹훅 핸들러.
 *
 * 백업 경로 — 브라우저 redirect 실패 시 안전망 역할.
 * Standard Webhooks 표준에 따른 서명 검증 (PortOne 서버 SDK가 처리).
 *
 * 웹훅 버전 2024-04-25 기준.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { Webhook } from '@portone/server-sdk'
import { createServiceClient } from '@/lib/supabase/admin'
import { processPaymentConfirmation } from '@/lib/payment'
import { sendRegistrationConfirmNotification, sendWaitlistConfirmNotification } from '@/lib/notification'

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
  const parts = paymentId.split('-')
  if (parts.length < 4 || parts[0] !== 'jdkh') {
    console.error(`[portone-webhook] paymentId 형식 오류: ${paymentId}`)
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  const meetingId8 = parts[1]
  const userId8 = parts[2]

  const supabase = createServiceClient()

  // prefix로 full UUID 조회 (병렬)
  const [{ data: meetings }, { data: profiles }] = await Promise.all([
    supabase
      .from('meetings')
      .select('id')
      .like('id', `${meetingId8}%`)
      .limit(1),
    supabase
      .from('profiles')
      .select('id')
      .like('id', `${userId8}%`)
      .limit(1),
  ])

  if (!meetings?.length || !profiles?.length) {
    console.error(`[portone-webhook] ID 조회 실패: ${paymentId}`)
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  const meetingId = meetings[0].id
  const userId = profiles[0].id

  // 결제 확정 처리 (idempotent — 이미 처리된 paymentId는 success 반환)
  const result = await processPaymentConfirmation(paymentId, meetingId, userId)

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
  }

  return NextResponse.json({ status: 'ok' }, { status: 200 })
}
