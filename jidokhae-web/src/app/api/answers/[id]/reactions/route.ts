import { NextResponse, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/admin'
import { upsertReactionNotification } from '@/lib/app-notifications'
import { getProfile } from '@/lib/profile'

/** 공감 토글. 본인 글에는 알림 없음. 알림은 묶음 처리(upsert). */
export async function POST(
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
    const { data: answer } = await admin
      .from('topic_answers')
      .select('id, user_id')
      .eq('id', answerId)
      .single()
    if (!answer) {
      return NextResponse.json(
        { status: 'error', message: '답변을 찾을 수 없어요' },
        { status: 404 },
      )
    }

    const { data: existing } = await admin
      .from('answer_reactions')
      .select('answer_id')
      .eq('answer_id', answerId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      await admin
        .from('answer_reactions')
        .delete()
        .eq('answer_id', answerId)
        .eq('user_id', user.id)
      return NextResponse.json({ status: 'success', data: { reacted: false } })
    }

    const { error } = await admin
      .from('answer_reactions')
      .insert({ answer_id: answerId, user_id: user.id })
    if (error) {
      return NextResponse.json(
        { status: 'error', message: '잠시 후 다시 시도해 주세요' },
        { status: 500 },
      )
    }

    if (answer.user_id !== user.id) {
      const me = await getProfile(user.id)
      const { count } = await admin
        .from('answer_reactions')
        .select('user_id', { count: 'exact', head: true })
        .eq('answer_id', answerId)
      void upsertReactionNotification(answer.user_id, {
        answer_id: answerId,
        actor_nickname: me?.nickname ?? '회원',
        total_count: count ?? 1,
      })
    }
    return NextResponse.json({ status: 'success', data: { reacted: true } })
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잠시 후 다시 시도해 주세요' },
      { status: 500 },
    )
  }
}
