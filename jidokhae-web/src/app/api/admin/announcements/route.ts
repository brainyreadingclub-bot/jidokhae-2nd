import { NextResponse, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/admin'

/**
 * 인앱 공지 발송 (2026-08-17 시안 D) — 전 회원의 알림함에 announcement 알림을 넣는다.
 * admin 전용 — 발송은 되돌리기 어려우므로 editor 제외 (배너·한줄과 달리).
 * 알림톡이 아니라 인앱 알림이므로 비용·심사 없음. 조용한 채널.
 */
export async function POST(request: NextRequest) {
  const user = await getRouteUser(request)
  if (!user) {
    return NextResponse.json(
      { status: 'error', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }

  const admin = createServiceClient()
  const { data: me } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!me || me.role !== 'admin') {
    return NextResponse.json(
      { status: 'error', message: '권한이 없습니다' },
      { status: 403 },
    )
  }

  let body: { title?: string; body?: string; href?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const title = (body.title ?? '').trim()
  if (!title || title.length > 60) {
    return NextResponse.json(
      { status: 'error', message: '제목을 1~60자로 입력해 주세요' },
      { status: 400 },
    )
  }
  const text = (body.body ?? '').trim()
  const href = (body.href ?? '').trim()
  // '//host'는 프로토콜 상대 URL, '/\'는 일부 브라우저에서 '//'로 해석 — 외부 이탈 차단
  if (href && (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/\\'))) {
    return NextResponse.json(
      { status: 'error', message: '링크는 /로 시작하는 내부 경로만 가능해요' },
      { status: 400 },
    )
  }

  const { data: members, error: memberError } = await admin
    .from('profiles')
    .select('id')

  if (memberError || !members) {
    return NextResponse.json(
      { status: 'error', message: '회원 목록 조회에 실패했습니다' },
      { status: 500 },
    )
  }

  const payload: Record<string, string> = { title }
  if (text) payload.body = text
  if (href) payload.href = href

  const rows = members.map((m) => ({
    user_id: m.id,
    type: 'announcement',
    payload,
  }))

  const { error } = await admin.from('app_notifications').insert(rows)
  if (error) {
    return NextResponse.json(
      { status: 'error', message: '발송에 실패했습니다. 잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  }

  return NextResponse.json({ status: 'success', data: { sent: rows.length } })
}
