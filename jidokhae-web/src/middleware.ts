import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { isOnboarded } from '@/lib/onboarding'
import {
  AFTER_LOGIN_PATH,
  safeNextPath,
  toNextParam,
  shouldRememberPath,
  isPrefetchRequest,
  NEXT_COOKIE,
  NEXT_COOKIE_MAX_AGE,
} from '@/lib/next-path'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // Auth callback: skip getUser() — PKCE code verifier cookies must stay intact
  if (pathname.startsWith('/auth/callback')) {
    return supabaseResponse
  }

  // Public pages: skip getUser() — no auth needed
  if (pathname.startsWith('/policy')) {
    return supabaseResponse
  }

  // SNS crawler metadata routes + PWA icons/manifest: must be publicly accessible
  if (
    pathname.startsWith('/opengraph-image') ||
    pathname.startsWith('/twitter-image') ||
    pathname.startsWith('/apple-icon') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/manifest')
  ) {
    return supabaseResponse
  }

  // Session refresh — must call getUser() to refresh expired tokens
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Auth pages: redirect to main if already authenticated
  if (pathname.startsWith('/auth')) {
    if (user) {
      const url = request.nextUrl.clone()
      // 이미 로그인된 회원이 딥링크를 눌러 로그인 화면에 도달한 경우
      // (직전 요청에서 쿠키가 심겼다) 홈이 아니라 목적지로 보낸다
      const rawNext = request.cookies.get(NEXT_COOKIE)?.value
      const target = safeNextPath(rawNext, AFTER_LOGIN_PATH)
      const qIndex = target.indexOf('?')
      url.pathname = qIndex === -1 ? target : target.slice(0, qIndex)
      url.search = qIndex === -1 ? '' : target.slice(qIndex)
      const redirectResponse = NextResponse.redirect(url)
      // 값이 있으면 무조건 지운다 — 검증에서 걸러진 값도 남겨두면 10분간 재평가된다
      if (rawNext) redirectResponse.cookies.delete(NEXT_COOKIE)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie)
      })
      return redirectResponse
    }
    return supabaseResponse
  }

  // Protected routes: redirect to login if not authenticated
  if (!user) {
    const url = request.nextUrl.clone()
    // 원래 목적지를 실어 보낸다 — 알림톡 딥링크를 카카오톡 인앱 브라우저로 열면
    // 세션이 없는 경우가 많은데, 목적지를 버리면 로그인 후 홈에 떨어져
    // 회원이 무엇을 하러 왔는지 알 수 없게 된다(도달 실패가 전환율 하락으로 오독됨)
    const next = toNextParam(pathname, request.nextUrl.search)
    url.pathname = '/auth/login'
    url.search = ''
    const redirectResponse = NextResponse.redirect(url)
    // 목적지는 쿠키로 넘긴다(이유는 next-path.ts의 NEXT_COOKIE 주석 참조).
    // 홈이 목적지면 굳이 심지 않는다 — 기본 동작과 같다.
    // shouldRememberPath: API 요청·prefetch는 "회원이 보려던 화면"이 아니다.
    const remember =
      next !== '/' &&
      shouldRememberPath(
        request.method,
        pathname,
        isPrefetchRequest(
          request.headers.get('sec-purpose'),
          request.headers.get('purpose'),
        ),
        request.headers.get('sec-fetch-dest'),
      )
    if (remember) {
      redirectResponse.cookies.set(NEXT_COOKIE, next, {
        path: '/',
        maxAge: NEXT_COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
    }
    // Preserve refreshed session cookies on redirect
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })
    return redirectResponse
  }

  // 첫 주소(/)와 알림톡 옛 모임 주소는 화면을 그리기 전에 여기서 바로 새 화면으로 보낸다.
  // 페이지에서 redirect()하면 옛 레이아웃을 그리느라 DB를 두세 번 기다린 뒤에야 넘어가고,
  // 로딩 경계 안에서 던져지면 HTML을 다 보낸 다음 브라우저가 다시 이동한다(2026-10-13 속도 점검).
  // 페이지 쪽 redirect는 안전망으로 그대로 둔다.
  if (request.method === 'GET' || request.method === 'HEAD') {
    const target = await nextUiRedirectTarget(supabase, user.id, pathname)
    if (target) {
      const url = request.nextUrl.clone()
      url.pathname = target
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie)
      })
      return redirectResponse
    }
  }

  return supabaseResponse
}

/** 알림톡 버튼이 가리키는 옛 모임 상세 — 그 아래 결제 화면(/confirm, /payment-*)은 대상이 아니다 */
const OLD_MEETING_DETAIL = /^\/meetings\/([^/]+)$/

/**
 * 새 화면(next_ui)으로 바로 보낼 곳. 없으면 null.
 * - `/` → `/home`: 온보딩(웰컴·프로필)을 마친 회원만. 미완성 회원은 `/`의 관문을 그대로 본다.
 *   (`(next)` 레이아웃이 미완성 회원을 `/`로 돌려보내므로, 여기서 같은 판정을 하지 않으면 순환한다)
 * - `/meetings/[id]` → `/meet/[id]`: 옛 상세 페이지의 redirect와 같은 조건(플래그만).
 * 판정 기준은 `isNextUiEnabled`(next-ui.ts)·`isOnboarded`(onboarding.ts)와 같아야 한다.
 */
async function nextUiRedirectTarget(
  supabase: SupabaseClient,
  userId: string,
  pathname: string,
): Promise<string | null> {
  const oldDetail = OLD_MEETING_DETAIL.exec(pathname)
  if (pathname !== '/' && !oldDetail) return null

  const flagQuery = supabase.from('site_settings').select('value').eq('key', 'next_ui').maybeSingle()
  const profileQuery =
    pathname === '/'
      ? supabase
          .from('profiles')
          .select('welcomed_at, profile_completed_at, real_name')
          .eq('id', userId)
          .maybeSingle()
      : null
  const [flag, profile] = await Promise.all([flagQuery, profileQuery])

  const nextUiOn = process.env.NEXT_UI_PREVIEW === 'on' || flag.data?.value === 'on'
  if (!nextUiOn) return null
  if (oldDetail) return `/meet/${oldDetail[1]}`
  return isOnboarded(profile?.data ?? null) ? '/home' : null
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, static assets
     */
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks/|api/cron/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
