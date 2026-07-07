import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'

// 정산 "확인 제외" 토글 (admin 전용).
// pending_transfer 건을 정산 목록에서 숨긴다(settlement_excluded=true) / 해제한다(false).
// 실제 registration은 그대로 두므로 정원·명단에는 영향 없음. 매출에도 미포함(pending_transfer는 원래 제외).
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

  let body: { registrationId?: string; excluded?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const { registrationId, excluded } = body
  if (!registrationId || typeof excluded !== 'boolean') {
    return NextResponse.json(
      { status: 'error', message: 'registrationId와 excluded가 필요합니다' },
      { status: 400 },
    )
  }

  const { data, error } = await admin
    .from('registrations')
    .update({ settlement_excluded: excluded })
    .eq('id', registrationId)
    .eq('status', 'pending_transfer')
    .select('id')

  if (error) {
    return NextResponse.json(
      { status: 'error', message: error.message },
      { status: 500 },
    )
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { status: 'error', message: '대상을 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  return NextResponse.json({ status: 'success' })
}
