import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: () => {},
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ status: 'error', message: '로그인이 필요합니다' }, { status: 401 })
  }

  const admin = createServiceClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ status: 'error', message: '권한이 없습니다' }, { status: 403 })
  }

  let body: {
    name?: string
    settlement_type?: string
    settlement_rate?: number
    settlement_fixed?: number
    contact_name?: string
    contact_info?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }

  const { name, settlement_type, settlement_rate, settlement_fixed, contact_name, contact_info } = body

  if (!name?.trim()) {
    return NextResponse.json({ status: 'error', message: '공간 이름을 입력해주세요' }, { status: 400 })
  }

  if (!settlement_type || !['percentage', 'fixed', 'none'].includes(settlement_type)) {
    return NextResponse.json({ status: 'error', message: '정산 유형을 선택해주세요' }, { status: 400 })
  }

  const { data, error } = await admin.from('venues').insert({
    name: name.trim(),
    settlement_type,
    settlement_rate: settlement_rate ?? 80,
    settlement_fixed: settlement_fixed ?? 0,
    contact_name: contact_name?.trim() || null,
    contact_info: contact_info?.trim() || null,
  }).select('id').single()

  if (error) {
    return NextResponse.json({ status: 'error', message: `생성 실패: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}
