import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { processUserCancel } from '@/lib/cancel'
import { promoteNextWaitlisted } from '@/lib/waitlist'

export async function POST(request: NextRequest) {
  // Authenticate user via Supabase session cookies
  // (same pattern as /api/registrations/confirm/route.ts)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // No-op: API route doesn't need to set cookies
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { status: 'error', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }

  let body: { registrationId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const { registrationId } = body
  if (!registrationId) {
    return NextResponse.json(
      { status: 'error', message: 'registrationId가 필요합니다' },
      { status: 400 },
    )
  }

  const result = await processUserCancel(registrationId, user.id)

  // 확정자 취소 성공 시 → 대기자 자동 승격
  if (result.status === 'success') {
    try {
      await promoteNextWaitlisted(result.meetingId)
    } catch (error) {
      console.error('[cancel] 대기자 승격 실패:', error)
      // 승격 실패해도 취소 자체는 성공
    }
  }

  const httpStatus =
    result.status === 'error' ? 500 : result.status === 'presenter_locked' ? 409 : 200
  return NextResponse.json(result, { status: httpStatus })
}
