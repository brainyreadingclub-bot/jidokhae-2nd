# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is the **planning and specification repository** for JIDOKHAE 2nd — a rewrite of the reading club web service with a tighter MVP scope. It contains only planning documents (no source code).

The actual codebase lives at a separate repository (`jidokhae-web/`), which has its own CLAUDE.md with full development commands and architecture details.

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

/검토문서                                        # Review notes (post-hoc analysis)
├── mvp 검토.md                                 # MVP review: payment reliability, Kakao in-app browser issues, webhook gaps
└── 수정 계획.md                                 # Modification plan: 19 changes across 3 documents (applied to v1.6/v1.3/v1.3)

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

**Current status:** M1 is **completed**. M2-M6 are **not started**.

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
| M4 결제 + 신청 | 3 | 29 | PortOne payment pipeline + Registration UX |
| M5 취소 + 환불 | 2 | 24 | Self-cancel + Batch refund on deletion |
| M6 통합 검증 + 출시 | 2 | 22 | E2E verification + Production deploy |

---

## Key Technical Decisions (from specs)

| Decision | Detail |
|----------|--------|
| Stack | Next.js 14 (App Router) + TypeScript + Supabase + Vercel |
| Auth | Supabase Auth ↔ Kakao OAuth |
| Payment | PortOne V2 API (NOT V1). PG: TossPayments or NHN KCP |
| DB access | Frontend: Supabase Client (anon key + RLS). Server: API Routes with service_role key |
| Supabase Clients | 3 variants: Server (anon key), Browser (anon key), Admin (service_role key) |
| Capacity check | DB Function (RPC) with `FOR UPDATE` row lock — atomic check + INSERT |
| Deletion flow | `active` → `deleting` (parallel refunds via `Promise.allSettled`) → `deleted` |
| Timezone | All date calculations in KST (Asia/Seoul), not UTC. Use KST utility functions, never `new Date()` directly |
| Refund calc | Date-unit only (days_remaining = meeting.date - today KST) |
| Registration uniqueness | `user_id + meeting_id` is NOT UNIQUE — re-registration creates new record |
| Meeting fee | Per-meeting variable (not hardcoded 10,000원) |
| Batch refund timeout | `Promise.allSettled` required (Vercel 10-second limit) |
| Payment mode | popup + redirect dual path (Kakao in-app browser blocks popups → auto-fallback to redirect) |
| Webhook backup | PortOne Webhook (`/api/webhooks/portone`) as backup when frontend callback/redirect fails. Signature verification required |
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
