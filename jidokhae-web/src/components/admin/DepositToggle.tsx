'use client'

import { useState } from 'react'

type Props = {
  registrationId: string
  isDeposited: boolean
}

export default function DepositToggle({ registrationId, isDeposited }: Props) {
  const [optimisticValue, setOptimisticValue] = useState(isDeposited)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    if (loading) return
    const newValue = !optimisticValue
    setOptimisticValue(newValue) // 즉시 UI 변경
    setLoading(true)
    try {
      const res = await fetch('/api/admin/registrations/confirm-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationIds: [registrationId],
          action: newValue ? 'confirm' : 'unconfirm',
        }),
      })
      if (!res.ok) {
        setOptimisticValue(!newValue) // 실패 시 되돌림
      }
    } catch {
      setOptimisticValue(!newValue) // 에러 시 되돌림
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="inline-flex items-center justify-center w-[44px] h-[44px] disabled:opacity-50"
      aria-label={optimisticValue ? '입금 확인 취소' : '입금 확인'}
    >
      {optimisticValue ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="2" width="20" height="20" rx="4" fill="var(--color-accent-500)" />
          <path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="2" width="20" height="20" rx="4" stroke="var(--color-accent-300)" strokeWidth="2" fill="none" />
        </svg>
      )}
    </button>
  )
}
