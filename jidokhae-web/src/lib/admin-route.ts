import { NextResponse, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/admin'

/**
 * API Route 전용 총괄운영자(admin) 검사 — `curator-route.ts`와 같은 모양, 집합만 admin 하나.
 * 돈이 움직이는 운영자 동작(발제자 지정 = 카드 전액 환불이 함께 일어날 수 있다)이 쓴다.
 * 라우트 파일은 핸들러 외의 export를 못 하므로 lib에 둔다.
 */
export type AdminRouteContext =
  | { error: NextResponse }
  | { user: { id: string }; admin: ReturnType<typeof createServiceClient> }

export async function requireAdminRoute(request: NextRequest): Promise<AdminRouteContext> {
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
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return {
      error: NextResponse.json(
        { status: 'error', message: '권한이 없어요' },
        { status: 403 },
      ),
    }
  }
  return { user, admin }
}
