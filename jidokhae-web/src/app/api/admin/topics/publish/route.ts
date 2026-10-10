import { NextResponse, type NextRequest } from 'next/server'
import { requireCurator } from '@/lib/curator-route'

/**
 * 고른 작성 중 발제만 공개 (2차, 대표님 8번 — 체크박스로 고른 것만). 권한 = 큐레이터.
 * published_at = now()만 채운다. **알림은 여기서 보내지 않는다** — 1차의 10분 묶음 알림
 * (DB 함수 flush_topic_notifications)이 그대로 한 번 보낸다. 새 알림 경로를 만들지 않는다.
 * 이미 공개된 것·다른 모임 것은 조건에서 걸러져 0행이 된다.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCurator(request)
    if ('error' in ctx) return ctx.error
    const body = await request.json()
    const meetingId = typeof body.meeting_id === 'string' ? body.meeting_id : ''
    const ids: string[] = Array.isArray(body.ids)
      ? body.ids.filter((v: unknown): v is string => typeof v === 'string').slice(0, 100)
      : []
    if (!meetingId || ids.length === 0) {
      return NextResponse.json(
        { status: 'error', message: '공개할 발제를 골라 주세요' },
        { status: 400 },
      )
    }
    const { data, error } = await ctx.admin
      .from('discussion_topics')
      .update({ published_at: new Date().toISOString() })
      .eq('meeting_id', meetingId)
      .in('id', ids)
      .is('published_at', null)
      .select('id')
    if (error) {
      return NextResponse.json(
        { status: 'error', message: '잠시 후 다시 시도해 주세요' },
        { status: 500 },
      )
    }
    return NextResponse.json({ status: 'success', data: { published: (data ?? []).length } })
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  }
}
