import { NextResponse, type NextRequest } from 'next/server'
import { requireCurator } from '@/lib/curator-route'

/**
 * 발제문 관리. 권한 = 큐레이터(admin·editor·is_staff, 2026-08-17 결정).
 * POST 등록(여러 개 한 번에) / PATCH 수정 / DELETE 삭제.
 *
 * 2026-10-09: 등록은 「작성 중」(published_at = null)으로만 들어가고 **알림을 보내지 않는다.**
 * 회원에게 보이고 알림이 가는 것은 「공개하기」(api/admin/topics/publish) 한 번뿐이다.
 * 공개된 발제를 고쳐도 알림은 다시 가지 않는다.
 */

const MAX_TOPICS_PER_REQUEST = 20
const MAX_TITLE = 200
const MAX_TEXT = 2000

type TopicInput = {
  title: string
  quote: string | null
  quote_page: string | null
  question: string
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function optStr(v: unknown): string | null {
  const s = str(v)
  return s === '' ? null : s
}

/** 입력 정리. 작성 중이라 제목·질문 중 하나는 비어도 되지만 둘 다 비면 거절 */
function normalizeTopic(raw: unknown): TopicInput | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const t: TopicInput = {
    title: str(r.title),
    quote: optStr(r.quote),
    quote_page: optStr(r.quote_page),
    question: str(r.question),
  }
  if (t.title === '' && t.question === '') return null
  if (
    t.title.length > MAX_TITLE ||
    t.question.length > MAX_TEXT ||
    (t.quote?.length ?? 0) > MAX_TEXT ||
    (t.quote_page?.length ?? 0) > 20
  ) {
    return null
  }
  return t
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCurator(request)
    if ('error' in ctx) return ctx.error
    const body = await request.json()
    const meetingId = typeof body.meeting_id === 'string' ? body.meeting_id : ''
    // { topics: [...] } — 붙여넣기로 나눈 여러 개. 하나만 보내도 같은 모양
    const rawTopics: unknown[] = Array.isArray(body.topics) ? body.topics : [body]
    const topics = rawTopics.map(normalizeTopic)
    if (
      !meetingId ||
      topics.length === 0 ||
      topics.length > MAX_TOPICS_PER_REQUEST ||
      topics.some((t) => t === null)
    ) {
      return NextResponse.json(
        { status: 'error', message: '필수 항목을 확인해 주세요' },
        { status: 400 },
      )
    }

    const { data: meeting } = await ctx.admin
      .from('meetings')
      .select('id')
      .eq('id', meetingId)
      .single()
    if (!meeting) {
      return NextResponse.json(
        { status: 'error', message: '모임을 찾을 수 없어요' },
        { status: 404 },
      )
    }

    // 번호는 서버가 매긴다 — 그 모임의 기존 발제 뒤로 이어 붙인다.
    // 여러 행을 한 번의 insert로 넣어 전부 들어가거나 하나도 안 들어간다.
    // 두 사람이 동시에 넣어 번호가 겹치면 unique(meeting_id, topic_no)가 막는다 → 한 번 더 시도
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: last } = await ctx.admin
        .from('discussion_topics')
        .select('topic_no')
        .eq('meeting_id', meetingId)
        .order('topic_no', { ascending: false })
        .limit(1)
      const start = (last?.[0]?.topic_no ?? 0) + 1
      const rows = (topics as TopicInput[]).map((t, i) => ({
        meeting_id: meetingId,
        topic_no: start + i,
        ...t,
        author_id: ctx.user.id,
        published_at: null,
      }))
      const { data, error } = await ctx.admin
        .from('discussion_topics')
        .insert(rows)
        .select('id, topic_no')
      if (!error && data) {
        return NextResponse.json({ status: 'success', data: { topics: data } })
      }
      if ((error as { code?: string } | null)?.code !== '23505') break
    }
    return NextResponse.json(
      { status: 'error', message: '잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireCurator(request)
    if ('error' in ctx) return ctx.error
    const body = await request.json()
    const t = normalizeTopic(body)
    // 저장은 제목·질문이 다 있어야 한다 — 공개된 발제가 빈 칸이 되면 안 된다
    if (!body.id || !t || t.title === '' || t.question === '') {
      return NextResponse.json(
        { status: 'error', message: '제목과 질문을 채워 주세요' },
        { status: 400 },
      )
    }
    const topicNo = body.topic_no === undefined ? undefined : Number(body.topic_no)
    if (topicNo !== undefined && (!Number.isInteger(topicNo) || topicNo < 1 || topicNo > 99)) {
      return NextResponse.json(
        { status: 'error', message: '번호를 확인해 주세요' },
        { status: 400 },
      )
    }
    const { error } = await ctx.admin
      .from('discussion_topics')
      .update({
        ...t,
        ...(topicNo !== undefined ? { topic_no: topicNo } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
    if (error) {
      const dup = (error as { code?: string }).code === '23505'
      return NextResponse.json(
        {
          status: 'error',
          message: dup ? '같은 번호의 발제가 이미 있어요' : '잠시 후 다시 시도해 주세요',
        },
        { status: dup ? 409 : 500 },
      )
    }
    return NextResponse.json({ status: 'success' })
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requireCurator(request)
    if ('error' in ctx) return ctx.error
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json(
        { status: 'error', message: 'id가 필요해요' },
        { status: 400 },
      )
    }
    const { error } = await ctx.admin.from('discussion_topics').delete().eq('id', id)
    if (error) {
      return NextResponse.json(
        { status: 'error', message: '잠시 후 다시 시도해 주세요' },
        { status: 500 },
      )
    }
    return NextResponse.json({ status: 'success' })
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  }
}
