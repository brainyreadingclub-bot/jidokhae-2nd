import { NextResponse, type NextRequest } from 'next/server'
import { requireAdminRoute } from '@/lib/admin-route'

/**
 * 공개 소감 내리기 / 내림 풀기 — 총괄운영자(admin)만 (대표님 답 2026-10-12).
 *
 * - hide: `comment_public=false` · `comment_hidden_at=now()` · `comment_hidden_by=운영자`를 **한 UPDATE로**.
 *   DB CHECK가 셋을 함께 요구한다. 내린 소감은 회원이 다시 공개하지 못한다(CHECK + 회원 API 두 겹).
 *   `comment_unpublished_at`은 건드리지 않는다 — 그 칸은 **회원이** 내린 시각이다
 * - unhide: 내림 칸 둘을 비운다. **공개로 되돌리지 않는다** — 다시 공개할지는 회원이 정한다
 *   (공개 동의는 회원 것이다, 계획서 §2-1)
 */
export async function POST(request: NextRequest) {
  const ctx = await requireAdminRoute(request)
  if ('error' in ctx) return ctx.error
  const { user, admin } = ctx

  let body: { reviewId?: unknown; action?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }
  const reviewId = typeof body?.reviewId === 'string' ? body.reviewId : ''
  if (!reviewId || (body.action !== 'hide' && body.action !== 'unhide')) {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }

  const patch =
    body.action === 'hide'
      ? {
          comment_public: false,
          comment_hidden_at: new Date().toISOString(),
          comment_hidden_by: user.id,
        }
      : { comment_hidden_at: null, comment_hidden_by: null }

  const query = admin.from('meeting_reviews').update(patch).eq('id', reviewId).not('comment', 'is', null)
  // 이미 내린 것을 또 내리면 내린 시각이 바뀐다 — 처음 내린 기록을 지키려고 원래 상태를 WHERE에 건다
  const { data, error } = await (body.action === 'hide'
    ? query.is('comment_hidden_at', null)
    : query.not('comment_hidden_at', 'is', null)
  ).select('id')

  if (error) {
    console.error('[admin/reviews/hide] 실패:', error.code, error.message)
    return NextResponse.json({ status: 'error', message: '처리하지 못했어요' }, { status: 500 })
  }
  return NextResponse.json({ status: 'success', data: { changed: (data ?? []).length } })
}
