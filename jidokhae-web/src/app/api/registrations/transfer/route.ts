import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'
import { getDisplayFee } from '@/lib/staff-slot'
import { isDiscussionApplyOpen } from '@/lib/discussion-rules'

export async function POST(request: NextRequest) {
  try {
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

  let body: { meetingId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const { meetingId } = body
  if (!meetingId) {
    return NextResponse.json(
      { status: 'error', message: 'meetingId가 필요합니다' },
      { status: 400 },
    )
  }

  const admin = createServiceClient()

  // 모임 정보 조회 (참가비 확인)
  const { data: meeting, error: meetingError } = await admin
    .from('meetings')
    .select('fee, status, meeting_type, date')
    .eq('id', meetingId)
    .single()

  if (meetingError || !meeting) {
    return NextResponse.json(
      { status: 'error', message: '모임을 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  if (meeting.status !== 'active') {
    return NextResponse.json(
      { status: 'error', message: '신청할 수 없는 모임입니다' },
      { status: 400 },
    )
  }

  // 토론모임 D-7 신청 마감 강제 (2026-08-17 결정) — 딥링크·공유 URL 경로 차단
  if (meeting.meeting_type === 'discussion' && !isDiscussionApplyOpen(meeting.date)) {
    return NextResponse.json(
      { status: 'error', message: '신청이 마감된 모임입니다' },
      { status: 400 },
    )
  }

  // 신청자 자격 + 슬롯 기반 자동 할인가 결정 (RPC가 마지막 방어선)
  const { data: profile } = await admin
    .from('profiles')
    .select('role, is_staff')
    .eq('id', user.id)
    .single()

  const { fee: paidAmount } = await getDisplayFee(
    meetingId,
    profile as { role: string; is_staff: boolean | null } | null,
    meeting.fee,
    meeting.meeting_type,
  )

  // 계좌이체 신청 RPC 호출
  const { data: result, error: rpcError } = await admin
    .rpc('register_transfer', {
      p_user_id: user.id,
      p_meeting_id: meetingId,
      p_paid_amount: paidAmount,
    })

  if (rpcError) {
    console.error('[transfer] RPC 오류:', rpcError)
    return NextResponse.json(
      { status: 'error', message: '신청 처리 중 오류가 발생했습니다' },
      { status: 500 },
    )
  }

  if (result === 'not_found' || result === 'not_active') {
    return NextResponse.json(
      { status: 'error', message: '신청할 수 없는 모임입니다' },
      { status: 400 },
    )
  }

  if (result === 'already_registered') {
    return NextResponse.json(
      { status: 'error', message: '이미 신청한 모임입니다' },
      { status: 400 },
    )
  }

  // 스텝 할인 race 거부 (사전 슬롯 카운트 후 다른 사용자가 차지)
  if (result === 'discount_not_eligible') {
    return NextResponse.json(
      { status: 'error', message: '스텝 할인 자격이 없습니다' },
      { status: 400 },
    )
  }

  if (result === 'staff_slot_full') {
    return NextResponse.json(
      { status: 'error', message: '스텝 할인 슬롯이 마감되었습니다. 정가로 다시 신청해주세요.' },
      { status: 400 },
    )
  }

  // pending_transfer 또는 waitlisted
  return NextResponse.json({ status: result })
  } catch (error) {
    console.error('[transfer] 예기치 않은 오류:', error)
    return NextResponse.json(
      { status: 'error', message: '서버 오류가 발생했습니다' },
      { status: 500 },
    )
  }
}
