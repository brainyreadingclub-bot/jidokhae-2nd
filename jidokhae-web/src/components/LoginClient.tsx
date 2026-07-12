'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Props = {
  settings: Record<string, string>
  memberCount: number | null
}

export default function LoginClient({ settings, memberCount }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [termsAgreed, setTermsAgreed] = useState(false)
  const count = useCountUp(memberCount)

  const regionsLabel = settings['active_regions_label'] ?? '경주 · 포항'

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
  }

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--color-neutral-50)' }}
    >
      {/* Organic blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-14 -right-14 h-52 w-52 rounded-full"
          style={{ backgroundColor: 'var(--color-primary-500)', opacity: 0.05 }}
        />
        <div
          className="absolute bottom-40 -left-12 h-36 w-36 rounded-full"
          style={{ backgroundColor: 'var(--color-accent-500)', opacity: 0.045 }}
        />
      </div>

      {/* ── Hero: Brand Editorial ── */}
      <section className="relative z-10 flex flex-1 flex-col justify-center px-[var(--spacing-page)] pt-12 md:px-10">
        <h1
          className="text-[2.5rem] font-black leading-none tracking-tight text-primary-500 md:text-[3rem]"
          style={{
            fontFamily: 'var(--font-display)',
            animation: 'loginFadeUp 600ms ease-out both',
          }}
        >
          지독해
        </h1>

        <p
          className="mt-3.5 text-xs text-neutral-600"
          style={{
            letterSpacing: '0.06em',
            animation: 'loginFadeUp 600ms ease-out both',
            animationDelay: '150ms',
          }}
        >
          {regionsLabel} 독서모임
        </p>

        {/* Coral editorial rule */}
        <div
          className="mt-5 mb-5 h-0.5 w-8 rounded-full bg-accent-500"
          style={{
            animation: 'loginFadeUp 600ms ease-out both',
            animationDelay: '300ms',
          }}
        />

        <p
          className="text-[1.35rem] font-bold leading-[1.45] text-neutral-900 [word-break:keep-all]"
          style={{
            fontFamily: 'var(--font-display)',
            animation: 'loginFadeUp 600ms ease-out both',
            animationDelay: '300ms',
          }}
        >
          책으로
          <br />
          연결되는
          <br />
          <span className="text-primary-500">사람들</span>
        </p>
      </section>

      {/* ── Foot: Login Action (경량 — 카드/그림자 없음) ── */}
      <section className="relative z-10 px-[var(--spacing-page)] pb-8 pt-2 md:px-10">
        {/* Social proof */}
        {count !== null && (
          <p className="mb-3.5 text-center text-xs text-neutral-600">
            지금 <span className="font-bold tabular-nums text-primary-500">{count}</span>명이 함께 읽고 있어요
          </p>
        )}

        {/* Kakao Login Button */}
        <button
          onClick={handleKakaoLogin}
          disabled={isLoading || !termsAgreed}
          className={`flex w-full items-center justify-center gap-2 rounded-[13px] px-6 py-3.5 text-sm font-bold transition-transform active:scale-[0.98] ${!termsAgreed ? 'opacity-40 cursor-not-allowed' : isLoading ? 'opacity-50' : ''}`}
          style={{
            backgroundColor: '#FEE500',
            color: 'rgba(0,0,0,0.85)',
          }}
        >
          <KakaoIcon />
          {isLoading ? '로그인 중...' : '카카오로 시작하기'}
        </button>

        {errorMessage && (
          <p className="mt-3 text-center text-sm text-error">{errorMessage}</p>
        )}

        {/* Terms Agreement */}
        <label className="mt-3.5 flex cursor-pointer items-center justify-center gap-2">
          <input
            type="checkbox"
            checked={termsAgreed}
            onChange={(e) => setTermsAgreed(e.target.checked)}
            className="h-3.5 w-3.5 rounded accent-primary-600"
          />
          <span className="text-[11px] leading-relaxed text-neutral-500">
            <a href="/policy/terms" target="_blank" className="underline">이용약관</a> 및{' '}
            <a href="/policy/privacy" target="_blank" className="underline">개인정보처리방침</a> 동의
          </span>
        </label>

        <Link
          href="/policy/meetings"
          className="mt-3 flex items-center justify-center gap-1 text-xs font-bold text-primary-500 hover:text-primary-600"
        >
          모임 일정 먼저 보기
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </section>
    </div>
  )
}

function useCountUp(target: number | null) {
  const [value, setValue] = useState<number | null>(target)
  const started = useRef(false)

  useEffect(() => {
    if (target === null || started.current) return
    started.current = true
    const start = Math.round(target * 0.6)
    const dur = 2600
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(start + (target - start) * e))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return value
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
