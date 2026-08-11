import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { startDiagnostic } from '@/lib/diagnostic-log'
import { safeNextPath, NEXT_COOKIE } from '@/lib/next-path'

export async function GET(request: NextRequest) {
  const diag = startDiagnostic('callback')
  diag.stage('start')

  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  // 딥링크 목적지: 쿼리(?next=, 수동 링크용)를 우선하고 없으면 미들웨어가 심은 쿠키.
  // 검증은 safeNextPath 단일 진입점으로 통일(미들웨어와 동일 규칙) — 기존 인라인
  // 검증은 '/\evil.com' 백슬래시 우회와 /auth 순환을 막지 못했다.
  const next = safeNextPath(
    searchParams.get('next') ?? request.cookies.get(NEXT_COOKIE)?.value,
  )

  // User cancelled auth or provider error → return to login (no error page)
  if (error || !code) {
    diag.stage('early-exit (no code/error)')
    return NextResponse.redirect(`${origin}/auth/login`)
  }

  // Use the same cookie pattern as middleware:
  // Track pending cookies, then apply to the final redirect response
  const pendingCookies: { name: string; value: string; options?: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Collect cookies to apply later on the redirect response
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({ name, value, options })
          })
        },
      },
    }
  )

  diag.stage('exchangeCodeForSession start')
  const tExchange = diag.elapsed()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  diag.stage('exchangeCodeForSession done', ` in ${diag.elapsed() - tExchange}ms${exchangeError ? ` ERROR: ${exchangeError.message}` : ''}`)

  // Build redirect response
  const redirectUrl = exchangeError
    ? `${origin}/auth/login`
    : `${origin}${next}`
  const response = NextResponse.redirect(redirectUrl)

  // Apply session cookies directly to the redirect response
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Record<string, string>)
  })

  // 딥링크 쿠키는 1회용 — 소비 후 삭제한다. 남겨두면 다음 로그인이 엉뚱한 곳으로 간다.
  response.cookies.delete(NEXT_COOKIE)

  diag.stage('complete', ` → ${exchangeError ? 'login' : 'next'}`)
  return response
}
