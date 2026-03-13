# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is the **planning and specification repository** for JIDOKHAE 2nd — a rewrite of the reading club web service with a tighter MVP scope. It contains only planning documents (no source code).

The actual implementation codebase lives at `jidokhae-web/` (nested inside this repo).

**Project:** JIDOKHAE (지독해) — A web service for a reading club in Gyeongju/Pohang, Korea (250 members). Members browse meeting schedules, register with payment, and manage cancellations/refunds.

---

## Document Structure

```
/core                                          # Foundational specs (Korean, read-only)
├── JIDOKHAE-2nd - 서비스 개요.md                # Service overview, vision, MVP scope, usage principles
├── JIDOKHAE-2nd - PRD.md                       # Product requirements, user stories, UX flows, button logic
└── JIDOKHAE-2nd - 기술 스택 & 시스템 구조.md      # Tech stack, system architecture, data flows, DB schema

/roadmap                                       # Execution roadmap (maintained by Claude)
├── milestones.md                              # 6 Milestones (M1-M6) — what to achieve
├── work-packages.md                           # 15 Work Packages — how to execute each milestone
└── scenarios.md                               # 146 BDD Scenarios — how to verify each WP

/검토문서                                        # Review notes & manual test checklists
├── mvp 검토.md                                 # MVP review: payment reliability, Kakao in-app browser issues, webhook gaps
├── 수정 계획.md                                 # Modification plan: 19 changes across 3 documents (applied to v1.6/v1.3/v1.3)
├── M3-수동테스트-체크리스트.md                     # M3 manual test checklist (28 items)
└── M5-수동테스트-체크리스트.md                     # M5 manual test checklist (cancel + refund, 48 items)

prompts                                          # Implementation prompt template (used when starting WP implementation in jidokhae-web/)
```

## Document Hierarchy (when conflicts arise)

**Core documents** (what to build):

1. **서비스 개요** — Vision, "why", usage principles ("쉬워야/모여야/보여야")
2. **PRD** — "What" to build, user stories, UX flows, button logic
3. **기술 스택 & 시스템 구조** — "How" to implement, architecture, data flows

**Roadmap documents** (how to execute):

4. **milestones.md** — 6 Milestones with dependency chain and acceptance criteria
5. **work-packages.md** — 15 WPs with deliverables, edge cases, verification checklists
6. **scenarios.md** — 146 BDD Scenarios in Given/When/Then format with dependency tracking

When ambiguous, return to the three usage principles from 서비스 개요:
1. **쉬워야 한다** — 3초 안에 일정 확인, 3클릭 안에 신청 완료
2. **모여야 한다** — 흩어진 일정과 신청이 한 곳에
3. **보여야 한다** — 상태가 명확하게 보여야

---

## Roadmap Structure

```
Milestone (목표)           → "무엇을 달성할 것인가"
  └─ Work Package (실행)   → "어떻게 실행할 것인가" (Vertical Slice, WP 완료 시 동작하는 소프트웨어)
       └─ Scenario (검증)  → "어떻게 확인할 것인가" (1 Scenario = 1 행동 = 1 검증)
```

**Dependency flow:**

```
WP1-1 → WP1-2 → WP1-3 → WP2-1 → WP2-2 → WP3-1 → WP3-2 → WP3-3 → WP4-1 → WP4-2 → WP4-3 → WP5-1 → WP5-2 → WP6-1 → WP6-2
```

**Current status:** M1–M5 are **completed**. Next is **M6** (통합 검증 + 출시).

---

## MVP Scope Summary

**In scope:** Kakao login → Meeting list → Registration with payment → Cancellation/refund → Admin CRUD

**Out of scope (future):** Waitlist, notifications/alimtalk, badges/praise, bean (콩) points, landing page, admin dashboard, AI chatbot, book tracking

## Milestone Overview

```
M1 (Foundation) → M2 (Auth) → M3 (Meeting CRUD) → M4 (Payment) → M5 (Cancel/Refund) → M6 (Integration QA)
```

| Milestone | WPs | Scenarios | Key Deliverable |
|-----------|:---:|:---------:|-----------------|
| M1 프로젝트 기반 구축 | 3 | 25 | Next.js + Supabase DB + Layout |
| M2 인증 (카카오 로그인) | 2 | 16 | Kakao OAuth + Session + Access control |
| M3 모임 일정 조회 + 운영자 CRUD | 3 | 30 | Meeting list/detail + Admin CRUD |
| M4 결제 + 신청 | 3 | 29 | TossPayments payment pipeline + Registration UX |
| M5 취소 + 환불 | 2 | 24 | Self-cancel + Batch refund on deletion |
| M6 통합 검증 + 출시 | 2 | 22 | E2E verification + Production deploy |

---

## Key Technical Decisions (from specs)

| Decision | Detail |
|----------|--------|
| Stack | Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Supabase + Vercel |
| Auth | Supabase Auth ↔ Kakao OAuth |
| Payment | TossPayments 직접 연동 (REST API + @tosspayments/payment-sdk) |
| DB access | Frontend: Supabase Client (anon key + RLS). Server: API Routes with service_role key |
| Supabase Clients | 3 variants: Server (anon key), Browser (anon key), Admin (service_role key) |
| Capacity check | DB Function (RPC) with `FOR UPDATE` row lock — atomic check + INSERT |
| Deletion flow | `active` → `deleting` (parallel refunds via `Promise.allSettled`) → `deleted` |
| Timezone | All date calculations in KST (Asia/Seoul), not UTC. Use KST utility functions, never `new Date()` directly |
| Refund calc | Date-unit only (days_remaining = meeting.date - today KST) |
| Registration uniqueness | `user_id + meeting_id` is NOT UNIQUE — re-registration creates new record |
| Meeting fee | Per-meeting variable (not hardcoded 10,000원) |
| Batch refund timeout | `Promise.allSettled` required (Vercel 10-second limit) |
| Payment mode | redirect only (TossPayments SDK는 항상 redirect) |
| Webhook backup | TossPayments Webhook (`/api/webhooks/tosspayments`) as backup when frontend redirect fails. Signature verification required |
| payment_id idempotency | API Route checks payment_id before processing — if already confirmed, returns success (no refund). 2-layer: API Route (payment_id) + DB Function (user+meeting) |
| Refund failure safety | On refund API failure, keep `confirmed` status (never leave user with no money AND no registration) |

## Key Business Rules

- **결제 완료 = 신청 확정** — No payment-less registrations exist
- **Refund policy:** 3+ days → 100%, 2 days → 50%, <2 days → 0% (cancellation still allowed)
- **Cancellation cutoff:** Day after meeting date → cancel button hidden
- **Capacity display:** Show "O명 참여" (current count), never show max capacity to members
- **Button logic:** Determined by `confirmed` registration existence + meeting timing (5 states — see PRD §6-2)
- **Deletion refund:** Always 100% regardless of refund policy dates
- **Duplicate prevention:** DB Function detects existing confirmed registration and rejects

---

## Working with This Repository

- **Language:** All planning documents are written in Korean. Maintain Korean when editing core and roadmap documents.
- **Core documents are authoritative:** `/core` documents define the spec. When implementing in the separate `jidokhae-web/` codebase, always cross-reference these specs — do not rely on memory or summaries alone.
- **Roadmap documents track execution:** `/roadmap` is maintained by Claude. When a WP is completed in the implementation repo, update `milestones.md` status and mark completed scenarios in `scenarios.md`.
- **Review flow:** `/검토문서` captures post-hoc analysis. When reviews identify issues, create a 수정 계획 (modification plan) listing exact edit locations before modifying core/roadmap docs.
- **Version awareness:** Core documents carry version numbers (e.g., v1.6, v1.3). Note the version when referencing specific sections, as review-driven edits may change content between versions.
- **Cross-repo workflow:** The implementation repo lives at `jidokhae-web/` (nested inside this repo). The `prompts` file contains a template for starting WP implementation — substitute `--단계` with the target WP (e.g., `WP1-1`) when using it.

---

## Implementation Codebase (`jidokhae-web/`)

### Development Commands

```bash
cd jidokhae-web
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint (eslint-config-next with core-web-vitals + typescript)
npm run start    # Start production server
```

Verification scripts (require `.env.local` with Supabase keys):
```bash
npx tsx scripts/verify-m1.ts       # Verify M1 deliverables
npx tsx scripts/verify-m1-rls.ts   # Verify RLS policies
```

### Architecture

- **Route groups:** `src/app/(main)/` for authenticated member pages, `src/app/(admin)/` for admin pages, `src/app/auth/` for login/callback
- **Middleware** (`src/middleware.ts`): Refreshes Supabase session on every request, redirects unauthenticated users to `/auth/login`, redirects authenticated users away from `/auth`. Skips `/auth/callback` to preserve PKCE cookies
- **Supabase clients** (`src/lib/supabase/`): `server.ts` (Server Components, anon key), `client.ts` (Client Components, anon key), `admin.ts` (API Routes, service_role key)
- **Tailwind v4:** Design tokens defined via `@theme inline` in `src/app/globals.css` — NOT `tailwind.config.ts`. Primary color: warm amber (`--color-primary-*`). Font: Pretendard
- **Layout:** Mobile-first single-column (`max-w-screen-sm`), bottom tab navigation (`BottomNav`), iOS safe area support
- **Path alias:** `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- **DB migrations:** `supabase/migration.sql` (full schema) + `fix-rls-recursion.sql` (RLS patches) — run manually in Supabase SQL Editor (no CLI migration)
- **No generated Supabase types** — manual type definitions in `src/types/meeting.ts`, Supabase responses cast with `as Meeting`
- **Error/Loading boundaries:** Each route group has `error.tsx` and `loading.tsx` files

### Database Schema

**Tables:** `profiles` (user info, role), `meetings` (schedule, capacity, fee, status), `registrations` (user+meeting, payment, refund tracking)

**Key DB Functions (SECURITY DEFINER):**
- `is_admin()` — Returns true if current user has admin role. Used in RLS policies
- `confirm_registration(p_user_id, p_meeting_id, p_payment_id, p_paid_amount)` — Atomic capacity check + INSERT with `FOR UPDATE` row lock. Returns: 'success' | 'not_found' | 'not_active' | 'already_registered' | 'full'
- `get_confirmed_counts(meeting_ids UUID[])` — Batch count of confirmed registrations per meeting (avoids N+1 queries)

**Triggers:** `on_auth_user_created` auto-creates profile from Kakao metadata on signup

### Code Conventions

- **Server Components by default** — pages are async Server Components that fetch data and pass props down. Only 7 files use `'use client'`: `BottomNav`, `LogoutButton`, `MeetingActionButton`, `MeetingForm`, `DeleteMeetingButton`, `RegistrationCard`, `auth/login/page`
- **No semicolons**, single quotes, function components only
- **Inline SVG icons** — no icon library. Icons defined as inline SVG in components
- **Admin access dual-layered:** layout-level role check (redirect) + DB-level RLS via `is_admin()` SECURITY DEFINER function
- **Mutation pattern in client components:** `router.push() + router.refresh()` after mutations (no `revalidatePath`)
- **Parallel data fetching:** `Promise.all()` in page components for concurrent Supabase queries
- **Next.js 16 params:** Dynamic route params are `Promise<{ id: string }>` (await required)
- **KST date utilities:** Always use `src/lib/kst.ts` functions (`getKSTToday()`, `formatKoreanDate()`, `formatKoreanTime()`, `formatFee()`, `getButtonState()`), never `new Date()` directly
- **API routes** (`src/app/api/`): `registrations/confirm` (M4 payment), `registrations/cancel` (M5 cancel), `meetings/[id]/delete` (M5 admin delete+refund), `webhooks/tosspayments` (M4 backup). All use service_role Supabase client, cookie-based auth
- **Business logic in `src/lib/`**: `payment.ts` (confirmation), `cancel.ts` (cancellation), `refund.ts` (refund calculation), `tosspayments.ts` (TossPayments API wrapper). Shared between API routes — keep logic here, not in route handlers
- **No test framework** — verification via scripts (`scripts/verify-m1*.ts`) and manual testing checklists (`검토문서/`). E2E tests planned for M6

### Payment Flow (M4)

1. Client loads TossPayments SDK → `requestPayment('카드', { amount, orderId, ... })`
2. User completes card payment on TossPayments page
3. TossPayments redirects to `/meetings/[id]/payment-redirect?paymentKey=...&orderId=...&amount=...`
4. Redirect page calls `POST /api/registrations/confirm` with those params
5. API Route: auth check → `processPaymentConfirmation()` → `confirmPayment()` (money moves) → `confirm_registration()` RPC (atomic DB insert)
6. Webhook backup at `/api/webhooks/tosspayments` handles missed redirects

**Safety patterns:** payment_id idempotency (no double-charge), atomic capacity check via DB function with `FOR UPDATE` lock, rollback refund if DB insert fails

### Cancel/Refund Flow (M5)

1. User clicks "취소하기" → info modal (refund rate/amount) → confirm modal → API call
2. `POST /api/registrations/cancel` → `processUserCancel()` → `cancelPayment()` (TossPayments) → DB update
3. Admin delete: `POST /api/meetings/[id]/delete` → set `deleting` → `Promise.allSettled` parallel refund → `deleted`

**Safety patterns:** optimistic lock with `.eq('status', 'confirmed')` + `.select('id')` to detect 0-row updates, race condition handling via `getPayment()` status check, partial failure retry (meeting stays `deleting`)

### Environment Variables

See `jidokhae-web/.env.example` for required variables (Supabase URL/keys, TossPayments keys).
