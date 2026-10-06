'use client'

import { useState } from 'react'
import type { SkinName } from '@/components/meetings/actionButtonSkin'

type Props = {
  bankName: string
  bankAccount: string
  bankHolder: string
  /** 'toss' = (next) 5탭 스킨. 미지정이면 구 화면 그대로 */
  skin?: SkinName
}

export default function BankInfoCard({ bankName, bankAccount, bankHolder, skin = 'legacy' }: Props) {
  const [copied, setCopied] = useState(false)
  const toss = skin === 'toss'

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(bankAccount)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: do nothing
    }
  }

  return (
    <div
      className={toss ? 'rounded-[18px] bg-tg-100 p-5' : 'rounded-[var(--radius-lg)] p-5'}
      style={
        toss
          ? undefined
          : {
              backgroundColor: 'var(--color-surface-100)',
              border: '1px solid var(--color-surface-300)',
            }
      }
    >
      <p className={toss ? 'text-sm font-bold text-tg-900 mb-4' : 'text-sm font-medium text-neutral-700 mb-4'}>
        입금 안내
      </p>

      <div className="space-y-2.5">
        <Row label="은행" value={bankName} toss={toss} />
        <Row label="계좌" value={bankAccount} toss={toss} mono />
        <Row label="예금주" value={bankHolder} toss={toss} />
      </div>

      <button
        onClick={handleCopy}
        className={
          toss
            ? 'mt-4 flex w-full items-center justify-center gap-2 rounded-[12px] bg-white py-3 text-sm font-bold text-brand-deep transition-all active:scale-[0.98]'
            : 'mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98]'
        }
        style={
          toss
            ? undefined
            : {
                backgroundColor: 'var(--color-primary-50)',
                color: 'var(--color-primary-700)',
                border: '1px solid var(--color-primary-200)',
              }
        }
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        {copied ? '복사됨!' : '계좌번호 복사'}
      </button>
    </div>
  )
}

function Row({
  label,
  value,
  toss,
  mono,
}: {
  label: string
  value: string
  toss: boolean
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`text-xs font-medium w-12 flex-shrink-0 ${toss ? 'text-tg-600' : 'text-neutral-500'}`}
      >
        {label}
      </span>
      <span
        className={`text-sm font-semibold ${toss ? 'text-tg-900' : 'text-neutral-800'} ${mono ? 'font-mono tabular-nums' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}
