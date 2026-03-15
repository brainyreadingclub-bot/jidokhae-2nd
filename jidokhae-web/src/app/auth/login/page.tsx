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
    <div className="relative flex min-h-screen flex-col items-center justify-between px-8 py-12 overflow-hidden" style={{ backgroundColor: 'var(--color-primary-700)' }}>
      {/* Background decoration — layered circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full opacity-[0.06]" style={{ backgroundColor: 'var(--color-accent-400)' }} />
        <div className="absolute top-1/4 -left-24 w-56 h-56 rounded-full opacity-[0.04]" style={{ backgroundColor: 'var(--color-primary-300)' }} />
        <div className="absolute bottom-32 -right-16 w-44 h-44 rounded-full opacity-[0.05]" style={{ backgroundColor: 'var(--color-accent-300)' }} />
      </div>

      {/* Top spacer */}
      <div />

      {/* Branding */}
      <div className="relative text-center">
        {/* Book icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <path d="M8 7h8" />
            <path d="M8 11h6" />
          </svg>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-white">
          지독해
        </h1>
        <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--color-primary-200)' }}>
          경주 · 포항 독서모임
        </p>

        {/* Tagline */}
        <div className="mt-8 mx-auto max-w-[240px]">
          <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            책으로 연결되는 우리의 시간,<br />
            함께 읽고 나누는 즐거움
          </p>
        </div>
      </div>

      {/* Bottom section */}
      <div className="relative w-full max-w-xs space-y-4">
        {/* Kakao Login Button */}
        <button
          onClick={handleKakaoLogin}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-sm font-bold transition-all disabled:opacity-50 active:scale-[0.98]"
          style={{ backgroundColor: '#FEE500', color: 'rgba(0,0,0,0.85)' }}
        >
          <KakaoIcon />
          {isLoading ? '로그인 중...' : '카카오로 시작하기'}
        </button>

        {errorMessage && (
          <p className="text-center text-sm" style={{ color: '#F7B87A' }}>{errorMessage}</p>
        )}

        <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          카카오 계정으로 간편하게 시작하세요
        </p>
      </div>
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
