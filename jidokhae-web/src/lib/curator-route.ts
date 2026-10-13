import { NextResponse, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/admin'
import { isCurator } from '@/lib/curator'

/**
 * API Route 전용 큐레이터(admin·editor·is_staff) 검사.
 * 발제 등록·수정·삭제(api/admin/topics)가 쓴다.
 * 라우트 파일은 핸들러 외의 export를 못 하므로 lib에 둔다.
 */
export type CuratorContext =
  | { error: NextResponse }
  | { user: { id: string }; admin: ReturnType<typeof createServiceClient> }

export async function requireCurator(request: NextRequest): Promise<CuratorContext> {
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
