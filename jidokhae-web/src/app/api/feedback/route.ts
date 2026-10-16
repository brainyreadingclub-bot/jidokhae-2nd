import { NextResponse, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/admin'
import { FEEDBACK_DAILY_LIMIT, resolveFeedbackInput, saveMemberFeedback } from '@/lib/member-feedback'

/**
 * 회원 의견 보내기 (보관함 I-001). 로그인 회원만.
 * 저장은 service_role — `member_feedback`는 회원 권한으로는 읽지도 쓰지도 못한다.
 * 🔴 실패 원문(DB 메시지)은 회원에게 내지 않는다. 서버 로그로만 남긴다
 */
export async function POST(request: NextRequest) {
  const user = await getRouteUser(request)
  if (!user) {
    return NextResponse.json({ status: 'error', message: '로그인이 필요해요' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', message: '내용을 다시 확인해 주세요' }, { status: 400 })
  }

  const input = resolveFeedbackInput(raw)
  if (!input.ok) {
    return NextResponse.json({ status: 'error', message: input.message }, { status: 400 })
  }

  const result = await saveMemberFeedback(createServiceClient(), user.id, input.value, Date.now())
  switch (result.status) {
    case 'saved':
      return NextResponse.json({ status: 'success' })
    case 'limited':
      return NextResponse.json(
        { status: 'error', message: `하루에 ${FEEDBACK_DAILY_LIMIT}번까지 보낼 수 있어요. 내일 다시 알려 주세요` },
        { status: 429 },
      )
    case 'table_missing':
      console.warn('[feedback] member_feedback 표가 아직 없음 — migration-member-feedback.sql 미실행')
      break
    case 'failed':
      console.warn('[feedback] 저장 실패:', result.message)
      break
  }
  return NextResponse.json(
    { status: 'error', message: '보내지 못했어요. 잠깐 뒤에 다시 시도해 주세요' },
    { status: 500 },
  )
}
