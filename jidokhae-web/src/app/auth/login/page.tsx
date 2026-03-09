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
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      {/* Branding */}
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold text-primary-600">지독해</h1>
        <p className="mt-2 text-sm text-gray-500">경주/포항 독서모임</p>
      </div>

      {/* Kakao Login Button */}
      <button
        onClick={handleKakaoLogin}
        disabled={isLoading}
        className="flex w-full max-w-xs items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold transition-opacity disabled:opacity-50"
        style={{ backgroundColor: '#FEE500', color: 'rgba(0,0,0,0.85)' }}
      >
        <KakaoIcon />
        {isLoading ? '로그인 중...' : '카카오로 시작하기'}
      </button>

      {errorMessage && (
        <p className="mt-4 text-center text-sm text-error">{errorMessage}</p>
      )}

      <p className="mt-6 text-center text-xs text-gray-400">
        카카오 계정으로 간편하게 시작하세요
      </p>
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
