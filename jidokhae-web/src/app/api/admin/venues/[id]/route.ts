import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

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
    status?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = body.name.trim()
  if (body.settlement_type !== undefined) updateData.settlement_type = body.settlement_type
  if (body.settlement_rate !== undefined) updateData.settlement_rate = body.settlement_rate
  if (body.settlement_fixed !== undefined) updateData.settlement_fixed = body.settlement_fixed
  if (body.contact_name !== undefined) updateData.contact_name = body.contact_name?.trim() || null
  if (body.contact_info !== undefined) updateData.contact_info = body.contact_info?.trim() || null
  if (body.status !== undefined && ['active', 'inactive'].includes(body.status)) {
    updateData.status = body.status
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ status: 'error', message: '수정할 항목이 없습니다' }, { status: 400 })
  }

  const { error } = await admin.from('venues').update(updateData).eq('id', id)

  if (error) {
    return NextResponse.json({ status: 'error', message: `수정 실패: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
