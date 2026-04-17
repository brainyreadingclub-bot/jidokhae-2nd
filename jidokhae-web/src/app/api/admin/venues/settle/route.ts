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
    venue_id?: string
    month?: string
    total_paid?: number
    settlement_amount?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }

  const { venue_id, month, total_paid, settlement_amount } = body
  if (!venue_id || !month || total_paid === undefined || settlement_amount === undefined) {
    return NextResponse.json({ status: 'error', message: '필수 항목이 누락되었습니다' }, { status: 400 })
  }

  const { error } = await admin.from('venue_settlements').upsert(
    {
      venue_id,
      month,
      total_paid,
      settlement_amount,
      settled_at: new Date().toISOString(),
      settled_by: user.id,
    },
    { onConflict: 'venue_id,month' },
  )

  if (error) {
    return NextResponse.json({ status: 'error', message: `정산 확정 실패: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ status: 'success' })
}
