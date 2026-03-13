/**
 * POST /api/meetings/[id]/delete
 * Admin-only: Delete meeting with batch refund for all confirmed registrations.
 * Uses Promise.allSettled for parallel refund (Vercel 10s timeout).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'
import { cancelPayment, getPayment } from '@/lib/tosspayments'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id: meetingId } = await params

  // 1. Authenticate user
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
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

  // 2. Verify admin role
  const adminSupabase = createServiceClient()
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json(
      { status: 'error', message: '권한이 없습니다' },
      { status: 403 },
    )
  }

  // 3. Set meeting status to 'deleting' (blocks new registrations)
  //    Allows both 'active' and 'deleting' for retry support
  const { error: statusError } = await adminSupabase
    .from('meetings')
    .update({ status: 'deleting' })
    .eq('id', meetingId)
    .in('status', ['active', 'deleting'])

  if (statusError) {
    return NextResponse.json(
      { status: 'error', message: '모임 상태 변경에 실패했습니다' },
      { status: 500 },
    )
  }

  // 4. Fetch all confirmed registrations
  const { data: registrations } = await adminSupabase
    .from('registrations')
    .select('id, payment_id, paid_amount')
    .eq('meeting_id', meetingId)
    .eq('status', 'confirmed')

  const confirmedRegs = registrations ?? []

  // 5. No confirmed registrations → go straight to 'deleted'
  if (confirmedRegs.length === 0) {
    await adminSupabase
      .from('meetings')
      .update({ status: 'deleted' })
      .eq('id', meetingId)

    return NextResponse.json({
      status: 'success',
      refundedCount: 0,
      failedCount: 0,
    })
  }

  // 6. Parallel refund via Promise.allSettled (Vercel 10s timeout constraint)
  const refundResults = await Promise.allSettled(
    confirmedRegs.map(async (reg) => {
      if (reg.payment_id) {
        try {
          // 100% refund = omit amount
          await cancelPayment(reg.payment_id, '모임 삭제로 인한 환불')
        } catch {
          // Retry safety: check if already cancelled at TossPayments
          // (handles case where previous refund succeeded but DB update failed)
          const payment = await getPayment(reg.payment_id)
          if (payment.status !== 'CANCELED') {
            throw new Error(`환불 실패: ${reg.id}`)
          }
          // Already cancelled → proceed to DB update
        }
      }

      // Update registration status
      const { error } = await adminSupabase
        .from('registrations')
        .update({
          status: 'cancelled',
          cancel_type: 'meeting_deleted',
          refunded_amount: reg.paid_amount ?? 0,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', reg.id)
        .eq('status', 'confirmed')

      if (error) {
        throw new Error(`DB 업데이트 실패: ${reg.id}`)
      }
    }),
  )

  const failedCount = refundResults.filter((r) => r.status === 'rejected').length
  const refundedCount = refundResults.filter(
    (r) => r.status === 'fulfilled',
  ).length

  // 7. All success → 'deleted', any failure → keep 'deleting'
  if (failedCount === 0) {
    await adminSupabase
      .from('meetings')
      .update({ status: 'deleted' })
      .eq('id', meetingId)
  }

  return NextResponse.json({
    status: failedCount === 0 ? 'success' : 'partial',
    refundedCount,
    failedCount,
  })
}
