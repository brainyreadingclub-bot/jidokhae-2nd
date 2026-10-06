'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { SkinName } from '@/components/meetings/actionButtonSkin'

type Props = {
  detailHref: string
  skin?: SkinName
}

const DEFAULT_MESSAGE = '결제가 취소되었습니다'

/** PG가 넘긴 message는 인코딩이 깨져 있을 수 있다 — 실패하면 기본 문구 */
function decodeMessage(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export default function PaymentFailClient({ detailHref, skin = 'legacy' }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toss = skin === 'toss'

  // 쿼리에서 바로 읽는다 — state로 옮기면 effect 안 setState가 되어 렌더가 한 번 더 돈다
  const code = searchParams.get('code')
  const raw = searchParams.get('message')
  const message =
    code === 'PAY_PROCESS_CANCELED' || code === 'USER_CANCEL' || !raw
      ? DEFAULT_MESSAGE
      : decodeMessage(raw)

  useEffect(() => {
    const timer = setTimeout(() => router.replace(detailHref), 5000)
    return () => clearTimeout(timer)
  }, [detailHref, router])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5">
      <div className="text-center">
        {/* Error icon */}
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
            toss ? 'bg-warnx-bg' : ''
          }`}
          style={
            toss
              ? undefined
              : {
                  backgroundColor: 'rgba(196, 61, 61, 0.08)',
                  border: '1px solid rgba(196, 61, 61, 0.15)',
                }
          }
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={toss ? 'text-warnx' : 'text-error'}
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <p className={`text-sm font-bold ${toss ? 'text-warnx' : 'text-error'}`}>{message}</p>
        <p className={`mt-2 text-xs ${toss ? 'text-tg-600' : 'text-primary-400'}`}>
          5초 후 자동으로 이동합니다
        </p>
        <button
          onClick={() => router.replace(detailHref)}
          className={
            toss
              ? 'mt-4 min-h-[48px] rounded-[14px] bg-tg-100 px-5 text-sm font-bold text-tg-700'
              : 'mt-4 rounded-[var(--radius-md)] px-5 py-2.5 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50'
          }
          style={toss ? undefined : { border: '1px solid var(--color-surface-300)' }}
        >
          모임으로 돌아가기
        </button>
      </div>
    </div>
  )
}
