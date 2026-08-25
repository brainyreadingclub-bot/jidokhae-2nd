'use client'

import { useState } from 'react'
import type { SkinName } from '@/components/meetings/actionButtonSkin'

type Props = {
  depositorName: string
  /** 'toss' = (next) 5탭 스킨. 미지정이면 구 화면 그대로 */
  skin?: SkinName
}

export default function CopyableDepositorName({ depositorName, skin = 'legacy' }: Props) {
  const [copied, setCopied] = useState(false)
  const toss = skin === 'toss'

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(depositorName)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 클립보드 API 미지원 시 무시
    }
  }

  return (
    <div
      className={toss ? 'mt-5 rounded-[16px] bg-warnx-bg p-4' : 'mt-5 rounded-xl p-4'}
      style={
        toss
          ? undefined
          : {
              backgroundColor: 'var(--color-accent-50)',
              border: '1px solid var(--color-accent-200)',
            }
      }
    >
      <div className="flex items-start gap-2.5">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`flex-shrink-0 mt-0.5 ${toss ? 'text-warnx' : 'text-accent-500'}`}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="flex-1">
          <p className={`text-sm leading-relaxed ${toss ? 'text-tg-800' : 'text-accent-700'}`}>
            아래 입금자명을 복사해서 입금해주세요
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <span
              className={
                toss
                  ? 'flex-1 rounded-lg bg-white px-3 py-2 text-sm font-bold text-tg-900'
                  : 'flex-1 rounded-lg px-3 py-2 text-sm font-bold text-primary-900'
              }
              style={
                toss
                  ? undefined
                  : {
                      backgroundColor: 'var(--color-surface-50)',
                      border: '1px solid var(--color-surface-300)',
                    }
              }
            >
              {depositorName}
            </span>
            <button
              onClick={handleCopy}
              className={`flex-shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                toss ? (copied ? 'bg-brand-bg text-brand-deep' : 'bg-white text-tg-800') : ''
              }`}
              style={
                toss
                  ? undefined
                  : {
                      backgroundColor: copied ? 'var(--color-primary-50)' : 'var(--color-accent-100)',
                      color: copied ? 'var(--color-primary-700)' : 'var(--color-accent-700)',
                      border: `1px solid ${copied ? 'var(--color-primary-200)' : 'var(--color-accent-200)'}`,
                    }
              }
            >
              {copied ? (
                <span className="inline-flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  복사됨
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  복사
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
