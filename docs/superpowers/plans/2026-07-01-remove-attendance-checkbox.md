# 참석 체크박스 제거 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영자가 손수 누르던 참석 체크박스를 제거하고, 참여는 "결제 완료(confirmed) + 취소 안 함 + 모임 날짜 경과"로 자동 판정되게 한다.

**Architecture:** 참석 데이터(`attended` 컬럼)는 이미 파생 가능한 정보였다. 회원 측 "참여함" 표시(`kst.ts` `getButtonState`)는 컬럼과 무관하게 status로 동작하므로 그대로 둔다. 운영자 측 참석 체크박스(`AttendanceToggle`) + 참석 API + 참석률 표시 UI만 걷어낸다. DB `attended` 컬럼은 **삭제하지 않고 보존**한다(미래 노쇼 대응 여지). 입금 확인 체크박스(`DepositToggle`)는 정산용이므로 유지.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, Supabase

**Scope note:** 이 작업은 순수 제거/정리다. 신규 로직이 없어 TDD 대신 기존 테스트(`kst.test.ts`의 `getButtonState` 'attended' 케이스)가 계속 통과하는지로 회원 측 동작 보존을 확인한다.

**결정 사항 (사용자 확정):**
- 참여 = `confirmed` + 취소 안 함 + 모임 날짜 경과
- `pending_transfer`(입금 미확인)는 참여에서 제외
- 노쇼(취소 안 하고 안 온 사람)는 참여로 카운트됨 — 현재 거의 없어 허용. 미래 대응은 별도 과제
- DB `attended` 컬럼은 보존 (코드에서만 분리)

---

## File Structure

**삭제:**
- `jidokhae-web/src/components/meetings/AttendanceToggle.tsx` — 참석 체크박스 컴포넌트
- `jidokhae-web/src/app/api/registrations/attendance/route.ts` — 참석 토글 API

**수정:**
- `jidokhae-web/src/components/meetings/AdminMeetingSection.tsx` — 참석 컬럼/토글/참석률 UI 제거
- `jidokhae-web/src/types/registration.ts` — `attended` 필드 제거
- `jidokhae-web/CLAUDE.md` — AttendanceToggle / attendance route 언급 정리
- `CLAUDE.md` (루트) — attendance route / attended 언급 정리

**손대지 않음 (의도적):**
- `jidokhae-web/src/lib/kst.ts` `getButtonState` — 'attended' 버튼 상태는 status 기반, 회원 측 유지
- `jidokhae-web/src/components/meetings/MeetingActionButton.tsx` — 위와 동일
- `jidokhae-web/src/components/admin/DepositToggle.tsx` — 정산용, 유지
- DB `attended` 컬럼 — 보존

---

### Task 1: registration 타입에서 `attended` 필드 제거

**Files:**
- Modify: `jidokhae-web/src/types/registration.ts:14`

- [ ] **Step 1: 필드 삭제**

`src/types/registration.ts`의 `Registration` 타입에서 다음 줄을 제거한다:

```typescript
  attended: boolean | null
```

제거 후 `Registration` 타입은 이렇게 된다:

```typescript
export type Registration = {
  id: string
  user_id: string
  meeting_id: string
  status: 'confirmed' | 'cancelled' | 'waitlisted' | 'waitlist_cancelled' | 'waitlist_refunded' | 'pending_transfer'
  cancel_type: 'user_cancelled' | 'meeting_deleted' | 'waitlist_user_cancelled' | 'waitlist_auto_refunded' | null
  payment_id: string | null
  paid_amount: number | null
  refunded_amount: number | null
  created_at: string
  cancelled_at: string | null
  payment_method: 'card' | 'transfer'
  is_staff_discount: boolean
}
```

> 참고: admin 상세 페이지는 `select('*')`로 조회하므로 런타임에는 `attended`가 계속 응답에 포함되지만, 타입에서 빠지면 코드가 그 값을 참조하지 못하게 되어 무해하게 무시된다.

---

### Task 2: `AdminMeetingSection.tsx`에서 참석 UI/로직 제거

**Files:**
- Modify: `jidokhae-web/src/components/meetings/AdminMeetingSection.tsx`

- [ ] **Step 1: AttendanceToggle import 제거 (line 3)**

제거:

```typescript
import AttendanceToggle from './AttendanceToggle'
```

`DepositToggle`, `RefundToggle` import는 유지한다.

- [ ] **Step 2: `showAttendance` 변수 제거 (line 41)**

제거:

```typescript
  const showAttendance = meetingDate <= getKSTToday()
```

> `getKSTToday` import는 그대로 둔다 — `getTransferCancelInfo`에서 계속 사용한다.

- [ ] **Step 3: `attendedCount` 변수 제거 (line 55)**

제거:

```typescript
  const attendedCount = confirmedRegs.filter((r) => r.status === 'confirmed' && r.attended).length
```

- [ ] **Step 4: `renderToggle`의 참석 분기 제거 (line 264-266)**

`renderToggle` 함수 안에서 다음 분기를 제거한다:

```typescript
    if (!showQueueNumber && showAttendance && reg.status === 'confirmed') {
      return <AttendanceToggle registrationId={reg.id} attended={reg.attended} />
    }
```

제거 후 `renderToggle`은 DepositToggle(입금대기/이체확정)과 RefundToggle(이체취소환불) 분기만 남고 마지막에 `return null`로 끝난다.

- [ ] **Step 5: 데스크톱 테이블 "참석" 헤더 컬럼 제거 (line 367-371)**

`renderDesktopTable`의 `<thead>`에서 제거:

```tsx
              {!showQueueNumber && showAttendance && (
                <th className="px-2 py-2.5 text-center text-xs font-bold text-primary-500">
                  참석
                </th>
              )}
```

- [ ] **Step 6: 데스크톱 테이블 "참석" 데이터 셀 제거 (line 413-424)**

`renderDesktopTable`의 `<tbody>` 각 행에서 제거:

```tsx
                {!showQueueNumber && showAttendance && (
                  <td className="px-2 py-1 text-center">
                    {reg.status === 'confirmed' ? (
                      <AttendanceToggle
                        registrationId={reg.id}
                        attended={reg.attended}
                      />
                    ) : (
                      <span className="text-primary-300">-</span>
                    )}
                  </td>
                )}
```

- [ ] **Step 7: 요약 카드의 참석률 줄 제거 (line 481-485)**

결제/환불 요약 카드 안에서 참석률 표시 블록을 제거한다:

```tsx
          {showAttendance && confirmedCount > 0 && (
            <div className="mt-2.5 pt-2.5 text-center text-xs text-primary-500" style={{ borderTop: '1px solid var(--color-surface-300)' }}>
              참석률 {Math.round((attendedCount / confirmedCount) * 100)}% ({attendedCount}/{confirmedCount}명)
            </div>
          )}
```

> 요약 카드 자체(총 결제 / 환불 / 순매출 grid)는 유지한다. 참석률 줄만 제거한다.

- [ ] **Step 8: 타입 체크로 잔여 참조 확인**

Run: `cd jidokhae-web && npx tsc --noEmit`
Expected: PASS — `attended`, `showAttendance`, `attendedCount`, `AttendanceToggle` 관련 미참조/미사용 에러가 하나도 없어야 한다. 에러가 나면 해당 위치를 위 스텝 기준으로 정리한다.

---

### Task 2.5: 모임 상세 "총 결제" 집계에서 입금 대기분 제외

**Files:**
- Modify: `jidokhae-web/src/components/meetings/AdminMeetingSection.tsx:49-50`

**배경:** `register_transfer` RPC는 계좌이체 신청 시 예상 금액을 `paid_amount`에 미리 기록한다(`migration-staff-discount-rpcs.sql:202-203`). 그래서 입금 확인 전(`pending_transfer`)에도 모임 상세 "총 결제"에 잡혀, 대시보드 매출(`dashboard.ts:44` — confirmed/cancelled만)·장소 정산(`dashboard.ts:216` — confirmed만)과 숫자가 어긋난다. 총 결제 집계에서 `pending_transfer`를 제외해 세 화면 기준을 "실제 입금 확인된 것만"으로 통일한다.

**주의:** `confirmedRegs` 필터(line 43) 자체는 건드리지 않는다 — 신청자 목록에 입금 대기자는 계속 보여야 하기 때문이다. `totalPaid` 계산에서만 제외한다.

- [ ] **Step 1: `totalPaid` 계산 수정**

기존 (line 49-50):

```typescript
  const totalPaid = confirmedRegs
    .reduce((sum, r) => sum + (r.paid_amount ?? 0), 0)
```

변경:

```typescript
  const totalPaid = confirmedRegs
    .filter((r) => r.status === 'confirmed' || r.status === 'cancelled')
    .reduce((sum, r) => sum + (r.paid_amount ?? 0), 0)
```

> `netRevenue = totalPaid - totalRefunded`는 그대로 두면 자동으로 정합된다. `totalRefunded`(line 51-53)는 이미 `status === 'cancelled'`만 세므로 수정 불필요.

- [ ] **Step 2: 타입 체크**

Run: `cd jidokhae-web && npx tsc --noEmit`
Expected: PASS

---

### Task 3: `AttendanceToggle.tsx` 파일 삭제

**Files:**
- Delete: `jidokhae-web/src/components/meetings/AttendanceToggle.tsx`

- [ ] **Step 1: 다른 참조가 없는지 확인**

Run: `cd jidokhae-web && grep -rn "AttendanceToggle" src`
Expected: 결과 없음 (Task 2에서 유일한 사용처를 제거했으므로)

- [ ] **Step 2: 파일 삭제**

```bash
git rm jidokhae-web/src/components/meetings/AttendanceToggle.tsx
```

---

### Task 4: 참석 API route 파일 삭제

**Files:**
- Delete: `jidokhae-web/src/app/api/registrations/attendance/route.ts`

- [ ] **Step 1: 다른 호출부가 없는지 확인**

Run: `cd jidokhae-web && grep -rn "registrations/attendance" src`
Expected: 결과 없음 (AttendanceToggle이 유일한 호출부였고 Task 3에서 삭제됨)

- [ ] **Step 2: 파일 삭제**

```bash
git rm jidokhae-web/src/app/api/registrations/attendance/route.ts
```

> `src/app/api/registrations/attendance/` 디렉토리가 비면 git이 자동으로 정리한다.

---

### Task 5: CLAUDE.md 문서 정리

**Files:**
- Modify: `jidokhae-web/CLAUDE.md`
- Modify: `CLAUDE.md` (루트)

- [ ] **Step 1: 나열식 참조 검색**

Run: `grep -rn "attendance\|AttendanceToggle\|참석 체크\|attended" CLAUDE.md jidokhae-web/CLAUDE.md`

- [ ] **Step 2: `jidokhae-web/CLAUDE.md`에서 AttendanceToggle 제거**

Client Components 나열 목록에서 `AttendanceToggle` 항목을 제거한다. (다른 컴포넌트 나열은 그대로 유지)

- [ ] **Step 3: 루트 `CLAUDE.md`에서 attendance 라우트/attended 언급 정리**

API routes 나열에서 `registrations/attendance (참석 확인 토글)` 항목을 제거하고, `attended boolean` 등 참석 체크 기능을 사실로 서술한 부분을 현재 동작(참여는 confirmed+모임경과로 자동 판정, `attended` 컬럼은 미사용 보존)에 맞게 정정한다.

> DB schema 설명에서 `registrations` 테이블의 `attended` 컬럼 존재 자체는 남겨두되(컬럼은 DB에 보존되므로), "참석 확인용 체크박스"가 아니라 "미사용 보존 컬럼"임을 명확히 한다.

---

### Task 6: 전체 검증 + 커밋

- [ ] **Step 1: prelaunch 전체 파이프라인 실행**

Run: `cd jidokhae-web && npm run prelaunch`
Expected: lint + tsc + test + build 모두 PASS. 특히 `kst.test.ts`의 `getButtonState` 'attended' 케이스가 계속 통과하여 회원 측 "참여함" 표시가 보존됨을 확인한다.

- [ ] **Step 2: 커밋**

> 참석 제거(Task 1~5)와 총 결제 정합(Task 2.5)은 같은 파일(`AdminMeetingSection.tsx`)을 건드리고 "모임 상세 운영자 섹션 정리"라는 한 맥락이므로 하나의 커밋으로 묶는다.

```bash
cd C:/jidokhae-2nd
git add jidokhae-web/src jidokhae-web/CLAUDE.md CLAUDE.md docs/superpowers/plans/2026-07-01-remove-attendance-checkbox.md
git commit -m "$(cat <<'EOF'
feat(admin): 참석 체크박스 제거 + 모임 상세 총결제 매출 정합

- 운영자 수동 참석 체크(AttendanceToggle) + attendance API + 참석률 표시 제거.
  참여는 confirmed+모임경과로 자동 판정. 회원 측 '참여함' 버튼은 status
  기반이라 유지. DB attended 컬럼은 미래 노쇼 대응 여지로 보존(코드에서만 분리).
- 모임 상세 '총 결제'에서 입금 대기(pending_transfer) 제외 → 대시보드 매출·
  장소 정산과 기준 통일(실제 입금 확인분만). 신청자 목록에는 입금 대기자 유지.
- 입금 확인 체크박스(DepositToggle)는 정산용으로 유지.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## 배포 메모 (실행 후)

이 변경은 CLAUDE.md 배포 전략상 **"운영자 개편"** 묶음(admin UI, 본인이 직접 검증 가능)에 해당한다. 회원 화면 영향 없음. 별도 배포 브랜치/PR로 분리할지, 소규모라 바로 반영할지는 실행 시점에 사용자와 결정한다.

## Self-Review 체크 결과

- **Spec 커버리지:** 참석 체크박스 제거(Task 2·3), 참석 API 제거(Task 4), 타입 정리(Task 1), 자동 판정 보존(손대지 않음 명시 + kst 테스트 검증), 문서 정리(Task 5), DB 컬럼 보존(명시) — 모두 태스크로 커버됨.
- **Placeholder 스캔:** 모든 코드 스텝에 실제 제거 대상 코드 블록 포함. "적절히 처리" 류 없음.
- **타입 일관성:** `attended` 제거가 타입(Task 1)과 소비처(Task 2)에서 일관. `tsc --noEmit`(Task 2 Step 8, Task 6)으로 이중 검증.
