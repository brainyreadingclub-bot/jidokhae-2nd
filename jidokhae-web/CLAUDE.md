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
npm run verify:prod  # Verify production deployment
npm run screenshot   # Capture UI screenshots for review
npx vitest run src/lib/__tests__/kst.test.ts  # Single test file
```

## Architecture

**Next.js 16 App Router** with TypeScript, Tailwind CSS v4, Supabase, deployed on Vercel.

### Route Groups
- `src/app/(main)/` — Authenticated member pages (meeting list, detail, my-registrations)
- `src/app/(admin)/` — Admin pages (CRUD for meetings)
- `src/app/auth/` — Login page + OAuth callback
- `src/app/api/` — API routes (registrations/confirm, registrations/cancel, meetings/[id]/delete, webhooks/tosspayments)

### Middleware (`src/middleware.ts`)
Refreshes Supabase session on every request. Redirects unauthenticated → `/auth/login`, authenticated → away from `/auth`. Skips `/auth/callback` to preserve PKCE cookies.

### Data Access Pattern
- **Server Components** (default): Use `src/lib/supabase/server.ts` (anon key + RLS)
- **Client Components**: Use `src/lib/supabase/client.ts` (anon key + RLS)
- **API Routes**: Use `src/lib/supabase/admin.ts` (service_role key, bypasses RLS)

### Business Logic (`src/lib/`)
- `payment.ts` — Payment confirmation flow
- `cancel.ts` — User cancellation flow
- `refund.ts` — Refund amount calculation
- `tosspayments.ts` — TossPayments API wrapper
- `kst.ts` — KST date utilities (getKSTToday, formatKoreanDate, formatKoreanTime, formatFee, getButtonState)

Logic is shared between API routes — keep it in `src/lib/`, not in route handlers.

## Key Conventions

- **Server Components by default.** Client Components (`'use client'`): BottomNav, LogoutButton, MeetingActionButton, MeetingForm, DeleteMeetingButton, RegistrationCard, MeetingCard, auth/login/page, payment-redirect/page, payment-fail/page, route group error.tsx files
- **No semicolons**, single quotes, function components only
- **Tailwind v4**: Design tokens in `@theme inline` block in `src/app/globals.css` — NOT in `tailwind.config.ts`. Full token reference: `DESIGN_TOKENS.md`
- **KST always**: Use `src/lib/kst.ts` functions, never `new Date()` directly
- **`formatFee()`** returns number-only string (e.g., `"10,000"`) — caller adds '원' suffix
- **Next.js 16 params**: Dynamic route params are `Promise<{ id: string }>` — must `await` them
- **Mutation pattern**: `router.push() + router.refresh()` after mutations (no `revalidatePath`)
- **Parallel fetching**: `Promise.all()` in page components for concurrent Supabase queries
- **Inline SVG icons** — no icon library
- **Manual types**: `src/types/meeting.ts` — no generated Supabase types, cast with `as Meeting`
- **DB migrations**: `supabase/migration.sql` — run manually in Supabase SQL Editor (no CLI)
- **Path alias**: `@/*` → `./src/*`
