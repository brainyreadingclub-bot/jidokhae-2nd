# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is the **planning and specification repository** for JIDOKHAE 2nd — a rewrite of the reading club web service with a tighter MVP scope. It contains planning documents and the implementation codebase.

**Project:** JIDOKHAE (지독해) — A web service for a reading club in Gyeongju/Pohang, Korea (250 members). Members browse meeting schedules, register with payment, and manage cancellations/refunds.

The actual implementation codebase lives at `jidokhae-web/` (nested inside this repo).

---

## Document Structure

```
/core                                          # Foundational specs (Korean, read-only)
├── JIDOKHAE-2nd - 서비스 개요.md                # Service overview, vision, MVP scope, usage principles
├── JIDOKHAE-2nd - PRD.md                       # Product requirements, user stories, UX flows, button logic
└── JIDOKHAE-2nd - 기술 스택 & 시스템 구조.md      # Tech stack, system architecture, data flows, DB schema

/roadmap                                       # Execution roadmap (maintained by Claude)
├── milestones.md                              # MVP 마일스톤 M1–M6
├── work-packages.md                           # MVP WP (15개)
├── scenarios.md                               # MVP BDD 시나리오 (146개)
├── milestones-phase3.md                       # Phase 3 마일스톤 M7–M12
├── work-packages-phase3.md                    # Phase 3 WP
├── scenarios-phase3.md                        # Phase 3 BDD 시나리오
└── phase3-requirements.md                     # Phase 3 요구사항 정의

/검토문서                                        # Specs / Templates / Decisions / Operations 4종 — README.md 인덱스 참조
├── README.md                                  # 카테고리 인덱스
├── Phase-2-2-대기신청-설계서.md                  # Spec (대기 신청 B안)
├── Phase-2-3-백오피스-지시서.md                  # Spec (백오피스 8개 작업, v1.3에 검토의견 흡수)
├── M6-통합테스트-체크리스트.md                    # Template (M12 재사용)
├── M6-프로덕션-배포-가이드.md                    # Template (M12 재사용)
├── 2026-04-23-풀스캔-후속-의사결정.md             # Decision (역할 매트릭스, 법적 면제, 입금 알림 금지)
└── 2026-04-28-pwa-sw-운영-가이드.md             # Operations (SW 인시던트 대응)

/memory                                        # Session continuity (maintained by Claude)
├── MEMORY.md                                  # 인덱스 — 항상 자동 로드
├── project_next_session.md                    # 다음 세션 핸드오프 (회고마다 갱신)
├── project_*.md                               # 진행 중 작업/외부 의존 상태 (e.g., tosspayments_review)
└── feedback_*.md                              # 세션 교훈 (lesson 1건 = 파일 1개)

/docs
├── expert-panel/                              # 전문가 패널 토론 결과 (의사결정 배경)
│   ├── 2026-03-24-brand-color.md             # 디자인 토큰 의사결정 root (M11 토큰 통합 시 참조)
│   ├── 2026-03-24-ux-calendar-view.md        # CalendarStrip 위클리 스트립 채택 근거
│   ├── 2026-04-17-phase3-preview-html-review.md
│   └── 2026-04-27-mobile-homescreen-icon-quality.md
├── learning/                                  # 파트너용 기술 학습서 (Part 1 완료, Part 2~6 예정)
└── superpowers/                               # superpowers 스킬 관련 문서 (plans/는 머지된 plan에 Status 헤더)

/verification-squad/reports/                   # 풀스캔 검증 리포트 (날짜별 디렉토리)

/jidokhae-web                                  # 구현 코드베이스 (별도 CLAUDE.md 보유)

prompts                                        # WP 구현 시작용 프롬프트 템플릿 (`--단계` 치환)
phase3-preview.html                            # Phase 3 Before/After UI 목업 (전문가 리뷰 대상)
토스 제출문서/                                  # PG 심사 제출 자료 (이미지)
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

**Current status:** M1–M6 MVP **completed**. Phase 2 확장 완료 — 알림톡(Phase 2-1) ✅, 대기 신청(Phase 2-2) ✅, 백오피스(Phase 2-3) ✅. **Phase 3 (진행 중)** — M7 Step 1 (안정 기반) ✅, M7 Step 2 (운영자 개편) ✅, M7 Step 2.5 (풀스캔 후속 보정) ✅, M7 Step 2.6 (계좌이체 환불 토글) ✅. M7 Step 3 (회원 홈) 예정.

**Current status (2026-07-28 갱신):** M7 Step 3 이후 로드맵보다 **토론모임 개편 + 2535 리디자인**이 먼저 진행됨.
- 2535 잉크그린 리디자인 ✅ (PR #39, prod 배포)
- 토론모임 0조각 — `meetings.meeting_type` 정기/토론 구분 ✅ (PR #41, 회원 화면 영향 0)
- 토론모임 1조각 — **서재 + 물어보기(책 담기) + 응답률 측정** ✅ 배포 (PR #42, `dcc61d5`). **단 `site_settings.library_enabled` 플래그 OFF → 회원 노출 0**
- 물어보기 응답률 계측 버그 수정 + 지표 재정의 ✅ (PR #43, `1f9ffaa`, 7/24 prod)
- **플래그 켜기 게이트 2건 남음**: (1) 알림톡 5종 실작동 점검(단무지님) → 6번째 템플릿 신설, (2) 회원 콜드스타트 화면 시안 합의. 상세는 `memory/project_next_session.md`
- ⚠️ 아래 문서의 라우트·컴포넌트·스키마 목록에는 서재/물어보기(`library_entries`, `books`, `book_asks`, `src/lib/asks*.ts`, `src/lib/library.ts`, `src/components/library/*`, `/admin/library`)가 **아직 미반영**

---

## MVP + Phase 2 Scope

**MVP (완료):** Kakao login → Meeting list → Registration with payment → Cancellation/refund → Admin CRUD → E2E 검증 + 배포

**Phase 2 (완료):**
- Phase 2-1: 알림톡 (Solapi → KakaoTalk 5종) ✅
- Phase 2-2: 대기 신청 + 자동 승격 ✅
- Phase 2-3: 백오피스 — 기본 기능(회원관리, 프로필 설정, 웰컴 스크린) ✅ (출석 토글은 이후 제거 — 참여 = 결제완료 + 모임일 경과로 자동 판정) / 고급 기능: 상수 통합 ✅, site_settings ✅, venues ✅, 대시보드 ✅, 회원 강화 ✅, 기간 필터 ✅
- Phase 2-4: 사용자 흐름 추적 (Vercel Analytics + GA4) ✅

**Phase 3 (진행 중):** 상세는 `roadmap/milestones-phase3.md`, `roadmap/work-packages-phase3.md`, `roadmap/scenarios-phase3.md`, `roadmap/phase3-requirements.md` 참조.
- M7 기반 정리 + 레이아웃 전환 —
  - Step 1 (안정 기반: 풀스캔 + Phase 3 DB schema + 배포 정책) ✅
  - Step 2 (운영자 개편: 사이드바 + 대시보드 허브 + 모임 관리 분리 + 모임 폼 확장) ✅
  - Step 2.5 (풀스캔 후속 보정: meeting-remind 병렬화 + `admin_confirm_transfer` RPC + editor 개인정보 차단 + 대시보드 매출 집계 + "원" 단위 통일 + 비로그인 meetings 컬럼 제한 + 쿠키 안내 + 배너 editor 권한) ✅
  - Step 2.6 (계좌이체 환불 토글: `RefundToggle` 컴포넌트 + `mark-refunded` API 양방향 변환) ✅
  - Step 3 (회원 홈) 예정
- M8 관리자 CMS — 배너 + 한 줄 (book_quote). 라우트 placeholder는 M7 Step 2에서 이미 배치
- M9 회원 홈 콘텐츠 전면 오픈
- M10 관리자 심화 — 정산 + 회원 생애주기
- M11 디자인 토큰 통합 + 접근성 정리
- M12 통합 검증 + 배포

**Out of scope (future):** Badges/praise, bean (콩) points, landing page, admin analytics dashboard, AI chatbot, book tracking

## Milestone Overview

| Milestone | WPs | Key Deliverable |
|-----------|:---:|-----------------|
| M1 프로젝트 기반 구축 | 3 | Next.js + Supabase DB + Layout |
| M2 인증 (카카오 로그인) | 2 | Kakao OAuth + Session + Access control |
| M3 모임 일정 조회 + 운영자 CRUD | 3 | Meeting list/detail + Admin CRUD |
| M4 결제 + 신청 | 3 | PortOne V2 (카카오페이) payment pipeline + Registration UX |
| M5 취소 + 환불 | 2 | Self-cancel + Batch refund on deletion |
| M6 통합 검증 + 출시 | 2 | E2E verification + Production deploy |
| M7 기반 정리 + 레이아웃 전환 | 5 | Admin 사이드바/허브 + 모임 관리 분리 + 회원 홈 개선 (Phase 3) |
| M8 관리자 CMS | — | 배너 + 한 줄 (book_quote) 운영 (Phase 3) |
| M9 회원 홈 콘텐츠 전면 오픈 | — | 회원 홈 리뉴얼 (Phase 3) |
| M10 관리자 심화 | — | 정산 + 회원 생애주기 (Phase 3) |
| M11 디자인 토큰 통합 + 접근성 | — | 디자인 시스템 정리 (Phase 3) |
| M12 통합 검증 + 배포 | — | Phase 3 E2E + 배포 (Phase 3) |

> M7~M12 WP/시나리오 상세는 `roadmap/milestones-phase3.md`, `roadmap/work-packages-phase3.md`, `roadmap/scenarios-phase3.md` 참조.

---

## Key Technical Decisions (from specs)

| Decision | Detail |
|----------|--------|
| Stack | Next.js 16.1.6 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + Supabase + Vercel |
| Auth | Supabase Auth ↔ Kakao OAuth |
| Payment | PortOne V2 (카카오페이 채널, `@portone/browser-sdk` + `@portone/server-sdk`). EASY_PAY payMethod = 카드 + 카카오페이머니 동시 지원. PR #28에서 TossPayments 직연동에서 마이그레이션 (토스 PG 심사 거절 → PortOne 경유). TossPayments SDK는 롤백 안전망으로 잔존(미사용) |
| DB access | Frontend: Supabase Client (anon key + RLS). Server: API Routes with service_role key |
| Supabase Clients | 3 variants: Server (anon key), Browser (anon key), Admin (service_role key) |
| Capacity check | DB Function (RPC) with `FOR UPDATE` row lock — atomic check + INSERT |
| Deletion flow | `active` → `deleting` (parallel refunds via `Promise.allSettled`) → `deleted` |
| Timezone | All date calculations in KST (Asia/Seoul), not UTC. Use KST utility functions, never `new Date()` directly |
| Refund calc | Date-unit only (days_remaining = meeting.date - today KST) |
| Registration uniqueness | `user_id + meeting_id` is NOT UNIQUE — re-registration creates new record |
| Meeting fee | Per-meeting variable (not hardcoded 10,000원) |
| Staff discount | admin/editor/`is_staff=true` 회원에게 정기모임 참가비 50% 할인 (모임당 슬롯 2명). 코드 `STAFF_DISCOUNT_RATE=0.5` / `STAFF_DISCOUNT_MAX_PER_MEETING=2` (`src/lib/pricing.ts`) ↔ SQL `staff_discount_max_per_meeting()` 동기 필수. 결제 화이트리스트 `[fee, fee/2]` + RPC FOR UPDATE 락에서 자격/슬롯 재검증 (불일치 시 자동 환불). PR #33~#35 |
| Free member (100% 할인) | `profiles.is_free=true` 회원은 정산 "입금 확인 대기" 목록/배지에서 제외 (`settlement.ts getPendingDeposits` + `dashboard.ts getTransferAlerts`, JS 필터 `is_free !== true`). 배경: 운영자 본인 + 소수 고정 무료 참석자가 계좌이체로 신청 후 미입금(코멥)하여 `pending_transfer`로 영구 잔존 → 정산 노이즈. 최소 설계 — 대상자는 **기존 계좌이체 흐름 그대로** 신청(신청/결제/취소 코드 무변경), 정산 조회에서만 제외. `pending_transfer`는 원래 매출·환불 대기에도 안 잡히므로 추가 처리 불필요. 스텝 할인(`is_staff`)과 완전 별개. 대상 지정은 SQL `UPDATE profiles SET is_free=true WHERE nickname=...` (토글 UI 없음, 고정 소수라). 마이그레이션: `migration-free-member.sql` |
| Batch refund timeout | `Promise.allSettled` required (Vercel 10-second limit) |
| Payment mode | redirect. PortOne V2는 결제창에서 완료 시 **이미 승인된 상태**로 redirect → redirect 핸들러/웹훅은 `getPayment()`로 `status === 'PAID'` 검증만 수행 (토스처럼 confirmPayment로 돈을 이동시키지 않음) |
| Webhook backup | PortOne Webhook (`/api/webhooks/portone`, `PORTONE_WEBHOOK_SECRET` 서명 검증) as backup when frontend redirect fails. 레거시 `/api/webhooks/tosspayments`는 미사용 잔존 |
| Bank transfer bridge | `site_settings.payment_mode` flag (`transfer_only`/`card_only`). 심사 전 계좌이체로 출시, 심사 후 카드 전환. `pending_transfer` 상태 + `payment_method` 컬럼 |
| payment_id idempotency | API Route checks payment_id before processing — if already confirmed, returns success (no refund). 2-layer: API Route (payment_id) + DB Function (user+meeting) |
| Refund failure safety | On refund API failure, keep `confirmed` status (never leave user with no money AND no registration) |
| Waitlist | B안: 대기 시 미리 결제 → 승격 시 자동 확정 → 미승격 시 전날 자동 전액 환불. `confirm_registration()` RPC가 정원 초과 시 `waitlisted` INSERT |
| Waitlist promotion | `promote_next_waitlisted()` DB 함수 (FOR UPDATE 락). 취소 API에서 동기 호출. 승격 알림톡 자동 발송 |
| Waitlist refund cron | `/api/cron/waitlist-refund` (KST 18:30) — catch-up 쿼리(`date <= tomorrow`)로 실패 건 자동 재시도 |
| Alimtalk (알림톡) | Solapi SDK → KakaoTalk 알림톡. 5종: 신청 확인, 모임 리마인드, 대기 확인, 승격 확정, 미승격 환불 |
| Notification dedup | INSERT(pending) → Solapi 발송 → UPDATE(sent/failed). Partial UNIQUE INDEX로 발송 전 중복 차단 |
| Cron auth | Vercel Cron sends `Authorization: Bearer CRON_SECRET` header. Middleware excludes `api/cron/` |

## Key Business Rules

- **결제 완료 = 신청 확정** — No payment-less registrations exist
- **Refund policy:** 3+ days → 100%, 2 days → 50%, <2 days → 0% (cancellation still allowed)
- **Cancellation cutoff:** Day after meeting date → cancel button hidden
- **Capacity display:** Show "O/N명" format (current/max) — both meeting cards and detail page. 회원/비로그인에게는 신청자 3명 미만(0·1·2명)일 때 "N명 모집 중" 형식으로 마스킹(`shouldMaskConfirmedCount` 절대 임계 3명, social proof 역효과 방지). 운영자는 0명만 마스킹, 1명+ 정확 노출. 마감 시 항상 정확 노출. **모임 상세에서 본인이 정원에 차지한 회원(confirmed 또는 pending_transfer)에게는 마스킹 해제** — 명단 헤더("함께하는 멤버 N명")와 카운트 정합성 확보 (`MeetingDetailContent`가 `isPrivileged={isEditorOrAdmin || hasConfirmed || hasPendingTransfer}` 전달)
- **Meeting capacity minimum:** 정원 최소 3명 (Form 단에서 강제, DB CHECK는 두지 않음). 노출 임계(3명)와 정합성을 위해 정원 1·2명 모임 생성 차단. 운영자가 SQL 콘솔로 직접 INSERT하는 우회 경로는 운영 정책상 발생하지 않는다고 가정
- **참여자 명단 노출 정책:** 모임 상세 페이지에서 본인이 정원에 차지한 회원(`confirmed` 또는 `pending_transfer`)에게만 다른 신청자 **닉네임만** 명단 노출(`confirmed` + `pending_transfer` 포함, `waitlisted` 제외). RPC `get_meeting_participant_nicknames`로 단일 진입점 검증. 운영자(admin/editor)는 본인 신청 여부 무관 명단 노출. 비로그인 / 미신청 / `waitlisted` 본인은 명단 미노출. 본인 강조 표시 없음, real_name·region·아바타 미노출. **운영자 입금 확인 지연 시 회원 입장에서 사실상 신청 완료 상태이므로 `pending_transfer` 본인을 `confirmed`와 동등 취급**. 회원 피드백 반영
- **신청 모임 시각 강화 (Phase 2):** 회원이 자기가 신청한 모임을 즉시 인지하도록 두 곳에 신호 노출. UX 원칙(Refactoring UI · Linear 패턴): 컨테이너 중첩 금지, 영속 상태는 inline. (1) 모임 상세에서 `confirmed` 또는 `pending_transfer`면 `RegistrationHero` inline strip(높이 ~40px, primary-50 배경 + primary-200 외곽선 + ✓ 동그라미 + "신청 완료" + 인사 메타 + D-Day pill — D-3 이하 accent-500 강조 / D-4 이상 primary-100 부드러움) 렌더. `confirmed`/`pending_transfer` 동일 표시(운영자 입금 확인 지연 시 회원 안심). `waitlisted`만 작은 `RegistrationStatusBadge`. `pending_transfer` 본인에게는 모임 정보 카드 아래에 입금 안내 박스도 함께 표시(입금 잊음 방지). (2) 홈(/)에서 본인 신청 모임(confirmed+pending_transfer+waitlisted) 1건+ 시 CalendarStrip 아래에 `MyMeetingsSection` 그룹(박스 외피 없음 — 작은 16×16 ✓ 동그라미 + "N님이 신청한 모임 · N건" 그룹 헤더 + 카드 리스트) 표시. "전체 일정"도 동일 형식 그룹 헤더(✓ 없음, neutral-600)로 연속 흐름. 임박순 정렬, **confirmed/pending_transfer는 동일하게 D-Day 뱃지**(D-3 이하 accent-500 진한 배경 강조, 당일은 `오늘 H:MM`), `waitlisted`는 "대기 중" 뱃지. 4건 초과 시 더보기 토글. 캘린더 필터 적용 시 섹션 숨김. 전체 일정 그룹에서는 신청 모임 제외(중복 방지). 운영자도 동일 적용
- **입금자명 형식:** 계좌이체 입금자명은 `M/D 닉네임` 형식 (예: `5/17 초록고래`). 모임명 포함 시 너무 길어 은행 입금자명 12자 한도 초과 위험 + 운영자 식별 편의. `MeetingDetailContent`에서 단일 진입점
- **Button logic:** Determined by `confirmed`/`waitlisted` registration existence + meeting timing (see PRD §6-2)
- **Deletion refund:** Always 100% regardless of refund policy dates (confirmed + waitlisted 모두)
- **Duplicate prevention:** DB Function detects existing confirmed registration and rejects
- **대기 취소:** 항상 100% 전액 환불 (환불 규칙 미적용)
- **돈 안전성:** `waitlisted` 상태에서 safeCancel/부분환불 절대 금지. 대기 취소/크론 환불/모임 삭제에서만 환불
- **계좌이체 브릿지:** `pending_transfer` = 정원 포함 but 미입금. 운영자 수동 확인 → `confirmed`. 이체 건 환불은 운영자 수동 이체
- **계좌이체 입금 확인 알림 금지:** `admin_confirm_transfer` 성공 시 회원에게 알림톡 발송하지 **않음**. 운영자가 월말 정산일에 하루 몰아서 입금 확인을 처리하므로 동시다발 알림이 회원 혼란을 유발. 카드결제 플로우만 즉시 알림 유지. (2026-04-23 확정)
- **역할 권한 매트릭스** (2026-04-23 확정):
  - `admin`(총괄운영자): 전체 권한. 정산, 회원 개인정보(phone/email) 열람, 사이트 설정, 배너·한줄 관리 포함
  - `editor`(운영진): 모임 CRUD, 회원 조회(이름/닉네임/지역만 — phone/email 미노출), **배너·한줄 관리 포함**
  - `member`(회원): 일반 회원 기능
  - adminOnly 메뉴: 정산, 회원 개인정보, 사이트 설정 (배너·한줄은 editor도 가능)
- **법적 확인 완료** (2026-04-23): 간이과세자이므로 전자상거래법 시행령 §12 제1항 제2호에 따라 **통신판매업 신고 면제**. GA4 동의 배너는 현 규모(250명, 한국 국내)에서 법적 의무 아님 — privacy 페이지에 쿠키 안내 문구로 갈음. 상세 근거: `검토문서/2026-04-23-풀스캔-후속-의사결정.md`

---

## Working with This Repository

- **Language:** All planning documents are written in Korean. Maintain Korean when editing core and roadmap documents.
- **Core documents are authoritative:** `/core` documents define the spec. When implementing, always cross-reference these specs — do not rely on memory or summaries alone.
- **Roadmap documents track execution:** `/roadmap` is maintained by Claude. When a WP is completed, update `milestones.md` status and mark completed scenarios in `scenarios.md`.
- **Review flow:** `/검토문서` captures post-hoc analysis. When reviews identify issues, create a 수정 계획 (modification plan) listing exact edit locations before modifying core/roadmap docs.
- **Version awareness:** Core documents carry version numbers (e.g., v1.6, v1.3). Note the version when referencing specific sections.
- **Cross-repo workflow:** The implementation repo lives at `jidokhae-web/`. The `prompts` file contains a template for starting WP implementation — substitute `--단계` with the target WP (e.g., `WP1-1`) when using it.
- **지시서의 enum/선택지 목록은 구현 전에 확인:** 지시서에 고정 목록(예: 지역 3개)이 있어도 실제 서비스 맥락에서 충분한지 사용자에게 먼저 물어볼 것. 구현 후 목록이 바뀌면 DB CHECK 제약까지 연쇄 수정 필요.
- **DB 마이그레이션 SQL은 코드 확정 후 안내:** CHECK 제약, 컬럼 타입 등 코드와 동기화가 필요한 마이그레이션은 스펙이 확정된 후에 사용자에게 전달. 코드보다 먼저 실행되면 불일치가 발생한다.
- **Phase 3 설계 검토 자료:** `docs/expert-panel/2026-04-17-phase3-preview-html-review.md` (전문가 패널 리뷰), `phase3-preview.html` (Before/After 목업). M7 이후 UI/UX 결정의 배경 맥락.
- **운영자 UI 변경 시 사후 잔재 4시나리오 사전 점검** (2026-04-27 교훈, `memory/feedback_2026-04-27_post-state-leftovers.md`): 카운트·라벨·토글 신설/수정 전에 (1) 며칠 잠수 누적 자동 만료 여부, (2) 상위 엔티티(모임) 삭제 후 잔재 처리 경로(deleted 모임 admin 상세 접근 가능 여부), (3) 토글 누락 정정 경로(unmark/OFF), (4) 회원 측 후속 행동 시 운영자 식별 정보(전화번호·계좌 등) 표시 여부를 plan에 명시 점검할 것.

---

## Branching & Deployment Strategy

**원칙 (2026-04-21 확정, Phase 3 M7부터 적용):**
마일스톤은 하나로 구현하고, 배포는 WP 묶음 단위로 split한다.

### 구현 단계
- 마일스톤(M7, M8, …)의 모든 WP를 `feat/phaseN-mX` 브랜치 하나에 순차 commit으로 누적
- 각 WP는 prelaunch 통과 후 commit. 마일스톤 전체 완료까지 한 브랜치에서 진행
- 마일스톤 완료 시 `backup/phaseN-mX-full` 백업 브랜치 생성 + origin push (cherry-pick 소스 보존)

### 배포 단계 (split)
- 배포 = 영향 대상 기준 묶음별 별도 브랜치 + 별도 PR
- **묶음 기준 3가지**:
  1. **안정성/백엔드/DB** — 사용자 화면 영향 0 (풀스캔, schema, 타입, cron, API 응답 형식, PWA Service Worker 등)
  2. **운영자 개편** — admin UI 변경 (본인이 직접 검증 가능)
  3. **회원 변화** — 회원 화면 변경 (250명 노출, 가장 신중)
- **기본 배포 순서**: 안정성 → 운영자 → 회원 (사용자가 admin 먼저 검증한 뒤 회원 공개)
- 각 묶음: `main`에서 `feat/phaseN-stepK-<slug>` 브랜치 생성 + `git cherry-pick <commits>` + push + PR
- 순차 머지 원칙: 한 묶음 머지 + 1~2일 모니터링 후 다음 묶음 착수
- 예시 (M7): `step1-stable` (WP7-1+7-2) → `step2-admin-overhaul` (WP7-3+7-4) → `step3-member-home` (WP7-5)

### Cherry-pick 주의
- 각 step의 cherry-pick 소스는 `backup/phaseN-mX-full` 브랜치의 해당 commit SHA
- conflict 최소화를 위해 마일스톤 내 WP는 가능한 한 별도 파일에 작성 (교훈: feedback_phase_structure)
- prod DB schema 마이그레이션은 안정성 step에 포함 (사용자 화면 영향 없으므로 먼저 배포 가능)

### 검증 전략
- **Option A — Preview**: Vercel preview에서 검증. Supabase + Kakao OAuth redirect URL에 preview 도메인 추가 필요 (1회 설정 후 재활용)
- **Option B — Prod 직접**: 사용자 영향 0인 안정성 step만 prod 직접 검증 + 이상 시 `git revert`
- UI 변경이 있는 step은 반드시 Option A (preview)로 검증

### Preview 환경 주의 (중요)
- Vercel Preview는 **prod Supabase에 그대로 연결** (별도 staging 아님). 검증 시 prod 데이터 실제 변경됨
- 테스트 모임은 즉시 삭제. 카드 결제 테스트 금지 (계좌이체로만)
- Preview env vars가 prod와 동일한지 Vercel Dashboard에서 확인

### 롤백
- 머지 직후 이상 시 `git revert -m 1 <merge-commit-sha>` + push → 2-3분 내 prod 복구
- DB schema는 revert하지 않음 (코드만 revert, schema는 forward-compatible하게 설계)
- 이후 step이 이미 머지된 상태에서 이전 step revert는 의존성 충돌 가능 — 각 step 머지 후 충분히 모니터링 후 다음 step 진행

---

## Implementation Codebase (`jidokhae-web/`)

### Development Commands

```bash
cd jidokhae-web
npm run dev         # Start dev server (http://localhost:3000)
npm run build       # Production build
npm run lint        # ESLint 9 flat config (eslint-config-next with core-web-vitals + typescript)
npm run test        # Vitest 4 (unit tests: kst, refund)
npm run test:watch  # Vitest watch mode
npm run prelaunch   # lint + tsc + test + build (full QA pipeline)
npm run start       # Start production server
npx tsc --noEmit    # Type check only (no emit)
```

Run a single test file:
```bash
cd jidokhae-web
npx vitest run src/lib/__tests__/kst.test.ts
```

**Local preview limitation:** `(main)` route group pages require Kakao OAuth login. Since the OAuth callback redirects to the production domain (not localhost), **authenticated pages cannot be tested locally**. Use Vercel production/preview deployments to verify `(main)` and `(admin)` page changes. Only `policy/*` and `auth/*` pages are accessible on localhost.

Verification & utility scripts (require `.env.local` with Supabase keys):
```bash
npx tsx scripts/verify-m1.ts         # Verify M1 deliverables
npx tsx scripts/verify-m1-rls.ts     # Verify RLS policies
npx tsx scripts/check-member-regs.ts # Check member registrations
npm run verify:prod                  # Verify production deployment
npm run screenshot                   # Capture UI screenshots (Playwright)
```

### Architecture

- **Route groups:** `src/app/(main)/` for authenticated member pages, `src/app/(admin)/` for admin pages, `src/app/auth/` for login/callback, `src/app/policy/` for public pages (about, terms, privacy, refund, meetings — no auth required). Key member routes: `meetings/[id]/page` (detail), `meetings/[id]/confirm/page` (pre-payment confirmation), `meetings/[id]/payment-redirect/page` (post-payment handler), `meetings/[id]/payment-fail/page` (failure), `my/page` (my registrations + 상단 '내 정보' 프로필 자가 수정 섹션 — 닉네임 1회 변경·전화·지역·이메일). Admin routes (Phase 3 M7 Step 2에서 재구성 — 데스크톱 사이드바 + 모바일 드로어): `admin/page` (허브 — WP7-3), `admin/meetings` (목록 + 지역 필터), `admin/meetings/[id]` (상세), `admin/meetings/new` (생성), `admin/meetings/[id]/edit` (수정), `admin/members` (회원 관리), `admin/settings` (사이트 설정 + 공간 관리), `admin/banners` (M8 placeholder, admin 전용), `admin/quotes` (M8 placeholder), `admin/settlements` (M10 placeholder, admin 전용). 사이드바 메뉴는 `src/components/admin/adminMenu.ts`가 단일 소스 (운영/콘텐츠/시스템 3그룹). Public routes: `policy/meetings` (공개 모임 목록), `policy/meetings/[id]` (공개 모임 상세)
- **Middleware** (`src/middleware.ts`): Refreshes Supabase session on every request, redirects unauthenticated users to `/auth/login`, redirects authenticated users away from `/auth`. Skips `/auth/callback` (preserve PKCE cookies), `/policy/*` (public pages), `api/webhooks/` (PortOne/PG verification), and `api/cron/` (Vercel Cron — CRON_SECRET auth)
- **Layouts:** Root (`src/app/layout.tsx` — fonts, viewport), `(main)/layout.tsx` (header + BottomNav + Footer, auth required), `(admin)/layout.tsx` (admin header + Footer, admin/editor role check), `policy/layout.tsx` (Footer only, public), `auth/layout.tsx` (Footer only, public — PG 심사 대응)
- **Supabase clients** (`src/lib/supabase/`): `server.ts` (Server Components, anon key), `client.ts` (Client Components, anon key), `admin.ts` (API Routes, service_role key)
- **Tailwind v4:** Design tokens defined via `@theme inline` in `src/app/globals.css` — NOT `tailwind.config.ts`. Design system: "잉크 그린 × 에디토리얼" (2026-07-07 2535 리디자인) — Primary: Ink Green `#127A5A` (`--color-primary-*`, 워드마크·링크·강조 **포인트**; 그린은 점이지 면이 아님), Accent: Citrus Coral `#F4552A` (`--color-accent-*`, 긴급·희소·에러·필수 표시에만), Neutral: Cool Warm Gray (`--color-neutral-*`, `neutral-50`=#F9FAFB off-white base), Surface: off-white/그레이 (`--color-surface-*`, legacy). 참가비 금액은 무채색(단위 없이 숫자만), 스텝 할인만 그린 강조. Fonts: Noto Serif KR (워드마크·히어로·책/모임 제목만), Pretendard (body). See `jidokhae-web/DESIGN_TOKENS.md` for full token reference
- **Layout:** Mobile-first single-column (`max-w-screen-sm`), bottom tab navigation (`BottomNav`), iOS safe area support
- **Path alias:** `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- **DB migrations:** `supabase/migration.sql` (full schema) + `fix-rls-recursion.sql` (RLS patches) — run manually in Supabase SQL Editor (no CLI migration)
- **No generated Supabase types** — manual type definitions in `src/types/meeting.ts`, `src/types/registration.ts`, `src/types/notification.ts`, `src/types/venue.ts`, Supabase responses cast with `as Meeting` or `as Registration`
- **Component directories:** `src/components/` organized by domain — `admin/`, `meetings/`, `registrations/`, `home/`, `my/`, `skeletons/`, `ui/`
- **Error/Loading boundaries:** Each route group has `error.tsx` and `loading.tsx` files

### Database Schema

**Tables:** `profiles` (user info, role, phone, region, real_name, welcomed_at, `nickname_changed_at` — 닉네임 1회 변경 추적, 마이페이지 자가 수정용. `migration-mypage-profile.sql`), `meetings` (schedule, capacity, fee, description, venue_id, status; Phase 3 M7 Step 1에서 `region`, `is_featured`, `chat_link`, `reading_link`, `detail_address` 5개 컬럼 추가), `registrations` (user+meeting, payment, refund tracking, `attended` boolean — 현재 미사용/향후 노쇼 대응용 예약 컬럼, status: confirmed/cancelled/waitlisted/waitlist_cancelled/waitlist_refunded), `notifications` (알림톡 발송 이력, status: pending→sent/failed/skipped), `site_settings` (key-value 운영 설정), `venues` (공간 + 정산 설정), `venue_settlements` (월별 공간 정산 이력), `banners` (CMS 배너 — M8 예정, schema는 M7 Step 1에서 선반영), `book_quotes` (한 줄 quote — 제출/검수/발행 워크플로우, M8 예정)

**Key indexes:** `idx_registrations_meeting_status`, `idx_registrations_user_meeting`, `idx_registrations_payment_id` (idempotency), `idx_registrations_waitlist` (partial — 대기자 순번), `idx_meetings_date_status` (home page query), `idx_notifications_remind_unique` (partial UNIQUE — 리마인드 중복 방지), `idx_notifications_confirm_unique` (partial UNIQUE — 신청 확인 중복 방지), `idx_profiles_nickname_unique` (partial — WHERE nickname <> ''), `idx_meetings_featured` (partial — is_featured = true), `idx_banners_active` (partial — active = true), `idx_book_quotes_pending` (partial — status = 'pending')

**Key DB Functions (SECURITY DEFINER):**
- `is_admin()` — Returns true if current user has admin role. Used in RLS policies
- `is_editor_or_admin()` — Returns true if current user has editor or admin role. Used in meetings INSERT/UPDATE RLS, registrations SELECT RLS, profiles SELECT RLS
- `confirm_registration(p_user_id, p_meeting_id, p_payment_id, p_paid_amount)` — Atomic capacity check + INSERT with `FOR UPDATE` row lock. Returns: 'success' | 'not_found' | 'not_active' | 'already_registered' | 'waitlisted'
- `promote_next_waitlisted(p_meeting_id)` — Atomic waitlist promotion with `FOR UPDATE` lock. Returns promoted (id, user_id) or empty
- `get_confirmed_counts(meeting_ids UUID[])` — Batch count of confirmed registrations per meeting (avoids N+1 queries)
- `register_transfer(p_user_id, p_meeting_id, p_paid_amount)` — 계좌이체 전용 원자적 정원 체크 + INSERT. FOR UPDATE 락. Returns: 'pending_transfer' | 'waitlisted' | 'already_registered' | 'not_found' | 'not_active'
- `admin_confirm_transfer(p_registration_id)` — 운영자의 입금 확인을 원자적으로 처리. registration + meeting FOR UPDATE 락 + 정원 재검증 + status 'pending_transfer' → 'confirmed' 전환. Phase 3 M7 Step 2.5에서 추가. editor 다수 동시 확인 시 정원 초과 방지 목적. Returns: 'success' | 'not_found' | 'not_pending' | 'not_active' | 'capacity_full'
- `get_meeting_participant_nicknames(p_meeting_id)` — 모임 참여자 닉네임 명단 반환 RPC. SECURITY DEFINER + search_path=''. 호출자가 해당 모임에 `confirmed` 또는 `pending_transfer`면 명단(confirmed+pending_transfer 닉네임, created_at ASC) 반환, 운영자(admin/editor)는 본인 신청 여부 무관 반환, 그 외(비로그인/미신청/대기)는 빈 배열. 회원 피드백 반영. 마이그레이션: `migration-feedback-participants.sql`

**Triggers:** `on_auth_user_created` auto-creates profile from Kakao metadata on signup. `meetings_updated_at` auto-updates `updated_at` on meeting changes.

### Code Conventions

- **Server Components by default** — pages are async Server Components that fetch data and pass props down. Client Components (`'use client'`): `BottomNav`, `LogoutButton`, `MeetingActionButton`, `MeetingForm`, `MeetingCard`, `MeetingsView`, `CalendarStrip`, `DeleteMeetingButton`, `RegistrationCard`, `ModalOverlay`, `WelcomeScreen`, `ProfileSetup`, `RegionPicker` (ProfileSetup·ProfileEditor 공용 지역 선택), `ProfileEditor` (마이페이지 프로필 보기↔편집), `MemberList`, `LoginClient`, `SiteSettingsForm`, `VenueManager`, `VenueSettlementTable`, `AdminDashboardContent`, `HomeContent`, `MeetingDetailContent`, `MyRegistrationContent`, `payment-redirect/page`, `payment-fail/page`, route group `error.tsx` files. Server Components: `MeetingDetailInfo`, `DateSectionHeader`, `AdminMeetingCard`, `AdminMeetingSection`, `EmptyMeetings`, `ProfileSection` (마이페이지 프로필 데이터 페치 + ProfileEditor 렌더), `Footer` (사업자정보 푸터). Note: `auth/login/page` is a Server Component that renders `<LoginClient />` (Client Component)
- **No semicolons**, single quotes, function components only
- **Inline SVG icons** — no icon library. Icons defined as inline SVG in components
- **Admin access dual-layered:** layout-level role check (redirect) + DB-level RLS via `is_admin()` / `is_editor_or_admin()` SECURITY DEFINER functions
- **Mutation pattern in client components:** `router.push() + router.refresh()` after mutations (no `revalidatePath`)
- **Parallel data fetching:** `Promise.all()` in page components for concurrent Supabase queries
- **Next.js 16 params:** Dynamic route params are `Promise<{ id: string }>` (await required)
- **KST date utilities:** Always use `src/lib/kst.ts` functions (`getKSTToday()`, `getTomorrowKST()`, `toKSTDate()`, `formatKoreanDate()`, `formatKoreanDateFull()`, `formatKoreanTime()`, `formatFee()`, `getDaysUntil()`, `getMeetingTiming()`, `getButtonState()`), never `new Date()` directly. `formatFee()` returns number-only string (e.g., `"10,000"`) — no '원' suffix
- **API routes** (`src/app/api/`): `registrations/confirm` (M4 payment + 알림톡), `registrations/cancel` (M5 cancel + 대기자 자동 승격), `registrations/waitlist-cancel` (대기 취소 전액 환불), `meetings/[id]/delete` (M5 admin delete+refund, confirmed+waitlisted 모두), `webhooks/portone` (M4 backup + 알림톡, `PORTONE_WEBHOOK_SECRET` 서명 검증), `webhooks/tosspayments` (레거시, 미사용), `admin/members/staff` (스텝 자격 `is_staff` 토글, admin 전용), `cron/meeting-remind` (Vercel Cron 리마인드 KST 19:00), `cron/waitlist-refund` (미승격 대기자 자동 환불 KST 18:30), `welcome`, `profile/setup`, `profile/update` (마이페이지 프로필 자가 수정 — 부분 수정, 닉네임 1회 변경 낙관적 락 + 중복 409, 본인 행만), `admin/members/role` (역할 변경), `admin/settings` (site_settings UPSERT), `admin/venues` (공간 CRUD), `admin/venues/[id]` (공간 수정), `admin/venues/settle` (정산 확정), `registrations/transfer` (계좌이체 신청), `admin/registrations/confirm-transfer` (운영자 입금 확인), `admin/registrations/mark-refunded` (운영자 환불 완료). All use service_role Supabase client, cookie-based auth (cron은 CRON_SECRET auth)
- **API response 표준 포맷:** `{ status: 'success' | 'error', message?, data? }` (Phase 3 M7 Step 1에서 12개 라우트 통일). 신규 API 라우트는 이 포맷을 따를 것. 기존 `{ success: true }` 패턴은 점진적 마이그레이션 중
- **Business logic in `src/lib/`**: `payment.ts` (confirmation), `cancel.ts` (cancellation, returns meetingId for promotion trigger), `waitlist.ts` (대기 승격 래퍼 + 대기 취소), `refund.ts` (refund calculation + `REFUND_RULES` 상수 — paid_amount 기반이라 스텝 할인 결제도 비율 환불), `portone.ts` (PortOne V2 server SDK 래퍼 — `getPayment`/`cancelPayment`), `tosspayments.ts` (레거시 TossPayments 래퍼, 미사용 잔존), `pricing.ts` (스텝 할인 가격 계산 단일 진입점 — `isStaffEligible`/`calculateFee` + 상수), `staff-slot.ts` (스텝 슬롯 카운트 + `getDisplayFee()`), `auth.ts` (cached `getUser()` via React `cache()` — safe only after middleware session refresh), `profile.ts` (cached `getProfile()` via React `cache()`), `profile-update.ts` (순수 검증 헬퍼 `resolveProfileUpdate` — 마이페이지 프로필 수정 규칙, Vitest 단위 테스트), `meeting.ts` (cached `getMeeting(id)` via React `cache()`), `notification.ts` (알림톡 5종 발송 + notifications 이력), `solapi.ts` (Solapi SDK 래퍼), `regions.ts` (`VALID_REGIONS` 상수 — 13개 지역), `site-settings.ts` (cached `getSiteSettings()` — service_role, React `cache()`), `dashboard.ts` (대시보드 집계 — 매출, 모임, 회원, 알림, 장소 정산). Shared between API routes — keep logic here, not in route handlers
- **Shared UI components:** `ModalOverlay` (`src/components/ui/ModalOverlay.tsx`) — reusable accessible modal with ESC key handling, focus management, backdrop blur. Used by `DeleteMeetingButton` and `MeetingActionButton`
- **Unit tests:** Vitest with `@/*` path alias and `globals: true`. **단, 테스트 파일에는 `import { describe, it, expect } from 'vitest'`를 명시할 것** — `globals: true`라 `vitest run`은 import 없이도 통과하지만, `prelaunch`의 `npx tsc --noEmit`가 테스트 파일도 타입 검사하므로 import 없으면 TS2304/TS2582로 실패. 검증은 `vitest run`만으로 끝내지 말고 tsc까지 돌릴 것. Tests in `src/lib/__tests__/` (kst, refund, pricing, visibility, profile-update). Run `npm test` or `npx vitest run`
- **Verification scripts & manual checklists:** `scripts/verify-m1*.ts`, `검토문서/` for manual testing checklists

### Payment Flow (M4)

> **PortOne V2 핵심 차이:** 토스는 `confirmPayment` 호출로 돈을 이동시켰지만, PortOne V2는 결제창에서 완료 시 **이미 승인된 상태**로 redirect. 따라서 서버는 `getPayment()`로 검증만 한다.

1. Client (`@portone/browser-sdk`) → `PortOne.requestPayment({ storeId, channelKey, paymentId, orderName, totalAmount, payMethod: 'EASY_PAY', ... })` (카카오페이 채널)
2. User completes payment on PortOne/카카오페이 결제창
3. PortOne redirects to `/meetings/[id]/payment-redirect?paymentId=...&transactionType=PAYMENT&txId=...` (실패/취소 시 `?paymentId=...&code=...&message=...`)
4. Redirect page calls `POST /api/registrations/confirm` with `paymentId`
5. API Route: auth check → `processPaymentConfirmation()` → `getPayment(paymentId)` 로 `status === 'PAID'` + 금액 검증 → `confirm_registration()` RPC (atomic DB insert — returns 'success' or 'waitlisted')
6. Webhook backup at `/api/webhooks/portone` (`PORTONE_WEBHOOK_SECRET` 서명 검증) handles missed redirects

**paymentId(주문번호) format:** `jdkh-{meetingId8}-{userId8}-{timestamp}` where `{meetingId8}` and `{userId8}` are the first 8 hex chars of the UUID (dashes stripped). Webhook reconstructs full UUIDs via `LIKE '{8chars}%'` prefix queries. PortOne의 `paymentId`가 기존 orderId/paymentKey 역할을 통합.

**Safety patterns:** payment_id idempotency (no double-charge), atomic capacity check via DB function with `FOR UPDATE` lock, rollback refund if DB insert fails

### Cancel/Refund Flow (M5)

1. User clicks "취소하기" → info modal (refund rate/amount) → confirm modal → API call
2. `POST /api/registrations/cancel` → `processUserCancel()` → `cancelPayment()` (PortOne) → DB update → `promoteNextWaitlisted()` (자동 승격)
3. Admin delete: `POST /api/meetings/[id]/delete` → set `deleting` → `Promise.allSettled` parallel refund (confirmed + waitlisted 모두) → `deleted`

**Safety patterns:** optimistic lock with `.eq('status', 'confirmed')` + `.select('id')` to detect 0-row updates, race condition handling via `getPayment()` status check, partial failure retry (meeting stays `deleting`)

### Notification Flow (Phase 2-1)

**알림톡 5종:** Solapi SDK (`src/lib/solapi.ts`) → KakaoTalk 알림톡

1. **신청 완료 확인** (이벤트 기반): 결제 성공 → API Route/웹훅에서 `sendRegistrationConfirmNotification()` 호출 (fire-and-forget, try-catch)
2. **모임 전날 리마인드** (Vercel Cron): `GET /api/cron/meeting-remind` — 매일 KST 19:00 (UTC `0 10 * * *`). 내일 active 모임의 confirmed 신청자에게 발송
3. **대기 신청 확인** (이벤트 기반): 결제 성공 → confirm/webhook에서 `sendWaitlistConfirmNotification()` 호출
4. **대기 승격 확정** (이벤트 기반): 확정자 취소 → `promoteNextWaitlisted()` → `sendWaitlistPromotedNotification()` 자동 발송
5. **미승격 자동 환불** (Vercel Cron): `GET /api/cron/waitlist-refund` — 매일 KST 18:30 (UTC `30 9 * * *`). `date <= tomorrow` catch-up 쿼리로 실패 건 자동 재시도

**중복 방지 패턴:** INSERT(pending) → Solapi 발송 → UPDATE(sent/failed). Partial UNIQUE INDEX가 INSERT 단계에서 위반 → 발송 전 중복 차단. 에러코드 `23505` = skip 처리.

**알림은 부가 기능** — 실패해도 결제/신청 흐름을 중단시키지 않음. `payment.ts`는 수정하지 않고 API Route 레벨에서 호출.

### Waitlist Flow (Phase 2-2)

1. **대기 신청**: 정원 초과 → PortOne 결제(기존과 동일) → `confirm_registration()` RPC가 `waitlisted` INSERT → 결제 유지, 환불 안 함
2. **자동 승격**: 확정자 취소 → cancel API에서 `promoteNextWaitlisted()` 호출 → DB 함수가 FOR UPDATE 락으로 원자적 승격 → 알림톡
3. **대기 취소**: `POST /api/registrations/waitlist-cancel` → 항상 100% 전액 환불 (환불 규칙 미적용)
4. **크론 자동 환불**: 매일 KST 18:30, `date <= tomorrow`인 모임의 waitlisted → 전액 환불 + 알림톡
5. **모임 삭제**: confirmed + waitlisted 모두 100% 환불

**돈 안전성 규칙:** `waitlisted` → safeCancel/환불 절대 금지. 대기 취소/크론 환불/모임 삭제에서만 환불.

### UI Behavior Details

- **MeetingCard capacity threshold:** At 80% capacity (`confirmedCount >= capacity * 0.8`), capacity text turns `text-accent-500` (orange warning)
- **Status color tokens:** `globals.css` defines `--color-status-open`, `--color-status-closing`, `--color-status-full`, `--color-status-completed`, `--color-status-cancelled` — used by MeetingCard left border
- **MeetingForm uses browser Supabase client** (anon key + RLS) for create/edit — admin writes go through RLS `is_editor_or_admin()` policy, not service_role
- **Admin layout role check** uses `getProfile()` (cached via React `cache()`) — same request deduplication with other profile reads. Checks for `admin` or `editor` role
- **CalendarStrip** (`src/components/meetings/CalendarStrip.tsx`): Weekly view shows **single week** with `<` `>` button navigation (no horizontal scroll). Month view toggles to full month grid. Month label shows "N-M월" when week spans month boundary. All date arithmetic uses `getUTC*()` methods with `parseDate()` (`+09:00` KST offset)
- **WelcomeScreen + ProfileSetup gates** on home page: first-time users see welcome → profile setup → meeting list

### Environment Variables

Copy `jidokhae-web/.env.example` to `jidokhae-web/.env.local` and fill in values:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase admin access
- `NEXT_PUBLIC_PORTONE_STORE_ID` / `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` / `PORTONE_API_SECRET` / `PORTONE_WEBHOOK_SECRET` — PortOne V2 (카카오페이) 결제
- `NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY` / `TOSSPAYMENTS_SECRET_KEY` — TossPayments (레거시, 롤백용 잔존)
- `SOLAPI_API_KEY` / `SOLAPI_API_SECRET` — Solapi 알림톡 API
- `SOLAPI_KAKAO_CHANNEL` / `SOLAPI_SENDER_PHONE` — KakaoTalk 채널 + 발신번호
- `SOLAPI_TEMPLATE_REMIND` / `SOLAPI_TEMPLATE_CONFIRM` / `SOLAPI_TEMPLATE_WAITLIST_CONFIRM` / `SOLAPI_TEMPLATE_WAITLIST_PROMOTED` / `SOLAPI_TEMPLATE_WAITLIST_REFUNDED` — 알림톡 템플릿 ID 5종
- `CRON_SECRET` — Vercel Cron 인증 토큰
- `NEXT_PUBLIC_GA_ID` — GA4 측정 ID (예: `G-0N0VWXM2JB`)

### Analytics (Phase 2-4)

**Vercel Analytics** (페이지뷰, 디바이스, 리퍼러) + **GA4** (이벤트 퍼널, 전환율 분석) 조합.

- **글로벌 설정:** `src/app/layout.tsx` — `<Analytics />`, `<SpeedInsights />`, GA4 `<Script>` (GA_ID 포맷 검증 후 조건부 렌더링)
- **SPA 라우트 추적:** `src/components/analytics/RouteChangeTracker.tsx` — `usePathname()` + `useSearchParams()` 감시, 민감 파라미터(`paymentKey`, `orderId`, `amount`) 자동 필터링
- **이벤트 유틸리티:** `src/lib/analytics.ts` — `trackEvent(name, params)` 래퍼 (`window.gtag?.()` 안전 호출)
- **타입:** `src/types/gtag.d.ts` — `window.gtag` 글로벌 타입 선언

**추적 퍼널 (GA4 Ecommerce 표준):**

| 이벤트 | 위치 | 트리거 |
|--------|------|--------|
| `view_item_list` | `MeetingsView.tsx` | 모임 목록 마운트 시 1회 |
| `view_item` | `TrackMeetingView.tsx` | 모임 상세 진입 (인증+공개 페이지) |
| `begin_checkout` | `MeetingActionButton.tsx` | 신청/대기신청 버튼 클릭 |
| `purchase` | `payment-redirect/page.tsx` | 결제 성공 (confirmed/waitlisted 구분) |
| `purchase_failed` | `payment-redirect/page.tsx` | 결제 실패/정원 초과 |
| `refund` | `MeetingActionButton.tsx` | 취소 완료 (confirmed/waitlist 구분) |

### Deployment

- **Vercel** — auto-detected Next.js settings + `vercel.json` for cron schedules
- `vercel.json` defines 2 cron jobs: `/api/cron/waitlist-refund` (UTC `30 9 * * *` = KST 18:30), `/api/cron/meeting-remind` (UTC `0 10 * * *` = KST 19:00)
- No Dockerfile, no GitHub Actions CI/CD
- **Playwright** is a devDependency for `npm run screenshot` (UI screenshot capture), not for E2E testing
