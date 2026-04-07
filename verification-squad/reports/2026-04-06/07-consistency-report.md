# 일관성 검토 보고서

**검증 대상**: `jidokhae-web/src/` 전체 (컴포넌트, 라이브러리, API 라우트, 타입, 스타일)
**검증 일시**: 2026-04-06
**프로젝트**: JIDOKHAE 2nd

---

## 1. 네이밍 일관성

| 범주 | 주류 패턴 | 일탈 사례 | 일탈 빈도 | 파일 위치 |
|------|---------|----------|----------|----------|
| 컴포넌트 선언 | `export default function ComponentName` | 없음 | 0 | - |
| Props 타입 | `type Props = { ... }` | 없음 | 0 | 모든 컴포넌트에서 일관 |
| 'use client' 따옴표 | `'use client'` (작은따옴표) | `"use client"` 사용 사례 없음 | 0 | - |
| 이벤트 핸들러 | `handleXxx` (예: `handleSubmit`, `handleClick`) | 없음 | 0 | - |
| 파일명 | PascalCase (컴포넌트), kebab-case (라이브러리) | 없음 | 0 | - |
| import 경로 | `@/` path alias | 상대경로 `./` (동일 디렉토리 내) | 6건 | `MeetingsView.tsx`, `AdminMeetingSection.tsx`, `registration.ts` |

**판정**: 상대경로 import는 같은 디렉토리 내부의 sibling import에만 사용되고 있어 허용 범위 내. 네이밍 전반적으로 매우 일관적.

---

## 2. 패턴 불일치

| 패턴 범주 | 패턴 A (빈도) | 패턴 B (빈도) | 권장 통일안 |
|----------|-------------|-------------|-----------|
| API 성공 응답 | `{ success: true }` (6건: welcome, settings, venues, venues/[id], venues/settle, members/role) | `{ status: 'success' }` (2건: attendance, mark-refunded) / `{ status: 'ok' }` (2건: webhooks) | `{ success: true }` 로 통일 |
| API 에러 응답 | `{ status: 'error', message: '...' }` (대다수) | `{ error: '...' }` (2건: webhooks, cron) | `{ status: 'error', message: '...' }` 로 통일 |
| Supabase cookie getAll | 메서드 구문 `getAll() { return request.cookies.getAll() }` (10건) | 화살표 + `.map()` `getAll: () => request.cookies.getAll().map(c => ...)` (4건: settings, venues, venues/[id], venues/settle) | 메서드 구문으로 통일 (`.map()` 불필요 -- 반환 타입 동일) |
| Admin 권한 검사 | `profile.role !== 'admin'` (6건) / `callerProfile.role !== 'admin'` (2건) | `profile.role !== 'admin' && profile.role !== 'editor'` (1건: attendance) | 의미 구분이므로 허용, 단 변수명 `profile` vs `callerProfile` 통일 권장 |
| Spinner SVG | `<Spinner />` 컴포넌트 (MeetingActionButton 내부) | 인라인 동일 SVG (TransferForm) | 공통 `Spinner` 컴포넌트를 `ui/` 디렉토리로 추출 |
| StickyBottom 레이아웃 | `<StickyBottom>` 컴포넌트 (MeetingActionButton 내부) | 인라인 동일 레이아웃 (TransferForm) | 공통 `StickyBottom` 컴포넌트를 `ui/` 디렉토리로 추출 |
| `new Date().toISOString()` | 13건 (cancel.ts, notification.ts, delete route, waitlist.ts, cron routes, API routes) | KST 유틸리티 사용 (날짜 계산) | `new Date().toISOString()` 는 타임스탬프 기록 용도이므로 허용 (KST 변환 불필요). `kst.ts` 내부의 `new Date()` 도 KST 포맷 목적이므로 정당 |

---

## 3. 디자인 토큰 준수

| 요소 | 정의된 토큰 | 하드코딩 사례 | 파일 위치 |
|------|-----------|------------|----------|
| **색상 (Tailwind 기본 gray)** | `neutral-*` 토큰 | `text-gray-900`, `text-gray-500`, `bg-gray-100`, `text-gray-700`, `border-gray-200` | `(main)/error.tsx`, `(admin)/error.tsx`, 4개 skeleton 파일, `payment-redirect/page.tsx`, `(admin)/loading.tsx` |
| **색상 (Tailwind 기본 red)** | `error` / `accent-*` 토큰 | `text-red-500` | `DeleteMeetingButton.tsx:182` |
| **색상 (하드코딩 hex)** | `accent-*` / `surface-*` 토큰 | `#FEE500` (카카오 브랜드 컬러) | `LoginClient.tsx:131` -- 외부 브랜드 컬러이므로 허용 |
| **색상 (하드코딩 rgba)** | `shadow-*` 토큰, semantic 토큰 | `rgba(196, 61, 61, 0.06/0.15)` (에러 배경/보더), `rgba(45, 125, 95, 0.06/0.15)` (성공 배경/보더), `rgba(181, 64, 58, ...)`, `rgba(217, 128, 42, ...)`, `rgba(27, 67, 50, 0.25)` (버튼 그림자), `rgba(180, 100, 60, 0.25)` | `SiteSettingsForm.tsx`, `MeetingForm.tsx`, `ProfileSetup.tsx`, `AdminDashboardContent.tsx`, `MeetingActionButton.tsx`, `TransferForm.tsx`, `payment-fail/page.tsx`, `VenueManager.tsx`, `confirm/page.tsx` |
| **폰트 사이즈 (arbitrary)** | `text-display` ~ `text-small` 토큰 | `text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[13px]`, `text-[16px]`, `text-[2.75rem]`, `text-[2.25rem]`, `text-[3.25rem]` | 32건 이상, 거의 모든 UI 컴포넌트 |
| **boxShadow (인라인)** | `shadow-sm` / `shadow-md` / `shadow-lg` 토큰 | `0 4px 14px rgba(27, 67, 50, 0.25)` (버튼), `0 -2px 8px rgba(45, 90, 61, 0.06)` (sticky bar), `0 2px 8px rgba(27, 67, 50, 0.2)` (대시보드) | `MeetingActionButton.tsx`, `TransferForm.tsx`, `confirm/page.tsx`, `AdminDashboardContent.tsx` |

**심각도 분석**:
- **gray 토큰 사용**: skeleton 파일과 error boundary에서 Tailwind 기본 `gray-*` 사용. 디자인 시스템의 `neutral-*` 로 교체 필요.
- **rgba 하드코딩**: 상태 표시 배경/보더에 반복 사용되는 패턴 (`rgba(196, 61, 61, 0.06/0.15)` 등)이 토큰으로 정의되지 않음. CSS 변수로 추출 권장.
- **arbitrary font size**: `text-[11px]` 등이 디자인 토큰의 `text-caption` (0.8125rem = 13px), `text-small` (0.75rem = 12px) 과 매칭되지 않는 크기로 광범위 사용. 디자인 스케일 재검토 또는 추가 토큰 정의 필요.

---

## 4. 중복 코드

| 기능 | 위치 A | 위치 B | 차이점 |
|------|-------|-------|--------|
| **Error boundary** | `src/app/(main)/error.tsx` | `src/app/(admin)/error.tsx` | 에러 메시지 문구만 다름 ("일시적인 오류입니다" vs "관리자 페이지에서 오류가 발생했습니다"). 나머지 JSX/스타일 100% 동일 |
| **Spinner SVG** | `MeetingActionButton.tsx:660-682` (`Spinner` 컴포넌트) | `TransferForm.tsx:69-85` (인라인 SVG) | 동일한 SVG 마크업 |
| **StickyBottom 레이아웃** | `MeetingActionButton.tsx:641-658` (`StickyBottom` 컴포넌트) | `TransferForm.tsx:49-94` (인라인 레이아웃) | 동일 구조 (fixed bottom, max-w-screen-sm, 동일 boxShadow) |
| **API 인증 보일러플레이트** | 15개 API route 파일 전체 | - | `createServerClient()` + cookie 설정 + `getUser()` + null 체크 코드가 모든 API route에 중복 (각 15~25줄). 공통 유틸 함수로 추출 가능 |
| **Admin 권한 검사 보일러플레이트** | 9개 admin API route | - | `createServiceClient()` + profiles 조회 + role 체크 패턴이 반복. 공통 `requireAdmin()` 유틸로 추출 가능 |

---

## 5. 코드 잔재

| 유형 | 개수 | 위치 목록 |
|------|------|----------|
| `console.error` | 20건 | `waitlist.ts` (3건), `payment.ts` (1건), `cancel.ts` (1건), `notification.ts` (1건), `(admin)/error.tsx` (1건), `(main)/error.tsx` (1건), `cron/waitlist-refund/route.ts` (2건), `webhooks/tosspayments/route.ts` (4건), `registrations/cancel/route.ts` (1건), `registrations/confirm/route.ts` (2건), `registrations/transfer/route.ts` (1건), `admin/registrations/mark-refunded/route.ts` (1건) -- **모두 의도적 서버 로깅이므로 허용** |
| `console.log` | 0건 | - (깔끔) |
| TODO / FIXME / HACK | 0건 | - (깔끔) |
| 중복 주석 | 1건 | `WelcomeScreen.tsx:86-87` -- 동일 내용의 JSX 주석이 연속 2줄 (`{/* 하단: Light parchment section */}` + `{/* 하단: Light parchment section (60%) */}`) |
| 미사용 Props | 1건 | `TransferForm.tsx` -- `meetingFee` prop이 타입에 정의되어 있고 호출부에서 전달되지만, 컴포넌트 내부에서 destructuring 되지 않고 사용되지 않음 |
| `@ts-expect-error` / 타입 우회 | 1건 | `notification.ts:106-107` -- `eslint-disable-next-line @typescript-eslint/no-explicit-any` + `(result as any)` (Solapi SDK 타입 부재로 인한 불가피한 우회) |
| 세미콜론 | 3건 (허용 범위) | `layout.tsx:88,90,91` -- GA4 `<Script>` 내부의 인라인 JavaScript 문자열 (JSX 외부 JS 코드이므로 세미콜론 필요) |

---

## 6. 문서화 일관성

| 항목 | 상태 | 비고 |
|------|------|------|
| `CLAUDE.md` (루트) | 최신 유지됨 | feature/bank-transfer 관련 내용(TransferForm, BankInfoCard, transfer API 등) 미반영 |
| `jidokhae-web/CLAUDE.md` | 최신 유지됨 | 동일하게 bank-transfer 신규 파일/라우트 미반영 |
| 타입 파일 | 일관 | `meeting.ts`, `registration.ts`, `notification.ts`, `venue.ts`, `gtag.d.ts` 모두 수동 정의 |
| JSX 섹션 주석 | 일관적 사용 | `{/* ── Section Name ── */}` 패턴. WelcomeScreen에 중복 1건 존재 |

---

## 7. 인터페이스 일관성

| 항목 | 상태 | 비고 |
|------|------|------|
| Supabase client 사용 | 일관 | Server Component: `createClient()` (server.ts), Client Component: `createBrowserClient()` (client.ts), API Route: `createServiceClient()` (admin.ts) + 인라인 `createServerClient()` (인증용) |
| 데이터 패칭 패턴 | 일관 | `Promise.all()` 로 병렬 조회, `.data` null 처리 (`?? []`), `as Meeting` 캐스팅 |
| 에러 처리 (Server Component) | 일관 | `throw new Error()` → error boundary 위임 |
| 에러 처리 (Client Component) | 일관 | `try-catch` + `useState` error state / alert |
| 라우트 파라미터 | 일관 | `Promise<{ id: string }>` + `await params` (Next.js 16 규약 준수) |
| mutation 후 갱신 | 일관 | `router.push()` + `router.refresh()` 또는 `router.replace()` |

---

## 종합 판정: 조건부 통과

**판정 사유**: 네이밍, 컴포넌트 구조, 데이터 패칭 패턴은 높은 수준의 일관성을 유지하고 있으나, (1) API 응답 포맷 3가지 혼재 (`success: true` / `status: 'success'` / `status: 'ok'`), (2) Tailwind 기본 `gray-*` 토큰 사용으로 인한 디자인 시스템 이탈 (skeleton/error 파일), (3) rgba 하드코딩 및 arbitrary font-size의 광범위 사용, (4) API route 인증 보일러플레이트 중복이 개선 필요 항목으로 식별됨.

### 우선순위별 개선 권장

**P1 (즉시 수정)**:
- `TransferForm.tsx` 미사용 prop `meetingFee` 제거 또는 활용
- `WelcomeScreen.tsx:86-87` 중복 주석 제거

**P2 (다음 세션 권장)**:
- API 성공 응답 포맷 통일: `{ success: true }` 로 표준화 (`attendance`, `mark-refunded` 라우트의 `status: 'success'` 및 webhook의 `status: 'ok'` 수정)
- error boundary의 `text-gray-*` / `bg-gray-*` 를 `text-neutral-*` / `bg-neutral-*` 로 교체
- skeleton 파일의 `bg-gray-100` / `border-gray-200` 를 디자인 토큰으로 교체
- `DeleteMeetingButton.tsx`의 `text-red-500` 를 `text-error` 로 교체

**P3 (리팩토링 시)**:
- `Spinner`, `StickyBottom` 를 `src/components/ui/` 로 추출하여 재사용
- API route 인증 보일러플레이트를 공통 유틸 함수 (`createAuthenticatedClient`, `requireAdmin`) 로 추출
- 반복 사용되는 rgba 값을 CSS 변수로 정의 (예: `--color-error-bg`, `--color-error-border`, `--color-success-bg`)
- `cookie getAll` 패턴 통일 (메서드 구문으로)
- arbitrary font-size 감사 및 디자인 토큰 확장 검토 (`text-[11px]` → `--text-badge` 등)
