'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  registrationId: string
}

export default function ConfirmTransferButton({ registrationId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading) return
    setLoading(true)

    try {
      const res = await fetch('/api/admin/registrations/confirm-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationIds: [registrationId] }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.message ?? '입금 확인 처리에 실패했습니다')
        return
      }

      router.refresh()
    } catch {
      alert('입금 확인 처리 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="bg-primary-50 text-primary-700 text-xs font-medium px-3 py-1.5 rounded-lg border border-primary-200 hover:bg-primary-100 disabled:opacity-50 transition-colors"
    >
      {loading ? '처리 중...' : '입금확인'}
    </button>
  )
}
