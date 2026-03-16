'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }>
}

export default function PaymentFailPage({ params }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState('결제가 취소되었습니다')

  useEffect(() => {
    async function handleFail() {
      const { id: meetingId } = await params
      const code = searchParams.get('code')
      const msg = searchParams.get('message')

      if (code === 'PAY_PROCESS_CANCELED' || code === 'USER_CANCEL') {
        setMessage('결제가 취소되었습니다')
      } else if (msg) {
        setMessage(decodeURIComponent(msg))
      }

      setTimeout(() => router.replace(`/meetings/${meetingId}`), 2000)
    }
    handleFail()
  }, [params, searchParams, router])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5">
      <div className="text-center">
        {/* Error icon */}
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            backgroundColor: 'rgba(196, 61, 61, 0.08)',
            border: '1px solid rgba(196, 61, 61, 0.15)',
          }}
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
            className="text-error"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <p className="text-sm font-bold text-error">{message}</p>
        <p className="mt-2 text-xs text-primary-400">
          잠시 후 모임 페이지로 이동합니다...
        </p>
      </div>
    </div>
  )
}
