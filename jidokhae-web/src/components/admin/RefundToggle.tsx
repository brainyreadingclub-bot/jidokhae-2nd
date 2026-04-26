'use client'

import { useState } from 'react'

/**
 * 계좌이체 취소 건의 환불 완료 토글 (양방향).
 *
 * 운영자가 회원 계좌로 송금 완료한 후 체크 → refunded_amount 자동 기록
 * 실수 정정/재처리 시 체크 해제 → refunded_amount = NULL 복구
 *
 * Phase 3 M7 Step 2.6 — DepositToggle 패턴 그대로 준거.
 */

type Props = {
  registrationId: string
  isRefunded: boolean
}

export default function RefundToggle({ registrationId, isRefunded }: Props) {
  const [optimisticValue, setOptimisticValue] = useState(isRefunded)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    if (loading) return
    const newValue = !optimisticValue
    setOptimisticValue(newValue) // 즉시 UI 변경
    setLoading(true)
    try {
      const res = await fetch('/api/admin/registrations/mark-refunded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId,
          action: newValue ? 'mark' : 'unmark',
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
      aria-label={optimisticValue ? '환불 완료 취소' : '환불 완료 처리'}
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
