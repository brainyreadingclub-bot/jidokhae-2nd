import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'
import { isLibraryEnabled, upsertBookAndEntry } from '@/lib/library'
import { verifyEligibleParticipation, recordAskAnswered, recordAskDismissed, recordAskViewed } from '@/lib/asks'
import type { BookSearchResult } from '@/types/book'

type AnswerBody = { action: 'answer'; meetingId: string; book: BookSearchResult }
type DismissBody = { action: 'dismiss'; meetingId: string }
type ViewBody = { action: 'view'; meetingId: string }
type AskBody = AnswerBody | DismissBody | ViewBody

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

  let body: AskBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }

  if (!body || typeof body.meetingId !== 'string' || !body.meetingId) {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }

  const admin = createServiceClient()

  // 자격 재검증 (통계 조작 방지)
  const eligible = await verifyEligibleParticipation(admin, user.id, body.meetingId)
  if (!eligible) {
    return NextResponse.json({ status: 'error', message: '대상 모임이 아닙니다' }, { status: 400 })
  }

  if (body.action === 'view') {
    // 노출 계측(최초 1회). 실패해도 화면엔 영향 없음.
    await recordAskViewed(admin, user.id, body.meetingId)
    return NextResponse.json({ status: 'success' })
  }

  if (body.action === 'dismiss') {
    const ok = await recordAskDismissed(admin, user.id, body.meetingId)
    if (!ok) {
      return NextResponse.json({ status: 'error', message: '처리에 실패했습니다' }, { status: 500 })
    }
    return NextResponse.json({ status: 'success' })
  }

  if (body.action === 'answer') {
    if (!body.book || typeof body.book.title !== 'string' || !body.book.title) {
      return NextResponse.json({ status: 'error', message: '책 정보가 없습니다' }, { status: 400 })
    }
    const result = await upsertBookAndEntry(
      admin,
      user.id,
      {
        isbn13: body.book.isbn13 ?? null,
        title: body.book.title,
        authors: body.book.authors ?? null,
        publisher: body.book.publisher ?? null,
        thumbnail: body.book.thumbnail ?? null,
        description: body.book.description ?? null,
      },
      'ask',
      body.meetingId,
    )
    if (result === 'error') {
      return NextResponse.json({ status: 'error', message: '서재에 담지 못했습니다' }, { status: 500 })
    }
    // 담기 성공/이미담김 모두 응답으로 간주 → answered 기록
    await recordAskAnswered(admin, user.id, body.meetingId)
    return NextResponse.json({ status: 'success', data: { result } })
  }

  return NextResponse.json({ status: 'error', message: '알 수 없는 요청입니다' }, { status: 400 })
}
