'use client'

import { useState } from 'react'

type Props = {
  bankName: string
  bankAccount: string
  bankHolder: string
}

export default function BankInfoCard({ bankName, bankAccount, bankHolder }: Props) {
  const [copied, setCopied] = useState(false)

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
      className="rounded-2xl p-5"
      style={{
        backgroundColor: 'var(--color-surface-100)',
        border: '1px solid var(--color-surface-300)',
      }}
    >
      <p className="text-sm font-medium text-primary-500 mb-4">
        입금 안내
      </p>

      <div className="space-y-2.5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-primary-500/70 w-12 flex-shrink-0">은행</span>
          <span className="text-sm font-semibold text-primary-800">{bankName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-primary-500/70 w-12 flex-shrink-0">계좌</span>
          <span className="text-sm font-semibold text-primary-800 font-mono tabular-nums">{bankAccount}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-primary-500/70 w-12 flex-shrink-0">예금주</span>
          <span className="text-sm font-semibold text-primary-800">{bankHolder}</span>
        </div>
      </div>

      <button
        onClick={handleCopy}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98]"
        style={{
          backgroundColor: 'var(--color-primary-50)',
          color: 'var(--color-primary-700)',
          border: '1px solid var(--color-primary-200)',
        }}
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
