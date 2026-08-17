import { NextResponse, after, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/admin'
import { isCurator } from '@/lib/curator'
import { createAppNotification } from '@/lib/app-notifications'

/**
 * 발제문 관리. 권한 = 큐레이터(admin·editor·is_staff, 2026-08-17 결정).
 * POST 등록 / PATCH 수정 / DELETE 삭제.
 */

type CuratorContext =
  | { error: NextResponse }
  | { user: { id: string }; admin: ReturnType<typeof createServiceClient> }

async function requireCurator(request: NextRequest): Promise<CuratorContext> {
  const user = await getRouteUser(request)
  if (!user) {
    return {
      error: NextResponse.json(
        { status: 'error', message: '로그인이 필요합니다' },
        { status: 401 },
      ),
    }
  }
  const admin = createServiceClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, is_staff')
    .eq('id', user.id)
    .single()
  if (!profile || !isCurator(profile)) {
    return {
      error: NextResponse.json(
        { status: 'error', message: '권한이 없어요' },
        { status: 403 },
      ),
    }
  }
  return { user, admin }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCurator(request)
    if ('error' in ctx) return ctx.error
    const { meeting_id, topic_no, title, quote, quote_page, question } =
      await request.json()
    if (!meeting_id || !topic_no || !title || !question) {
      return NextResponse.json(
        { status: 'error', message: '필수 항목을 확인해 주세요' },
        { status: 400 },
      )
    }
    const { data, error } = await ctx.admin
      .from('discussion_topics')
      .insert({
        meeting_id,
        topic_no,
        title,
        quote: quote ?? null,
        quote_page: quote_page ?? null,
        question,
        author_id: ctx.user.id,
      })
      .select('id')
      .single()
    if (error || !data) {
      const dup = (error as { code?: string } | null)?.code === '23505'
      return NextResponse.json(
        {
          status: 'error',
          message: dup ? '같은 번호의 발제가 이미 있어요' : '잠시 후 다시 시도해 주세요',
        },
        { status: dup ? 409 : 500 },
      )
    }

    // 신청자(confirmed·pending_transfer) 전원에게 인앱 알림 — 실패해도 등록은 성공.
    // after(): 서버리스에서 응답 후에도 실행 보장 — void fire-and-forget은 람다 freeze로 유실
    after(async () => {
      const { data: regs } = await ctx.admin
        .from('registrations')
        .select('user_id, status')
        .eq('meeting_id', meeting_id)
        .in('status', ['confirmed', 'pending_transfer'])
      const seen = new Set<string>()
      for (const r of regs ?? []) {
        if (seen.has(r.user_id)) continue
        seen.add(r.user_id)
        await createAppNotification(r.user_id, 'topic_posted', {
          meeting_id,
          topic_no,
          title,
        })
      }
    })

    return NextResponse.json({ status: 'success', data: { id: data.id } })
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
    const { id, title, quote, quote_page, question } = await request.json()
    if (!id || !title || !question) {
      return NextResponse.json(
        { status: 'error', message: '필수 항목을 확인해 주세요' },
        { status: 400 },
      )
    }
    const { error } = await ctx.admin
      .from('discussion_topics')
      .update({
        title,
        quote: quote ?? null,
        quote_page: quote_page ?? null,
        question,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
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
