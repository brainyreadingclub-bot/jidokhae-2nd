import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'
import { isLibraryEnabled, removeEntry } from '@/lib/library'

export async function POST(request: NextRequest) {
  if (!(await isLibraryEnabled())) {
    return NextResponse.json({ status: 'error', message: '사용할 수 없는 기능입니다' }, { status: 403 })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ status: 'error', message: '로그인이 필요합니다' }, { status: 401 })
  }

  let body: { entryId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }

  if (!body.entryId || typeof body.entryId !== 'string') {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }

  const admin = createServiceClient()
  const removed = await removeEntry(admin, user.id, body.entryId)
  if (!removed) {
    return NextResponse.json({ status: 'error', message: '서재에서 빼지 못했습니다' }, { status: 500 })
  }
  return NextResponse.json({ status: 'success', data: { title: removed.title } })
}
