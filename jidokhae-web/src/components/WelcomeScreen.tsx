'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  nickname: string
  settings: Record<string, string>
  memberCount: number | null
}

export default function WelcomeScreen({ nickname, settings, memberCount }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const count = useCountUp(memberCount)

  const displayName = nickname || '회원'
  const regionsLabel = settings['active_regions_label'] ?? '경주·포항'

  const handleCTA = async () => {
    setLoading(true)
    try {
      await fetch('/api/welcome', { method: 'POST' })
    } catch {
      // 실패 시 refresh로 재시도 가능
    }
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-[60] flex min-h-screen flex-col overflow-hidden animate-[fadeIn_300ms_ease-out_both]">
      {/* ── 상단: Dark editorial section (~62%) ── */}
      <section
        className="relative flex flex-[1.6] flex-col justify-end overflow-hidden px-[var(--spacing-page)] pb-12 text-left [word-break:keep-all]"
        style={{
          background:
            'radial-gradient(circle at 70% 20%, var(--color-primary-600), var(--color-primary-900) 68%)',
        }}
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
            className="absolute -top-8 -right-9 h-40 w-40 rounded-full"
            style={{ background: 'radial-gradient(circle, var(--color-accent-500) 0%, transparent 70%)', opacity: 0.1 }}
          />
          <div
            className="absolute top-20 -left-10 h-32 w-32 rounded-full"
            style={{ background: 'radial-gradient(circle, var(--color-primary-400) 0%, transparent 70%)', opacity: 0.12 }}
          />
        </div>

        {/* Brand content */}
        <div className="relative">
          <p
            className="text-xl font-black tracking-tight text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            지독해
          </p>

          {/* Editorial rule */}
          <div className="mt-4 mb-4 h-px w-[52px] bg-white/30" />

          <p className="text-sm text-white/50">
            {displayName}님,
          </p>

          <h1
            className="mt-1.5 text-[1.65rem] font-black leading-[1.26] tracking-tight text-white [word-break:keep-all]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="text-white/[0.46]">넷플릭스 말고,</span>
            <br />
            독서습관이 생깁니다.
          </h1>
        </div>
      </section>

      {/* ── 하단: Light section (~38%) ── */}
      <section
        className="relative z-10 -mt-[18px] flex flex-[1] flex-col items-center justify-center rounded-t-[22px] px-[var(--spacing-page)] py-8"
        style={{ backgroundColor: 'var(--color-neutral-50)' }}
      >
        <p className="mb-5 text-center font-sans text-sm text-neutral-600 leading-relaxed">
          매주 모이는 사람들
          {count !== null && (
            <>
              , <span className="font-bold tabular-nums text-primary-500">{count}</span>명
            </>
          )}
          .
          <br />
          {regionsLabel}에서 꾸준히.
        </p>

        <button
          onClick={handleCTA}
          disabled={loading}
          className="flex w-full max-w-[320px] items-center justify-center rounded-[13px] px-6 py-3.5 text-sm font-bold text-white transition-shadow hover:shadow-md disabled:opacity-50 active:scale-[0.98]"
          style={{
            backgroundColor: 'var(--color-primary-600)',
            boxShadow: '0 8px 18px -8px rgba(18, 122, 90, 0.5)',
          }}
        >
          {loading ? '잠시만요...' : '이번 달 모임 보기 →'}
        </button>

        <p className="mt-3.5 text-small text-neutral-400">
          처음 오는 사람이 제일 많습니다.
        </p>
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
