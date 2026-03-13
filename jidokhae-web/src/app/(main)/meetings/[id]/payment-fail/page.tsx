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
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="text-center">
        <p className="text-sm font-medium text-error">{message}</p>
        <p className="mt-2 text-xs text-gray-400">
          잠시 후 모임 페이지로 이동합니다...
        </p>
      </div>
    </div>
  )
}
