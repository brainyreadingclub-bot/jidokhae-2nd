import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/admin'
import { findOpenLink, hashDevice } from '@/lib/presenter-link-server'
import {
  PRESENTER_RATE_PER_MINUTE,
  PRESENTER_TOPIC_CAP,
  isValidDeviceId,
} from '@/lib/presenter-link'
import {
  normalizeTopicInput,
  classifySaveFailure,
  SAVE_FAILURE_MESSAGE,
} from '@/lib/topic-input'

/**
 * 발제자 링크 — 발제 쓰기(POST)·고치기(PATCH). 로그인 없음 (2차, 대표님 확정).
 *
 * 🔴 지키는 것
 *   - 토큰은 서버(service_role)에서만 검사한다. 닫힌 링크·없는 토큰은 같은 대답(410 closed)
 *   - 쓴 글은 **언제나 작성 중**(published_at = null)으로만 들어간다. 공개는 운영자만
 *   - 공개된 발제는 이 경로로 절대 저장되지 않는다 — UPDATE 조건에 published_at IS NULL (9번)
 *   - 고치기는 그 기기에서 쓴 발제만 — 기기 표시 해시가 같아야 한다 (7번)
 *   - 덮어쓰지 않는다 — 연 시각(updated_at)이 그대로일 때만 저장 (6번)
 *   - 남용 방지 — 링크당 30개, 모임당 1분 5개
 */

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ status: 'error', code, message }, { status })
}

type Ctx = { params: Promise<{ token: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { token } = await params
    const link = await findOpenLink(token)
    if (!link) return fail('closed', '이 링크는 닫혔어요', 410)

    const body = await request.json().catch(() => null)
    if (!body || !isValidDeviceId(body.device)) {
      return fail('invalid', '화면을 새로 고친 뒤 다시 저장해 주세요', 400)
    }
    const topic = normalizeTopicInput(body)
    if (!topic) return fail('invalid', '제목과 질문을 채워 주세요', 400)

    const admin = createServiceClient()
    const since = new Date(Date.now() - 60_000).toISOString()
    const [{ count: total }, { count: recent }] = await Promise.all([
      admin
        .from('discussion_topics')
        .select('id', { count: 'exact', head: true })
        .eq('meeting_id', link.meeting_id)
        .eq('source', 'link'),
      admin
        .from('discussion_topics')
        .select('id', { count: 'exact', head: true })
        .eq('meeting_id', link.meeting_id)
        .eq('source', 'link')
        .gte('created_at', since),
    ])
    if ((total ?? 0) >= PRESENTER_TOPIC_CAP) {
      return fail('cap', '이 링크로 받을 수 있는 발제가 다 찼어요 — 운영자에게 말해 주세요', 403)
    }
    if ((recent ?? 0) >= PRESENTER_RATE_PER_MINUTE) {
      return fail('rate', '잠깐 뒤에 다시 저장해 주세요', 429)
    }

    const hash = hashDevice(body.device)
    // 번호는 서버가 매긴다 — 겹치면 unique(meeting_id, topic_no)가 막는다 → 한 번 더
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: last } = await admin
        .from('discussion_topics')
        .select('topic_no')
        .eq('meeting_id', link.meeting_id)
        .order('topic_no', { ascending: false })
        .limit(1)
      const { data, error } = await admin
        .from('discussion_topics')
        .insert({
          meeting_id: link.meeting_id,
          topic_no: (last?.[0]?.topic_no ?? 0) + 1,
          ...topic,
          // 로그인이 없어 작성자가 없다 — 링크를 만든 운영자 이름으로 둔다(source = 'link'가 구분)
          author_id: link.created_by,
          published_at: null,
          source: 'link',
          presenter_device_hash: hash,
        })
        .select('id, topic_no, updated_at')
        .single()
      if (!error && data) return NextResponse.json({ status: 'success', data })
      if ((error as { code?: string } | null)?.code !== '23505') break
    }
    return fail('server', '잠시 후 다시 시도해 주세요', 500)
  } catch {
    return fail('server', '잠시 후 다시 시도해 주세요', 500)
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { token } = await params
    const link = await findOpenLink(token)
    if (!link) return fail('closed', '이 링크는 닫혔어요', 410)

    const body = await request.json().catch(() => null)
    if (
      !body ||
      !isValidDeviceId(body.device) ||
      typeof body.id !== 'string' ||
      typeof body.expected_updated_at !== 'string'
    ) {
      return fail('invalid', '화면을 새로 고친 뒤 다시 저장해 주세요', 400)
    }
    const topic = normalizeTopicInput(body)
    if (!topic) return fail('invalid', '제목과 질문을 채워 주세요', 400)

    const admin = createServiceClient()
    const hash = hashDevice(body.device)
    const { data: updated, error } = await admin
      .from('discussion_topics')
      .update({ ...topic, updated_at: new Date().toISOString() })
      .eq('id', body.id)
      .eq('meeting_id', link.meeting_id)
      .eq('source', 'link')
      .eq('presenter_device_hash', hash)
      .is('published_at', null)
      .eq('updated_at', body.expected_updated_at)
      .select('id, topic_no, updated_at')
    if (error) throw error
    if (updated && updated.length > 0) {
      return NextResponse.json({ status: 'success', data: updated[0] })
    }

    // 0행 — 왜인지 가른다
    const { data: row } = await admin
      .from('discussion_topics')
      .select('meeting_id, source, presenter_device_hash, published_at, updated_at')
      .eq('id', body.id)
      .maybeSingle()
    const sameMeeting = row && row.meeting_id === link.meeting_id
    const code = classifySaveFailure(
      sameMeeting
        ? {
            published_at: row.published_at,
            updated_at: row.updated_at,
            mine: row.source === 'link' && row.presenter_device_hash === hash,
          }
        : null,
      { forbidPublished: true },
    )
    return fail(code, SAVE_FAILURE_MESSAGE[code], 409)
  } catch {
    return fail('server', '잠시 후 다시 시도해 주세요', 500)
  }
}
