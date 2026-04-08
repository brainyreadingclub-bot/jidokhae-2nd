import { NextResponse, type NextRequest } from 'next/server'
import { getPayment } from '@/lib/tosspayments'
import { createServiceClient } from '@/lib/supabase/admin'
import { cancelPayment } from '@/lib/tosspayments'
import { sendRegistrationConfirmNotification, sendWaitlistConfirmNotification } from '@/lib/notification'

export async function POST(request: NextRequest) {
  let body: {
    eventType?: string
    data?: { paymentKey?: string; orderId?: string; status?: string }
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Only process payment status changes
  if (body.eventType !== 'PAYMENT_STATUS_CHANGED') {
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  const paymentKey = body.data?.paymentKey
  const orderId = body.data?.orderId
  if (!paymentKey || !orderId) {
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  // Verify payment by fetching from TossPayments
  let payment
  try {
    payment = await getPayment(paymentKey)
  } catch {
    return NextResponse.json({ error: 'Failed to verify' }, { status: 500 })
  }

  if (payment.status !== 'DONE') {
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  // orderId 교차 검증 — 위조 방지
  if (payment.orderId !== orderId) {
    console.error(`[webhook] orderId 불일치: expected=${payment.orderId}, got=${orderId}`)
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  const supabase = createServiceClient()

  // Idempotency: already registered or waitlisted?
  const { data: existing } = await supabase
    .from('registrations')
    .select('id')
    .eq('payment_id', paymentKey)
    .in('status', ['confirmed', 'waitlisted'])
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  }

  // Parse meetingId and userId from orderId: jdkh-{meetingId8}-{userId8}-{timestamp}
  const parts = orderId.split('-')
  if (parts.length < 4 || parts[0] !== 'jdkh') {
    console.error(`[webhook] Invalid orderId format: ${orderId}`)
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  const meetingId8 = parts[1]
  const userId8 = parts[2]

  // Look up full IDs by prefix (parallel)
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
    console.error(`[webhook] Could not resolve IDs from orderId: ${orderId}`)
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  const meetingId = meetings[0].id
  const userId = profiles[0].id

  // Register via DB function (payment already confirmed by TossPayments)
  const { data: result, error: rpcError } = await supabase.rpc('confirm_registration', {
    p_user_id: userId,
    p_meeting_id: meetingId,
    p_payment_id: paymentKey,
    p_paid_amount: payment.totalAmount,
  })

  // RPC 실패 시 환불 처리 (고아 결제 방지)
  if (rpcError) {
    console.error('[webhook] RPC 실패:', rpcError)
    try {
      await cancelPayment(paymentKey, 'webhook RPC 실패 — 자동 환불')
    } catch (cancelError) {
      console.error('[webhook] 환불도 실패 — 수동 확인 필요:', cancelError)
    }
    return NextResponse.json({ status: 'error', message: 'RPC 실패' }, { status: 500 })
  }

  const rpcResult = result as string

  if (rpcResult === 'success') {
    try {
      const { data: reg } = await supabase
        .from('registrations')
        .select('id')
        .eq('payment_id', paymentKey)
        .eq('status', 'confirmed')
        .limit(1)

      if (reg?.[0]?.id) {
        await sendRegistrationConfirmNotification(meetingId, userId, reg[0].id)
      }
    } catch (error) {
      console.error('[webhook] 신청 완료 알림톡 발송 실패:', error)
    }
  } else if (rpcResult === 'waitlisted') {
    // 대기 신청 — 환불하지 않음, 알림톡 발송
    try {
      const { data: reg } = await supabase
        .from('registrations')
        .select('id')
        .eq('payment_id', paymentKey)
        .eq('status', 'waitlisted')
        .limit(1)

      if (reg?.[0]?.id) {
        await sendWaitlistConfirmNotification(meetingId, userId, reg[0].id)
      }
    } catch (error) {
      console.error('[webhook] 대기 신청 알림톡 발송 실패:', error)
    }
  } else if (rpcResult === 'full' || rpcResult === 'already_registered') {
    // Refund since DB rejected
    try {
      await cancelPayment(paymentKey, rpcResult === 'full' ? '정원 마감' : '중복 신청')
    } catch (e) {
      console.error(`[webhook] Refund failed for ${paymentKey}:`, e)
    }
  }

  return NextResponse.json({ status: 'ok' }, { status: 200 })
}
