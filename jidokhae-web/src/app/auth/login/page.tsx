'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleKakaoLogin() {
    setIsLoading(true)
    setErrorMessage('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setIsLoading(false)
      setErrorMessage('로그인에 실패했습니다. 다시 시도해주세요.')
    }
    // If no error, browser will redirect to Kakao
  }

  return (
    <div className="flex min-h-screen flex-col overflow-hidden">
      {/* ── Top Section: Brand Editorial ── */}
      <section
        className="relative flex flex-[3] flex-col justify-end px-[var(--spacing-page)] pb-14 md:px-10"
        style={{ backgroundColor: 'var(--color-primary-900)' }}
      >
        {/* Grain texture overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: 0.035,
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* Organic shapes */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-20 -right-20 h-64 w-64 rounded-full"
            style={{ background: 'radial-gradient(circle, var(--color-accent-400) 0%, transparent 70%)', opacity: 0.06 }}
          />
          <div
            className="absolute top-1/3 -left-16 h-48 w-48 rounded-full"
            style={{ background: 'radial-gradient(circle, var(--color-primary-300) 0%, transparent 70%)', opacity: 0.05 }}
          />
          <div
            className="absolute bottom-12 right-8 h-32 w-32 rounded-full"
            style={{ background: 'radial-gradient(circle, var(--color-accent-300) 0%, transparent 70%)', opacity: 0.04 }}
          />
        </div>

        {/* Brand content */}
        <div className="relative">
          <h1
            className="text-[2.75rem] font-bold leading-[1.1] text-white md:text-[3.25rem]"
            style={{
              fontFamily: 'var(--font-display)',
              animation: 'loginFadeUp 600ms ease-out both',
            }}
          >
            지독해
          </h1>

          <p
            className="mt-3 text-caption text-neutral-400"
            style={{
              letterSpacing: '0.15em',
              animation: 'loginFadeUp 600ms ease-out both',
              animationDelay: '150ms',
            }}
          >
            경주 · 포항 독서모임
          </p>

          {/* Thin editorial rule */}
          <div
            className="mt-6 mb-6 h-px w-[60px] bg-neutral-600"
            style={{
              animation: 'loginFadeUp 600ms ease-out both',
              animationDelay: '300ms',
            }}
          />

          <p
            className="text-subheading text-neutral-300"
            style={{
              animation: 'loginFadeUp 600ms ease-out both',
              animationDelay: '300ms',
            }}
          >
            책으로 연결되는 사람들
          </p>
        </div>
      </section>

      {/* ── Bottom Section: Login Action ── */}
      <section
        className="relative z-10 -mt-6 flex flex-[2] flex-col items-center justify-center rounded-t-[24px] px-[var(--spacing-page)] py-10 md:px-10"
        style={{
          backgroundColor: 'var(--color-neutral-50)',
          animation: 'loginSlideUp 500ms ease-out both',
          animationDelay: '200ms',
        }}
      >
        {/* Social proof */}
        <p className="mb-6 text-caption text-neutral-500">
          지금 250명이 함께 읽고 있어요
        </p>

        {/* Kakao Login Button */}
        <button
          onClick={handleKakaoLogin}
          disabled={isLoading}
          className="flex w-full max-w-[320px] items-center justify-center gap-2.5 rounded-[var(--radius-md)] px-6 py-4 text-sm font-bold shadow-sm transition-shadow hover:shadow-md disabled:opacity-50 active:scale-[0.98]"
          style={{
            backgroundColor: '#FEE500',
            color: 'rgba(0,0,0,0.85)',
            transitionDuration: 'var(--transition-base)',
          }}
        >
          <KakaoIcon />
          {isLoading ? '로그인 중...' : '카카오로 시작하기'}
        </button>

        {errorMessage && (
          <p className="mt-3 text-center text-sm text-error">{errorMessage}</p>
        )}

        <p className="mt-4 text-small text-neutral-400">
          카카오 계정으로 간편하게 시작하세요
        </p>

        {/* Footer */}
        <p
          className="mt-auto pt-6 text-small text-neutral-300"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
        >
          지독해 · 경주 포항 독서모임
        </p>
      </section>
    </div>
  )
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 0.6C4.029 0.6 0 3.713 0 7.55c0 2.486 1.656 4.668 4.148 5.892l-1.058 3.87c-.094.342.299.613.593.41L7.82 14.98c.386.04.78.07 1.18.07 4.971 0 9-3.113 9-6.95S13.971.6 9 .6z"
        fill="rgba(0,0,0,0.9)"
      />
    </svg>
  )
}
