'use client'

import { useMemo, useState } from 'react'
import { formatFee } from '@/lib/kst'
import type { RegionRevenueEntry } from '@/lib/settlement'

type Props = {
  entries: RegionRevenueEntry[]
  currentMonth: string // "YYYY-MM" (KST 현재 월)
}

type RegionAgg = {
  region: string
  meetings: number
  participants: number
  revenue: number
}

// "YYYY-MM" → "YYYY년 M월"
function monthLabel(month: string): string {
  const [y, m] = month.split('-')
  return `${y}년 ${parseInt(m, 10)}월`
}

// "YYYY-MM" 한 달 이동 (delta: -1 | +1)
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

function aggregate(entries: RegionRevenueEntry[]): RegionAgg[] {
  const byRegion = new Map<string, { meetingIds: Set<string>; participants: number; revenue: number }>()
  for (const e of entries) {
    const cur = byRegion.get(e.region) ?? { meetingIds: new Set<string>(), participants: 0, revenue: 0 }
    cur.meetingIds.add(e.meetingId)
    cur.participants += 1
    cur.revenue += e.paidAmount
    byRegion.set(e.region, cur)
  }
  return [...byRegion.entries()]
    .map(([region, v]) => ({ region, meetings: v.meetingIds.size, participants: v.participants, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
}

export default function RegionRevenueTable({ entries, currentMonth }: Props) {
  const [view, setView] = useState<'month' | 'all'>('month')
  const [month, setMonth] = useState(currentMonth)

  // 데이터가 존재하는 가장 이른 월 (월 네비 하한)
  const earliestMonth = useMemo(() => {
    if (entries.length === 0) return currentMonth
    return entries.reduce((min, e) => (e.month < min ? e.month : min), currentMonth)
  }, [entries, currentMonth])

  // 월 네비 상한 — 현재 월 또는 미래 예정 모임(선결제 confirmed)이 있으면 그 최신 월까지
  const latestMonth = useMemo(() => {
    return entries.reduce((max, e) => (e.month > max ? e.month : max), currentMonth)
  }, [entries, currentMonth])

  const rows = useMemo(() => {
    const filtered = view === 'all' ? entries : entries.filter((e) => e.month === month)
    return aggregate(filtered)
  }, [entries, view, month])

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          meetings: acc.meetings + r.meetings,
          participants: acc.participants + r.participants,
          revenue: acc.revenue + r.revenue,
        }),
        { meetings: 0, participants: 0, revenue: 0 },
      ),
    [rows],
  )

  const canPrev = month > earliestMonth
  const canNext = month < latestMonth

  return (
    <div>
      {/* 안내 */}
      <p className="mb-3 text-xs text-neutral-400">
        결제 완료(참석 확정) 기준 지역별 실입금 총액입니다. 취소·미입금·대기 건은 제외됩니다.
      </p>

      {/* 컨트롤: 월 네비 + 전체누적 토글 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            disabled={view === 'all' || !canPrev}
            aria-label="이전 달"
            className="flex h-8 w-8 items-center justify-center rounded-full text-primary-600 transition-colors hover:bg-primary-50 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            ‹
          </button>
          <span
            className={[
              'min-w-[92px] text-center text-sm font-bold',
              view === 'all' ? 'text-neutral-300' : 'text-primary-800',
            ].join(' ')}
          >
            {view === 'all' ? '전체 기간' : monthLabel(month)}
          </span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={view === 'all' || !canNext}
            aria-label="다음 달"
            className="flex h-8 w-8 items-center justify-center rounded-full text-primary-600 transition-colors hover:bg-primary-50 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            ›
          </button>
        </div>

        <div
          className="flex rounded-full p-0.5"
          style={{ backgroundColor: 'var(--color-surface-200)' }}
        >
          <button
            type="button"
            onClick={() => setView('month')}
            className={[
              'rounded-full px-3 py-1 text-xs font-bold transition-colors',
              view === 'month' ? 'text-primary-800' : 'text-neutral-500',
            ].join(' ')}
            style={view === 'month' ? { backgroundColor: 'var(--color-surface-50)' } : undefined}
          >
            이번 달
          </button>
          <button
            type="button"
            onClick={() => setView('all')}
            className={[
              'rounded-full px-3 py-1 text-xs font-bold transition-colors',
              view === 'all' ? 'text-primary-800' : 'text-neutral-500',
            ].join(' ')}
            style={view === 'all' ? { backgroundColor: 'var(--color-surface-50)' } : undefined}
          >
            전체 누적
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-400">
          {view === 'all' ? '집계된 매출이 없습니다.' : '이번 달 매출이 없습니다.'}
        </p>
      ) : (
        <>
          {/* 모바일 카드 */}
          <div className="md:hidden space-y-2">
            {rows.map((row) => (
              <div
                key={row.region}
                className="rounded-[var(--radius-md)] p-3"
                style={{ backgroundColor: 'var(--color-surface-50)', border: '1px solid var(--color-surface-200)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-primary-800">{row.region}</span>
                  <span className="text-sm font-bold text-primary-800">{formatFee(row.revenue)}원</span>
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  모임 {row.meetings}회 · 참여 {row.participants}명
                </div>
              </div>
            ))}
            {/* 합계 카드 */}
            <div
              className="rounded-[var(--radius-md)] p-3"
              style={{ backgroundColor: 'var(--color-primary-50)', border: '1px solid var(--color-primary-200)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-primary-800">합계</span>
                <span className="text-sm font-bold text-primary-900">{formatFee(totals.revenue)}원</span>
              </div>
              <div className="mt-1 text-xs text-primary-600">
                모임 {totals.meetings}회 · 참여 {totals.participants}명
              </div>
            </div>
          </div>

          {/* 데스크톱 테이블 */}
          <div
            className="hidden md:block rounded-[var(--radius-md)] overflow-hidden"
            style={{ border: '1px solid var(--color-surface-300)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--color-surface-300)',
                    backgroundColor: 'var(--color-surface-100)',
                  }}
                >
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-primary-500">지역</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-primary-500">모임</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-primary-500">참여</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-primary-500">매출</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.region}
                    style={{
                      borderBottom: '1px solid var(--color-surface-200)',
                      backgroundColor: 'var(--color-surface-50)',
                    }}
                  >
                    <td className="px-4 py-2.5 font-medium text-primary-800">{row.region}</td>
                    <td className="px-4 py-2.5 text-right text-neutral-600">{row.meetings}회</td>
                    <td className="px-4 py-2.5 text-right text-neutral-600">{row.participants}명</td>
                    <td className="px-4 py-2.5 text-right font-medium text-primary-800">
                      {formatFee(row.revenue)}원
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: 'var(--color-primary-50)' }}>
                  <td className="px-4 py-2.5 font-bold text-primary-800">합계</td>
                  <td className="px-4 py-2.5 text-right font-bold text-primary-700">{totals.meetings}회</td>
                  <td className="px-4 py-2.5 text-right font-bold text-primary-700">{totals.participants}명</td>
                  <td className="px-4 py-2.5 text-right font-bold text-primary-900">
                    {formatFee(totals.revenue)}원
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
