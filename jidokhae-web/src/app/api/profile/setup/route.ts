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

  let body: { nickname?: string; phone?: string; region?: string[]; email?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const { nickname, phone, region, email } = body

  // 서버 유효성 검사
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

  const VALID_REGIONS = ['경주', '포항', '울산', '부산', '대구', '창원', '대전', '광주', '전주', '수원', '인천', '서울', '제주']
  if (!Array.isArray(region) || region.length === 0 || !region.every((r) => VALID_REGIONS.includes(r))) {
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
  const { error } = await admin
    .from('profiles')
    .update({
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

  return NextResponse.json({ success: true })
}
