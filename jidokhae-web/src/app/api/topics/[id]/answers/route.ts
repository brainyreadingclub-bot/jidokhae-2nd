import { NextResponse, after, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/admin'
import { canWriteAnswer } from '@/lib/discussion-rules'
import { getAnswerAccess } from '@/lib/answer-access'
import { recordAppEvent } from '@/lib/app-events'
import { getTopicAnswererCounts } from '@/lib/discussion'

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
      .select('meeting_id, topic_no')
      .eq('id', topicId)
      .not('published_at', 'is', null)
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

    // 같은 사람이 같은 발제에 같은 내용을 또 저장하면 새로 만들지 않고 있던 답변을 돌려준다
    // (2026-10-13 대표님 결정 — 한 발제에 여러 답변은 허용, 같은 내용 중복만 막는다).
    // 두 번 누름·창 두 개·새로고침 전 재전송이 여기로 온다. 동시에 들어온 두 요청은
    // DB 고유 색인(migration-topic-answer-dedup.sql)이 막고, 그 충돌(23505)도 같은 답으로 끝낸다
    // 본문을 조회 조건(주소)에 싣지 않는다 — 2000자 한글은 주소 길이 한도를 넘을 수 있다.
    // 한 사람이 한 발제에 쓴 답변은 몇 개뿐이라 가져와서 비교한다
    const trimmed = body.trim()
    const findSame = async () => {
      const { data: mine } = await admin
        .from('topic_answers')
        .select('id, body')
        .eq('topic_id', topicId)
        .eq('user_id', user.id)
      return {
        data: (mine ?? []).find((a) => a.body === trimmed) ?? null,
        /** 이 발제에 쓴 답이 아직 하나도 없다 = 이번 답이 첫 답 */
        firstHere: (mine ?? []).length === 0,
      }
    }
    const { data: same, firstHere } = await findSame()
    if (same) {
      return NextResponse.json({ status: 'success', data: { id: same.id, duplicate: true } })
    }

    const { data: answer, error } = await admin
      .from('topic_answers')
      .insert({ topic_id: topicId, user_id: user.id, body: trimmed })
      .select('id')
      .single()
    if (error?.code === '23505') {
      const { data: raced } = await findSame()
      if (raced) {
        return NextResponse.json({ status: 'success', data: { id: raced.id, duplicate: true } })
      }
    }
    if (error || !answer) {
      return NextResponse.json(
        { status: 'error', message: '잠시 후 다시 시도해 주세요' },
        { status: 500 },
      )
    }

    // 기록 — 화면을 막지 않는다(after). 이번 답으로 남의 답이 처음 열렸으면 그것도 남긴다
    after(async () => {
      try {
        const access = await getAnswerAccess(user.id, topic.meeting_id)
        const openedNow =
          firstHere && access.revealAfterOwn && !access.curator && !access.presenter
        await recordAppEvent({
          event: 'topic.answer_submit',
          userId: user.id,
          meetingId: topic.meeting_id,
          props: { topic_no: topic.topic_no, body_length: trimmed.length, opened_now: openedNow },
        })
        if (openedNow) {
          const counts = await getTopicAnswererCounts([topicId])
          await recordAppEvent({
            event: 'topic.answers_unlock',
            userId: user.id,
            meetingId: topic.meeting_id,
            // 방금 쓴 나를 뺀, 열어서 보게 된 사람 수
            props: { topic_no: topic.topic_no, answerers: Math.max(0, (counts.get(topicId) ?? 1) - 1) },
          })
        }
      } catch (e) {
        console.warn('[topic answer] 기록 중 예외:', e)
      }
    })
    return NextResponse.json({ status: 'success', data: { id: answer.id } })
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  }
}
