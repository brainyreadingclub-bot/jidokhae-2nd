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

  let body: { registrationIds?: string[]; action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const { registrationIds } = body
  const action = body.action ?? 'confirm'
  if (!registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0) {
    return NextResponse.json(
      { status: 'error', message: 'registrationIds가 필요합니다' },
      { status: 400 },
    )
  }

  if (registrationIds.length > 50) {
    return NextResponse.json(
      { status: 'error', message: '한 번에 최대 50건까지 처리할 수 있습니다' },
      { status: 400 },
    )
  }

  let confirmed = 0
  let failed = 0

  for (const registrationId of registrationIds) {
    if (action === 'unconfirm') {
      const { data } = await admin
        .from('registrations')
        .update({ status: 'pending_transfer' })
        .eq('id', registrationId)
        .eq('status', 'confirmed')
        .eq('payment_method', 'transfer')
        .select('id')

      if (data && data.length > 0) confirmed++
      else failed++
    } else {
      const { data, error } = await admin
        .from('registrations')
        .update({ status: 'confirmed' })
        .eq('id', registrationId)
        .eq('status', 'pending_transfer')
        .select('id')

      if (error || !data || data.length === 0) {
        failed++
      } else {
        confirmed++
      }
    }
  }

  return NextResponse.json({ confirmed, failed })
}
