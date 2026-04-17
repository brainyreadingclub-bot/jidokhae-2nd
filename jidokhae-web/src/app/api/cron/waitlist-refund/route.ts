/**
 * Vercel Cron — 미승격 대기자 자동 환불.
 * 매일 18:30 KST (UTC 09:30) 실행. 리마인드(19:00) 전에 완료.
 * catch-up: date <= tomorrow인 모임의 waitlisted 모두 처리 (실패 건 재시도 포함).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/admin'
import { getTomorrowKST } from '@/lib/kst'
import { cancelPayment, getPayment } from '@/lib/tosspayments'
import { sendWaitlistRefundedNotification } from '@/lib/notification'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()
  const tomorrow = getTomorrowKST()

  // catch-up 쿼리: 내일 이전 모임 중 아직 waitlisted인 건도 포함
  const { data: waitlistedRegs, error: queryError } = await supabase
    .from('registrations')
    .select('id, user_id, payment_id, paid_amount, meeting_id, payment_method, meetings(title, date)')
    .eq('status', 'waitlisted')
    .lte('meetings.date', tomorrow)

  if (queryError) {
    console.error('[waitlist-refund] 쿼리 실패:', queryError)
    return NextResponse.json(
      { status: 'error', message: 'Query failed' },
      { status: 500 },
    )
  }

  // Supabase JOIN 필터는 null 결과를 포함할 수 있으므로 필터링
  const regsToRefund = (waitlistedRegs ?? []).filter(
    (r) => r.meetings !== null,
  )

  if (regsToRefund.length === 0) {
    return NextResponse.json({
      status: 'success',
      message: 'No waitlisted to refund',
      data: { refunded: 0, failed: 0, total: 0 },
    })
  }

  // 병렬 환불 (Vercel 10s 타임아웃 대응 — Promise.allSettled로 부분 실패 허용)
  const results = await Promise.allSettled(
    regsToRefund.map(async (reg) => {
      // 계좌이체: TossPayments 환불 스킵, DB만 업데이트
      if (reg.payment_method === 'transfer') {
        await supabase.from('registrations')
          .update({
            status: 'waitlist_refunded',
            cancel_type: 'waitlist_auto_refunded',
            refunded_amount: 0,
            cancelled_at: new Date().toISOString(),
          })
          .eq('id', reg.id)
          .eq('status', 'waitlisted')
        return
      }

      // TossPayments 전액 환불 (재시도 안전: 이미 환불된 건 허용)
      if (reg.payment_id) {
        try {
          await cancelPayment(reg.payment_id, '대기 미승격 자동 환불')
        } catch {
          const payment = await getPayment(reg.payment_id)
          if (payment.status !== 'CANCELED') {
            throw new Error(`환불 실패: ${reg.id}`)
          }
        }
      }

      // DB 업데이트
      await supabase
        .from('registrations')
        .update({
          status: 'waitlist_refunded',
          cancel_type: 'waitlist_auto_refunded',
          refunded_amount: reg.paid_amount ?? 0,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', reg.id)
        .eq('status', 'waitlisted')

      // 미승격 알림톡 (실패해도 환불은 완료)
      const meetingData = reg.meetings as unknown as { title: string; date: string }
      try {
        await sendWaitlistRefundedNotification(
          reg.user_id,
          reg.id,
          meetingData.title,
          reg.paid_amount ?? 0,
        )
      } catch {
        // ignore
      }
    }),
  )

  const refunded = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  results.forEach((r, idx) => {
    if (r.status === 'rejected') {
      console.error(`[waitlist-refund] 환불 실패: ${regsToRefund[idx].id}`, r.reason)
    }
  })

  return NextResponse.json({
    status: failed === 0 ? 'success' : 'partial',
    data: { refunded, failed, total: regsToRefund.length },
  })
}
