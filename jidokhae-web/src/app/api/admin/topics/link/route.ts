import { NextResponse, type NextRequest } from 'next/server'
import { requireCurator } from '@/lib/curator-route'
import { generateToken } from '@/lib/presenter-link-server'

/**
 * 발제자 링크 만들기·바꾸기·닫기 (2차). 권한 = 큐레이터.
 *   action 'open'   — 링크가 없거나 닫혀 있으면 새 토큰으로 연다. 열려 있으면 그대로 돌려준다
 *   action 'rotate' — 새 토큰으로 바꾼다(옛 주소는 바로 닫힌다)
 *   action 'close'  — 지금 닫는다(화면에서 한 번 더 확인한 뒤 부른다)
 * 닫히는 시각은 저장하지 않는다 — 앱이 매번 모임 날짜로 계산한다(lib/presenter-link.ts).
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCurator(request)
    if ('error' in ctx) return ctx.error
    const body = await request.json()
    const meetingId = typeof body.meeting_id === 'string' ? body.meeting_id : ''
    const action = body.action
    if (!meetingId || !['open', 'rotate', 'close'].includes(action)) {
      return NextResponse.json(
        { status: 'error', message: '요청을 확인해 주세요' },
        { status: 400 },
      )
    }

    const { data: meeting } = await ctx.admin
      .from('meetings')
      .select('id, meeting_type, status')
      .eq('id', meetingId)
      .maybeSingle()
    if (!meeting || meeting.meeting_type !== 'discussion' || meeting.status !== 'active') {
      return NextResponse.json(
        { status: 'error', message: '토론모임에서만 링크를 만들 수 있어요' },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const { data: link, error: readError } = await ctx.admin
      .from('topic_presenter_links')
      .select('token, closed_at')
      .eq('meeting_id', meetingId)
      .maybeSingle()
    if (readError) {
      return NextResponse.json(
        { status: 'error', message: '잠시 후 다시 시도해 주세요' },
        { status: 500 },
      )
    }

    if (action === 'close') {
      if (link) {
        const { error } = await ctx.admin
          .from('topic_presenter_links')
          .update({ closed_at: now, updated_at: now })
          .eq('meeting_id', meetingId)
        if (error) throw error
      }
      return NextResponse.json({ status: 'success', data: { token: null } })
    }

    if (action === 'open' && link && link.closed_at === null) {
      return NextResponse.json({ status: 'success', data: { token: link.token } })
    }

    // 새 토큰 — open(없거나 닫힘) · rotate
    const token = generateToken()
    const { error } = await ctx.admin.from('topic_presenter_links').upsert(
      {
        meeting_id: meetingId,
        token,
        closed_at: null,
        created_by: ctx.user.id,
        updated_at: now,
      },
      { onConflict: 'meeting_id' },
    )
    if (error) throw error
    return NextResponse.json({ status: 'success', data: { token } })
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  }
}
