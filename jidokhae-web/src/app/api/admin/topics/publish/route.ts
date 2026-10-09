import { NextResponse, after, type NextRequest } from 'next/server'
import { requireCurator } from '@/lib/curator-route'
import { createAppNotification } from '@/lib/app-notifications'
import { isTopicIncomplete } from '@/lib/topic-paste'
import type { TopicPostedPayload } from '@/lib/topic-notification'

/**
 * 발제문 공개하기 (2026-10-09). 권한 = 큐레이터.
 * 그 모임의 「작성 중」 발제를 한꺼번에 공개하고, 신청자(confirmed·pending_transfer)
 * 1인당 앱 알림을 **1건** 보낸다. 제목·질문이 빈 발제가 하나라도 있으면 아무것도 공개하지 않는다.
 *
 * 동시에 두 번 눌러도 알림은 한 번 — update가 `published_at is null`인 행만 바꾸고,
 * 바뀐 행이 0이면 알림을 보내지 않는다.
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

    const [{ data: meeting }, { data: topics, error: topicsError }] = await Promise.all([
      ctx.admin.from('meetings').select('id, title').eq('id', meetingId).single(),
      ctx.admin
        .from('discussion_topics')
        .select('id, title, question, published_at')
        .eq('meeting_id', meetingId),
    ])
    if (!meeting) {
      return NextResponse.json(
        { status: 'error', message: '모임을 찾을 수 없어요' },
        { status: 404 },
      )
    }
    if (topicsError) {
      return NextResponse.json(
        { status: 'error', message: '잠시 후 다시 시도해 주세요' },
        { status: 500 },
      )
    }

    const rows = (topics ?? []) as {
      id: string
      title: string
      question: string
      published_at: string | null
    }[]
    const drafts = rows.filter((t) => t.published_at === null)
    if (drafts.length === 0) {
      return NextResponse.json(
        { status: 'error', message: '공개할 발제가 없어요' },
        { status: 400 },
      )
    }
    const incomplete = drafts.filter(isTopicIncomplete).length
    if (incomplete > 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: `제목이나 질문이 빈 발제가 ${incomplete}개 있어요 — 채우면 공개할 수 있어요`,
        },
        { status: 400 },
      )
    }
    const hadPublished = rows.some((t) => t.published_at !== null)

    const { data: updated, error: updateError } = await ctx.admin
      .from('discussion_topics')
      .update({ published_at: new Date().toISOString() })
      .eq('meeting_id', meetingId)
      .in(
        'id',
        drafts.map((t) => t.id),
      )
      .is('published_at', null)
      .select('id')
    if (updateError) {
      return NextResponse.json(
        { status: 'error', message: '잠시 후 다시 시도해 주세요' },
        { status: 500 },
      )
    }
    const count = (updated ?? []).length

    if (count > 0) {
      const payload: TopicPostedPayload = {
        meeting_id: meetingId,
        meeting_title: (meeting as { title: string }).title,
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
    }

    return NextResponse.json({ status: 'success', data: { published: count } })
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  }
}
