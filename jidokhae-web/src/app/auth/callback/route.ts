import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { startDiagnostic } from '@/lib/diagnostic-log'

export async function GET(request: NextRequest) {
  const diag = startDiagnostic('callback')
  diag.stage('start')

  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const rawNext = searchParams.get('next') ?? '/'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

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

  diag.stage('complete', ` → ${exchangeError ? 'login' : 'next'}`)
  return response
}
