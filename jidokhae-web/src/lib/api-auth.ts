import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * API Route 전용 사용자 조회.
 * 기존 라우트들의 createServerClient + request.cookies 패턴을 한 곳으로 모음.
 * 반환: 로그인 사용자 또는 null (401 응답은 호출부 책임).
 */
export async function getRouteUser(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
