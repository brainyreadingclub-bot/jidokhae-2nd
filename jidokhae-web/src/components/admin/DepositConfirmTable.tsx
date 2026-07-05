'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatFee } from '@/lib/kst'
import { sortDepositRows, formatKSTDateTime } from '@/lib/settlement'
import type { DepositRow, DepositSort } from '@/lib/settlement'

type FailureDetail = {
  id: string
  reason: string
}

type ConfirmResponse = {
  status: 'success' | 'partial' | 'error'
  message?: string
  data?: {
    confirmed: number
    failed: number
    failedReasons: FailureDetail[]
  }
}

type BannerState = {
  confirmed: number
  failures: { nickname: string; reason: string }[]
  networkError: string | null
}

const REASON_MAP: Record<string, string> = {
  not_found: '대상 없음',
  not_pending: '이미 처리됨',
  not_active: '종료된 모임',
  capacity_full: '정원 초과',
}

function translateReason(code: string): string {
  return REASON_MAP[code] ?? code
}

// "YYYY-MM-DD" → "M/D 형식 (미팅 날짜 기반 입금자명 접두어)
function meetingDatePrefix(meetingDate: string): string {
  if (!meetingDate) return ''
  const parts = meetingDate.split('-')
  if (parts.length < 3) return ''
  const m = parseInt(parts[1], 10)
  const d = parseInt(parts[2], 10)
  if (isNaN(m) || isNaN(d)) return ''
  return `${m}/${d} `
}

type Props = {
  rows: DepositRow[]
}

export default function DepositConfirmTable({ rows }: Props) {
  const router = useRouter()
  const [sort, setSort] = useState<DepositSort>('created')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState<BannerState | null>(null)

  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  const mobileSelectAllRef = useRef<HTMLInputElement>(null)

  const sorted = sortDepositRows(rows, sort)
  const allIds = sorted.map((r) => r.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const isIndeterminate = selected.size > 0 && !allSelected

  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = isIndeterminate
  }, [isIndeterminate])

  useEffect(() => {
    if (mobileSelectAllRef.current) mobileSelectAllRef.current.indeterminate = isIndeterminate
  }, [isIndeterminate])

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allIds))
    }
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleConfirm() {
    if (selected.size === 0 || submitting) return
    setSubmitting(true)
    setBanner(null)

    const ids = Array.from(selected)
    try {
      const res = await fetch('/api/admin/registrations/confirm-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationIds: ids, action: 'confirm' }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: undefined })) as { message?: string }
        setBanner({ confirmed: 0, failures: [], networkError: body.message || '요청에 실패했습니다' })
        setSubmitting(false)
        return
      }

      const body = (await res.json()) as ConfirmResponse

      const failures: { nickname: string; reason: string }[] = []
      if (body.data?.failedReasons) {
        const rowMap = new Map(rows.map((r) => [r.id, r]))
        for (const f of body.data.failedReasons) {
          const row = rowMap.get(f.id)
          failures.push({
            nickname: row?.nickname ?? f.id,
            reason: translateReason(f.reason),
          })
        }
      }

      setBanner({
        confirmed: body.data?.confirmed ?? 0,
        failures,
        networkError: null,
      })
      setSelected(new Set())
      router.refresh()
    } catch {
      setBanner({ confirmed: 0, failures: [], networkError: '네트워크 오류' })
    }
    setSubmitting(false)
  }

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-neutral-400">
        입금 확인 대기 중인 건이 없습니다.
      </p>
    )
  }

  return (
    <div>
      {/* 툴바 */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">
            {selected.size > 0 ? `${selected.size}건 선택됨` : `총 ${rows.length}건`}
          </span>
          {/* 모바일 전체 선택 (md 이상에서는 테이블 헤더 체크박스 사용) */}
          <label className="md:hidden flex items-center gap-1.5 cursor-pointer select-none">
            <input
              ref={mobileSelectAllRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="전체 선택"
              className="w-5 h-5 accent-[var(--color-primary-600)] cursor-pointer"
            />
            <span className="text-xs text-neutral-500">전체 선택</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="deposit-sort" className="text-xs text-neutral-400 sr-only">
            정렬
          </label>
          <select
            id="deposit-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as DepositSort)}
            className="text-xs rounded-md px-2 py-1.5 text-primary-700 bg-surface-50"
            style={{ border: '1px solid var(--color-surface-300)' }}
          >
            <option value="created">신청 시각 순</option>
            <option value="meeting">모임별</option>
            <option value="amount">금액순</option>
          </select>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0 || submitting}
            className="text-xs font-bold px-3 py-1.5 rounded-md bg-primary-600 text-white disabled:opacity-40 hover:bg-primary-700 transition-colors"
          >
            {submitting ? '처리 중…' : '입금 확인'}
          </button>
        </div>
      </div>

      {/* 결과 배너 */}
      {banner && (
        <div
          className="mb-3 rounded-md px-3 py-2.5 text-sm"
          style={{
            backgroundColor: banner.networkError || banner.failures.length > 0
              ? 'var(--color-accent-50)'
              : 'var(--color-primary-50)',
            border: `1px solid ${banner.networkError || banner.failures.length > 0 ? 'var(--color-accent-200)' : 'var(--color-primary-200)'}`,
          }}
        >
          {banner.networkError ? (
            <span className="text-accent-700">{banner.networkError}</span>
          ) : (
            <span>
              <span className="font-medium text-primary-800">✅ {banner.confirmed}건 확인</span>
              {banner.failures.length > 0 && (
                <>
                  <span className="text-neutral-400"> · </span>
                  <span className="font-medium text-accent-700">{banner.failures.length}건 실패</span>
                  <ul className="mt-1 space-y-0.5">
                    {banner.failures.map((f, i) => (
                      <li key={i} className="text-xs text-accent-600">
                        {f.nickname} ({f.reason})
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </span>
          )}
        </div>
      )}

      {/* 모바일 카드 목록 */}
      <div className="md:hidden space-y-2">
        {sorted.map((row) => {
          const isChecked = selected.has(row.id)
          const prefix = meetingDatePrefix(row.meetingDate)
          const depositName = `${prefix}${row.nickname}`
          return (
            <div
              key={row.id}
              className="rounded-[var(--radius-md)] p-3"
              style={{
                backgroundColor: isChecked ? 'var(--color-primary-50)' : 'var(--color-surface-50)',
                border: '1px solid var(--color-surface-200)',
              }}
            >
              {/* Row 1: 체크박스 + 입금자명 + 금액 */}
              <div className="flex items-center gap-3">
                <label className="flex items-center cursor-pointer p-1 -m-1">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleRow(row.id)}
                    aria-label={`${depositName} 선택`}
                    className="w-5 h-5 accent-[var(--color-primary-600)] cursor-pointer"
                  />
                </label>
                <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                  <span className="text-sm font-medium text-primary-800 truncate">
                    {depositName}
                  </span>
                  <span className="text-sm text-primary-800 whitespace-nowrap shrink-0">
                    {row.isStaffDiscount ? (
                      <span>
                        <span className="text-accent-600 font-bold">{formatFee(row.paidAmount)}원</span>
                        <span
                          className="ml-1 text-[10px] font-bold text-accent-600 rounded px-1 py-0.5"
                          style={{ backgroundColor: 'var(--color-accent-50)', border: '1px solid var(--color-accent-200)' }}
                        >
                          스텝½
                        </span>
                      </span>
                    ) : (
                      <span>{formatFee(row.paidAmount)}원</span>
                    )}
                  </span>
                </div>
              </div>
              {/* Row 2: 신청 시각 + 경과 */}
              <div className="mt-1.5 flex items-center gap-2 text-xs text-neutral-500">
                <span>{formatKSTDateTime(row.createdAt)}</span>
                <span className="text-neutral-300">·</span>
                <span>
                  {row.elapsedDays}일
                  {row.elapsedDays > 30 && (
                    <span
                      className="ml-0.5"
                      title="30일 초과 미입금"
                      aria-label="30일 초과 미입금"
                    >
                      ⏳
                    </span>
                  )}
                </span>
              </div>
              {/* Row 3: 모임 + 연락처 */}
              <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                <span className="text-primary-600 truncate">{row.meetingTitle}</span>
                <span className="text-neutral-400 shrink-0">{row.phone ?? '-'}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* 데스크톱 테이블 */}
      <div
        className="hidden md:block rounded-[var(--radius-md)] overflow-x-auto"
        style={{ border: '1px solid var(--color-surface-300)' }}
      >
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--color-surface-300)',
                backgroundColor: 'var(--color-surface-100)',
              }}
            >
              <th className="px-3 py-2.5 text-left">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                  className="w-4 h-4 accent-[var(--color-primary-600)] cursor-pointer"
                />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-primary-500">입금자명</th>
              <th className="px-3 py-2.5 text-right text-xs font-bold text-primary-500">금액</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-primary-500">신청 시각</th>
              <th className="px-3 py-2.5 text-right text-xs font-bold text-primary-500">경과</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-primary-500">모임</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-primary-500">연락처</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const isChecked = selected.has(row.id)
              const prefix = meetingDatePrefix(row.meetingDate)
              const depositName = `${prefix}${row.nickname}`
              return (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: '1px solid var(--color-surface-200)',
                    backgroundColor: isChecked
                      ? 'var(--color-primary-50)'
                      : 'var(--color-surface-50)',
                  }}
                >
                  {/* 체크박스 */}
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleRow(row.id)}
                      aria-label={`${depositName} 선택`}
                      className="w-4 h-4 accent-[var(--color-primary-600)] cursor-pointer"
                    />
                  </td>
                  {/* 입금자명 */}
                  <td className="px-3 py-2.5 font-medium text-primary-800 whitespace-nowrap">
                    {depositName}
                  </td>
                  {/* 금액 */}
                  <td className="px-3 py-2.5 text-right text-primary-800 whitespace-nowrap">
                    {row.isStaffDiscount ? (
                      <span>
                        <span className="text-accent-600 font-bold">{formatFee(row.paidAmount)}원</span>
                        <span
                          className="ml-1 text-[10px] font-bold text-accent-600 rounded px-1 py-0.5"
                          style={{ backgroundColor: 'var(--color-accent-50)', border: '1px solid var(--color-accent-200)' }}
                        >
                          스텝½
                        </span>
                      </span>
                    ) : (
                      <span>{formatFee(row.paidAmount)}원</span>
                    )}
                  </td>
                  {/* 신청 시각 */}
                  <td className="px-3 py-2.5 text-neutral-600 whitespace-nowrap">
                    {formatKSTDateTime(row.createdAt)}
                  </td>
                  {/* 경과 */}
                  <td className="px-3 py-2.5 text-right text-neutral-600 whitespace-nowrap">
                    {row.elapsedDays}일
                    {row.elapsedDays > 30 && (
                      <span
                        className="ml-1"
                        title="30일 초과 미입금"
                        aria-label="30일 초과 미입금"
                      >
                        ⏳
                      </span>
                    )}
                  </td>
                  {/* 모임 */}
                  <td className="px-3 py-2.5 text-primary-700 max-w-[160px] truncate">
                    {row.meetingTitle}
                  </td>
                  {/* 연락처 */}
                  <td className="px-3 py-2.5 text-neutral-500">
                    {row.phone ?? '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
