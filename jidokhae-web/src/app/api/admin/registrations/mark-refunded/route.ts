import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'

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

  // admin 권한 확인
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

  let body: { registrationId?: string; refundedAmount?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const { registrationId, refundedAmount } = body
  if (!registrationId || refundedAmount === undefined) {
    return NextResponse.json(
      { status: 'error', message: 'registrationId와 refundedAmount가 필요합니다' },
      { status: 400 },
    )
  }

  // 금액 범위 기본 검증
  if (typeof refundedAmount !== 'number' || refundedAmount < 0) {
    return NextResponse.json(
      { status: 'error', message: '환불 금액이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  // 대상 registration 조회 + 상태 검증
  const { data: reg, error: fetchError } = await admin
    .from('registrations')
    .select('paid_amount, status, payment_method, refunded_amount')
    .eq('id', registrationId)
    .single()

  if (fetchError || !reg) {
    return NextResponse.json(
      { status: 'error', message: '신청 내역을 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  if (reg.status !== 'cancelled' || reg.payment_method !== 'transfer') {
    return NextResponse.json(
      { status: 'error', message: '계좌이체 취소 건만 환불 처리할 수 있습니다' },
      { status: 400 },
    )
  }

  if (reg.refunded_amount !== null) {
    return NextResponse.json(
      { status: 'error', message: '이미 환불 처리된 건입니다' },
      { status: 400 },
    )
  }

  if (refundedAmount > (reg.paid_amount ?? 0)) {
    return NextResponse.json(
      { status: 'error', message: '환불 금액이 결제 금액을 초과합니다' },
      { status: 400 },
    )
  }

  // 검증 통과 — 환불 기록
  const { error } = await admin
    .from('registrations')
    .update({ refunded_amount: refundedAmount })
    .eq('id', registrationId)
    .eq('status', 'cancelled')
    .eq('payment_method', 'transfer')
    .is('refunded_amount', null)

  if (error) {
    console.error('[mark-refunded] 환불 기록 실패:', error)
    return NextResponse.json(
      { status: 'error', message: '환불 기록에 실패했습니다' },
      { status: 500 },
    )
  }

  return NextResponse.json({ status: 'success' })
}
