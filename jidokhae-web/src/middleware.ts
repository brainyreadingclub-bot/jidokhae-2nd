import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

  // Session refresh — must call getUser() to refresh expired tokens
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Auth pages: redirect to main if already authenticated
  if (pathname.startsWith('/auth')) {
    if (user) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      const redirectResponse = NextResponse.redirect(url)
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
    url.pathname = '/auth/login'
    const redirectResponse = NextResponse.redirect(url)
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
