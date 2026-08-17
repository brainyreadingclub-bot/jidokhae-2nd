import { NextResponse, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/admin'
import { isCurator } from '@/lib/curator'

/**
 * "모임에서 이어가요" 핀 토글. 권한 = 큐레이터.
 * 취소자 답변의 핀 해제도 이 API로 (스펙 §10 QA).
 */
export async function PATCH(
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
    const admin = createServiceClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('role, is_staff')
      .eq('id', user.id)
      .single()
    if (!profile || !isCurator(profile)) {
      return NextResponse.json(
        { status: 'error', message: '권한이 없어요' },
        { status: 403 },
      )
    }
    const { data: answer } = await admin
      .from('topic_answers')
      .select('pinned')
      .eq('id', answerId)
      .single()
    if (!answer) {
      return NextResponse.json(
        { status: 'error', message: '답변을 찾을 수 없어요' },
        { status: 404 },
      )
    }
    const { error } = await admin
      .from('topic_answers')
      .update({ pinned: !answer.pinned })
      .eq('id', answerId)
    if (error) {
      return NextResponse.json(
        { status: 'error', message: '잠시 후 다시 시도해 주세요' },
        { status: 500 },
      )
    }
    return NextResponse.json({ status: 'success', data: { pinned: !answer.pinned } })
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  }
}
