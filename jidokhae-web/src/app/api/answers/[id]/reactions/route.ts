import { NextResponse, after, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/admin'
import { upsertReactionNotification } from '@/lib/app-notifications'
import { getProfile } from '@/lib/profile'
import { getAnswerAccess, getMyAnsweredTopicIds, viewForTopic } from '@/lib/answer-access'
import { canSeeOthersAnswers } from '@/lib/answer-access-rules'

/** 공감 토글. 본인 글에는 알림 없음. 알림은 묶음 처리(upsert). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: answerId } = await params
    const user = await getRouteUser(request)
    if (!user) {
      return NextResponse.json(
        { status: 'error', message: '로그인이 필요합니다' },
        { status: 401 },
      )
    }
    const admin = createServiceClient()
    const { data: answer } = await admin
      .from('topic_answers')
      .select('id, user_id, topic_id, discussion_topics(meeting_id)')
      .eq('id', answerId)
      .single()
    // 읽을 수 없는 답변에는 공감도 못 한다 — 「있다」는 것도 안 알린다(404로 같게).
    // 응답 후 공개: 그 발제에 자기 답이 없는 신청자는 남의 답에 공감할 수 없다 (2026-10-15)
    const typed = answer as
      | { user_id: string; topic_id: string; discussion_topics?: { meeting_id: string } | null }
      | null
    const meetingId = typed?.discussion_topics?.meeting_id
    let canSee = false
    if (typed && meetingId) {
      const [access, mine] = await Promise.all([
        getAnswerAccess(user.id, meetingId),
        getMyAnsweredTopicIds(user.id, [typed.topic_id]),
      ])
      canSee =
        typed.user_id === user.id ||
        canSeeOthersAnswers(viewForTopic(access, mine.has(typed.topic_id)))
    }
    if (!answer || !canSee) {
      return NextResponse.json(
        { status: 'error', message: '답변을 찾을 수 없어요' },
        { status: 404 },
      )
    }

    const { data: existing } = await admin
      .from('answer_reactions')
      .select('answer_id')
      .eq('answer_id', answerId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      await admin
        .from('answer_reactions')
        .delete()
        .eq('answer_id', answerId)
        .eq('user_id', user.id)
      return NextResponse.json({ status: 'success', data: { reacted: false } })
    }

    const { error } = await admin
      .from('answer_reactions')
      .insert({ answer_id: answerId, user_id: user.id })
    if (error) {
      return NextResponse.json(
        { status: 'error', message: '잠시 후 다시 시도해 주세요' },
        { status: 500 },
      )
    }

    if (answer.user_id !== user.id) {
      const me = await getProfile(user.id)
      const { count } = await admin
        .from('answer_reactions')
        .select('user_id', { count: 'exact', head: true })
        .eq('answer_id', answerId)
      // after(): 서버리스에서 응답 후에도 실행 보장 — void fire-and-forget은 람다 freeze로 유실
      after(
        upsertReactionNotification(answer.user_id, {
          answer_id: answerId,
          actor_nickname: me?.nickname ?? '회원',
          total_count: count ?? 1,
        }),
      )
    }
    return NextResponse.json({ status: 'success', data: { reacted: true } })
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  }
}
