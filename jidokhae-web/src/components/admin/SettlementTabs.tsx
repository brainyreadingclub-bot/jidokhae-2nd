'use client'

import { useState } from 'react'
import DepositConfirmTable from '@/components/admin/DepositConfirmTable'
import RefundWaitingTable from '@/components/admin/RefundWaitingTable'
import type { DepositRow, RefundRow } from '@/lib/settlement'

type Props = {
  deposits: DepositRow[]
  refunds: RefundRow[]
  excludedDeposits: DepositRow[]
}

export default function SettlementTabs({ deposits, refunds, excludedDeposits }: Props) {
  const [tab, setTab] = useState<'deposit' | 'refund'>('deposit')

  return (
    <div>
      {/* 탭 바 */}
      <div
        role="tablist"
        className="flex gap-1"
        style={{ borderBottom: '1px solid var(--color-surface-300)' }}
      >
        <button
          type="button"
          role="tab"
          id="tab-deposit"
          aria-controls="tab-panel-deposit"
          aria-selected={tab === 'deposit'}
          onClick={() => setTab('deposit')}
          className={[
            'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors',
            tab === 'deposit'
              ? 'text-primary-800'
              : 'text-neutral-500 hover:text-primary-700',
          ].join(' ')}
          style={
            tab === 'deposit'
              ? { borderBottom: '2px solid var(--color-primary-600)', marginBottom: '-1px' }
              : undefined
          }
        >
          입금 확인 대기
          <span
            className={[
              'text-[11px] rounded-full px-1.5 py-0.5',
              tab === 'deposit' ? 'text-primary-700' : 'text-neutral-500',
            ].join(' ')}
            style={{
              backgroundColor:
                tab === 'deposit'
                  ? 'var(--color-primary-50)'
                  : 'var(--color-surface-200)',
            }}
          >
            {deposits.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-refund"
          aria-controls="tab-panel-refund"
          aria-selected={tab === 'refund'}
          onClick={() => setTab('refund')}
          className={[
            'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors',
            tab === 'refund'
              ? 'text-primary-800'
              : 'text-neutral-500 hover:text-primary-700',
          ].join(' ')}
          style={
            tab === 'refund'
              ? { borderBottom: '2px solid var(--color-primary-600)', marginBottom: '-1px' }
              : undefined
          }
        >
          환불 대기
          <span
            className={[
              'text-[11px] rounded-full px-1.5 py-0.5',
              tab === 'refund' ? 'text-primary-700' : 'text-neutral-500',
            ].join(' ')}
            style={{
              backgroundColor:
                tab === 'refund'
                  ? 'var(--color-primary-50)'
                  : 'var(--color-surface-200)',
            }}
          >
            {refunds.length}
          </span>
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      <div
        role="tabpanel"
        id={tab === 'deposit' ? 'tab-panel-deposit' : 'tab-panel-refund'}
        aria-labelledby={tab === 'deposit' ? 'tab-deposit' : 'tab-refund'}
        className="mt-4"
      >
        {tab === 'deposit' && <DepositConfirmTable rows={deposits} excludedRows={excludedDeposits} />}
        {tab === 'refund' && <RefundWaitingTable rows={refunds} />}
      </div>
    </div>
  )
}
