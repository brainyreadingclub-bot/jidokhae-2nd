import { NextResponse, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/admin'
import { upsertBook } from '@/lib/library'
import type { BookSearchResult } from '@/types/book'

/**
 * 책 확보 API (토론모임 ↔ 책 연결용).
 * 카카오 검색 결과를 books에 upsert하고 id를 돌려준다 — MeetingForm이 book_id 저장에 사용.
 * 권한: admin·editor (모임 CRUD 권한과 동일).
 */
export async function POST(request: NextRequest) {
  const user = await getRouteUser(request)
  if (!user) {
    return NextResponse.json(
      { status: 'error', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }

  const admin = createServiceClient()
  const { data: me } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!me || (me.role !== 'admin' && me.role !== 'editor')) {
    return NextResponse.json(
      { status: 'error', message: '권한이 없습니다' },
      { status: 403 },
    )
  }

  let body: { book?: BookSearchResult }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const book = body.book
  if (!book || typeof book.title !== 'string' || !book.title.trim()) {
    return NextResponse.json(
      { status: 'error', message: '책 정보가 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const bookId = await upsertBook(admin, book)
  if (!bookId) {
    return NextResponse.json(
      { status: 'error', message: '책 저장에 실패했습니다' },
      { status: 500 },
    )
  }

  return NextResponse.json({ status: 'success', data: { id: bookId } })
}
