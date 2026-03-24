import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  // Auth check
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

  // Admin role check
  const admin = createServiceClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ status: 'error', message: '권한이 없습니다' }, { status: 403 })
  }

  // Parse body
  let body: { settings?: Record<string, string> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }

  const { settings } = body
  if (!settings || typeof settings !== 'object') {
    return NextResponse.json({ status: 'error', message: '설정 데이터가 필요합니다' }, { status: 400 })
  }

  // UPSERT each setting
  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value: String(value).trim(),
    updated_at: new Date().toISOString(),
  }))

  const { error } = await admin
    .from('site_settings')
    .upsert(rows, { onConflict: 'key' })

  if (error) {
    return NextResponse.json({ status: 'error', message: `저장 실패: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
