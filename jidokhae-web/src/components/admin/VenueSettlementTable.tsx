'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatFee } from '@/lib/kst'
import type { VenueSettlementRow } from '@/lib/dashboard'

type Props = {
  rows: VenueSettlementRow[]
  month: string
}

export default function VenueSettlementTable({ rows, month }: Props) {
  const router = useRouter()
  const [settlingId, setSettlingId] = useState<string | null>(null)

  async function handleSettle(row: VenueSettlementRow) {
    setSettlingId(row.venueId)
    try {
      const res = await fetch('/api/admin/venues/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_id: row.venueId,
          month,
          total_paid: row.totalPaid,
          settlement_amount: row.settlementAmount,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.message || '정산 확정에 실패했습니다')
      } else {
        router.refresh()
      }
    } catch {
      alert('정산 확정에 실패했습니다')
    }
    setSettlingId(null)
  }

  if (rows.length === 0) return null

  return (
    <div
      className="mt-4 rounded-[var(--radius-md)] overflow-hidden"
      style={{ border: '1px solid var(--color-surface-300)' }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-surface-300)', backgroundColor: 'var(--color-surface-100)' }}>
            <th className="px-3 py-2.5 text-left text-xs font-bold text-primary-500">공간</th>
            <th className="px-3 py-2.5 text-right text-xs font-bold text-primary-500">모임</th>
            <th className="px-3 py-2.5 text-right text-xs font-bold text-primary-500">결제</th>
            <th className="px-3 py-2.5 text-right text-xs font-bold text-primary-500">정산</th>
            <th className="px-3 py-2.5 text-center text-xs font-bold text-primary-500">상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.venueId}
              style={{ borderBottom: '1px solid var(--color-surface-200)', backgroundColor: 'var(--color-surface-50)' }}
            >
              <td className="px-3 py-2.5 text-sm font-medium text-primary-800 truncate max-w-[100px]">
                {row.venueName}
              </td>
              <td className="px-3 py-2.5 text-right text-sm text-primary-500">
                {row.meetingCount}회
              </td>
              <td className="px-3 py-2.5 text-right text-sm text-primary-800">
                {formatFee(row.totalPaid)}
              </td>
              <td className="px-3 py-2.5 text-right text-sm font-medium text-primary-800">
                {formatFee(row.settlementAmount)}
                <span className="text-xs text-primary-400 ml-0.5">
                  {row.settlementType === 'percentage' ? `(${row.settlementRate}%)` : row.settlementType === 'fixed' ? '(고정)' : ''}
                </span>
              </td>
              <td className="px-3 py-2.5 text-center">
                {row.settledAt ? (
                  <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700" style={{ border: '1px solid var(--color-primary-100)' }}>
                    완료
                  </span>
                ) : (
                  <button
                    onClick={() => handleSettle(row)}
                    disabled={settlingId === row.venueId}
                    className="text-xs font-bold text-accent-600 hover:text-accent-700 disabled:text-neutral-400"
                  >
                    {settlingId === row.venueId ? '처리 중...' : '정산하기'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
