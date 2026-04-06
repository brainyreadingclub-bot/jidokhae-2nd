'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  registrationId: string
  paidAmount: number
}

export default function MarkRefundedButton({ registrationId, paidAmount }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading) return
    setLoading(true)

    try {
      const res = await fetch('/api/admin/registrations/mark-refunded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId, refundedAmount: paidAmount }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? '환불 완료 처리에 실패했습니다')
        return
      }

      router.refresh()
    } catch {
      alert('환불 완료 처리 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="bg-accent-50 text-accent-700 text-xs font-medium px-3 py-1.5 rounded-lg border border-accent-200 hover:bg-accent-100 disabled:opacity-50 transition-colors"
    >
      {loading ? '처리 중...' : '환불완료'}
    </button>
  )
}
