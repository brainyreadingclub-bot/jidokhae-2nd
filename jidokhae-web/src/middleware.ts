import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
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
      const target = safeNextPath(rawNext)
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

  return supabaseResponse
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
