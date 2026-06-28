import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'
import { resolveProfileUpdate, type ProfileUpdateInput } from '@/lib/profile-update'

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ status: 'error', message: '로그인이 필요합니다' }, { status: 401 })
  }

  let body: ProfileUpdateInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }

  const admin = createServiceClient()

  // 현재 프로필 조회
  const { data: current, error: fetchError } = await admin
    .from('profiles')
    .select('nickname, nickname_changed_at')
    .eq('id', user.id)
    .single()

  if (fetchError || !current) {
    return NextResponse.json({ status: 'error', message: '프로필을 찾을 수 없습니다' }, { status: 404 })
  }

  // 입금 대기(pending_transfer) 보유 여부
  const { data: pending } = await admin
    .from('registrations')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'pending_transfer')
    .limit(1)

  const hasPendingTransfer = !!(pending && pending.length > 0)

  // 검증 + 변경분 산출
  const resolved = resolveProfileUpdate(
    { nickname: body.nickname, phone: body.phone, region: body.region, email: body.email },
    { nickname: current.nickname, nickname_changed_at: current.nickname_changed_at },
    { hasPendingTransfer },
  )

  if (!resolved.ok) {
    return NextResponse.json({ status: 'error', message: resolved.message }, { status: 400 })
  }

  // 변경할 내용이 없으면 바로 성공
  if (Object.keys(resolved.updates).length === 0) {
    return NextResponse.json({ status: 'success' })
  }

  // 닉네임 실제 변경 시: 중복 체크 + 변경 시각 기록
  if (resolved.nicknameChanged) {
    const newNickname = resolved.updates.nickname as string
    const { data: dup } = await admin
      .from('profiles')
      .select('id')
      .eq('nickname', newNickname)
      .neq('id', user.id)
      .neq('nickname', '')
      .limit(1)

    if (dup && dup.length > 0) {
      return NextResponse.json({ status: 'error', message: '이미 사용 중인 닉네임입니다' }, { status: 409 })
    }

    resolved.updates.nickname_changed_at = new Date().toISOString()

    // 낙관적 가드: nickname_changed_at IS NULL인 행만 업데이트
    const { data: updated, error: updateError } = await admin
      .from('profiles')
      .update(resolved.updates)
      .eq('id', user.id)
      .is('nickname_changed_at', null)
      .select('id')

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json({ status: 'error', message: '이미 사용 중인 닉네임입니다' }, { status: 409 })
      }
      return NextResponse.json({ status: 'error', message: '프로필 저장에 실패했습니다' }, { status: 500 })
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ status: 'error', message: '닉네임은 1회만 변경할 수 있어요' }, { status: 409 })
    }

    return NextResponse.json({ status: 'success' })
  }

  // 닉네임 외 필드만 수정
  const { error: updateError } = await admin
    .from('profiles')
    .update(resolved.updates)
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ status: 'error', message: '프로필 저장에 실패했습니다' }, { status: 500 })
  }

  return NextResponse.json({ status: 'success' })
}
