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

  let body: { userId?: string; newRole?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const { userId, newRole } = body

  if (!userId || !newRole) {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  // member 또는 editor만 허용
  if (newRole !== 'member' && newRole !== 'editor') {
    return NextResponse.json(
      { status: 'error', message: '허용되지 않는 역할입니다' },
      { status: 400 },
    )
  }

  // 자기 자신 변경 거부
  if (userId === user.id) {
    return NextResponse.json(
      { status: 'error', message: '자기 자신의 역할은 변경할 수 없습니다' },
      { status: 400 },
    )
  }

  // 대상 사용자 확인
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (!targetProfile) {
    return NextResponse.json(
      { status: 'error', message: '사용자를 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  // admin 역할 변경 거부
  if (targetProfile.role === 'admin') {
    return NextResponse.json(
      { status: 'error', message: '운영자 역할은 변경할 수 없습니다' },
      { status: 400 },
    )
  }

  const { error } = await admin
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)

  if (error) {
    return NextResponse.json(
      { status: 'error', message: '역할 변경에 실패했습니다' },
      { status: 500 },
    )
  }

  return NextResponse.json({ status: 'success' })
}
