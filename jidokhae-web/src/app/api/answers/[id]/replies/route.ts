import { NextResponse, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/admin'
import { createAppNotification } from '@/lib/app-notifications'
import { getProfile } from '@/lib/profile'
import { canWriteAnswer } from '@/lib/discussion-rules'

/** 답글 작성. 자격 = 해당 모임 신청자. 답변 주인에게 인앱 알림. */
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
    const { body } = await request.json()
    if (typeof body !== 'string' || body.trim().length === 0 || body.length > 1000) {
      return NextResponse.json(
        { status: 'error', message: '내용을 확인해 주세요' },
        { status: 400 },
      )
    }

    const admin = createServiceClient()
    const { data: answer } = await admin
      .from('topic_answers')
      .select('id, user_id, topic_id')
      .eq('id', answerId)
      .single()
    if (!answer) {
      return NextResponse.json(
        { status: 'error', message: '답변을 찾을 수 없어요' },
        { status: 404 },
      )
    }
    const { data: topic } = await admin
      .from('discussion_topics')
      .select('meeting_id')
      .eq('id', answer.topic_id)
      .single()
    if (!topic) {
      return NextResponse.json(
        { status: 'error', message: '발제를 찾을 수 없어요' },
        { status: 404 },
      )
    }

    const { data: regs } = await admin
      .from('registrations')
      .select('status')
      .eq('user_id', user.id)
      .eq('meeting_id', topic.meeting_id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (!canWriteAnswer(regs?.[0]?.status ?? null)) {
      return NextResponse.json(
        { status: 'error', message: '신청하면 함께 이야기할 수 있어요' },
        { status: 403 },
      )
    }

    const { error } = await admin
      .from('answer_replies')
      .insert({ answer_id: answerId, user_id: user.id, body: body.trim() })
    if (error) {
      return NextResponse.json(
        { status: 'error', message: '잠시 후 다시 시도해 주세요' },
        { status: 500 },
      )
    }

    if (answer.user_id !== user.id) {
      const me = await getProfile(user.id)
      void createAppNotification(answer.user_id, 'answer_reply', {
        answer_id: answerId,
        topic_id: answer.topic_id,
        actor_nickname: me?.nickname ?? '회원',
        preview: body.trim().slice(0, 60),
      })
    }
    return NextResponse.json({ status: 'success' })
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  }
}
