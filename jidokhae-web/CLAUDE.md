# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Parent Repository

The parent repo at `../` contains planning/spec documents and a comprehensive CLAUDE.md with full project context (business rules, technical decisions, milestone status, database schema, payment/cancel flows). **Read `../CLAUDE.md` when you need spec-level context.**

## Development Commands

```bash
npm run dev          # Dev server at http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (unit tests)
npm run test:watch   # Vitest watch mode
npm run prelaunch    # lint + tsc + test + build (full QA pipeline)
npx tsc --noEmit     # Type check only (no emit)
npm run verify:prod  # Verify production deployment (requires .env.local)
npm run screenshot   # Capture UI screenshots for review (Playwright)
npx vitest run src/lib/__tests__/kst.test.ts  # Single test file
```

## Architecture

**Next.js 16 App Router** with TypeScript, Tailwind CSS v4, Supabase, deployed on Vercel.

### Route Groups
- `src/app/(main)/` — Authenticated member pages (meeting list, detail, my-registrations)
- `src/app/(next)/` — **전면개편 5탭 UI (토스 스킨)**: `/home` `/meet` `/talk` `/shelf` `/me`(+`/me/notifications` 알림함). `site_settings.next_ui` 플래그 뒤에 있어 OFF면 회원 노출 0. 레이아웃이 온보딩 게이트(`isOnboarded()` — 미완성자는 `/`로) 수행. 표현 컴포넌트는 `src/components/next/` (NextNav, TossUI, HomeView/MeetView/TalkView). 상세·신청·결제는 구경로(`/meetings/[id]`) 재사용 — 결제 로직 무변경. 플래그 ON 시 `/`는 온보딩 완료자만 `/home`으로 리다이렉트
- `src/app/(admin)/` — Admin pages. Phase 3 M7 Step 2에서 데스크톱 사이드바 + 모바일 드로어 레이아웃으로 재구성. 라우트: `admin/` (허브), `admin/meetings` (지역 필터 포함 목록), `admin/meetings/[id]` (상세 + 신청자), `admin/meetings/new`, `admin/meetings/[id]/edit`, `admin/members`, `admin/settings`, `admin/settlements` (입금 확인·환불 대기·지역별 매출 3탭, admin 전용), `admin/notices` (공지 발송 → 인앱 알림), `admin/library` (서재 응답률), `admin/notifications` (알림톡 이력), `admin/banners` (M8 placeholder, admin 전용), `admin/quotes` (M8 placeholder). 발제문 관리는 토론모임 상세에서 진입
- `src/app/auth/` — Login page + OAuth callback (auth layout includes Footer for PG 심사)
- `src/app/policy/` — Public pages (about, terms, privacy, refund, meetings list/detail — no auth required)
- `src/app/api/` — API routes (registrations/confirm, registrations/cancel, registrations/waitlist-cancel, registrations/transfer, meetings/[id]/delete, webhooks/portone, webhooks/tosspayments (legacy), cron/meeting-remind, cron/waitlist-refund, welcome, profile/setup, profile/update (마이페이지 프로필 자가 수정 — 부분 수정, 닉네임 1회 변경 낙관적 락 + 중복 409, 본인 행만), admin/members/role, admin/members/staff, admin/settings, admin/venues, admin/venues/[id], admin/venues/settle, admin/registrations/confirm-transfer, admin/registrations/mark-refunded)

### Middleware (`src/middleware.ts`)
Refreshes Supabase session on every request. Redirects unauthenticated → `/auth/login`, authenticated → away from `/auth`. Skips `/auth/callback` (preserve PKCE cookies), `/policy/*` (public pages), `api/webhooks/` (PortOne 결제 검증 — legacy tosspayments 라우트 포함), and `api/cron/` (Vercel Cron — CRON_SECRET auth).

### Data Access Pattern
- **Server Components** (default): Use `src/lib/supabase/server.ts` (anon key + RLS)
- **Client Components**: Use `src/lib/supabase/client.ts` (anon key + RLS)
- **API Routes**: Use `src/lib/supabase/admin.ts` (service_role key, bypasses RLS)

### Business Logic (`src/lib/`)
- `payment.ts` — Payment confirmation flow (PortOne V2 KakaoPay 채널). 결제 금액 검증은 화이트리스트 `[meeting.fee, calculateFee(fee, true)]` — 자격·슬롯 재검증은 RPC FOR UPDATE 락에 위임 (PR #34)
- `cancel.ts` — User cancellation flow (returns meetingId for promotion trigger). PortOne `cancelPayment` 사용
- `waitlist.ts` — 대기 승격 래퍼 (promote RPC + 알림톡) + 대기 취소 (100% 환불)
- `refund.ts` — Refund amount calculation (paid_amount 기반 — 스텝 할인 결제도 paid_amount * 비율로 환불). **`calculateRefundByType(meetingType, ...)`이 단일 진입점** — 토론모임(discussion)은 7일 100%/3일 50%, 그 외는 3일 100%/2일 50%. 실환불(cancel.ts)·권장액(mark-refunded)·취소 모달·admin 표시·환불정책 페이지가 전부 이 함수를 거친다. `calculateRefund`/`calculateDiscussionRefund`를 직접 부르지 말 것 (2026-08-21 배선, PR #64)
- `discussion-rules.ts` — 토론모임 순수 규칙: `isDiscussionApplyOpen()` (D-7 신청 마감 — 화면 버튼 + payment.ts 카드 자동취소 + transfer 400, 3중 강제), `canWriteAnswer()` (발제 답변 자격 = confirmed·pending_transfer)
- `discussion.ts` — 발제 스레드 조회 (`getTopicsWithStats` 등). 테이블 5개: discussion_topics/topic_answers/answer_replies/answer_reactions + (migration-discussion-thread.sql)
- `curator.ts` — 발제 등록·수정·핀 권한 = admin·editor·`is_staff` (is_staff에 할인 외 권한이 생긴 첫 사례). DB `is_curator()` SQL 함수와 동기 필수
- `app-notifications.ts` — 인앱 알림 (알림함). 라우트에서 발송 시 반드시 `after()`로 감쌀 것
- `library.ts` / `asks.ts` / `asks-pure.ts` — 서재(library_entries)·물어보기(book_asks) + `isLibraryEnabled()` 플래그
- `next-ui.ts` — `isNextUiEnabled()`: `NEXT_UI_PREVIEW` env OR `site_settings.next_ui`. 켜는 날 library_enabled와 동시 ON
- `kakao-books.ts` — 카카오 책 검색 API 래퍼 (`KAKAO_REST_API_KEY`). 표지는 `next/image` 금지, plain `<img>` (Kakao CDN이 remotePatterns에 없음)
- `registration-status.ts` — "정원 차지+참석 예정" status 상수 (pending_transfer = confirmed 동등 취급의 단일 소스)
- `api-auth.ts` — API Route 전용 `getRouteUser(request)` (createServerClient+cookies 패턴 통합)
- `onboarding.ts` — `isOnboarded(profile)` = welcomed_at + profile_completed_at + real_name (HomeContent 이중 게이트와 동일 기준)
- `portone.ts` — PortOne V2 server SDK wrapper (`getPayment`, `cancelPayment`). KakaoPay 채널 (EASY_PAY payMethod = 카드 + 카카오페이머니 동시 지원)
- `tosspayments.ts` — (legacy) TossPayments API wrapper. PR #28에서 PortOne로 마이그레이션 완료. 미사용 상태로 잔존 — 롤백 안전망 목적
- `pricing.ts` — 스텝 할인 가격 계산 단일 진입점. 상수 `STAFF_DISCOUNT_RATE = 0.5`, `STAFF_DISCOUNT_MAX_PER_MEETING = 2`. 함수 `isStaffEligible(profile)`, `calculateFee(baseFee, isStaffDiscount)`. SQL `staff_discount_max_per_meeting()` 함수와 동기 필수
- `staff-slot.ts` — 스텝 할인 슬롯 카운트 + `getDisplayFee(meetingId, profile, fee)` 헬퍼. 자격(role/is_staff) + 슬롯 여석 시 할인가 반환. 사용처: 모임 상세 page, transfer route (RPC가 마지막 방어선)
- `kst.ts` — KST date utilities (getKSTToday, getTomorrowKST, formatKoreanDate, formatKoreanDateFull, formatKoreanTime, formatFee, getDaysUntil, getButtonState)
- `auth.ts` — Cached `getUser()` for server-side user fetching (safe only after middleware session refresh)
- `profile.ts` — Cached `getProfile(userId)` for server-side profile fetching
- `profile-update.ts` — 순수 검증 헬퍼 `resolveProfileUpdate` — 마이페이지 프로필 자가 수정 규칙 (닉네임 1회 변경, 전화·지역·이메일 자유 수정, 실명 읽기전용). Vitest 단위 테스트 (`__tests__/profile-update.test.ts`)
- `meeting.ts` — Cached `getMeeting(id)` for server-side meeting fetching
- `notification.ts` — 알림톡 발송 + notifications 이력 기록 (INSERT pending → 발송 → UPDATE sent/failed)
- `solapi.ts` — Solapi SDK 래퍼 (KakaoTalk 알림톡)
- `site-settings.ts` — Cached `getSiteSettings()` for site configuration
- `dashboard.ts` — Dashboard aggregations (revenue, meetings, members, alerts, venue settlements). Phase 3 M7 Step 2.5: 매출 집계 공식 수정 — 총매출에 confirmed + cancelled 모두 포함 (취소 발생 시 순매출 음수 표시 문제 해소)
- `regions.ts` — Valid regions constant (`VALID_REGIONS`)
- `visibility.ts` — 모임 신청자 수 마스킹 헬퍼 (Phase 3, PR #19). admin/editor에게는 정확한 카운트, 회원에겐 절대 임계 3명 미만 마스킹. `lib/__tests__/visibility.test.ts`에 단위 테스트. 모임 상세에서는 본인이 정원에 차지한 회원(`confirmed` 또는 `pending_transfer`)에게도 마스킹 해제 (명단 헤더의 인원수와 카운트 정합)

Logic is shared between API routes — keep it in `src/lib/`, not in route handlers.

## Key Conventions

- **Server Components by default.** Client Components (`'use client'`): BottomNav, LogoutButton, MeetingActionButton, MeetingForm, DeleteMeetingButton, RegistrationCard, MeetingCard, MeetingsView, CalendarStrip, ModalOverlay, WelcomeScreen, ProfileSetup, RegionPicker (ProfileSetup·ProfileEditor 공용 지역 선택), ProfileEditor (마이페이지 프로필 보기↔편집), MemberList, LoginClient, SiteSettingsForm, VenueManager, VenueSettlementTable, AdminDashboardContent, HomeContent, MeetingDetailContent, MyRegistrationContent, MyMeetingsSection (홈 "내 모임" 섹션 — 더보기 토글 때문에 client), payment-redirect/page, payment-fail/page, route group error.tsx files. Phase 3 M7 Step 2 추가: AdminSidebar, AdminMobileNav, AdminDashboardHub, AdminMeetingsList, RegionFilter, PlaceholderPage (준비 중 라우트용). Phase 3 M7 Step 2.6 추가: RefundToggle (계좌이체 환불 완료 양방향 체크박스, DepositToggle 패턴). Server Components include DateSectionHeader, MeetingDetailInfo, Footer (사업자정보 푸터), ProfileSection (마이페이지 프로필 데이터 페치 + ProfileEditor 렌더), RegistrationStatusBadge (모임 상세 — waitlisted 상태만, confirmed/pending_transfer는 hero가 흡수), RegistrationHero (모임 상세 — confirmed/pending_transfer 상태 hero 배너), ParticipantsList (모임 상세 참여자 닉네임 명단). Note: auth/login/page is a Server Component that renders `<LoginClient />`
- **Component directories:** `src/components/` organized by domain — `admin/`, `meetings/`, `registrations/`, `home/`, `my/`, `skeletons/`, `ui/`
- **Shared UI:** `ModalOverlay` (`src/components/ui/ModalOverlay.tsx`) — reusable accessible modal with ESC key, focus management. Used by DeleteMeetingButton, MeetingActionButton
- **No semicolons**, single quotes, function components only
- **Tailwind v4**: Design tokens in `@theme inline` block in `src/app/globals.css` — NOT in `tailwind.config.ts`. Full token reference: `DESIGN_TOKENS.md`
- **KST always**: Use `src/lib/kst.ts` functions, never `new Date()` directly
- **`formatFee()`** returns number-only string (e.g., `"10,000"`) — caller adds '원' suffix
- **Next.js 16 params**: Dynamic route params are `Promise<{ id: string }>` — must `await` them
- **Mutation pattern**: `router.push() + router.refresh()` after mutations (no `revalidatePath`)
- **Parallel fetching**: `Promise.all()` in page components for concurrent Supabase queries
- **Inline SVG icons** — no icon library
- **Manual types**: `src/types/meeting.ts` (Phase 3 M7 Step 1에서 region/is_featured/chat_link/reading_link/detail_address 추가), `src/types/registration.ts`, `src/types/notification.ts`, `src/types/venue.ts`, `src/types/banner.ts` (Phase 3), `src/types/book_quote.ts` (Phase 3) — no generated Supabase types, cast with `as Meeting`/`as Registration`
- **DB migrations**: `supabase/migration.sql` — run manually in Supabase SQL Editor (no CLI)
- **Path alias**: `@/*` → `./src/*` (works in tests too via vitest `tsconfigPaths` plugin)
- **PostCSS**: Uses `@tailwindcss/postcss` plugin (`postcss.config.mjs`)
- **ESLint**: Flat config in `eslint.config.mjs` — `eslint-config-next` (core-web-vitals + typescript)
- **Analytics**: `src/lib/analytics.ts` (`trackEvent()` 래퍼), `src/components/analytics/` (RouteChangeTracker, TrackMeetingView). GA4 이벤트 추가 시 `trackEvent()` 사용, 새 추적 컴포넌트는 `analytics/` 디렉토리에 배치
- **Admin 메뉴 단일 소스** (Phase 3 M7 Step 2): `src/components/admin/adminMenu.ts`가 7개 메뉴를 3개 그룹(운영/콘텐츠/시스템)으로 정의. `adminOnly: true`는 editor 역할에서 숨김(정산/배너/설정). `PlaceholderPage` 컴포넌트가 M8/M10 준비 중 라우트를 렌더. 새 admin 메뉴 추가 시 `adminMenu.ts`에만 항목 추가하면 AdminSidebar/AdminMobileNav 양쪽에 자동 반영
- **API response 포맷** (Phase 3 M7 Step 1): `{ status: 'success' | 'error', message?, data? }`로 12개 라우트 통일. 신규 API 라우트는 이 포맷을 따를 것. 기존 `{ success: true }` 패턴은 점진적 마이그레이션 중
- **라우트 응답 후 부수 작업은 `next/server`의 `after()`** (2026-08-17): `void promise()` fire-and-forget은 Vercel 람다 freeze로 유실/지연됨 (Preview 실측 13분 지연). 인앱 알림 등 응답과 무관한 후속 작업은 반드시 `after()`로 감쌀 것. 로컬 dev에서는 재현 안 되므로 리뷰 단계에서 잡아야 함
- **Phase 3 DB schema**: `supabase/migration-phase3-m7.sql` (롤백: `migration-phase3-m7-rollback.sql`) — meetings 5개 컬럼 + banners + book_quotes + 파셜 인덱스 5개. M7 Step 2.5: `migration-phase3-m7-step2-5.sql` — `admin_confirm_transfer` DB Function 추가 (운영자 입금 확인 원자성)
- **계좌이체 환불 처리** (Phase 3 M7 Step 2.6): `/api/admin/registrations/mark-refunded`가 `action: 'mark' | 'unmark'` 양방향 지원. 'mark'는 서버에서 `calculateRefund(meeting.date, paid_amount, cancelled_at)` 자동 계산해 `refunded_amount` 기록. 'unmark'는 NULL 복구. admin role 전용. RefundToggle 컴포넌트가 호출. ⚠️ **금지**: 호출 성공 후 `sendRegistrationConfirmNotification` 호출 (운영자 월말 일괄 처리 맥락)
- **계좌이체 환불 처리 한계** (Phase 3 M7 Step 2.6 발견): 모임 삭제 후 `payment_method='transfer' AND status='confirmed'`였던 회원의 환불 대기는 `refunded_amount=NULL`로 잔존하는데, deleted 모임은 `/admin/meetings/[id]` 페이지가 `notFound()`라 RefundToggle 사용 불가. 빈도 낮으면 SQL로 처리 (`UPDATE registrations SET refunded_amount = paid_amount WHERE status='cancelled' AND payment_method='transfer' AND refunded_amount IS NULL AND paid_amount > 0;`). 빈도 높아지면 deleted 모임도 admin 상세 접근 가능하게 분기 수정 필요
- **스텝 할인 시스템** (PR #33~#35): admin/editor/`is_staff=true` 회원에게 정기모임 참가비 50% 할인 (모임당 슬롯 2명, 코드 `STAFF_DISCOUNT_MAX_PER_MEETING` ↔ SQL `staff_discount_max_per_meeting()` 동기 필수). 결제 화이트리스트: payment.ts에서 `[fee, fee/2]`만 허용 + RPC가 FOR UPDATE 락 안에서 자격/슬롯 재검증 (`discount_not_eligible` / `staff_slot_full` 반환 시 자동 환불). 회원 화면(모임 상세/confirm/MeetingActionButton)은 `getDisplayFee()`로 자격자에게 할인가 표시 — 일반 회원에게는 정가만. admin 회원 관리 페이지 `MemberList`의 staff pill로 `is_staff` 토글 (admin 전용). DB schema: `supabase/migration-staff-discount.sql` + `migration-staff-discount-rpcs.sql`
- **기능 플래그 패턴**: `isNextUiEnabled()`(next-ui.ts)·`isLibraryEnabled()`(library.ts) — Preview 전용 env OR `site_settings` 키. 켜기 = DB flip(재배포 불필요). 새 회원 노출 기능은 이 패턴 뒤에 넣어 dark-merge한다
- **활성 탭 판정 패턴**: `pathname === href || pathname.startsWith(href + '/')` — 단순 `startsWith(href)`는 `/me`가 `/meet`에 매칭되는 버그 (PR #58 사고). BottomNav·NextNav 공통
- **Preview 검증 워크플로**: 프리뷰 브랜치 미러 = `git push origin origin/main:refs/heads/feat/next-phase1a --force` (branch-scoped env `NEXT_UI_PREVIEW=on`). Vercel SSO 보호 때문에 Playwright 접근 불가 — 크롬 MCP(사용자 브라우저 세션)로 검증. Vercel MCP는 스코프 불일치(403) — vercel CLI 사용
- **PWA Service Worker** (2026-04-28 도입): `@serwist/next` configurator mode (Next.js 16 Turbopack 호환). `src/sw.ts`가 캐시 전략 단일 소스, `serwist.config.js`가 빌드 설정. **API/auth/_next/data는 NetworkOnly (절대 캐시 안 함)**. HTML(admin 포함)은 NetworkFirst, `_next/static`+font+icon은 CacheFirst. dev 모드는 SerwistProvider의 `disable` prop으로 비활성. SW 산출물(`public/sw.js`, `public/swe-worker-*.js`, `public/sw.js.map`)은 빌드 산출물이라 git ignore + ESLint 제외. 새 SW 감지 시 `skipWaiting + clientsClaim`으로 즉시 점령(사용자에게 prompt 없음). 빌드 명령은 `next build && serwist build` 2단계. 화면 이상 신고 시 SW 캐시를 1순위로 의심 → 사용자에게 PWA 강제 종료 후 재실행 또는 새로고침 안내. 운영 가이드: `/검토문서/2026-04-28-pwa-sw-운영-가이드.md`
