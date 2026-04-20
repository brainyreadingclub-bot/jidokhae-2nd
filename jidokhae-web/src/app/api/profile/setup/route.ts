import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'
import { VALID_REGIONS } from '@/lib/regions'

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
    return NextResponse.json(
      { status: 'error', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }

  let body: { nickname?: string; real_name?: string; phone?: string; region?: string[]; email?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const { nickname, real_name, phone, region, email } = body

  // 서버 유효성 검사
  if (!real_name || real_name.trim().length < 2 || real_name.trim().length > 20) {
    return NextResponse.json(
      { status: 'error', message: '실명은 2~20자로 입력해주세요' },
      { status: 400 },
    )
  }

  if (!nickname || nickname.trim().length < 2 || nickname.trim().length > 20) {
    return NextResponse.json(
      { status: 'error', message: '닉네임은 2~20자로 입력해주세요' },
      { status: 400 },
    )
  }

  if (!phone || !/^010\d{7,8}$/.test(phone)) {
    return NextResponse.json(
      { status: 'error', message: '010으로 시작하는 휴대폰 번호를 입력해주세요' },
      { status: 400 },
    )
  }

  if (!Array.isArray(region) || region.length === 0 || !region.every((r: string) => (VALID_REGIONS as readonly string[]).includes(r))) {
    return NextResponse.json(
      { status: 'error', message: '지역을 하나 이상 선택해주세요' },
      { status: 400 },
    )
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { status: 'error', message: '올바른 이메일을 입력해주세요' },
      { status: 400 },
    )
  }

  const admin = createServiceClient()

  // 닉네임 중복 체크 (자기 자신 제외, 빈 문자열 제외)
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('nickname', nickname.trim())
    .neq('id', user.id)
    .neq('nickname', '')
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { status: 'error', message: '이미 사용 중인 닉네임입니다' },
      { status: 409 },
    )
  }

  const { error } = await admin
    .from('profiles')
    .update({
      real_name: real_name!.trim(),
      nickname: nickname.trim(),
      phone,
      region,
      email: email || null,
      profile_completed_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json(
      { status: 'error', message: '프로필 저장에 실패했습니다' },
      { status: 500 },
    )
  }

  return NextResponse.json({ status: 'success' })
}
