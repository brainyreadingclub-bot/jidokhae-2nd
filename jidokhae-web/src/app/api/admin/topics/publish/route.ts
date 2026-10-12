import { NextResponse, after, type NextRequest } from 'next/server'
import { requireCurator } from '@/lib/curator-route'
import { createAppNotification } from '@/lib/app-notifications'
import type { TopicPostedPayload } from '@/lib/topic-notification'

/**
 * 「발제 공개하기」 (2026-10-12 대표님). 권한 = 큐레이터.
 * 그 모임의 「작성 중」 발제를 **전부** 공개하고, 신청자(confirmed·pending_transfer)
 * 1인당 앱 알림을 **1건** 보낸다. 운영자가 쓴 것이든 발제자 링크로 받은 것이든 같다.
 * 공개 뒤에 새로 쓴 발제는 다시 작성 중 → 또 누르면 그것만 공개하고 알림 한 번(「더 올라왔어요」).
 *
 * 동시에 두 번 눌러도 알림은 한 번 — update가 `published_at is null`인 행만 바꾸고,
 * 바뀐 행이 0이면 알림을 보내지 않는다.
 * notified_at도 같이 채운다 — 옛 10분 묶음 예약 작업이 아직 켜져 있어도 이 발제를 다시 알리지 않게.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCurator(request)
    if ('error' in ctx) return ctx.error
    const { meeting_id: meetingId } = await request.json()
    if (typeof meetingId !== 'string' || !meetingId) {
      return NextResponse.json(
        { status: 'error', message: '모임을 확인해 주세요' },
        { status: 400 },
      )
    }

    const [{ data: meeting }, { data: published, error: pubError }] = await Promise.all([
      ctx.admin.from('meetings').select('id, title, status').eq('id', meetingId).single(),
      ctx.admin
        .from('discussion_topics')
        .select('id')
        .eq('meeting_id', meetingId)
        .not('published_at', 'is', null)
        .limit(1),
    ])
    const m = meeting as { id: string; title: string; status: string } | null
    if (!m || m.status !== 'active') {
      return NextResponse.json(
        { status: 'error', message: '모임을 찾을 수 없어요' },
        { status: 404 },
      )
    }
    if (pubError) {
      return NextResponse.json(
        { status: 'error', message: '잠시 후 다시 시도해 주세요' },
        { status: 500 },
      )
    }
    const hadPublished = (published ?? []).length > 0

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await ctx.admin
      .from('discussion_topics')
      .update({ published_at: now, notified_at: now })
      .eq('meeting_id', meetingId)
      .is('published_at', null)
      .select('id')
    if (updateError) {
      return NextResponse.json(
        { status: 'error', message: '잠시 후 다시 시도해 주세요' },
        { status: 500 },
      )
    }
    const count = (updated ?? []).length
    if (count === 0) {
      return NextResponse.json(
        { status: 'error', message: '공개할 발제가 없어요' },
        { status: 400 },
      )
    }

    const payload: TopicPostedPayload = {
      meeting_id: meetingId,
      meeting_title: m.title,
      count,
      more: hadPublished,
    }
    // 신청자 1인당 1건. 실패해도 공개는 이미 끝났다(알림은 부가 기능).
    // after(): 서버리스에서 응답 후에도 실행 보장 — void fire-and-forget은 람다 freeze로 유실
    after(async () => {
      const { data: regs } = await ctx.admin
        .from('registrations')
        .select('user_id')
        .eq('meeting_id', meetingId)
        .in('status', ['confirmed', 'pending_transfer'])
      const recipients = [...new Set((regs ?? []).map((r) => r.user_id as string))]
      for (const userId of recipients) {
        await createAppNotification(userId, 'topic_posted', payload)
      }
    })

    return NextResponse.json({ status: 'success', data: { published: count } })
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  }
}
