# 마이페이지 프로필 보기/수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/my` 화면 상단에 "내 정보" 섹션을 추가해 회원이 닉네임(1회)·전화·지역·이메일을 셀프 수정하고, 실명은 읽기전용으로 표시한다.

**Architecture:** 순수 검증 로직(`resolveProfileUpdate`)을 lib에 분리해 단위 테스트로 보호하고, 그 위에 API 라우트(`/api/profile/update`)와 클라이언트 편집 컴포넌트(`ProfileEditor`)를 올린다. 닉네임 "변경"은 제출값이 현재 값과 실제로 다를 때만 1회를 소비한다. 지역 선택 UI(`RegionPicker`)는 `ProfileSetup`에서 공용 파일로 추출해 재사용한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (service_role API route), Vitest, Tailwind v4.

**배포 주의:** 회원 화면 변경(250명 노출) → CLAUDE.md 전략상 가장 신중한 묶음. 별도 feature 브랜치 + Vercel Preview 검증 후 PR. 로컬은 Kakao OAuth 때문에 `(main)` 페이지 직접 검증 불가 → tsc/build/test로 게이트하고 시각 검증은 Preview.

**스펙 근거:** `docs/superpowers/specs/2026-06-28-mypage-profile-design.md`

---

## File Structure

**생성:**
- `jidokhae-web/supabase/migration-mypage-profile.sql` — `profiles.nickname_changed_at` 컬럼 추가 SQL (수동 실행)
- `jidokhae-web/supabase/migration-mypage-profile-rollback.sql` — 롤백 SQL
- `jidokhae-web/src/lib/profile-update.ts` — 순수 검증/병합 헬퍼 `resolveProfileUpdate`
- `jidokhae-web/src/lib/__tests__/profile-update.test.ts` — 단위 테스트
- `jidokhae-web/src/components/RegionPicker.tsx` — `ProfileSetup`에서 추출한 공용 지역 선택 컴포넌트
- `jidokhae-web/src/app/api/profile/update/route.ts` — 부분 수정 API
- `jidokhae-web/src/components/my/ProfileEditor.tsx` — 보기↔편집 토글 클라이언트 컴포넌트
- `jidokhae-web/src/components/my/ProfileSection.tsx` — 프로필 데이터 fetch + ProfileEditor 렌더 (서버)
- `jidokhae-web/src/components/skeletons/ProfileSkeleton.tsx` — 프로필 섹션 로딩 스켈레톤

**수정:**
- `jidokhae-web/src/components/ProfileSetup.tsx` — 로컬 `RegionPicker` 제거, 공용 파일 import
- `jidokhae-web/src/lib/profile.ts` — `getProfile()` select에 `nickname_changed_at` 추가
- `jidokhae-web/src/app/(main)/my/page.tsx` — ProfileSection을 신청 목록 위에 배치

---

## Task 0: 작업 브랜치 생성

**Files:** (없음 — git 작업)

- [ ] **Step 1: main 최신화 + feature 브랜치 생성**

Run:
```bash
cd C:/jidokhae-2nd
git checkout main
git pull origin main
git checkout -b feat/mypage-profile
```
Expected: `Switched to a new branch 'feat/mypage-profile'`

---

## Task 1: DB 마이그레이션 SQL 작성

기존 회원 전원 `nickname_changed_at = NULL`(= 아직 변경 안 함 = 1회 기회). `welcomed_at`/`profile_completed_at`과 동일한 `ADD COLUMN IF NOT EXISTS` 패턴.

**Files:**
- Create: `jidokhae-web/supabase/migration-mypage-profile.sql`
- Create: `jidokhae-web/supabase/migration-mypage-profile-rollback.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

`jidokhae-web/supabase/migration-mypage-profile.sql`:
```sql
-- ============================================================
-- 마이페이지 프로필 수정 — 닉네임 1회 변경 추적
-- Supabase SQL Editor에서 아래 1줄을 수동 실행할 것
-- 기존 회원 전원 nickname_changed_at = NULL (= 아직 변경 안 함 = 1회 기회)
-- 가입 시 최초 입력은 "변경"이 아니므로 별도 UPDATE 불필요
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname_changed_at TIMESTAMPTZ DEFAULT NULL;
```

- [ ] **Step 2: 롤백 SQL 작성**

`jidokhae-web/supabase/migration-mypage-profile-rollback.sql`:
```sql
-- 롤백: nickname_changed_at 컬럼 제거
ALTER TABLE public.profiles DROP COLUMN IF EXISTS nickname_changed_at;
```

- [ ] **Step 3: Commit**

```bash
cd C:/jidokhae-2nd
git add jidokhae-web/supabase/migration-mypage-profile.sql jidokhae-web/supabase/migration-mypage-profile-rollback.sql
git commit -m "feat(mypage): nickname_changed_at 컬럼 마이그레이션 SQL"
```

> **수동 실행 안내:** 이 SQL은 코드 머지 전 prod Supabase SQL Editor에서 실행해야 한다(컬럼이 없으면 API/getProfile이 깨짐). 단무지님께 실행 요청은 Task 8 배포 단계에서 안내. Preview도 prod Supabase에 연결되므로 Preview 검증 전 실행 필요.

---

## Task 2: 순수 검증 헬퍼 `resolveProfileUpdate` (TDD)

제출 입력 + 현재 프로필 + 입금대기 여부를 받아, 검증 결과와 DB에 반영할 변경분(`updates`), 닉네임 실제 변경 여부(`nicknameChanged`)를 반환하는 순수 함수. **닉네임은 제출값이 현재 값과 다를 때만 변경으로 취급한다.**

**Files:**
- Create: `jidokhae-web/src/lib/profile-update.ts`
- Test: `jidokhae-web/src/lib/__tests__/profile-update.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`jidokhae-web/src/lib/__tests__/profile-update.test.ts`:
```ts
import { resolveProfileUpdate } from '@/lib/profile-update'

const current = {
  nickname: '초록고래',
  phone: '01012345678',
  region: ['경주', '포항'],
  email: 'hong@example.com',
  nickname_changed_at: null,
}

describe('resolveProfileUpdate', () => {
  it('닉네임이 현재와 같으면 변경으로 치지 않는다 (1회 소비 안 함)', () => {
    const r = resolveProfileUpdate({ nickname: '초록고래' }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: true, updates: {}, nicknameChanged: false })
  })

  it('닉네임이 실제로 바뀌면 변경으로 처리한다', () => {
    const r = resolveProfileUpdate({ nickname: '파란고래' }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: true, updates: { nickname: '파란고래' }, nicknameChanged: true })
  })

  it('이미 1회 변경한 회원은 닉네임 변경이 막힌다', () => {
    const changed = { ...current, nickname_changed_at: '2026-06-01T00:00:00Z' }
    const r = resolveProfileUpdate({ nickname: '파란고래' }, changed, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: false, message: '닉네임은 1회만 변경할 수 있어요' })
  })

  it('입금 대기 중이면 닉네임 변경이 막힌다', () => {
    const r = resolveProfileUpdate({ nickname: '파란고래' }, current, { hasPendingTransfer: true })
    expect(r).toEqual({ ok: false, message: '입금 확인이 끝난 뒤 닉네임을 변경할 수 있어요' })
  })

  it('닉네임 길이가 2자 미만이면 막힌다', () => {
    const r = resolveProfileUpdate({ nickname: '왕' }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: false, message: '닉네임은 2~20자로 입력해주세요' })
  })

  it('전화번호 형식이 틀리면 막힌다', () => {
    const r = resolveProfileUpdate({ phone: '0212345678' }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: false, message: '010으로 시작하는 휴대폰 번호를 입력해주세요' })
  })

  it('전화번호의 하이픈은 제거되어 저장된다', () => {
    const r = resolveProfileUpdate({ phone: '010-9999-8888' }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: true, updates: { phone: '01099998888' }, nicknameChanged: false })
  })

  it('지역이 비어 있으면 막힌다', () => {
    const r = resolveProfileUpdate({ region: [] }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: false, message: '지역을 하나 이상 선택해주세요' })
  })

  it('유효하지 않은 지역이면 막힌다', () => {
    const r = resolveProfileUpdate({ region: ['도쿄'] }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: false, message: '지역을 하나 이상 선택해주세요' })
  })

  it('이메일을 빈 값으로 보내면 null로 저장된다', () => {
    const r = resolveProfileUpdate({ email: '  ' }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: true, updates: { email: null }, nicknameChanged: false })
  })

  it('잘못된 이메일이면 막힌다', () => {
    const r = resolveProfileUpdate({ email: 'not-an-email' }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: false, message: '올바른 이메일을 입력해주세요' })
  })

  it('여러 필드를 동시에 부분 수정한다 (닉네임 미변경)', () => {
    const r = resolveProfileUpdate(
      { nickname: '초록고래', phone: '010-1111-2222', region: ['울산'] },
      current,
      { hasPendingTransfer: false },
    )
    expect(r).toEqual({
      ok: true,
      updates: { phone: '01011112222', region: ['울산'] },
      nicknameChanged: false,
    })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:/jidokhae-2nd/jidokhae-web && npx vitest run src/lib/__tests__/profile-update.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/profile-update"` (파일 없음)

- [ ] **Step 3: 헬퍼 구현**

`jidokhae-web/src/lib/profile-update.ts`:
```ts
import { VALID_REGIONS } from '@/lib/regions'

export type ProfileUpdateInput = {
  nickname?: string
  phone?: string
  region?: string[]
  email?: string | null
}

export type CurrentProfile = {
  nickname: string
  nickname_changed_at: string | null
}

export type ResolveResult =
  | { ok: false; message: string }
  | { ok: true; updates: Record<string, unknown>; nicknameChanged: boolean }

export function resolveProfileUpdate(
  input: ProfileUpdateInput,
  current: CurrentProfile,
  opts: { hasPendingTransfer: boolean },
): ResolveResult {
  const updates: Record<string, unknown> = {}

  if (input.phone !== undefined) {
    const digits = input.phone.replace(/\D/g, '')
    if (!/^010\d{7,8}$/.test(digits)) {
      return { ok: false, message: '010으로 시작하는 휴대폰 번호를 입력해주세요' }
    }
    updates.phone = digits
  }

  if (input.region !== undefined) {
    if (
      !Array.isArray(input.region) ||
      input.region.length === 0 ||
      !input.region.every((r) => (VALID_REGIONS as readonly string[]).includes(r))
    ) {
      return { ok: false, message: '지역을 하나 이상 선택해주세요' }
    }
    updates.region = input.region
  }

  if (input.email !== undefined) {
    const email = (input.email ?? '').trim() || null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: '올바른 이메일을 입력해주세요' }
    }
    updates.email = email
  }

  let nicknameChanged = false
  if (input.nickname !== undefined) {
    const trimmed = input.nickname.trim()
    // 현재 닉네임과 실제로 다를 때만 변경으로 취급 → 1회 기회 보호
    if (trimmed !== current.nickname) {
      if (trimmed.length < 2 || trimmed.length > 20) {
        return { ok: false, message: '닉네임은 2~20자로 입력해주세요' }
      }
      if (current.nickname_changed_at !== null) {
        return { ok: false, message: '닉네임은 1회만 변경할 수 있어요' }
      }
      if (opts.hasPendingTransfer) {
        return { ok: false, message: '입금 확인이 끝난 뒤 닉네임을 변경할 수 있어요' }
      }
      updates.nickname = trimmed
      nicknameChanged = true
    }
  }

  return { ok: true, updates, nicknameChanged }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd C:/jidokhae-2nd/jidokhae-web && npx vitest run src/lib/__tests__/profile-update.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
cd C:/jidokhae-2nd
git add jidokhae-web/src/lib/profile-update.ts jidokhae-web/src/lib/__tests__/profile-update.test.ts
git commit -m "feat(mypage): resolveProfileUpdate 순수 검증 헬퍼 + 테스트"
```

---

## Task 3: RegionPicker 공용 컴포넌트 추출

현재 `RegionPicker`는 `ProfileSetup.tsx` 내부 로컬 함수라 재사용 불가. 별도 파일로 추출하고 `ProfileSetup`은 import만 한다. **로직/스타일은 그대로 옮긴다(동작 변경 없음).**

**Files:**
- Create: `jidokhae-web/src/components/RegionPicker.tsx`
- Modify: `jidokhae-web/src/components/ProfileSetup.tsx`

- [ ] **Step 1: 공용 RegionPicker 파일 생성**

`jidokhae-web/src/components/RegionPicker.tsx` (기존 `ProfileSetup.tsx` 254-365줄을 그대로 이전):
```tsx
'use client'

import { useState } from 'react'
import { VALID_REGIONS } from '@/lib/regions'

const PRIMARY_REGIONS: string[] = ['경주', '포항']
const OTHER_REGIONS = VALID_REGIONS.filter((r) => !PRIMARY_REGIONS.includes(r))

export default function RegionPicker({
  regions,
  onChange,
  error,
}: {
  regions: string[]
  onChange: (regions: string[]) => void
  error?: string
}) {
  const hasOtherSelected = regions.some((r) => (OTHER_REGIONS as readonly string[]).includes(r))
  const [showOthers, setShowOthers] = useState(hasOtherSelected)

  function toggleRegion(r: string) {
    onChange(
      regions.includes(r)
        ? regions.filter((v) => v !== r)
        : [...regions, r],
    )
  }

  const selectedStyle = {
    border: '1px solid var(--color-primary-500)',
    backgroundColor: 'var(--color-primary-50)',
  }
  const unselectedStyle = {
    border: '1px solid var(--color-neutral-200)',
    backgroundColor: 'var(--color-surface-50)',
  }

  return (
    <div>
      <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">
        주로 참여할 지역 (복수 선택 가능)<span className="text-accent-500 ml-0.5">*</span>
      </label>

      {/* Primary regions — larger buttons */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {PRIMARY_REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => toggleRegion(r)}
            className={`relative py-3.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
              regions.includes(r)
                ? 'text-primary-700 font-bold'
                : 'text-neutral-500'
            }`}
            style={regions.includes(r) ? selectedStyle : unselectedStyle}
          >
            {r}
            {regions.includes(r) && (
              <svg className="absolute top-2 right-2 text-primary-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* Toggle for other regions */}
      {!showOthers ? (
        <button
          type="button"
          onClick={() => setShowOthers(true)}
          className="w-full py-2 text-xs font-medium text-primary-400 hover:text-primary-600 transition-colors"
        >
          다른 지역 보기
          <svg className="inline ml-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {OTHER_REGIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggleRegion(r)}
                className={`py-2.5 rounded-[var(--radius-md)] text-sm transition-colors ${
                  regions.includes(r)
                    ? 'text-primary-700 font-bold'
                    : 'text-neutral-500'
                }`}
                style={regions.includes(r) ? selectedStyle : unselectedStyle}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowOthers(false)}
            className="mt-1 w-full py-2 text-xs font-medium text-primary-400 hover:text-primary-600 transition-colors"
          >
            접기
            <svg className="inline ml-1 rotate-180" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </>
      )}

      {error && (
        <p className="mt-1 text-xs text-error">{error}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: ProfileSetup.tsx에서 로컬 RegionPicker 제거 + import 추가**

`jidokhae-web/src/components/ProfileSetup.tsx` 상단 import에 추가 (5번째 줄 `import { VALID_REGIONS }...` 아래):
```tsx
import RegionPicker from '@/components/RegionPicker'
```

그리고 파일 하단의 `const PRIMARY_REGIONS ...`부터 끝까지(기존 254-365줄: `PRIMARY_REGIONS`, `OTHER_REGIONS`, `function RegionPicker(...)` 전체)를 삭제한다. `ProfileSetup`이 더 이상 `VALID_REGIONS`를 직접 쓰지 않으면 5번째 줄 `import { VALID_REGIONS } from '@/lib/regions'`도 제거한다(미사용 import = lint 에러).

> 확인: 추출 후 `ProfileSetup.tsx`에서 `VALID_REGIONS` 참조가 0건이면 import 삭제. `RegionPicker` 참조(202줄 `<RegionPicker ...>`)는 그대로 유지.

- [ ] **Step 3: 타입/린트/빌드 검증**

Run: `cd C:/jidokhae-2nd/jidokhae-web && npx tsc --noEmit && npm run lint`
Expected: 에러 0. (미사용 import 없음, RegionPicker 정상 해석)

- [ ] **Step 4: Commit**

```bash
cd C:/jidokhae-2nd
git add jidokhae-web/src/components/RegionPicker.tsx jidokhae-web/src/components/ProfileSetup.tsx
git commit -m "refactor(mypage): RegionPicker 공용 컴포넌트로 추출"
```

---

## Task 4: getProfile에 nickname_changed_at 추가

**Files:**
- Modify: `jidokhae-web/src/lib/profile.ts`

- [ ] **Step 1: select + 반환 타입에 컬럼 추가**

`jidokhae-web/src/lib/profile.ts` 전체를 아래로 교체:
```ts
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export const getProfile = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('nickname, role, welcomed_at, phone, region, email, real_name, profile_completed_at, is_staff, nickname_changed_at')
    .eq('id', userId)
    .single()

  if (error) throw new Error(`프로필 조회 실패: ${error.message}`)
  return data as {
    nickname: string
    role: string
    welcomed_at: string | null
    phone: string | null
    region: string[] | null
    email: string | null
    real_name: string | null
    profile_completed_at: string | null
    is_staff: boolean
    nickname_changed_at: string | null
  }
})
```

- [ ] **Step 2: 타입 검증**

Run: `cd C:/jidokhae-2nd/jidokhae-web && npx tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 3: Commit**

```bash
cd C:/jidokhae-2nd
git add jidokhae-web/src/lib/profile.ts
git commit -m "feat(mypage): getProfile에 nickname_changed_at 추가"
```

---

## Task 5: `/api/profile/update` 라우트

본인 프로필만 부분 수정. `resolveProfileUpdate`로 검증 → 닉네임 실제 변경 시 중복 체크 + `nickname_changed_at = now()` 기록 + 낙관적 가드. 표준 응답 포맷 `{ status, message? }`.

**Files:**
- Create: `jidokhae-web/src/app/api/profile/update/route.ts`

- [ ] **Step 1: 라우트 구현**

`jidokhae-web/src/app/api/profile/update/route.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'
import { resolveProfileUpdate, type ProfileUpdateInput } from '@/lib/profile-update'

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // No-op: API route doesn't need to set cookies
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ status: 'error', message: '로그인이 필요합니다' }, { status: 401 })
  }

  let body: ProfileUpdateInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', message: '잘못된 요청입니다' }, { status: 400 })
  }

  const admin = createServiceClient()

  // 현재 프로필 조회
  const { data: current, error: fetchError } = await admin
    .from('profiles')
    .select('nickname, nickname_changed_at')
    .eq('id', user.id)
    .single()

  if (fetchError || !current) {
    return NextResponse.json({ status: 'error', message: '프로필을 찾을 수 없습니다' }, { status: 404 })
  }

  // 입금 대기(pending_transfer) 보유 여부
  const { data: pending } = await admin
    .from('registrations')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'pending_transfer')
    .limit(1)

  const hasPendingTransfer = !!(pending && pending.length > 0)

  // 검증 + 변경분 산출
  const resolved = resolveProfileUpdate(
    { nickname: body.nickname, phone: body.phone, region: body.region, email: body.email },
    { nickname: current.nickname, nickname_changed_at: current.nickname_changed_at },
    { hasPendingTransfer },
  )

  if (!resolved.ok) {
    return NextResponse.json({ status: 'error', message: resolved.message }, { status: 400 })
  }

  // 변경할 내용이 없으면 바로 성공
  if (Object.keys(resolved.updates).length === 0) {
    return NextResponse.json({ status: 'success' })
  }

  // 닉네임 실제 변경 시: 중복 체크 + 변경 시각 기록
  if (resolved.nicknameChanged) {
    const newNickname = resolved.updates.nickname as string
    const { data: dup } = await admin
      .from('profiles')
      .select('id')
      .eq('nickname', newNickname)
      .neq('id', user.id)
      .neq('nickname', '')
      .limit(1)

    if (dup && dup.length > 0) {
      return NextResponse.json({ status: 'error', message: '이미 사용 중인 닉네임입니다' }, { status: 409 })
    }

    resolved.updates.nickname_changed_at = new Date().toISOString()

    // 낙관적 가드: nickname_changed_at IS NULL인 행만 업데이트
    const { data: updated, error: updateError } = await admin
      .from('profiles')
      .update(resolved.updates)
      .eq('id', user.id)
      .is('nickname_changed_at', null)
      .select('id')

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json({ status: 'error', message: '이미 사용 중인 닉네임입니다' }, { status: 409 })
      }
      return NextResponse.json({ status: 'error', message: '프로필 저장에 실패했습니다' }, { status: 500 })
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ status: 'error', message: '닉네임은 1회만 변경할 수 있어요' }, { status: 409 })
    }

    return NextResponse.json({ status: 'success' })
  }

  // 닉네임 외 필드만 수정
  const { error: updateError } = await admin
    .from('profiles')
    .update(resolved.updates)
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ status: 'error', message: '프로필 저장에 실패했습니다' }, { status: 500 })
  }

  return NextResponse.json({ status: 'success' })
}
```

- [ ] **Step 2: 타입/린트/빌드 검증**

Run: `cd C:/jidokhae-2nd/jidokhae-web && npx tsc --noEmit && npm run lint`
Expected: 에러 0.

- [ ] **Step 3: Commit**

```bash
cd C:/jidokhae-2nd
git add jidokhae-web/src/app/api/profile/update/route.ts
git commit -m "feat(mypage): /api/profile/update 부분 수정 라우트"
```

---

## Task 6: ProfileEditor 클라이언트 컴포넌트

보기 모드 ↔ 편집 모드 토글. 닉네임 잠금 상태(`changed`/`pending`)별 안내. 저장 시 `/api/profile/update` 호출 후 `router.refresh()`.

**Files:**
- Create: `jidokhae-web/src/components/my/ProfileEditor.tsx`

- [ ] **Step 1: 컴포넌트 구현**

`jidokhae-web/src/components/my/ProfileEditor.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RegionPicker from '@/components/RegionPicker'

type NicknameLock = 'changed' | 'pending' | null

type Props = {
  nickname: string
  realName: string | null
  phone: string | null
  region: string[] | null
  email: string | null
  nicknameLock: NicknameLock
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

const LOCK_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="inline align-[-1px]">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)

export default function ProfileEditor({ nickname, realName, phone, region, email, nicknameLock }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    nickname,
    phone: phone ? formatPhone(phone) : '',
    regions: region || ([] as string[]),
    email: email || '',
  })

  function startEdit() {
    setForm({
      nickname,
      phone: phone ? formatPhone(phone) : '',
      regions: region || [],
      email: email || '',
    })
    setApiError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setApiError(null)
    setEditing(false)
  }

  async function handleSave() {
    setSaving(true)
    setApiError(null)
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: form.nickname.trim(),
          phone: form.phone.replace(/\D/g, ''),
          region: form.regions,
          email: form.email.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.status !== 'success') {
        setApiError(data.message || '저장에 실패했습니다')
        setSaving(false)
        return
      }
      setEditing(false)
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    } catch {
      setApiError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
      setSaving(false)
    }
  }

  const heading = (
    <h2 className="mb-3 text-xl font-extrabold text-neutral-800 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
      내 정보
    </h2>
  )

  // ── 보기 모드 ──
  if (!editing) {
    const rows: { label: string; value: string; locked?: boolean }[] = [
      { label: '닉네임', value: nickname },
      { label: '실명', value: realName || '-', locked: true },
      { label: '전화', value: phone ? formatPhone(phone) : '-' },
      { label: '지역', value: region && region.length > 0 ? region.join(', ') : '-' },
      { label: '이메일', value: email || '-' },
    ]
    return (
      <section>
        {heading}
        <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-surface-50 px-4 shadow-[var(--shadow-sm)]">
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`flex items-center py-3 ${i < rows.length - 1 ? 'border-b border-neutral-200' : ''}`}
            >
              <span className="w-16 shrink-0 text-caption text-neutral-500">{row.label}</span>
              <span className="flex-1 text-sm font-semibold text-neutral-800">
                {row.value}
                {row.locked && <span className="ml-1.5 text-neutral-400">{LOCK_ICON}</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            수정하기
          </button>
        </div>
        {saved && <p className="mt-2 text-right text-caption text-primary-600">저장되었습니다</p>}
      </section>
    )
  }

  // ── 편집 모드 ──
  const inputClassName =
    'w-full rounded-[var(--radius-md)] px-3.5 py-3 text-sm font-medium text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400/40 transition-shadow'
  const inputStyle = { backgroundColor: 'var(--color-surface-50)', border: '1px solid var(--color-surface-300)' }
  const lockedInputStyle = { backgroundColor: 'var(--color-surface-100)', border: '1px solid var(--color-neutral-200)' }

  const nicknameHint =
    nicknameLock === 'changed'
      ? '닉네임은 1회만 변경할 수 있어요.'
      : nicknameLock === 'pending'
        ? '입금 확인이 끝난 뒤 변경할 수 있어요.'
        : '닉네임은 1회만 변경할 수 있어요. 신중히 입력해 주세요.'

  return (
    <section>
      {heading}
      <div className="rounded-[var(--radius-md)] border border-primary-100 bg-surface-50 p-4 shadow-[var(--shadow-sm)] space-y-4">
        {/* 닉네임 */}
        <div>
          <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">닉네임</label>
          <input
            type="text"
            value={form.nickname}
            onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))}
            disabled={nicknameLock !== null}
            maxLength={20}
            className={inputClassName}
            style={nicknameLock !== null ? lockedInputStyle : inputStyle}
          />
          <p className={`mt-1.5 text-xs ${nicknameLock !== null ? 'text-accent-600' : 'text-neutral-500'}`}>
            {nicknameLock !== null && <span className="mr-1">{LOCK_ICON}</span>}
            {nicknameHint}
          </p>
        </div>

        {/* 실명 (읽기전용) */}
        <div>
          <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">실명</label>
          <input type="text" value={realName || ''} disabled className={inputClassName} style={lockedInputStyle} />
          <p className="mt-1.5 text-xs text-accent-600">
            <span className="mr-1">{LOCK_ICON}</span>
            실명 변경은 운영진에게 문의해 주세요.
          </p>
        </div>

        {/* 전화번호 */}
        <div>
          <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">전화번호</label>
          <input
            type="tel"
            inputMode="numeric"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
            placeholder="010-0000-0000"
            maxLength={13}
            className={inputClassName}
            style={inputStyle}
          />
        </div>

        {/* 지역 */}
        <RegionPicker regions={form.regions} onChange={(regions) => setForm((p) => ({ ...p, regions }))} />

        {/* 이메일 */}
        <div>
          <label className="mb-2 block text-xs font-bold text-primary-700 tracking-tight">이메일 (선택)</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="email@example.com"
            className={inputClassName}
            style={inputStyle}
          />
        </div>

        {apiError && (
          <div
            className="rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-error"
            style={{ backgroundColor: 'rgba(196, 61, 61, 0.06)', border: '1px solid rgba(196, 61, 61, 0.15)' }}
          >
            {apiError}
          </div>
        )}

        <div className="flex gap-2.5 pt-1">
          <button
            onClick={cancelEdit}
            disabled={saving}
            className="flex-1 rounded-[var(--radius-md)] border border-neutral-300 bg-white py-3 text-sm font-bold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-[var(--radius-md)] bg-primary-600 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 타입/린트 검증**

Run: `cd C:/jidokhae-2nd/jidokhae-web && npx tsc --noEmit && npm run lint`
Expected: 에러 0.

- [ ] **Step 3: Commit**

```bash
cd C:/jidokhae-2nd
git add jidokhae-web/src/components/my/ProfileEditor.tsx
git commit -m "feat(mypage): ProfileEditor 보기/편집 컴포넌트"
```

---

## Task 7: ProfileSection + 스켈레톤 + /my 페이지 통합

서버에서 프로필 + 입금대기 여부를 조회해 잠금 상태를 계산하고 `ProfileEditor`에 전달. `/my` 페이지에 신청 목록 위로 배치.

**Files:**
- Create: `jidokhae-web/src/components/my/ProfileSection.tsx`
- Create: `jidokhae-web/src/components/skeletons/ProfileSkeleton.tsx`
- Modify: `jidokhae-web/src/app/(main)/my/page.tsx`

- [ ] **Step 1: ProfileSection 서버 컴포넌트 작성**

`jidokhae-web/src/components/my/ProfileSection.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import ProfileEditor from '@/components/my/ProfileEditor'

export default async function ProfileSection() {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const supabase = await createClient()
  const [profile, pendingResult] = await Promise.all([
    getProfile(user.id),
    supabase
      .from('registrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending_transfer')
      .limit(1),
  ])

  const hasPendingTransfer = !!(pendingResult.data && pendingResult.data.length > 0)

  // 잠금 우선순위: 이미 변경(영구) > 입금 대기(임시)
  const nicknameLock: 'changed' | 'pending' | null =
    profile.nickname_changed_at !== null ? 'changed' : hasPendingTransfer ? 'pending' : null

  return (
    <ProfileEditor
      nickname={profile.nickname}
      realName={profile.real_name}
      phone={profile.phone}
      region={profile.region}
      email={profile.email}
      nicknameLock={nicknameLock}
    />
  )
}
```

- [ ] **Step 2: ProfileSkeleton 작성**

`jidokhae-web/src/components/skeletons/ProfileSkeleton.tsx`:
```tsx
export default function ProfileSkeleton() {
  return (
    <section className="animate-pulse">
      <div className="mb-3 h-7 w-24 rounded bg-neutral-200" />
      <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-surface-50 px-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`flex items-center py-3 ${i < 4 ? 'border-b border-neutral-200' : ''}`}>
            <div className="h-4 w-12 rounded bg-neutral-200" />
            <div className="ml-4 h-4 w-32 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: /my 페이지에 통합**

`jidokhae-web/src/app/(main)/my/page.tsx` 전체를 아래로 교체:
```tsx
import { Suspense } from 'react'
import MyRegistrationContent from '@/components/my/MyRegistrationContent'
import RegistrationsSkeleton from '@/components/skeletons/RegistrationsSkeleton'
import ProfileSection from '@/components/my/ProfileSection'
import ProfileSkeleton from '@/components/skeletons/ProfileSkeleton'

export default function MyPage() {
  return (
    <div className="px-5 pt-6">
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileSection />
      </Suspense>

      <h1 className="mt-8 text-xl font-extrabold text-neutral-800 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>내 신청</h1>
      <Suspense fallback={<RegistrationsSkeleton />}>
        <MyRegistrationContent />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 4: 전체 QA 파이프라인**

Run: `cd C:/jidokhae-2nd/jidokhae-web && npm run prelaunch`
Expected: lint + tsc + test(profile-update 포함) + build 전부 PASS.

- [ ] **Step 5: Commit**

```bash
cd C:/jidokhae-2nd
git add jidokhae-web/src/components/my/ProfileSection.tsx jidokhae-web/src/components/skeletons/ProfileSkeleton.tsx jidokhae-web/src/app/(main)/my/page.tsx
git commit -m "feat(mypage): /my에 내 정보 섹션 통합"
```

---

## Task 8: 배포 준비 (수동 SQL + Preview 검증)

UI는 로컬에서 Kakao OAuth 때문에 검증 불가 → Vercel Preview로 시각 검증.

- [ ] **Step 1: prod Supabase에 마이그레이션 SQL 실행 (단무지님 수동)**

단무지님께 안내: Supabase SQL Editor에서 `jidokhae-web/supabase/migration-mypage-profile.sql` 1줄 실행.
> Preview도 prod Supabase에 연결되므로, Preview 검증 **전에** 반드시 실행해야 한다. 컬럼이 없으면 getProfile/API가 깨진다.

- [ ] **Step 2: 브랜치 push + PR 생성**

```bash
cd C:/jidokhae-2nd
git push -u origin feat/mypage-profile
```
이후 `main` 대상 PR 생성. Vercel이 Preview 자동 배포.

- [ ] **Step 3: Preview 수동 검증 체크리스트**

단무지님 캡처/확인 기준(추측 금지):
- [ ] `/my` 진입 시 "내 정보" 섹션이 신청 목록 위에 보인다
- [ ] [수정하기] → 같은 화면에서 편집 폼이 펼쳐진다
- [ ] 전화/지역/이메일만 바꾸고 저장 → 닉네임 1회 기회가 **소비되지 않는다** (다시 편집 시 닉네임 입력칸 열려 있음)
- [ ] 닉네임을 실제로 바꿔 저장 → 다음 진입부터 닉네임 입력칸이 잠긴다("1회만 변경" 안내)
- [ ] 입금 대기(pending_transfer) 보유 시 닉네임 입력칸이 잠긴다("입금 확인 후" 안내)
- [ ] 실명 칸은 항상 잠금 + 자물쇠 + "운영진 문의" 안내
- [ ] 중복 닉네임 저장 시 "이미 사용 중인 닉네임입니다" 표시
- [ ] 저장 후 "저장되었습니다" 노출 + 값 갱신

- [ ] **Step 4: 검증 통과 후 머지**

PR 머지 후 1~2일 모니터링. 이상 시 `git revert -m 1 <merge-commit>` (컬럼은 forward-compatible이라 SQL 롤백 불필요).

---

## Self-Review 결과

**스펙 커버리지:** 스펙 §3 결정사항(실명 읽기전용, 닉네임 1회+입금대기 잠금, 기존 250명 NULL, 앱레벨 강제) → Task 1·2·5·6에서 구현. §7 구성요소 5개 → Task 1(DB)·5(API)·6(컴포넌트)·7(페이지)·4(getProfile) 매핑. §9 리스크(race·RLS·중복·미완성프로필·무알림) → Task 5에서 낙관적 가드+23505+본인검증으로 처리. 누락 없음.

**플레이스홀더:** 모든 step에 실제 코드/명령/기대출력 포함. "적절히 처리" 류 없음.

**타입 일관성:** `resolveProfileUpdate`/`ProfileUpdateInput`(Task 2) ↔ API 사용(Task 5) 일치. `nickname_changed_at` 타입(Task 4) ↔ ProfileSection 계산(Task 7) 일치. `nicknameLock` 유니온(`'changed'|'pending'|null`)이 Task 6·7에서 동일. `RegionPicker` props(Task 3) ↔ ProfileEditor/ProfileSetup 사용 일치.
