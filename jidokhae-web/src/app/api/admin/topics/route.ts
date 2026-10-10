import { NextResponse, type NextRequest } from 'next/server'
import { requireCurator } from '@/lib/curator-route'

/**
 * 발제문 관리. 권한 = 큐레이터(admin·editor·is_staff, 2026-08-17 결정).
 * POST 등록 / PATCH 수정 / DELETE 삭제.
 *
 * 2026-10-10 (1차): 운영자가 하나씩 써서 **등록하면 바로 공개**(published_at = now()).
 * 이 라우트는 **알림을 보내지 않는다.** 신청자 알림은 DB 예약 작업이 묶어서 보낸다 —
 * 마지막 등록 후 10분 동안 추가 등록이 없으면 그 모임 신청자에게 「발제 N개가 올라왔어요」 한 번
 * (`supabase/migration-topics-notify.sql`의 flush_topic_notifications, 1분마다).
 * 고치기(PATCH)는 published_at을 건드리지 않아 알림이 다시 가지 않는다.
 */

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

/** 입력 정리. 제목·질문은 필수(바로 공개되므로 빈 칸 발제가 회원에게 나가면 안 된다) */
function normalizeTopic(raw: unknown): TopicInput | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const t: TopicInput = {
    title: str(r.title),
    quote: optStr(r.quote),
    quote_page: optStr(r.quote_page),
    question: str(r.question),
  }
  if (t.title === '' || t.question === '') return null
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
    const topic = normalizeTopic(body)
    if (!meetingId || !topic) {
      return NextResponse.json(
        { status: 'error', message: '제목과 질문을 채워 주세요' },
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
    // 두 사람이 동시에 넣어 번호가 겹치면 unique(meeting_id, topic_no)가 막는다 → 한 번 더 시도
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: last } = await ctx.admin
        .from('discussion_topics')
        .select('topic_no')
        .eq('meeting_id', meetingId)
        .order('topic_no', { ascending: false })
        .limit(1)
      const { data, error } = await ctx.admin
        .from('discussion_topics')
        .insert({
          meeting_id: meetingId,
          topic_no: (last?.[0]?.topic_no ?? 0) + 1,
          ...topic,
          author_id: ctx.user.id,
          published_at: new Date().toISOString(),
        })
        .select('id, topic_no')
        .single()
      if (!error && data) {
        return NextResponse.json({ status: 'success', data })
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
    if (!body.id || !t) {
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
    // published_at·notified_at은 건드리지 않는다 — 고쳐도 알림이 다시 가지 않는다
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
    // 알림 전에 지운 발제는 알림 개수에서 빠진다 — 예약 작업이 보낼 때 다시 센다
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
