import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'

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
    .select('fee, status')
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

  // 계좌이체 신청 RPC 호출
  const { data: result, error: rpcError } = await admin
    .rpc('register_transfer', {
      p_user_id: user.id,
      p_meeting_id: meetingId,
      p_paid_amount: meeting.fee,
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
