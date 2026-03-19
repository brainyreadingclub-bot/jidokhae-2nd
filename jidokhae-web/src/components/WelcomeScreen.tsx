'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function WelcomeScreen({ nickname }: { nickname: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const displayName = nickname || '회원'

  const handleCTA = async () => {
    setLoading(true)
    try {
      await fetch('/api/welcome', { method: 'POST' })
    } catch {
      // 실패해도 메인으로 이동 — 진입을 막지 않음
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-8 animate-[fadeIn_0.4s_ease-out]"
      style={{
        backgroundColor: 'var(--color-neutral-50)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* 로고 */}
      <p className="font-display text-lg text-primary-700 mb-10">
        지독해
      </p>

      {/* 인사 + 헤드카피 */}
      <div className="text-center">
        <p className="font-sans text-base text-neutral-500 mb-3">
          {displayName}님,
        </p>
        <h1 className="font-display text-[1.75rem] font-bold text-primary-900 leading-tight">
          넷플릭스 말고,
          <br />
          할 게 생깁니다.
        </h1>
      </div>

      {/* 본문 */}
      <div className="mt-6 text-center">
        <p className="font-sans text-base text-neutral-500 leading-relaxed">
          매주 모이는 사람들, 250명.
          <br />
          경주·포항, 3년째.
        </p>
      </div>

      {/* CTA + 보조 텍스트 */}
      <div className="mt-10 w-full max-w-xs">
        <button
          onClick={handleCTA}
          disabled={loading}
          className="w-full py-3.5 bg-primary-600 text-white font-semibold rounded-[12px] transition-colors hover:bg-primary-700 active:bg-primary-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? '잠시만요...' : '이번 달 모임 보기 →'}
        </button>
        <p className="mt-3 text-center text-[0.8125rem] text-neutral-400">
          처음 오는 사람이 제일 많습니다.
        </p>
      </div>
    </div>
  )
}
