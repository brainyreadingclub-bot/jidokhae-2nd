/**
 * admin/members/staff — 회원의 is_staff 토글 API.
 *
 * 패턴: admin/members/role 그대로 복제.
 *   - admin role 전용 (editor는 권한 없음)
 *   - 자기 자신 변경 거부
 *   - admin/editor 대상 변경 거부 (자동 자격이라 무의미 + 권한 보호)
 *
 * Body: { userId: string, isStaff: boolean }
 */

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

  let body: { userId?: string; isStaff?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const { userId, isStaff } = body

  if (!userId || typeof isStaff !== 'boolean') {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  // 자기 자신 변경 거부
  if (userId === user.id) {
    return NextResponse.json(
      { status: 'error', message: '자기 자신의 스텝 지정은 변경할 수 없습니다' },
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

  // admin/editor는 자동 자격이라 staff 토글 무의미 + 권한 보호
  if (targetProfile.role === 'admin' || targetProfile.role === 'editor') {
    return NextResponse.json(
      { status: 'error', message: '운영자/운영진은 자동으로 스텝 자격이 부여됩니다' },
      { status: 400 },
    )
  }

  const { error } = await admin
    .from('profiles')
    .update({ is_staff: isStaff })
    .eq('id', userId)

  if (error) {
    return NextResponse.json(
      { status: 'error', message: '스텝 지정 변경에 실패했습니다' },
      { status: 500 },
    )
  }

  return NextResponse.json({ status: 'success' })
}
