# 모임 신청자 수 소셜 프루프 마스킹 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모임 신청자 수가 정원의 50% 미만일 때 일반 사용자에게는 숫자를 가리고 "N명 모집 중"으로만 표시하여 적은 신청자 수가 "인기 없는 모임"처럼 보이는 social proof 역효과를 방지한다. admin/editor는 항상 정확한 숫자를 본다.

**Architecture:** View-layer 마스킹만 사용. DB/RPC는 변경 없음. `src/lib/visibility.ts`에 `shouldMaskConfirmedCount(count, capacity, isPrivileged)` 헬퍼를 도입하고, `MeetingCard`/`MeetingDetailInfo` 두 표시 컴포넌트에 `isPrivileged` prop을 추가한다. 호출자(`HomeContent`/`MeetingDetailContent`/policy 페이지 2개)에서 role 기반으로 prop을 전달한다.

**Tech Stack:** Next.js 16 Server Components, TypeScript, Tailwind v4, Vitest 4.

**작업 격리:** 별도 worktree `C:/jidokhae-2nd-social-proof` + 새 브랜치 `feat/social-proof-count-mask` (현재 hotfix 브랜치 HEAD에서 분기). 다른 세션(`C:/jidokhae-2nd-welcome`)과 디스크/브랜치 양쪽으로 분리.

---

## 영향 범위 (Files Touched)

### 신규 파일
- `jidokhae-web/src/lib/visibility.ts` — 마스킹 헬퍼 (순수 함수)
- `jidokhae-web/src/lib/__tests__/visibility.test.ts` — 단위 테스트

### 수정 파일 (총 7개)
- `jidokhae-web/src/components/meetings/MeetingCard.tsx` — `isPrivileged?` prop 추가, 마스킹 분기
- `jidokhae-web/src/components/meetings/MeetingDetailInfo.tsx` — `isPrivileged?` prop 추가, 마스킹 분기
- `jidokhae-web/src/components/meetings/MeetingsView.tsx` — `isPrivileged` prop 통과
- `jidokhae-web/src/components/home/HomeContent.tsx` — role 기반 isPrivileged 전달
- `jidokhae-web/src/components/meetings/MeetingDetailContent.tsx` — `profile.role` 기반 isPrivileged 전달
- `jidokhae-web/src/app/policy/meetings/page.tsx` — `isPrivileged={false}` 명시 전달
- `jidokhae-web/src/app/policy/meetings/[id]/page.tsx` — `isPrivileged={false}` 명시 전달

### 의도적으로 손대지 않는 영역
- 운영자 라우트 `(admin)/admin/meetings/*` — 이미 정확한 숫자 노출
- DB / RPC `get_confirmed_counts` — 서버 데이터는 그대로
- `MeetingActionButton` 등 신청 버튼 로직 — `isFull` 계산은 원본 `confirmedCount` 사용

### 0명 마스킹 동작 보존
기존 `confirmedCount === 0`일 때 `"N명 모집 중"`으로 표시되는 행동은 admin/editor에게도 그대로 유지한다. (운영자도 0명 카드의 "X/Y명" 노출이 원래 없었으므로 변경 없음.) 마스킹 헬퍼에 `count === 0 → mask` 분기 명시.

---

## Task 0: Worktree 생성 및 격리 검증

**목적:** 다른 세션(`feat/welcome-screen`)과 충돌 없이 작업할 격리된 작업 공간 확보.

- [ ] **Step 1: 새 worktree + 새 브랜치 생성 (현재 hotfix 브랜치 HEAD 기준)**

```bash
git worktree add -b feat/social-proof-count-mask ../jidokhae-2nd-social-proof HEAD
```

Expected output: `Preparing worktree (new branch 'feat/social-proof-count-mask') HEAD is now at 6eda58b ...`

- [ ] **Step 2: worktree 목록으로 격리 확인**

```bash
git worktree list
```

Expected output에 3개 worktree가 보여야 함:
```
C:/jidokhae-2nd                  6eda58b [feat/phase3-m7-step2-5-hotfix]
C:/jidokhae-2nd-welcome          XXXXXXX [feat/welcome-screen]
C:/jidokhae-2nd-social-proof     6eda58b [feat/social-proof-count-mask]
```

- [ ] **Step 3: 새 worktree로 cd 후 깨끗한 상태 확인**

```bash
cd ../jidokhae-2nd-social-proof
git status
```

Expected: `nothing to commit, working tree clean`

- [ ] **Step 4: 의존성 install (node_modules는 worktree마다 별도)**

```bash
cd jidokhae-web
npm install
```

Expected: 완료. (시간 1~2분)

- [ ] **Step 5: 베이스라인 prelaunch 통과 확인**

```bash
npm run prelaunch
```

Expected: 모든 단계 PASS (lint + tsc + test + build). 이후 작업 중 회귀 시 비교용 베이스라인.

---

## Task 1: 마스킹 헬퍼 + 단위 테스트 (TDD)

**Files:**
- Create: `jidokhae-web/src/lib/visibility.ts`
- Test: `jidokhae-web/src/lib/__tests__/visibility.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`jidokhae-web/src/lib/__tests__/visibility.test.ts`:

```ts
import { shouldMaskConfirmedCount } from '@/lib/visibility'

describe('shouldMaskConfirmedCount', () => {
  describe('일반 사용자', () => {
    it('0명은 항상 마스킹 (기존 social proof 보존)', () => {
      expect(shouldMaskConfirmedCount(0, 6, false)).toBe(true)
    })
    it('정원 절반 미만은 마스킹 (정원 6명, 신청 2명 → 마스킹)', () => {
      expect(shouldMaskConfirmedCount(2, 6, false)).toBe(true)
    })
    it('정원 절반 도달은 노출 (정원 6명, 신청 3명 → 노출)', () => {
      expect(shouldMaskConfirmedCount(3, 6, false)).toBe(false)
    })
    it('홀수 정원 ceil 임계 (정원 5명, 신청 2명 → 마스킹, 3명 → 노출)', () => {
      expect(shouldMaskConfirmedCount(2, 5, false)).toBe(true)
      expect(shouldMaskConfirmedCount(3, 5, false)).toBe(false)
    })
    it('마감 시 노출 (마감 안내가 마스킹보다 우선)', () => {
      expect(shouldMaskConfirmedCount(6, 6, false)).toBe(false)
      expect(shouldMaskConfirmedCount(3, 3, false)).toBe(false)
    })
    it('큰 정원 검증 (정원 10명, 신청 4명 → 마스킹, 5명 → 노출)', () => {
      expect(shouldMaskConfirmedCount(4, 10, false)).toBe(true)
      expect(shouldMaskConfirmedCount(5, 10, false)).toBe(false)
    })
  })

  describe('관리자/운영자 (isPrivileged=true)', () => {
    it('0명은 마스킹 (기존 행동 보존: 운영자도 0명 카드는 N명 모집 중)', () => {
      expect(shouldMaskConfirmedCount(0, 6, true)).toBe(true)
    })
    it('1명 이상은 항상 노출 (정원 비율과 무관)', () => {
      expect(shouldMaskConfirmedCount(1, 6, true)).toBe(false)
      expect(shouldMaskConfirmedCount(2, 6, true)).toBe(false)
      expect(shouldMaskConfirmedCount(3, 10, true)).toBe(false)
    })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd jidokhae-web
npx vitest run src/lib/__tests__/visibility.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/visibility'" 또는 import 에러

- [ ] **Step 3: 헬퍼 구현 (최소 구현)**

`jidokhae-web/src/lib/visibility.ts`:

```ts
/**
 * 모임 신청자 수를 일반 사용자에게 가릴지 결정한다.
 *
 * 적은 신청자 수가 "인기 없는 모임"처럼 보이는 social proof 역효과를 방지하기 위해
 * 정원 50% 미만일 때 숫자를 가리고 "N명 모집 중"으로만 표시한다.
 *
 * Why:
 * - 0명: 기존 행동 보존 (운영자 포함 모두 마스킹).
 * - 마감(count >= capacity): 마감 안내가 마스킹보다 우선 → 항상 노출.
 * - 운영자: 1명 이상이면 항상 정확한 숫자 노출.
 * - 일반 사용자 + 정원 절반 미만 + 마감 아님: 마스킹.
 *
 * 50% 임계는 ceil 기준이라 홀수 정원에서 보수적이다 (정원 5명 → 3명부터 노출).
 */
export function shouldMaskConfirmedCount(
  confirmedCount: number,
  capacity: number,
  isPrivileged: boolean,
): boolean {
  if (confirmedCount >= capacity) return false
  if (confirmedCount === 0) return true
  if (isPrivileged) return false
  return confirmedCount * 2 < capacity
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/__tests__/visibility.test.ts
```

Expected: PASS — 11개 테스트 모두 통과

- [ ] **Step 5: 커밋**

```bash
git add src/lib/visibility.ts src/lib/__tests__/visibility.test.ts
git commit -m "feat(visibility): 모임 신청자 수 마스킹 헬퍼 + 단위 테스트

정원 50% 미만일 때 social proof 역효과 방지를 위해 신청자 수를 가린다.
0명은 항상 마스킹(기존 행동 보존), 마감/운영자는 항상 노출."
```

---

## Task 2: MeetingCard 마스킹 적용

**Files:**
- Modify: `jidokhae-web/src/components/meetings/MeetingCard.tsx`

`MeetingCard`는 회원 홈 + 공개(policy) 목록 양쪽에서 사용된다. `isPrivileged?: boolean` 옵셔널 prop을 추가하여 default `false`로 두면 호출부 일부만 우선 통과시켜도 안전하다.

- [ ] **Step 1: props 타입에 `isPrivileged?` 추가**

`jidokhae-web/src/components/meetings/MeetingCard.tsx` 의 `MeetingCardProps`:

```tsx
type MeetingCardProps = {
  meeting: Meeting
  confirmedCount: number
  isRegistered: boolean
  isWaitlisted?: boolean
  isPrivileged?: boolean
  basePath?: string
}
```

함수 시그니처에도 default 추가:

```tsx
export default function MeetingCard({
  meeting,
  confirmedCount,
  isRegistered,
  isWaitlisted,
  isPrivileged = false,
  basePath = '/meetings',
}: MeetingCardProps) {
```

- [ ] **Step 2: 헬퍼 import + isMasked 계산**

파일 상단 import:

```tsx
import { shouldMaskConfirmedCount } from '@/lib/visibility'
```

`isFull` 계산 직후에 `isMasked` 추가:

```tsx
const isFull = confirmedCount >= meeting.capacity
const isMasked = shouldMaskConfirmedCount(confirmedCount, meeting.capacity, isPrivileged)
const isAlmostFull = !isFull && !isMasked && confirmedCount >= meeting.capacity * 0.8
```

`isAlmostFull`에 `!isMasked` 조건 추가 — 마스킹 중에는 80% 주황 강조도 차단해야 신청 수 추정 누설을 막는다.

- [ ] **Step 3: 표시 텍스트 분기 변경**

기존 `{confirmedCount === 0 ? ... : ...}` 분기를 `isMasked` 기반으로 교체. JSX 내 capacity 표시 블록:

```tsx
<span className={`flex items-center gap-1 ${capacityClass}`}>
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
  {isMasked
    ? <span>{meeting.capacity}명 모집 중</span>
    : <><span className="font-mono tabular-nums">{confirmedCount}/{meeting.capacity}</span>명</>
  }
</span>
```

- [ ] **Step 4: 타입체크 + 테스트 + 빌드**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: tsc PASS, 기존 테스트 + visibility 11개 모두 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/meetings/MeetingCard.tsx
git commit -m "feat(MeetingCard): 정원 50% 미만 마스킹 + 80% 강조 색상도 마스킹 중 차단

isPrivileged prop 옵셔널 추가 (default false). 마감/마스킹 우선순위는 isFull > isMasked > isAlmostFull."
```

---

## Task 3: MeetingDetailInfo 마스킹 적용

**Files:**
- Modify: `jidokhae-web/src/components/meetings/MeetingDetailInfo.tsx`

회원 모임 상세 + 공개 모임 상세 양쪽에서 사용. 동일 패턴.

- [ ] **Step 1: props 타입에 `isPrivileged?` 추가**

```tsx
type Props = {
  meeting: Meeting
  confirmedCount: number
  capacity: number
  isPrivileged?: boolean
}

export default function MeetingDetailInfo({ meeting, confirmedCount, capacity, isPrivileged = false }: Props) {
```

- [ ] **Step 2: 헬퍼 import + isMasked 계산**

```tsx
import { shouldMaskConfirmedCount } from '@/lib/visibility'
```

내부 로직:

```tsx
const isFull = confirmedCount >= capacity
const isMasked = shouldMaskConfirmedCount(confirmedCount, capacity, isPrivileged)
const isAlmostFull = !isFull && !isMasked && confirmedCount >= capacity * 0.8
```

- [ ] **Step 3: "참여" InfoRow의 value/valueClassName 분기를 isMasked 기반으로 교체**

```tsx
<InfoRow
  icon={ /* 사람 아이콘 SVG 그대로 */ }
  label="참여"
  value={isMasked ? `${capacity}명 모집 중` : `${confirmedCount}/${capacity}명`}
  valueClassName={isMasked ? capacityClass : `${capacityClass} font-mono tabular-nums`}
/>
```

- [ ] **Step 4: 타입체크**

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/meetings/MeetingDetailInfo.tsx
git commit -m "feat(MeetingDetailInfo): 정원 50% 미만 마스킹 적용 (참여 row)

isPrivileged prop 옵셔널 추가. 마스킹 중에는 80% 주황 강조도 차단."
```

---

## Task 4: MeetingsView → MeetingCard prop pass-through

**Files:**
- Modify: `jidokhae-web/src/components/meetings/MeetingsView.tsx`

`MeetingsView`는 client component이므로 위에서 받은 `isPrivileged`를 그대로 자식 카드에 흘려보낸다.

- [ ] **Step 1: Props 타입에 `isPrivileged: boolean` 추가**

```tsx
type Props = {
  meetings: Meeting[]
  countMap: Record<string, number>
  registeredSet: string[]
  waitlistedSet: string[]
  kstToday: string
  isPrivileged: boolean
}
```

함수 시그니처 destructure:

```tsx
export default function MeetingsView({
  meetings,
  countMap,
  registeredSet,
  waitlistedSet,
  kstToday,
  isPrivileged,
}: Props) {
```

- [ ] **Step 2: MeetingCard 호출부에 isPrivileged 전달**

기존 `<MeetingCard ... />` 블록에 prop 추가:

```tsx
<MeetingCard
  key={meeting.id}
  meeting={meeting}
  confirmedCount={countMap[meeting.id] ?? 0}
  isRegistered={registeredSetObj.has(meeting.id)}
  isWaitlisted={waitlistedSetObj.has(meeting.id)}
  isPrivileged={isPrivileged}
/>
```

- [ ] **Step 3: 타입체크 (호출자 HomeContent가 아직 안 보냈으니 에러 발생 OK — 다음 task에서 해결)**

```bash
npx tsc --noEmit
```

Expected: HomeContent에서 prop missing 에러. 다음 Task 5에서 해소된다. (이 시점에 잠시 type error는 허용 — 다음 커밋 직후에 통과해야 함)

- [ ] **Step 4: 커밋 보류**

이 변경은 Task 5와 단일 커밋으로 묶는다 (호출자 + 수신자가 같이 변경되어야 type 안전). Task 5 마지막 커밋에서 같이 add.

---

## Task 5: HomeContent에서 isPrivileged 계산 + 전달

**Files:**
- Modify: `jidokhae-web/src/components/home/HomeContent.tsx`

`HomeContent`는 이미 로그인 사용자에 대해 `getProfile(user.id)`를 호출하므로 role을 알 수 있다. 단, 현재 코드는 `welcomed_at`/`profile_completed_at` 분기 후에는 profile을 다시 fetch하지 않고 본문으로 흐른다 → 본문에서도 role을 알기 위해 profile fetch를 본문 진입 시점까지 끌어와야 한다.

- [ ] **Step 1: 본문 진입 직전에 role 결정 로직 추가**

기존 코드에서 user 분기 이후 `const kstToday = getKSTToday()` 직전에 다음 추가:

```tsx
const role = user ? (await getProfile(user.id)).role : null
const isPrivileged = role === 'admin' || role === 'editor'
```

(이미 위 분기에서 `getProfile(user.id)`가 호출되므로 React `cache()` 덕분에 중복 호출 비용 없음 — `src/lib/profile.ts`가 React `cache()`로 감싸져 있다는 CLAUDE.md 명시.)

- [ ] **Step 2: MeetingsView 호출부에 isPrivileged 전달**

```tsx
return (
  <div className="mt-4">
    <MeetingsView
      meetings={typedMeetings}
      countMap={countMap}
      registeredSet={registeredArr}
      waitlistedSet={waitlistedArr}
      kstToday={kstToday}
      isPrivileged={isPrivileged}
    />
  </div>
)
```

- [ ] **Step 3: 타입체크 + 테스트**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: 모두 PASS

- [ ] **Step 4: 커밋 (Task 4 + 5 묶음)**

```bash
git add src/components/meetings/MeetingsView.tsx src/components/home/HomeContent.tsx
git commit -m "feat(home): 회원 홈에서 admin/editor에게는 정확한 신청 수 노출

HomeContent에서 role 기반으로 isPrivileged를 계산해 MeetingsView를 거쳐 MeetingCard로 전달.
React cache()로 getProfile 중복 호출은 0비용."
```

---

## Task 6: MeetingDetailContent → MeetingDetailInfo pass-through

**Files:**
- Modify: `jidokhae-web/src/components/meetings/MeetingDetailContent.tsx`

`MeetingDetailContent`는 이미 `profile.role`을 가져와 `isAdmin`, `isEditorOrAdmin` 변수를 만든다 → 그대로 재활용.

- [ ] **Step 1: MeetingDetailInfo 호출부에 isPrivileged 전달**

기존 `<MeetingDetailInfo ... />` 블록을 다음으로 변경:

```tsx
<MeetingDetailInfo
  meeting={typedMeeting}
  confirmedCount={confirmedCount}
  capacity={typedMeeting.capacity}
  isPrivileged={isEditorOrAdmin}
/>
```

(`isEditorOrAdmin` 변수는 이미 line 78 부근에 존재하므로 추가 계산 불필요.)

- [ ] **Step 2: 타입체크**

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/components/meetings/MeetingDetailContent.tsx
git commit -m "feat(meeting-detail): 회원 모임 상세에서 운영자에게 정확한 신청 수 노출"
```

---

## Task 7: 공개(policy) 모임 목록에 isPrivileged=false 명시 전달

**Files:**
- Modify: `jidokhae-web/src/app/policy/meetings/page.tsx`

비로그인 공개 페이지. 명시적으로 `isPrivileged={false}` 전달.

- [ ] **Step 1: MeetingCard 호출부에 isPrivileged 전달**

기존 `<MeetingCard ... />` 블록을 다음으로 변경:

```tsx
<MeetingCard
  key={meeting.id}
  meeting={meeting}
  confirmedCount={countMap.get(meeting.id) ?? 0}
  isRegistered={false}
  isWaitlisted={false}
  isPrivileged={false}
  basePath="/policy/meetings"
/>
```

- [ ] **Step 2: 타입체크 + 빌드**

```bash
npx tsc --noEmit
npm run build
```

Expected: 모두 PASS

- [ ] **Step 3: 커밋**

```bash
git add src/app/policy/meetings/page.tsx
git commit -m "feat(policy/meetings): 비로그인 공개 목록에 isPrivileged=false 명시 전달"
```

---

## Task 8: 공개(policy) 모임 상세에 isPrivileged=false 명시 전달

**Files:**
- Modify: `jidokhae-web/src/app/policy/meetings/[id]/page.tsx`

- [ ] **Step 1: MeetingDetailInfo 호출부에 isPrivileged 전달**

```tsx
<MeetingDetailInfo
  meeting={typedMeeting}
  confirmedCount={confirmedCount}
  capacity={typedMeeting.capacity}
  isPrivileged={false}
/>
```

- [ ] **Step 2: 타입체크**

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/app/policy/meetings/\[id\]/page.tsx
git commit -m "feat(policy/meetings/detail): 비로그인 공개 상세에 isPrivileged=false 명시 전달"
```

---

## Task 9: 전체 prelaunch + 회귀 검증

**Files:** (변경 없음)

- [ ] **Step 1: prelaunch 통과 확인**

```bash
cd jidokhae-web
npm run prelaunch
```

Expected: lint + tsc + test + build 모두 PASS. 회귀 0건.

- [ ] **Step 2: visibility 단위 테스트만 단독 재확인**

```bash
npx vitest run src/lib/__tests__/visibility.test.ts
```

Expected: 11개 테스트 PASS

- [ ] **Step 3: 회원 페이지(`(main)`)는 OAuth 제약으로 로컬 검증 불가 — 사용자에게 preview 배포 검증 안내**

다음 메시지를 사용자에게 전달:

> 코드 변경 + 빌드까지 통과. 다만 `(main)` 라우트(회원 홈/회원 모임 상세)는 카카오 OAuth 콜백이 production 도메인으로만 redirect되어 로컬에서 직접 검증 불가. Vercel preview 배포로 다음을 확인 필요:
>
> 1. **회원 홈** — 정원 6명 / 신청 2명 모임이 "6명 모집 중"으로 표시되는지
> 2. **회원 홈** — 정원 6명 / 신청 3명 모임이 "3/6명"으로 표시되는지
> 3. **공개 페이지** (`/policy/meetings`) — 같은 마스킹이 비로그인 상태에서도 동작하는지
> 4. **운영자 계정으로 회원 홈 접속** — 정원 6명 / 신청 2명 모임이 "2/6명"으로 정확히 보이는지

---

## Task 10: 브랜치 push + 머지/PR 결정 안내

**Files:** (변경 없음)

- [ ] **Step 1: 브랜치 push**

```bash
git push -u origin feat/social-proof-count-mask
```

- [ ] **Step 2: 사용자에게 통합 옵션 제시**

다음 옵션 중 사용자 선택:

> **A. M7 step3-member-home 묶음에 합류** — 다른 회원 화면 변경과 함께 PR. 250명에게 한 번에 노출.
>
> **B. 독립 PR로 즉시 머지** — 작은 UX 개선이라 risk 적음. 빠른 가치 전달.
>
> **C. 핫픽스 브랜치(`feat/phase3-m7-step2-5-hotfix`)에 cherry-pick** — 핫픽스 마무리되어 머지될 때 같이 들어감. 단, 핫픽스의 의도와 다르므로 비추천.

- [ ] **Step 3: 옵션 선택 후 worktree 정리 (이번 세션 종료 시)**

선택지에 따라:
- B 옵션: PR 머지 후 `git worktree remove ../jidokhae-2nd-social-proof` + `git branch -d feat/social-proof-count-mask`
- A/C: worktree 유지 (추가 작업 가능성)

---

## 다른 세션과의 격리 보장

| 항목 | 격리 방법 |
|------|----------|
| 디스크 working tree | `C:/jidokhae-2nd-social-proof` (다른 세션 `C:/jidokhae-2nd-welcome`과 별개 폴더) |
| Git 브랜치 | `feat/social-proof-count-mask` (다른 세션 `feat/welcome-screen`과 별개) |
| 변경 파일 영역 | meetings/* + policy/meetings/* + home/* (다른 세션의 welcome/middleware/layout과 0 겹침) |
| node_modules | worktree마다 자체 install — 의존성 충돌 0 |
| DB / Supabase | DB 변경 0 — 다른 세션 DB 작업과 무관 |

**예상 머지 충돌 위험:** 0. 같은 파일을 두 세션이 만지지 않으며, 분리된 브랜치라 history도 독립적.

---

## Self-Review 체크리스트

- [x] **Spec coverage:** 사용자 결정 5항목(50% 임계, "N명 모집 중" 통일, 80% 색상 마스킹, admin+editor, policy 마스킹) 모두 task에 반영됨
- [x] **Placeholder 없음:** TBD/TODO 0건. 코드 블록 모두 실제 코드.
- [x] **Type 일관성:** `isPrivileged` 명칭 9개 파일에서 동일. `shouldMaskConfirmedCount` 시그니처 일관.
- [x] **0명 마스킹 보존:** Task 1 헬퍼에 `count === 0 → mask` 명시. 운영자 회귀 0.
- [x] **마감 우선순위:** 헬퍼 첫 줄 `count >= capacity → false` 보장.
- [x] **회귀 영역 명시:** "의도적으로 손대지 않는 영역" 섹션에 admin 라우트 / DB / 신청 버튼 로직 명시.
