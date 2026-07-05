# 입금/환불 통합 관리 화면 (정산) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전체 계좌이체 입금 확인 대기 건과 환불 대기 건을 `/admin/settlements` 한 화면(탭 2개)에 모아, 은행 명세서와 대조하며 일괄 입금 확인 / 개별 환불 완료 처리한다.

**Architecture:** 서버 컴포넌트 `page.tsx`가 admin 권한 재검증 + 두 탭 데이터를 병렬 페치(`src/lib/settlement.ts`)해 클라이언트 탭 컴포넌트에 넘긴다. 입금 확인 탭은 다중 선택 → 기존 배치 API(`confirm-transfer`) 호출 + 부분 실패 배너. 환불 대기 탭은 기존 `RefundToggle`(mark-refunded API)을 행별로 재사용. 쓰기 API는 전부 기존 것 재사용 — 신규 백엔드는 조회 헬퍼뿐.

**Tech Stack:** Next.js 16 App Router (서버 컴포넌트 기본), React 19, TypeScript, Tailwind v4, Supabase(service_role admin client), Vitest.

**설계 근거 문서:** `docs/superpowers/specs/2026-07-04-deposit-refund-settlement-design.md`

---

## 착수 전 필수 확인 (구현 시작 전 1회)

**계좌이체 대기자 승격 경로 검증 (설계서 §4 교차 확인 항목).** `promote_next_waitlisted` RPC가 계좌이체 대기자를 승격할 때 `confirmed`로 바꾸는지 `pending_transfer`로 바꾸는지 확인한다. 만약 바로 `confirmed`면 미입금인데 확정 처리되는 버그 → 이 경우 본 화면 범위와 별개로 **먼저 사용자에게 보고**하고 이 플랜을 잠시 멈춘다.

- [ ] **Step 0: 승격 경로 grep 확인**

Run: `grep -rn "promote_next_waitlisted" jidokhae-web/supabase/`
확인: 승격 시 status가 `pending_transfer`로 남는지(계좌이체 대기자는 승격 후 입금 안내 필요) 또는 별도 처리가 있는지. 결과가 애매하면 사용자에게 질문. 명백히 정상이면 다음 태스크 진행.

---

## File Structure

**신규 생성:**
- `jidokhae-web/src/lib/settlement.ts` — 두 탭 데이터 조회 + 순수 가공 헬퍼(경과일, KST 시각 포맷, 정렬). 조회는 service_role admin client.
- `jidokhae-web/src/lib/__tests__/settlement.test.ts` — 순수 헬퍼 단위 테스트(경과일 계산, 시각 포맷, 정렬).
- `jidokhae-web/src/components/admin/SettlementTabs.tsx` — 탭 전환 (client).
- `jidokhae-web/src/components/admin/DepositConfirmTable.tsx` — 입금 확인 탭 (client, 다중 선택 + 배치 호출 + 부분 실패 배너).
- `jidokhae-web/src/components/admin/RefundWaitingTable.tsx` — 환불 대기 탭 (client, RefundToggle 재사용).

**수정:**
- `jidokhae-web/src/app/(admin)/admin/settlements/page.tsx` — PlaceholderPage 대체, 서버 컴포넌트로 재작성.
- `jidokhae-web/src/components/admin/AdminDashboardHub.tsx` — 입금/환불 알림 링크를 `/admin/settlements`로 변경.

**재사용(수정 없음):** `RefundToggle`, `calculateRefund`(refund.ts), `confirm-transfer` API, `mark-refunded` API, `kst.ts`.

---

## Task 1: settlement.ts 순수 헬퍼 (TDD)

**Files:**
- Create: `jidokhae-web/src/lib/settlement.ts`
- Test: `jidokhae-web/src/lib/__tests__/settlement.test.ts`

먼저 순수 함수 3개만 구현한다: 경과일 계산, 타임스탬프→KST 시각 문자열, 입금 확인 행 정렬. DB 조회 헬퍼는 Task 2에서 같은 파일에 추가한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`jidokhae-web/src/lib/__tests__/settlement.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  elapsedDaysKST,
  formatKSTDateTime,
  sortDepositRows,
  type DepositRow,
} from '@/lib/settlement'

describe('elapsedDaysKST', () => {
  it('같은 날 신청이면 0일', () => {
    expect(elapsedDaysKST('2026-07-04T01:00:00Z', '2026-07-04')).toBe(0)
  })
  it('3일 전 신청이면 3일', () => {
    // 2026-07-01 10:00 KST 신청, 오늘 2026-07-04
    expect(elapsedDaysKST('2026-07-01T01:00:00Z', '2026-07-04')).toBe(3)
  })
  it('KST 자정 경계: UTC 15:00(=KST 익일 0시) 신청은 그 날짜 기준', () => {
    // 2026-07-03T15:30:00Z = 2026-07-04 00:30 KST → 오늘과 같은 날 → 0
    expect(elapsedDaysKST('2026-07-03T15:30:00Z', '2026-07-04')).toBe(0)
  })
})

describe('formatKSTDateTime', () => {
  it('UTC를 KST 날짜+시각으로 포맷', () => {
    // 2026-05-12T06:24:00Z = 2026-05-12 15:24 KST
    expect(formatKSTDateTime('2026-05-12T06:24:00Z')).toBe('5/12 오후 3:24')
  })
  it('오전 시각', () => {
    // 2026-05-08T00:10:00Z = 2026-05-08 09:10 KST
    expect(formatKSTDateTime('2026-05-08T00:10:00Z')).toBe('5/8 오전 9:10')
  })
})

describe('sortDepositRows', () => {
  const rows: DepositRow[] = [
    { id: 'a', createdAt: '2026-05-12T07:01:00Z', paidAmount: 5000, meetingTitle: '경주 5월', meetingDate: '2026-05-17', nickname: '파란달', phone: null, elapsedDays: 1, isStaffDiscount: true },
    { id: 'b', createdAt: '2026-05-12T06:24:00Z', paidAmount: 10000, meetingTitle: '경주 5월', meetingDate: '2026-05-17', nickname: '초록고래', phone: null, elapsedDays: 1, isStaffDiscount: false },
    { id: 'c', createdAt: '2026-05-08T00:10:00Z', paidAmount: 12000, meetingTitle: '포항 5월', meetingDate: '2026-05-20', nickname: '노을', phone: null, elapsedDays: 5, isStaffDiscount: false },
  ]
  it('created: 오래된→최신', () => {
    expect(sortDepositRows(rows, 'created').map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })
  it('amount: 큰 금액 먼저', () => {
    expect(sortDepositRows(rows, 'amount').map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })
  it('meeting: 모임 날짜순 그다음 신청순', () => {
    expect(sortDepositRows(rows, 'meeting').map((r) => r.id)).toEqual(['b', 'a', 'c'])
  })
  it('원본 배열을 변형하지 않음', () => {
    const before = rows.map((r) => r.id)
    sortDepositRows(rows, 'amount')
    expect(rows.map((r) => r.id)).toEqual(before)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd jidokhae-web && npx vitest run src/lib/__tests__/settlement.test.ts`
Expected: FAIL — `@/lib/settlement` 모듈 없음.

- [ ] **Step 3: 순수 헬퍼 구현**

`jidokhae-web/src/lib/settlement.ts`:

```typescript
import { getDaysUntil, toKSTDate } from '@/lib/kst'

export type DepositRow = {
  id: string
  createdAt: string
  paidAmount: number
  meetingTitle: string
  meetingDate: string
  nickname: string
  phone: string | null
  elapsedDays: number
  isStaffDiscount: boolean
}

export type DepositSort = 'created' | 'amount' | 'meeting'

// 신청 시각(UTC ISO) → 오늘(KST YYYY-MM-DD) 기준 경과 일수
export function elapsedDaysKST(createdAtUTC: string, kstToday: string): number {
  const createdKSTDate = toKSTDate(new Date(createdAtUTC))
  return getDaysUntil(kstToday, createdKSTDate)
}

// UTC ISO → "M/D 오전/오후 h:mm" (KST)
export function formatKSTDateTime(utcISO: string): string {
  const kstMs = new Date(utcISO).getTime() + 9 * 60 * 60 * 1000
  const d = new Date(kstMs)
  const month = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  const hour24 = d.getUTCHours()
  const minute = d.getUTCMinutes()
  const isPM = hour24 >= 12
  const meridiem = isPM ? '오후' : '오전'
  let hour12 = hour24 % 12
  if (hour12 === 0) hour12 = 12
  const mm = minute.toString().padStart(2, '0')
  return `${month}/${day} ${meridiem} ${hour12}:${mm}`
}

export function sortDepositRows(rows: DepositRow[], sort: DepositSort): DepositRow[] {
  const copy = [...rows]
  if (sort === 'amount') {
    copy.sort((a, b) => b.paidAmount - a.paidAmount)
  } else if (sort === 'meeting') {
    copy.sort((a, b) => {
      if (a.meetingDate !== b.meetingDate) return a.meetingDate < b.meetingDate ? -1 : 1
      return a.createdAt < b.createdAt ? -1 : 1
    })
  } else {
    // created: 오래된 → 최신
    copy.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  }
  return copy
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd jidokhae-web && npx vitest run src/lib/__tests__/settlement.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: 커밋**

```bash
git add jidokhae-web/src/lib/settlement.ts jidokhae-web/src/lib/__tests__/settlement.test.ts
git commit -m "feat(settlement): 정산 화면 순수 헬퍼(경과일/KST시각/정렬) + 단위 테스트"
```

---

## Task 2: settlement.ts 데이터 조회 헬퍼

**Files:**
- Modify: `jidokhae-web/src/lib/settlement.ts`

두 탭 데이터를 admin(service_role) client로 조회하는 함수를 추가한다. 조회는 순수 함수가 아니라 단위 테스트 대상이 아님 — Task 1의 순수 헬퍼로 가공만 위임한다.

- [ ] **Step 1: 조회 헬퍼 추가**

`jidokhae-web/src/lib/settlement.ts` 상단 import 및 하단에 추가:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import { getKSTToday } from '@/lib/kst'
```

파일 하단에 타입 + 함수 추가:

```typescript
export type RefundRow = {
  id: string
  cancelledAt: string | null
  refundAmount: number
  meetingTitle: string | null
  nickname: string
  phone: string | null
}

type RegRow = {
  id: string
  created_at: string
  cancelled_at: string | null
  paid_amount: number | null
  is_staff_discount: boolean
  profiles: { nickname: string | null; phone: string | null } | null
  meetings: { title: string | null; date: string | null } | null
}

// 탭 A: pending_transfer 전체 (모임/프로필 join)
export async function getPendingDeposits(
  supabase: SupabaseClient,
): Promise<DepositRow[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, created_at, paid_amount, is_staff_discount, profiles(nickname, phone), meetings(title, date)')
    .eq('status', 'pending_transfer')
    .order('created_at', { ascending: true })

  if (error) throw error
  const kstToday = getKSTToday()

  return ((data ?? []) as unknown as RegRow[]).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    paidAmount: r.paid_amount ?? 0,
    meetingTitle: r.meetings?.title ?? '삭제된 모임',
    meetingDate: r.meetings?.date ?? '',
    nickname: r.profiles?.nickname ?? '(알수없음)',
    phone: r.profiles?.phone ?? null,
    elapsedDays: elapsedDaysKST(r.created_at, kstToday),
    isStaffDiscount: r.is_staff_discount,
  }))
}

// 탭 B: 환불 대기 (계좌이체 취소 + 미환불 + 실입금)
export async function getPendingRefunds(
  supabase: SupabaseClient,
): Promise<RefundRow[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, cancelled_at, paid_amount, is_staff_discount, profiles(nickname, phone), meetings(title, date)')
    .eq('status', 'cancelled')
    .eq('payment_method', 'transfer')
    .is('refunded_amount', null)
    .gt('paid_amount', 0)
    .order('cancelled_at', { ascending: true })

  if (error) throw error

  return ((data ?? []) as unknown as RegRow[]).map((r) => {
    // 환불액은 실제 처리 시 mark-refunded 라우트가 calculateRefund로 재계산.
    // 여기서는 표시용으로 paid_amount를 그대로 보여준다(규칙 라벨은 UI에서).
    return {
      id: r.id,
      cancelledAt: r.cancelled_at,
      refundAmount: r.paid_amount ?? 0,
      meetingTitle: r.meetings?.title ?? null,
      nickname: r.profiles?.nickname ?? '(알수없음)',
      phone: r.profiles?.phone ?? null,
    }
  })
}
```

> **주의:** 환불액을 표시용으로 `paid_amount` 원금으로 두는 이유 — 실제 환불 처리는 `mark-refunded`가 `calculateRefund(meeting.date, paid_amount, cancelled_at)`로 서버에서 재계산한다. 취소 시점 대비 모임 날짜로 비율이 갈리지만, 환불 대기 탭에 뜨는 계좌이체 취소 건은 대부분 100%(모임 삭제 or 3일+ 전 취소)라 원금 표시가 실무상 오해를 최소화한다. 정확한 규칙 라벨이 필요하면 후속 개선.

- [ ] **Step 2: 타입 체크**

Run: `cd jidokhae-web && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add jidokhae-web/src/lib/settlement.ts
git commit -m "feat(settlement): 입금 대기/환불 대기 조회 헬퍼 추가"
```

---

## Task 3: 입금 확인 탭 컴포넌트

**Files:**
- Create: `jidokhae-web/src/components/admin/DepositConfirmTable.tsx`

- [ ] **Step 1: 컴포넌트 작성**

`jidokhae-web/src/components/admin/DepositConfirmTable.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatFee } from '@/lib/kst'
import { formatKSTDateTime, sortDepositRows, type DepositRow, type DepositSort } from '@/lib/settlement'

export default function DepositConfirmTable({ rows }: { rows: DepositRow[] }) {
  const router = useRouter()
  const [sort, setSort] = useState<DepositSort>('created')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState<{ confirmed: number; failed: number; reasons: string[] } | null>(null)

  const sorted = sortDepositRows(rows, sort)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === sorted.length) setSelected(new Set())
    else setSelected(new Set(sorted.map((r) => r.id)))
  }

  async function confirmSelected() {
    if (selected.size === 0 || submitting) return
    setSubmitting(true)
    setBanner(null)
    try {
      const res = await fetch('/api/admin/registrations/confirm-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationIds: Array.from(selected), action: 'confirm' }),
      })
      const json = await res.json()
      if (!res.ok) {
        setBanner({ confirmed: 0, failed: selected.size, reasons: [json.message ?? '요청 실패'] })
        return
      }
      const d = json.data ?? {}
      setBanner({
        confirmed: d.confirmed ?? 0,
        failed: d.failed ?? 0,
        reasons: d.failedReasons ?? [],
      })
      setSelected(new Set())
      router.refresh()
    } catch {
      setBanner({ confirmed: 0, failed: selected.size, reasons: ['네트워크 오류'] })
    } finally {
      setSubmitting(false)
    }
  }

  if (rows.length === 0) {
    return <p className="py-12 text-center text-neutral-500">입금 확인 대기 중인 건이 없습니다.</p>
  }

  return (
    <div>
      {banner && (
        <div className="mb-3 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-sm">
          ✅ <b>{banner.confirmed}건 확인</b>
          {banner.failed > 0 && (
            <>
              {' · '}
              <b className="text-accent-600">{banner.failed}건 실패</b>
              {banner.reasons.length > 0 && ` — ${banner.reasons.join(', ')}`}
            </>
          )}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <label className="text-sm text-neutral-600">
          정렬{' '}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as DepositSort)}
            className="rounded border border-neutral-300 px-2 py-1"
          >
            <option value="created">신청 시각 순 (오래된→최신)</option>
            <option value="meeting">모임별</option>
            <option value="amount">금액순</option>
          </select>
        </label>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500">{selected.size}건 선택됨</span>
          <button
            onClick={confirmSelected}
            disabled={selected.size === 0 || submitting}
            className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {submitting ? '처리 중…' : '선택 입금 확인'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={sorted.length > 0 && selected.size === sorted.length}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                />
              </th>
              <th className="px-2 py-2">입금자명 (은행표시)</th>
              <th className="px-2 py-2">금액</th>
              <th className="px-2 py-2">신청 시각</th>
              <th className="px-2 py-2">경과</th>
              <th className="px-2 py-2">모임</th>
              <th className="px-2 py-2">연락처</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const mmdd = r.meetingDate ? `${Number(r.meetingDate.slice(5, 7))}/${Number(r.meetingDate.slice(8, 10))}` : ''
              const isSel = selected.has(r.id)
              return (
                <tr key={r.id} className={`border-b border-neutral-100 ${isSel ? 'bg-primary-50' : ''}`}>
                  <td className="px-2 py-2.5">
                    <input type="checkbox" checked={isSel} onChange={() => toggle(r.id)} aria-label={`${r.nickname} 선택`} />
                  </td>
                  <td className="px-2 py-2.5 font-semibold">
                    {mmdd} {r.nickname}
                  </td>
                  <td className="px-2 py-2.5">
                    {r.isStaffDiscount ? (
                      <span className="text-accent-600">
                        <b>{formatFee(r.paidAmount)}</b> <span className="text-xs">스텝½</span>
                      </span>
                    ) : (
                      formatFee(r.paidAmount)
                    )}
                  </td>
                  <td className="px-2 py-2.5">{formatKSTDateTime(r.createdAt)}</td>
                  <td className="px-2 py-2.5 text-neutral-500">
                    {r.elapsedDays}일
                    {r.elapsedDays > 30 && (
                      <span className="ml-1" title="30일 초과 미입금" aria-label="30일 초과 미입금">
                        ⏳
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-neutral-600">{r.meetingTitle}</td>
                  <td className="px-2 py-2.5 text-neutral-600">{r.phone ?? '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 타입 체크**

Run: `cd jidokhae-web && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add jidokhae-web/src/components/admin/DepositConfirmTable.tsx
git commit -m "feat(settlement): 입금 확인 탭 (다중 선택 + 배치 확인 + 부분 실패 배너)"
```

---

## Task 4: 환불 대기 탭 컴포넌트

**Files:**
- Create: `jidokhae-web/src/components/admin/RefundWaitingTable.tsx`

기존 `RefundToggle`(props: `{ registrationId, isRefunded }`)을 행별로 재사용한다. 이 탭에 뜨는 건은 전부 미환불이므로 `isRefunded={false}`.

- [ ] **Step 1: 컴포넌트 작성**

`jidokhae-web/src/components/admin/RefundWaitingTable.tsx`:

```typescript
import { formatFee } from '@/lib/kst'
import { formatKSTDateTime, type RefundRow } from '@/lib/settlement'
import RefundToggle from '@/components/admin/RefundToggle'

export default function RefundWaitingTable({ rows }: { rows: RefundRow[] }) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-neutral-500">환불 대기 중인 건이 없습니다.</p>
  }

  return (
    <div>
      <div className="mb-3 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-neutral-700">
        💡 환불은 직접 송금합니다. 회원 계좌를 저장하지 않으므로 <b>연락처로 계좌를 받아</b> 보낸 뒤 &ldquo;환불 완료&rdquo;를 체크하세요.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-2 py-2">닉네임</th>
              <th className="px-2 py-2">환불액</th>
              <th className="px-2 py-2">취소 시각</th>
              <th className="px-2 py-2">모임</th>
              <th className="px-2 py-2">연락처</th>
              <th className="px-2 py-2">환불 완료</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-neutral-100">
                <td className="px-2 py-2.5 font-semibold">{r.nickname}</td>
                <td className="px-2 py-2.5">{formatFee(r.refundAmount)}</td>
                <td className="px-2 py-2.5">{r.cancelledAt ? formatKSTDateTime(r.cancelledAt) : '-'}</td>
                <td className="px-2 py-2.5 text-neutral-600">
                  {r.meetingTitle ?? <span className="text-neutral-400">삭제된 모임</span>}
                </td>
                <td className="px-2 py-2.5 text-neutral-600">{r.phone ?? '-'}</td>
                <td className="px-2 py-2.5">
                  <RefundToggle registrationId={r.id} isRefunded={false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

> **RefundToggle 재확인:** props 시그니처가 `{ registrationId: string; isRefunded: boolean }`인지 구현 전 `RefundToggle.tsx`를 read해서 맞춘다. 다르면 실제 시그니처에 맞춰 호출부 수정.

- [ ] **Step 2: 타입 체크**

Run: `cd jidokhae-web && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add jidokhae-web/src/components/admin/RefundWaitingTable.tsx
git commit -m "feat(settlement): 환불 대기 탭 (RefundToggle 재사용)"
```

---

## Task 5: 탭 전환 컴포넌트

**Files:**
- Create: `jidokhae-web/src/components/admin/SettlementTabs.tsx`

- [ ] **Step 1: 컴포넌트 작성**

`jidokhae-web/src/components/admin/SettlementTabs.tsx`:

```typescript
'use client'

import { useState } from 'react'
import DepositConfirmTable from '@/components/admin/DepositConfirmTable'
import RefundWaitingTable from '@/components/admin/RefundWaitingTable'
import type { DepositRow, RefundRow } from '@/lib/settlement'

export default function SettlementTabs({
  deposits,
  refunds,
}: {
  deposits: DepositRow[]
  refunds: RefundRow[]
}) {
  const [tab, setTab] = useState<'deposit' | 'refund'>('deposit')

  return (
    <div>
      <div className="mb-4 flex gap-2 border-b-2 border-neutral-200">
        <button
          onClick={() => setTab('deposit')}
          className={`px-4 py-2 text-sm font-semibold ${
            tab === 'deposit' ? 'border-b-[3px] border-primary-500 text-primary-600' : 'text-neutral-500'
          }`}
        >
          입금 확인 대기{' '}
          <span className="ml-1 rounded-full bg-accent-500 px-2 py-0.5 text-xs text-white">{deposits.length}</span>
        </button>
        <button
          onClick={() => setTab('refund')}
          className={`px-4 py-2 text-sm font-semibold ${
            tab === 'refund' ? 'border-b-[3px] border-primary-500 text-primary-600' : 'text-neutral-500'
          }`}
        >
          환불 대기{' '}
          <span className="ml-1 rounded-full bg-neutral-400 px-2 py-0.5 text-xs text-white">{refunds.length}</span>
        </button>
      </div>

      {tab === 'deposit' ? <DepositConfirmTable rows={deposits} /> : <RefundWaitingTable rows={refunds} />}
    </div>
  )
}
```

- [ ] **Step 2: 타입 체크**

Run: `cd jidokhae-web && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add jidokhae-web/src/components/admin/SettlementTabs.tsx
git commit -m "feat(settlement): 입금/환불 탭 전환 컴포넌트"
```

---

## Task 6: 페이지 재작성 (placeholder 대체)

**Files:**
- Modify: `jidokhae-web/src/app/(admin)/admin/settlements/page.tsx`

admin 전용(editor 접근 차단) 이중 방어 — 레이아웃은 admin/editor를 통과시키므로 페이지에서 role을 다시 확인해 editor를 막는다. phone 노출 화면이라 필수.

- [ ] **Step 1: 기존 파일 read**

Run: 페이지 현재 내용을 확인(PlaceholderPage 사용 구조).
`getProfile()` / admin client import 경로를 기존 admin 페이지(`admin/members/page.tsx` 등)에서 확인해 동일 패턴으로 맞춘다.

- [ ] **Step 2: 페이지 작성**

`jidokhae-web/src/app/(admin)/admin/settlements/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/profile'
import { getUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPendingDeposits, getPendingRefunds } from '@/lib/settlement'
import SettlementTabs from '@/components/admin/SettlementTabs'

export default async function SettlementsPage() {
  const user = await getUser()
  if (!user) redirect('/auth/login')
  const profile = await getProfile(user.id)
  // admin 전용 (editor 차단) — phone/정산 개인정보
  if (profile?.role !== 'admin') redirect('/admin')

  const supabase = createAdminClient()
  const [deposits, refunds] = await Promise.all([
    getPendingDeposits(supabase),
    getPendingRefunds(supabase),
  ])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-1 font-serif text-2xl font-bold text-neutral-800">입금 · 환불 관리</h1>
      <p className="mb-5 text-sm text-neutral-500">
        은행 명세서를 옆에 두고 대조하며 일괄 입금 확인 · 환불 완료를 처리하세요.
      </p>
      <SettlementTabs deposits={deposits} refunds={refunds} />
    </div>
  )
}
```

> **import 경로 검증:** `getUser`(`@/lib/auth`), `getProfile`(`@/lib/profile`), `createAdminClient`(`@/lib/supabase/admin`)의 실제 export 이름을 기존 admin 페이지에서 확인 후 맞춘다. `createAdminClient` 이름이 다르면(예: `createClient`) 실제 이름으로 교체.

- [ ] **Step 3: prelaunch 전체 검증**

Run: `cd jidokhae-web && npm run prelaunch`
Expected: lint + tsc + test + build 전부 통과. (PlaceholderPage import가 사라져 unused 경고 없는지 확인.)

- [ ] **Step 4: 커밋**

```bash
git add jidokhae-web/src/app/\(admin\)/admin/settlements/page.tsx
git commit -m "feat(settlement): /admin/settlements 정산 화면 구현 (placeholder 대체, admin 전용)"
```

---

## Task 7: 대시보드 링크 연동

**Files:**
- Modify: `jidokhae-web/src/components/admin/AdminDashboardHub.tsx`

대시보드의 "입금 확인 대기 N건" 링크를 `/admin/settlements`로 바꾼다.

- [ ] **Step 1: 현재 링크 확인**

Run: `grep -n "pendingTransfer\|입금 확인\|환불 대기\|/admin/meetings" jidokhae-web/src/components/admin/AdminDashboardHub.tsx`
확인: 입금/환불 알림 블록이 현재 어디로 링크되는지.

- [ ] **Step 2: 링크 수정**

입금 확인 대기 알림의 `href`를 `/admin/settlements`로 변경. 환불 대기 알림이 있으면 동일하게 `/admin/settlements`로. (탭 딥링크는 이번 범위 밖 — 화면 진입 후 탭 전환.)

정확한 old_string은 Step 1 결과로 확정하되, 예시 형태:

```typescript
// Before
href="/admin/meetings"
// After
href="/admin/settlements"
```

- [ ] **Step 3: 타입 체크 + 커밋**

Run: `cd jidokhae-web && npx tsc --noEmit`
Expected: 에러 없음.

```bash
git add jidokhae-web/src/components/admin/AdminDashboardHub.tsx
git commit -m "feat(settlement): 대시보드 입금/환불 알림 링크를 정산 화면으로 연결"
```

---

## Task 8: 최종 검증 + 수동 확인 체크리스트

- [ ] **Step 1: prelaunch 재실행**

Run: `cd jidokhae-web && npm run prelaunch`
Expected: 전부 통과.

- [ ] **Step 2: 수동 확인 체크리스트 (Vercel preview에서 — UI 변경이므로 Option A)**

설계서 §8 기반. preview 배포 후 admin 계정으로 확인:

- [ ] 입금 확인 탭: pending_transfer 전체가 뜨는지, 입금자명 `M/D 닉네임` 형식(모임 날짜 기준)인지
- [ ] 스텝 할인 건 금액에 `스텝½` 배지 + accent 색, paid_amount가 반값인지
- [ ] 정렬 3종(신청순/모임별/금액순) 동작
- [ ] 다중 선택 → "선택 입금 확인" → 성공 시 목록에서 사라지고 배너 표시, `router.refresh()` 반영
- [ ] 부분 실패(capacity_full 등) 시 배너에 실패 건수/사유 노출
- [ ] 경과일: 30일 초과 건에만 ⏳ 아이콘 1개, 색 강조 없음
- [ ] 환불 대기 탭: 계좌이체 취소 미환불 건만, 삭제된 모임 건도 "삭제된 모임"으로 렌더
- [ ] 환불 완료 토글(RefundToggle) 동작 → 목록 반영
- [ ] editor 계정으로 `/admin/settlements` 접근 시 `/admin`으로 리다이렉트(phone 노출 차단)
- [ ] 빈 상태(0건) 각 탭 empty state 문구
- [ ] 대시보드 입금/환불 알림 클릭 → `/admin/settlements` 진입

- [ ] **Step 3: 이상 없으면 최종 커밋 (있으면 수정 후)**

수동 확인에서 발견된 이슈만 개별 커밋. 이상 없으면 이 태스크는 커밋 없이 종료.

---

## Self-Review 결과 (작성자 확인 완료)

- **스펙 커버리지:** 설계서 §3(탭 2개/컬럼), §4(범위·엣지), §6(대시보드 연동), §7(파일), §8(엣지 체크리스트) → Task 1~8에 매핑됨. 경과일 30일 아이콘 1개(§8 확정)는 Task 3 Step 1에 반영.
- **플레이스홀더:** 없음 — 모든 코드 스텝에 실제 코드 포함. import 경로/RefundToggle props/대시보드 old_string 3곳은 "구현 전 read 확인" 명시(코드베이스 확인 필요 지점).
- **타입 일관성:** `DepositRow`/`RefundRow`/`DepositSort` Task 1 정의 → Task 3·4·5에서 동일 이름 사용. `getPendingDeposits`/`getPendingRefunds` Task 2 정의 → Task 6 사용. `confirm-transfer` 응답 `data.confirmed/failed/failedReasons`는 기존 라우트 반환 형태와 일치.
- **주의점(구현자):** ① Task 0 승격 경로 선확인 필수 ② import export 이름은 기존 admin 페이지 기준으로 맞출 것 ③ RefundToggle props 실제 시그니처 확인.
