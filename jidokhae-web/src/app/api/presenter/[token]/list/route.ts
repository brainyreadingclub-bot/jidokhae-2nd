import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/admin'
import { findOpenLink, hashDevice } from '@/lib/presenter-link-server'
import { PRESENTER_TOPIC_CAP, isValidDeviceId } from '@/lib/presenter-link'

/**
 * 발제자 링크 — 이 모임에 이미 올라온 발제 (로그인 없음, 2차 4번).
 * 돌려주는 것: 공개된 발제의 번호·제목 + **이 기기에서 쓴** 작성 중 발제(고치기용 전체 내용).
 * 다른 사람이 쓴 작성 중 발제·운영자가 쓴 작성 중 발제는 돌려주지 않는다.
 * 기기 표시는 주소가 아니라 본문으로 받는다(서버 로그에 남지 않게).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    const link = await findOpenLink(token)
    if (!link) {
      return NextResponse.json(
        { status: 'error', code: 'closed', message: '이 링크는 닫혔어요' },
        { status: 410 },
      )
    }
    const { device } = await request.json().catch(() => ({ device: null }))
    const hash = isValidDeviceId(device) ? hashDevice(device) : null

    const admin = createServiceClient()
    const { data, error } = await admin
      .from('discussion_topics')
      .select(
        'id, topic_no, title, quote, quote_page, question, published_at, updated_at, source, presenter_device_hash',
      )
      .eq('meeting_id', link.meeting_id)
      .order('topic_no')
    if (error) throw error

    type Row = {
      id: string
      topic_no: number
      title: string
      quote: string | null
      quote_page: string | null
      question: string
      published_at: string | null
      updated_at: string
      source: string
      presenter_device_hash: string | null
    }
    const rows = (data ?? []) as Row[]
    const topics = rows.flatMap((t) => {
      if (t.published_at !== null) {
        return [{ id: t.id, topic_no: t.topic_no, title: t.title, published: true, mine: false }]
      }
      if (hash && t.source === 'link' && t.presenter_device_hash === hash) {
        return [
          {
            id: t.id,
            topic_no: t.topic_no,
            title: t.title,
            published: false,
            mine: true,
            quote: t.quote,
            quote_page: t.quote_page,
            question: t.question,
            updated_at: t.updated_at,
          },
        ]
      }
      return []
    })
    const linkCount = rows.filter((t) => t.source === 'link').length

    return NextResponse.json({
      status: 'success',
      data: {
        topics,
        next_no: (rows.at(-1)?.topic_no ?? 0) + 1,
        cap_reached: linkCount >= PRESENTER_TOPIC_CAP,
      },
    })
  } catch {
    return NextResponse.json(
      { status: 'error', code: 'server', message: '잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  }
}
