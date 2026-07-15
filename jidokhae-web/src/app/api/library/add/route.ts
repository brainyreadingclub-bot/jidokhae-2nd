import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'
import { isLibraryEnabled, upsertBookAndEntry } from '@/lib/library'
import type { BookSearchResult } from '@/types/book'

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

  let body: BookSearchResult
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }

  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ status: 'error', message: '책 정보가 없습니다' }, { status: 400 })
  }

  const admin = createServiceClient()
  const result = await upsertBookAndEntry(
    admin,
    user.id,
    {
      isbn13: body.isbn13 ?? null,
      title: body.title,
      authors: body.authors ?? null,
      publisher: body.publisher ?? null,
      thumbnail: body.thumbnail ?? null,
    },
    'manual',
    null,
  )

  if (result === 'error') {
    return NextResponse.json({ status: 'error', message: '서재에 담지 못했습니다' }, { status: 500 })
  }
  // 'added' | 'already' 모두 성공으로 처리(멱등)
  return NextResponse.json({ status: 'success', data: { result } })
}
