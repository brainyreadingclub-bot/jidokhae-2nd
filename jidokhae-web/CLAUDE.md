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
- `src/app/(admin)/` — Admin pages. Phase 3 M7 Step 2에서 데스크톱 사이드바 + 모바일 드로어 레이아웃으로 재구성. 라우트: `admin/` (허브), `admin/meetings` (지역 필터 포함 목록), `admin/meetings/[id]` (상세 + 신청자), `admin/meetings/new`, `admin/meetings/[id]/edit`, `admin/members`, `admin/settings`, `admin/banners` (M8 placeholder, admin 전용), `admin/quotes` (M8 placeholder), `admin/settlements` (M10 placeholder, admin 전용)
- `src/app/auth/` — Login page + OAuth callback (auth layout includes Footer for PG 심사)
- `src/app/policy/` — Public pages (about, terms, privacy, refund, meetings list/detail — no auth required)
- `src/app/api/` — API routes (registrations/confirm, registrations/cancel, registrations/waitlist-cancel, registrations/attendance, meetings/[id]/delete, webhooks/tosspayments, cron/meeting-remind, cron/waitlist-refund, welcome, profile/setup, admin/members, admin/settings, admin/venues, admin/venues/[id], admin/venues/settle)

### Middleware (`src/middleware.ts`)
Refreshes Supabase session on every request. Redirects unauthenticated → `/auth/login`, authenticated → away from `/auth`. Skips `/auth/callback` (preserve PKCE cookies), `/policy/*` (public pages), `api/webhooks/` (TossPayments verification), and `api/cron/` (Vercel Cron — CRON_SECRET auth).

### Data Access Pattern
- **Server Components** (default): Use `src/lib/supabase/server.ts` (anon key + RLS)
- **Client Components**: Use `src/lib/supabase/client.ts` (anon key + RLS)
- **API Routes**: Use `src/lib/supabase/admin.ts` (service_role key, bypasses RLS)

### Business Logic (`src/lib/`)
- `payment.ts` — Payment confirmation flow
- `cancel.ts` — User cancellation flow (returns meetingId for promotion trigger)
- `waitlist.ts` — 대기 승격 래퍼 (promote RPC + 알림톡) + 대기 취소 (100% 환불)
- `refund.ts` — Refund amount calculation
- `tosspayments.ts` — TossPayments API wrapper
- `kst.ts` — KST date utilities (getKSTToday, getTomorrowKST, formatKoreanDate, formatKoreanDateFull, formatKoreanTime, formatFee, getDaysUntil, getButtonState)
- `auth.ts` — Cached `getUser()` for server-side user fetching (safe only after middleware session refresh)
- `profile.ts` — Cached `getProfile(userId)` for server-side profile fetching
- `meeting.ts` — Cached `getMeeting(id)` for server-side meeting fetching
- `notification.ts` — 알림톡 발송 + notifications 이력 기록 (INSERT pending → 발송 → UPDATE sent/failed)
- `solapi.ts` — Solapi SDK 래퍼 (KakaoTalk 알림톡)
- `site-settings.ts` — Cached `getSiteSettings()` for site configuration
- `dashboard.ts` — Dashboard aggregations (revenue, meetings, members, alerts, venue settlements)
- `regions.ts` — Valid regions constant (`VALID_REGIONS`)

Logic is shared between API routes — keep it in `src/lib/`, not in route handlers.

## Key Conventions

- **Server Components by default.** Client Components (`'use client'`): BottomNav, LogoutButton, MeetingActionButton, MeetingForm, DeleteMeetingButton, RegistrationCard, MeetingCard, MeetingsView, CalendarStrip, ModalOverlay, WelcomeScreen, ProfileSetup, AttendanceToggle, MemberList, LoginClient, SiteSettingsForm, VenueManager, VenueSettlementTable, AdminDashboardContent, HomeContent, MeetingDetailContent, MyRegistrationContent, payment-redirect/page, payment-fail/page, route group error.tsx files. Phase 3 M7 Step 2 추가: AdminSidebar, AdminMobileNav, AdminDashboardHub, AdminMeetingsList, RegionFilter, PlaceholderPage (준비 중 라우트용). Server Components include DateSectionHeader, MeetingDetailInfo, Footer (사업자정보 푸터). Note: auth/login/page is a Server Component that renders `<LoginClient />`
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
- **Phase 3 DB schema**: `supabase/migration-phase3-m7.sql` (롤백: `migration-phase3-m7-rollback.sql`) — meetings 5개 컬럼 + banners + book_quotes + 파셜 인덱스 5개
