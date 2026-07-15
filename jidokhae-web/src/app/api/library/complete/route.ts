import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'
import { isLibraryEnabled, setCompleted } from '@/lib/library'

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

  let body: { entryId?: string; completed?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }

  if (!body.entryId || typeof body.completed !== 'boolean') {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }

  const admin = createServiceClient()
  const ok = await setCompleted(admin, user.id, body.entryId, body.completed)
  if (!ok) {
    return NextResponse.json({ status: 'error', message: '완독 표시에 실패했습니다' }, { status: 500 })
  }
  return NextResponse.json({ status: 'success' })
}
