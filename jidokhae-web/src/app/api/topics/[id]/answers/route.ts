import { NextResponse, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/admin'
import { canWriteAnswer } from '@/lib/discussion-rules'

/** 발제 답변 작성. 자격 = 해당 모임 confirmed·pending_transfer 신청자. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: topicId } = await params
    const user = await getRouteUser(request)
    if (!user) {
      return NextResponse.json(
        { status: 'error', message: '로그인이 필요합니다' },
        { status: 401 },
      )
    }
    const { body } = await request.json()
    if (typeof body !== 'string' || body.trim().length === 0 || body.length > 2000) {
      return NextResponse.json(
        { status: 'error', message: '내용을 확인해 주세요' },
        { status: 400 },
      )
    }

    const admin = createServiceClient()
    const { data: topic } = await admin
      .from('discussion_topics')
      .select('meeting_id')
      .eq('id', topicId)
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

    const { data: answer, error } = await admin
      .from('topic_answers')
      .insert({ topic_id: topicId, user_id: user.id, body: body.trim() })
      .select('id')
      .single()
    if (error || !answer) {
      return NextResponse.json(
        { status: 'error', message: '잠시 후 다시 시도해 주세요' },
        { status: 500 },
      )
    }
    return NextResponse.json({ status: 'success', data: { id: answer.id } })
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  }
}
