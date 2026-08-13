'use client'

import { useState } from 'react'
import NotificationLogTable from '@/components/admin/NotificationLogTable'
import type { NotificationLogRow } from '@/lib/notification-log'

type TabKey = 'problem' | 'recent'

type Props = {
  problemRows: NotificationLogRow[]
  recentRows: NotificationLogRow[]
}

export default function NotificationLogTabs({ problemRows, recentRows }: Props) {
  // 문제 건이 없으면 빈 탭을 먼저 보여줄 이유가 없다 — 최근 발송으로 연다.
  const [tab, setTab] = useState<TabKey>(problemRows.length > 0 ? 'problem' : 'recent')

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'problem', label: '실패 · 건너뜀', count: problemRows.length },
    { key: 'recent', label: '최근 발송', count: recentRows.length },
  ]

  return (
    <div>
      <div
        role="tablist"
        className="flex gap-1"
        style={{ borderBottom: '1px solid var(--color-surface-300)' }}
      >
        {tabs.map(({ key, label, count }) => {
          const active = tab === key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-controls={`tab-panel-${key}`}
              aria-selected={active}
              onClick={() => setTab(key)}
              className={[
                'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'text-primary-800' : 'text-neutral-500 hover:text-primary-700',
              ].join(' ')}
              style={
                active
                  ? { borderBottom: '2px solid var(--color-primary-600)', marginBottom: '-1px' }
                  : undefined
              }
            >
              {label}
              <span
                className={[
                  'rounded-full px-1.5 py-0.5 text-[11px]',
                  active ? 'text-primary-700' : 'text-neutral-500',
                ].join(' ')}
                style={{
                  backgroundColor: active
                    ? 'var(--color-primary-50)'
                    : 'var(--color-surface-200)',
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div
        id="tab-panel-problem"
        role="tabpanel"
        aria-labelledby="tab-problem"
        hidden={tab !== 'problem'}
        className="pt-4"
      >
        <p className="mb-3 text-xs text-neutral-400 break-keep">
          전체 기간에서 실패·건너뜀만 모았습니다. &lsquo;건너뜀&rsquo;은 회원에게 전화번호가 없어
          발송을 시도하지 않은 건이라 회원 프로필을 확인해야 합니다.
        </p>
        {/*
          실패 사유가 Solapi가 돌려주는 뭉뚱그린 문구라 이것만 보면 원인을 알 수 없다.
          실제 원인(수신거부·번호 오류·템플릿 불일치 등)은 Solapi 콘솔에서 확인해야 한다.
          이 사실을 화면에 적어두지 않으면 다음 사람이 같은 곳에서 또 막힌다.
        */}
        <p className="mb-3 break-keep rounded-[var(--radius-md)] bg-neutral-50 px-3 py-2 text-[11px] text-neutral-500">
          실패 사유는 Solapi가 돌려준 문구라 대부분 뭉뚱그려져 있습니다. 진짜 원인(수신 거부, 번호
          오류, 템플릿 불일치 등)은 Solapi 콘솔의 발송 내역에서 확인해야 합니다.
        </p>
        <NotificationLogTable
          rows={problemRows}
          emptyMessage="실패하거나 건너뛴 발송이 없습니다."
        />
      </div>

      <div
        id="tab-panel-recent"
        role="tabpanel"
        aria-labelledby="tab-recent"
        hidden={tab !== 'recent'}
        className="pt-4"
      >
        <NotificationLogTable rows={recentRows} emptyMessage="발송 이력이 없습니다." />
      </div>
    </div>
  )
}
