import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'
import { getKSTToday } from '@/lib/kst'

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

  // Check role: editor or admin only
  const adminSupabase = createServiceClient()
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'editor')) {
    return NextResponse.json(
      { status: 'error', message: '권한이 없습니다' },
      { status: 403 },
    )
  }

  // Parse body
  const body = await request.json()
  const { registrationId, attended } = body as {
    registrationId: string
    attended: boolean | null
  }

  if (!registrationId || (attended !== true && attended !== null)) {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  // Validate: registration exists, is confirmed, and meeting date <= today KST
  const { data: reg } = await adminSupabase
    .from('registrations')
    .select('id, status, meeting_id')
    .eq('id', registrationId)
    .single()

  if (!reg) {
    return NextResponse.json(
      { status: 'error', message: '신청 정보를 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  if (reg.status !== 'confirmed') {
    return NextResponse.json(
      { status: 'error', message: '확정된 신청만 참석 체크할 수 있습니다' },
      { status: 400 },
    )
  }

  const { data: meeting } = await adminSupabase
    .from('meetings')
    .select('date')
    .eq('id', reg.meeting_id)
    .single()

  if (!meeting) {
    return NextResponse.json(
      { status: 'error', message: '모임을 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  const kstToday = getKSTToday()
  if (meeting.date > kstToday) {
    return NextResponse.json(
      { status: 'error', message: '모임 날짜 이후에만 참석을 체크할 수 있습니다' },
      { status: 400 },
    )
  }

  // Update attended
  const { error } = await adminSupabase
    .from('registrations')
    .update({ attended })
    .eq('id', registrationId)

  if (error) {
    return NextResponse.json(
      { status: 'error', message: '참석 상태 업데이트에 실패했습니다' },
      { status: 500 },
    )
  }

  return NextResponse.json({ status: 'success' })
}
