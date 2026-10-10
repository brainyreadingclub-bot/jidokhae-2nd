import { NextResponse, type NextRequest } from 'next/server'
import { requireCurator } from '@/lib/curator-route'
import {
  normalizeTopicInput,
  classifySaveFailure,
  SAVE_FAILURE_MESSAGE,
} from '@/lib/topic-input'

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

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCurator(request)
    if ('error' in ctx) return ctx.error
    const body = await request.json()
    const meetingId = typeof body.meeting_id === 'string' ? body.meeting_id : ''
    const topic = normalizeTopicInput(body)
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
    const t = normalizeTopicInput(body)
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
    // published_at·notified_at은 건드리지 않는다 — 고쳐도 알림이 다시 가지 않는다.
    // expected_updated_at(연 시각)을 주면 그 시각 그대로일 때만 저장한다 — 발제자와 동시에 고쳐도
    // 덮어쓰지 않는다(2차, 대표님 6번). 공개된 발제도 운영자는 고칠 수 있다
    const expected = typeof body.expected_updated_at === 'string' ? body.expected_updated_at : null
    let q = ctx.admin
      .from('discussion_topics')
      .update({
        ...t,
        ...(topicNo !== undefined ? { topic_no: topicNo } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
    if (expected) q = q.eq('updated_at', expected)
    const { data: updated, error } = await q.select('id')
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
    if (!updated || updated.length === 0) {
      const { data: row } = await ctx.admin
        .from('discussion_topics')
        .select('published_at, updated_at')
        .eq('id', body.id)
        .maybeSingle()
      const code = classifySaveFailure(row, { forbidPublished: false })
      return NextResponse.json(
        { status: 'error', code, message: SAVE_FAILURE_MESSAGE[code] },
        { status: 409 },
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
