'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  nickname: string
  settings: Record<string, string>
}

export default function WelcomeScreen({ nickname, settings }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const displayName = nickname || '회원'

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
      {/* ── 상단: Dark editorial section (40%) ── */}
      <section
        className="relative flex flex-[2] flex-col justify-end px-[var(--spacing-page)] pb-14"
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
          <p
            className="text-xl font-bold text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            지독해
          </p>

          {/* Editorial rule */}
          <div className="mt-5 mb-5 h-px w-[60px] bg-neutral-600" />

          <p className="text-base text-neutral-400">
            {displayName}님,
          </p>

          <h1
            className="mt-2 text-3xl font-bold leading-tight text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="text-neutral-400">넷플릭스 말고,</span>
            <br />
            독서습관이 생깁니다.
          </h1>
        </div>
      </section>

      {/* ── 하단: Light parchment section ── */}
      {/* ── 하단: Light parchment section (60%) ── */}
      <section
        className="relative z-10 -mt-6 flex flex-[3] flex-col items-center justify-center rounded-t-[24px] px-[var(--spacing-page)] py-10"
        style={{ backgroundColor: 'var(--color-neutral-50)' }}
      >
        <p className="mb-6 text-center font-sans text-base text-neutral-500 leading-relaxed">
          매주 모이는 사람들, {settings['member_count'] ?? '250'}명.
          <br />
          {settings['active_regions_label'] ?? '경주·포항'}, 3년째.
        </p>

        <button
          onClick={handleCTA}
          disabled={loading}
          className="flex w-full max-w-[320px] items-center justify-center rounded-[var(--radius-md)] px-6 py-4 text-sm font-bold text-white shadow-sm transition-shadow hover:shadow-md disabled:opacity-50 active:scale-[0.98]"
          style={{
            backgroundColor: 'var(--color-primary-600)',
            transitionDuration: 'var(--transition-base)',
          }}
        >
          {loading ? '잠시만요...' : '이번 달 모임 보기 →'}
        </button>

        <p className="mt-4 text-small text-neutral-400">
          처음 오는 사람이 제일 많습니다.
        </p>
      </section>
    </div>
  )
}
