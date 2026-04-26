/**
 * 계좌이체 취소 건의 환불 완료 처리 (양방향).
 *
 * Phase 3 M7 Step 2.6: 양방향 토글 지원으로 변경.
 * - action='mark'   : 서버에서 권장 환불액 자동 계산 → refunded_amount 기록
 * - action='unmark' : refunded_amount = NULL로 되돌리기 (실수 정정/재처리)
 *
 * ⚠️ 금지: 이 API 호출 성공 후 sendRegistrationConfirmNotification 호출 금지.
 *    운영자가 월말 정산일에 하루 몰아서 처리하므로 동시다발 알림이
 *    회원 혼란을 유발. (CLAUDE.md 규칙 / 검토문서 §2.6)
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'
import { calculateRefund } from '@/lib/refund'
import { toKSTDate, getKSTToday } from '@/lib/kst'

export async function POST(request: NextRequest) {
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

  // admin 권한 확인 (DepositToggle/confirm-transfer와 동일 정책)
  const admin = createServiceClient()
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!callerProfile || callerProfile.role !== 'admin') {
    return NextResponse.json(
      { status: 'error', message: '권한이 없습니다' },
      { status: 403 },
    )
  }

  let body: { registrationId?: string; action?: 'mark' | 'unmark' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const { registrationId, action } = body
  if (!registrationId) {
    return NextResponse.json(
      { status: 'error', message: 'registrationId가 필요합니다' },
      { status: 400 },
    )
  }
  if (action !== 'mark' && action !== 'unmark') {
    return NextResponse.json(
      { status: 'error', message: 'action은 mark 또는 unmark여야 합니다' },
      { status: 400 },
    )
  }

  // 대상 registration + 모임 날짜 조회 (권장 환불액 계산용)
  const { data: reg, error: fetchError } = await admin
    .from('registrations')
    .select('paid_amount, status, payment_method, refunded_amount, cancelled_at, meetings(date)')
    .eq('id', registrationId)
    .single()

  if (fetchError || !reg) {
    return NextResponse.json(
      { status: 'error', message: '신청 내역을 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  // 공통 검증 — cancelled + transfer 건만 처리 대상
  if (reg.status !== 'cancelled' || reg.payment_method !== 'transfer') {
    return NextResponse.json(
      { status: 'error', message: '계좌이체 취소 건만 환불 처리할 수 있습니다' },
      { status: 400 },
    )
  }

  if (action === 'mark') {
    // mark: NULL → 권장 환불액
    if (reg.refunded_amount !== null) {
      return NextResponse.json(
        { status: 'error', message: '이미 환불 처리된 건입니다' },
        { status: 400 },
      )
    }

    // 권장 환불액 = calculateRefund(meeting.date, paid_amount, cancelled_at)
    // 토글 누른 시점이 아니라 취소 시점 기준으로 계산 (회원 입장 일관성).
    const meetingData = reg.meetings as unknown as { date: string } | null
    if (!meetingData) {
      return NextResponse.json(
        { status: 'error', message: '연결된 모임을 찾을 수 없습니다' },
        { status: 500 },
      )
    }
    const cancelDate = reg.cancelled_at
      ? toKSTDate(new Date(reg.cancelled_at))
      : getKSTToday()
    const { refundAmount } = calculateRefund(
      meetingData.date,
      reg.paid_amount ?? 0,
      cancelDate,
    )

    // optimistic lock — 동시 mark 방어
    const { data: updated, error } = await admin
      .from('registrations')
      .update({ refunded_amount: refundAmount })
      .eq('id', registrationId)
      .eq('status', 'cancelled')
      .eq('payment_method', 'transfer')
      .is('refunded_amount', null)
      .select('id')

    if (error) {
      console.error('[mark-refunded] mark 실패:', error)
      return NextResponse.json(
        { status: 'error', message: '환불 기록에 실패했습니다' },
        { status: 500 },
      )
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { status: 'error', message: '이미 처리된 건이거나 상태가 변경되었습니다' },
        { status: 409 },
      )
    }

    return NextResponse.json({
      status: 'success',
      data: { refundedAmount: refundAmount },
    })
  }

  // action === 'unmark' — refunded_amount > 0 → NULL
  if (reg.refunded_amount === null) {
    return NextResponse.json(
      { status: 'error', message: '이미 환불 미처리 상태입니다' },
      { status: 400 },
    )
  }
  // 미입금 취소(refunded_amount=0) 보호 — 0은 환불 대상이 아니라 unmark 대상도 아님
  if (reg.refunded_amount === 0) {
    return NextResponse.json(
      { status: 'error', message: '미입금 취소 건은 환불 처리 대상이 아닙니다' },
      { status: 400 },
    )
  }

  const { data: updated, error } = await admin
    .from('registrations')
    .update({ refunded_amount: null })
    .eq('id', registrationId)
    .eq('status', 'cancelled')
    .eq('payment_method', 'transfer')
    .gt('refunded_amount', 0)
    .select('id')

  if (error) {
    console.error('[mark-refunded] unmark 실패:', error)
    return NextResponse.json(
      { status: 'error', message: '환불 취소에 실패했습니다' },
      { status: 500 },
    )
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { status: 'error', message: '이미 처리된 건이거나 상태가 변경되었습니다' },
      { status: 409 },
    )
  }

  return NextResponse.json({ status: 'success', data: { refundedAmount: null } })
}
