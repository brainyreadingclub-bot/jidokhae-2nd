# JIDOKHAE Phase 3 Work Packages

> 이 문서는 `roadmap/milestones-phase3.md`의 각 Milestone(M7~M12)을 **실행 가능한 Work Package(WP)** 단위로 분해한 문서입니다.
> 각 WP는 Vertical Slice 원칙에 따라 사용자(회원 또는 운영자) 가치를 전달하며, WP 완료 시 소프트웨어는 **동작하는 상태**입니다.
> 테크 리드 관점에서 "이 WP만 끝나도 배포 가능한가?"를 기준으로 분해했습니다.

---

## 읽는 법

| 용어 | 의미 |
|------|------|
| WP | Work Package — Milestone 내 실행 단위 |
| 선행 조건 | 이 WP를 시작하기 전에 완료되어야 하는 항목 |
| 사용자 가치 | 이 WP가 끝났을 때 회원/운영자가 얻는 구체적 가치 |
| 검증 기준 | WP 완료를 판단하는 구체적 테스트 |

**의존성 흐름:**

```
WP7-1 → WP7-2 → WP7-3 → WP7-4 → WP7-5
                   ↓                ↓
                WP8-1, WP8-2     (M7 완료)
                   ↓
                WP9-1, WP9-2, WP9-3, WP9-4, WP9-5 (순서 무관, 병렬 가능)
                WP10-1, WP10-2, WP10-3 (M8 이후, M9와 병렬 가능)
                   ↓
                WP11-1, WP11-2
                   ↓
                WP12-1 → WP12-2
```

**Phase 3 WP 총괄:**

| Milestone | WP 수 | 주요 WP |
|-----------|:----:|---------|
| M7 | 5 | 풀스캔 정리, DB 확장, 사이드바, 모임관리 분리, 3탭 |
| M8 | 2 | 배너 CMS, 한 줄 승인 |
| M9 | 5 | 배너, D-Day, 한 줄 표시, 소셜 프루프, 인라인 배너 |
| M10 | 3 | 정산 고도화, 생애주기, 모임 폼 2차 |
| M11 | 2 | 토큰 하드코딩 제거, 접근성 |
| M12 | 2 | 회귀 검증, 배포 |
| **합계** | **19** | |

**UI 선행 규칙:** 신규 UI 구성이 포함된 WP는 **코드 작성 전 `/frontend-design` 스킬 선행** 필수. 각 WP 내 UI 작업 절에 명시.

---

# M7. 기반 정리 + 레이아웃 전환

## WP7-1. 풀스캔 기존 이슈 정리

**목표:** Phase 3 공사 전에 배포 차단급 + 인프라 + UX 이슈 11건을 깨끗이 처리한다. 기능 추가 전 기술 부채 0 만들기.

**사용자 가치:** 운영자/회원 모두 보안·안정성 강화된 서비스 사용 (눈에 띄는 기능 변화 없음, 신뢰성 상승).

**선행 조건:** 없음 (Phase 2-4까지의 프로덕션 상태)

**UI 선행 필요:** 없음 (내부 로직/문구 수정)

**산출물:**

| # | 작업 | 대상 파일 |
|---|------|----------|
| 1 | S-1 웹훅 orderId 교차 검증 | `src/app/api/webhooks/tosspayments/route.ts` |
| 2 | S-2 paymentKey encodeURIComponent | `src/lib/tosspayments.ts` |
| 3 | S-3 payment.ts orderId 검증 | `src/lib/payment.ts` |
| 4 | S-4 웹훅 RPC 실패 시 환불 처리 | `src/app/api/webhooks/tosspayments/route.ts` |
| 5 | I-1 보안 헤더 (X-Frame-Options 등) | `next.config.ts` |
| 6 | I-2 TossPayments fetch 타임아웃 8초 | `src/lib/tosspayments.ts` |
| 7 | I-3 attendance API try-catch | `src/app/api/registrations/attendance/route.ts` |
| 8 | I-4 Cron waitlist-refund 병렬화 | `src/app/api/cron/waitlist-refund/route.ts` |
| 9 | I-5 confirm-transfer 정원 체크 | `src/app/api/admin/registrations/confirm-transfer/route.ts` |
| 10 | U-1 "입금 후 운영자 확인까지 대기합니다" 문구 삭제 | UI 컴포넌트 |
| 11 | U-2 API 응답 형식 통일 `{ status, message }` | 관련 API Route 전체 |

**검증 기준:**
- [ ] `npm run prelaunch` 통과 (lint + tsc + test + build)
- [ ] 풀스캔 재실행 시 Critical 0건 (이미 처리된 항목 제외)
- [ ] 기존 E2E 플로우(로그인 → 신청 → 결제 → 취소) 회귀 없음

---

## WP7-2. DB 마이그레이션 — meetings 확장 + banners + book_quotes

**목표:** Phase 3에서 필요한 DB 스키마를 한 번에 확장한다. 이후 WP가 이 스키마 위에서 진행된다.

**사용자 가치:** 직접 가치는 없음. 이후 WP8~WP9에서 사용자 가치로 변환됨 (기반 공사).

**선행 조건:** WP7-1 완료 권장 (안정 상태에서 마이그레이션)

**UI 선행 필요:** 없음 (DB 작업)

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | `meetings` 컬럼 추가 | region (TEXT DEFAULT '경주', NOT NULL), is_featured (BOOLEAN DEFAULT false, NOT NULL), chat_link (TEXT), reading_link (TEXT), detail_address (TEXT) |
| 2 | `banners` 테이블 생성 | id (UUID PK), title, description, link_url, image_url, is_active (BOOLEAN DEFAULT true), display_order (INT DEFAULT 0), created_at, updated_at |
| 3 | `book_quotes` 테이블 생성 | id (UUID PK), book_title, quote_text (CHECK LENGTH <= 200), submitted_by (FK→profiles), status (pending/approved/rejected), approved_at (nullable), created_at |
| 4 | banners RLS 정책 | select_active (로그인 유저, is_active=true만), admin_all (FOR ALL, admin) |
| 5 | book_quotes RLS 정책 | select_approved (로그인 유저), select_own (submitted_by = auth.uid()), select_editor_or_admin (is_editor_or_admin()), insert (본인 submitted_by만), update_editor_or_admin |
| 6 | Supabase Storage bucket 생성 | `banners` bucket (public read, admin write) |
| 7 | 타입 정의 추가 | `src/types/banner.ts`, `src/types/book_quote.ts` |

**검증 기준:**
- [ ] Supabase SQL Editor에서 마이그레이션 실행 성공
- [ ] `meetings`에 5개 컬럼 추가됨 (기존 레코드는 default 값 적용)
- [ ] `banners`, `book_quotes` 테이블 생성 + RLS 활성화
- [ ] 로그인 유저로 banners SELECT 시 `is_active=false`는 제외됨
- [ ] member role로 book_quotes INSERT 시 `submitted_by = auth.uid()` 강제
- [ ] Storage bucket에 이미지 업로드 가능 (admin 계정)

---

## WP7-3. 관리자 데스크톱 사이드바 레이아웃

**목표:** 관리자 페이지가 데스크톱에서는 좌측 사이드바, 모바일에서는 햄버거 메뉴로 동작한다. Phase 3 모든 관리자 기능의 레이아웃 기반.

**사용자 가치:** 운영자가 데스크톱 환경에서 한 화면에서 모든 관리 메뉴로 이동 가능. 현재 모바일-우선 UI의 답답함 해소.

**선행 조건:** WP7-2 완료 불필요 (레이아웃만)

**UI 선행 필요:** **`/frontend-design` 스킬 선행** — 사이드바 구조/햄버거 메뉴/반응형 breakpoint/active state

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | 사이드바 컴포넌트 | `src/components/admin/Sidebar.tsx`. 데스크톱(≥1024px) 고정 좌측, 모바일 햄버거 오픈 |
| 2 | 사이드바 메뉴 7종 | 대시보드, 모임 관리, 정산, 회원 관리, 설정, 배너 관리, 한 줄 관리 — 배너/한줄은 독립 메뉴 |
| 3 | (admin)/layout.tsx 개편 | 기존 모바일-only 헤더 → 사이드바 + 모바일 햄버거로 교체. admin/editor role 체크 유지 |
| 4 | 활성 메뉴 표시 | `usePathname()`으로 현재 경로와 매칭 |
| 5 | 로그아웃 + 사이트 이동 | 사이드바 하단에 "로그아웃 / 사이트로 돌아가기" |

**검증 기준:**
- [ ] 데스크톱(≥1024px)에서 좌측 사이드바 고정 렌더
- [ ] 모바일(<1024px)에서 햄버거 버튼 → 오버레이 오픈/닫힘 동작
- [ ] 각 메뉴 클릭 시 해당 경로 이동, active state 시각 표시
- [ ] admin/editor 역할 체크 유지 (기존 회귀 없음)
- [ ] 배너/한 줄 메뉴는 "준비 중" placeholder 페이지로 연결 (WP8에서 구현)

---

## WP7-4. 관리자 모임 관리 페이지 분리 + 모임 폼 1차 확장

**목표:** `/admin`에서 모든 기능이 뒤섞인 현 상태를 분리. 모임 목록은 `/admin/meetings`, 운영자 전용 상세는 `/admin/meetings/[id]`로. 대시보드는 허브로 재설정. 모임 폼에 region + is_featured 추가.

**사용자 가치:** 운영자가 모임 관리를 전용 페이지에서 수행. 목록 필터(진행중/지난달/전체 + 지역)로 데이터 조회 속도 향상. region 태깅으로 향후 필터링 기반 확보.

**선행 조건:** WP7-2 (meetings.region/is_featured 컬럼), WP7-3 (사이드바 메뉴)

**UI 선행 필요:** **`/frontend-design` 스킬 선행** — 대시보드 허브 구조(긴급 알림/이번 주 요약/핵심 수치 3개), 모임 관리 목록 필터, 모임 폼 확장 섹션

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | `/admin` 대시보드 허브화 | 긴급 알림 + 이번 주 요약 + 핵심 수치 3개 + 바로가기 (상세 수치는 M10) |
| 2 | `/admin/meetings` 신규 페이지 | 모임 목록 + 필터(진행중/지난달/전체 + 지역) |
| 3 | `/admin/meetings/[id]` 신규 페이지 | 운영자 전용 상세 (신청자 목록 + 입금 토글 + 재정 요약) — 기존 `/meetings/[id]`의 AdminMeetingSection 내용을 이동 |
| 4 | `/meetings/[id]` 정리 | AdminMeetingSection → "관리자 페이지에서 보기" 링크로 축소 |
| 5 | AdminMeetingCard 링크 재연결 | `/admin/meetings/[id]`로 |
| 6 | 모임 폼 region 필수 필드 | `VALID_REGIONS` select. 기본값 '경주' |
| 7 | 모임 폼 is_featured 체크박스 | 생성/수정 모두, edit initialValues 전달 |

**검증 기준:**
- [ ] `/admin` 접근 시 허브 화면 렌더 (모임 목록 아님)
- [ ] `/admin/meetings` 에서 필터 동작 (진행중/지난달/전체 + 지역 13개)
- [ ] `/admin/meetings/[id]` 에서 신청자/입금토글/재정 요약 동작
- [ ] `/meetings/[id]` AdminMeetingSection → "관리자 페이지에서 보기" 링크만 노출
- [ ] 모임 생성 시 region 미선택 저장 불가
- [ ] 모임 수정 시 is_featured 기존값이 체크박스에 반영됨

---

## WP7-5. 회원 탭 2→3탭 전환 (홈 뼈대)

**목표:** 회원 탭 구조를 "모임 일정 / 내 신청"에서 "홈 / 모임 일정 / 내 신청" 3탭으로 확장한다. 홈 탭 내용은 placeholder. 기본 랜딩은 모임 일정 유지.

**사용자 가치:** 회원이 새로운 "홈" 탭 존재를 인지. (실제 콘텐츠는 M9에서 채움)

**선행 조건:** WP7-2 불필요 (레이아웃만)

**UI 선행 필요:** **`/frontend-design` 스킬 선행** — 3탭 BottomNav, 홈 탭 placeholder 메시지

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | BottomNav 3탭 확장 | 홈 / 모임 일정 / 내 신청 |
| 2 | `/home` 라우트 신규 | placeholder 페이지 ("홈 탭 준비 중" 또는 최소 환영 메시지) |
| 3 | 기본 랜딩 유지 | 로그인 후 `/` (모임 일정)로 이동, `/home`은 수동 진입 |
| 4 | 탭 아이콘 + 레이블 | 홈 아이콘 추가 (inline SVG) |

**검증 기준:**
- [ ] BottomNav에 3탭 렌더
- [ ] `/home` 접근 시 placeholder 렌더
- [ ] 로그인 직후 기본 경로는 `/` (모임 일정)
- [ ] active tab 표시 정상

---

# M8. 관리자 CMS — 배너 + 한 줄

## WP8-1. 배너 관리 CMS

**목표:** 운영자가 배너를 등록/수정/삭제/활성화/정렬할 수 있다. Supabase Storage로 이미지 업로드 + 삭제 동기화.

**사용자 가치:** 운영자가 사이트 홍보 콘텐츠를 직접 관리. M9에서 회원 노출.

**선행 조건:** WP7-2 (banners 테이블 + Storage bucket), WP7-3 (사이드바 메뉴 슬롯)

**UI 선행 필요:** **`/frontend-design` 스킬 선행** — 배너 목록 테이블, 등록/수정 폼, 이미지 업로드 UI, 순서 표시 라벨

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | `/admin/banners` 목록 페이지 | 활성/비활성 토글, 순서 표시, 수정/삭제 버튼 |
| 2 | `/admin/banners/new` + `/admin/banners/[id]/edit` | 폼: title, description, link_url, image_url, is_active, display_order |
| 3 | 이미지 업로드 컴포넌트 | Supabase Storage `banners` bucket으로 업로드. URL 직접 입력 금지 |
| 4 | 삭제 API Route | `src/app/api/admin/banners/[id]/route.ts` DELETE. Storage 파일도 함께 삭제 |
| 5 | 표시 순서 라벨 | "숫자가 작을수록 먼저" 안내 텍스트 |
| 6 | 배너 텍스트/이미지 분기 | image_url 없으면 텍스트 배너로 저장 가능 |

**검증 기준:**
- [ ] 운영자가 배너 신규 생성 (이미지 업로드 포함) 성공
- [ ] is_active 토글 → 목록 즉시 반영
- [ ] 배너 삭제 → Storage 파일 삭제 확인 (Supabase Storage 대시보드)
- [ ] display_order 변경 → 목록 재정렬
- [ ] 일반 회원이 `/admin/banners` 접근 차단 (RLS + 레이아웃 role 체크)
- [ ] image_url 없는 텍스트 배너 저장 성공

---

## WP8-2. 한 줄 관리 승인 워크플로우

**목표:** 운영자가 회원이 제출한 한 줄(book_quotes)을 승인/거절/승인취소/삭제할 수 있다.

**사용자 가치:** 운영자가 회원 콘텐츠 품질을 관리. M9에서 회원 제출 UI 추가.

**선행 조건:** WP7-2 (book_quotes 테이블), WP7-3 (사이드바 메뉴 슬롯)

**UI 선행 필요:** **`/frontend-design` 스킬 선행** — 탭 구조(대기/승인/거절), 카드형 리스트, 승인/거절 액션 버튼

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | `/admin/book-quotes` 목록 페이지 | 탭: 대기(pending) / 승인됨(approved) / 거절됨(rejected). 기본은 대기 |
| 2 | 카드 UI | book_title, quote_text, submitted_by 닉네임(마스킹 전 원본), created_at, 액션 버튼 |
| 3 | 승인 API | `POST /api/admin/book-quotes/[id]/approve` — status=approved, approved_at=now() |
| 4 | 거절 API | `POST /api/admin/book-quotes/[id]/reject` — status=rejected |
| 5 | 승인 취소 API | `POST /api/admin/book-quotes/[id]/unapprove` — approved→rejected |
| 6 | 삭제 API | `DELETE /api/admin/book-quotes/[id]` — 완전 삭제 |

**검증 기준:**
- [ ] 탭 전환 시 해당 status 목록만 표시
- [ ] 승인 → "승인됨" 탭으로 이동, approved_at 기록
- [ ] 거절 → "거절됨" 탭으로 이동
- [ ] 승인 취소 → "거절됨" 탭으로 이동 (승인됨 → 거절됨)
- [ ] 삭제 → 모든 탭에서 사라짐
- [ ] 일반 회원 접근 차단

---

# M9. 회원 홈 콘텐츠 전면 오픈

## WP9-1. 홈 홍보 배너 (스와이프 + fallback)

**목표:** 홈 최상단에 활성 배너를 스와이프 UI로 노출. 0개일 때 다가오는 모임 1~2개 카드로 대체.

**사용자 가치:** 회원이 홈 진입 시 활성 프로모션을 즉시 인지. 배너 없는 상태에서도 빈 영역 대신 모임으로 유도.

**선행 조건:** WP7-5 (홈 탭 뼈대), WP8-1 (배너 데이터 존재 가능)

**UI 선행 필요:** **`/frontend-design` 스킬 선행** — 스와이프 카드 UI, 이미지/텍스트 분기 디자인, fallback 카드, 스크롤바 숨김(L-6)

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | `/home` 상단에 BannerSection 배치 | Server Component, banners SELECT |
| 2 | 가로 스와이프 UI | CSS scroll-snap-x, scroll-snap-align center |
| 3 | 이미지 배너 렌더 | image_url 있음 + 설명 오버레이 |
| 4 | 텍스트 배너 렌더 | image_url 없음, 타이틀 + description 카드 |
| 5 | 링크 처리 분기 | 외부 URL: `<a target="_blank" rel="noopener">`, 내부: `<Link>`, **빈값: `<div>`** (리로드 방지) |
| 6 | 0개 fallback | banners 활성 0개 → 다가오는 active 모임 1~2개 카드 |
| 7 | 스크롤바 숨김 | `scrollbar-width: none; ::-webkit-scrollbar { display: none }` |

**검증 기준:**
- [ ] 활성 배너 1개 → 1장 카드 렌더
- [ ] 활성 배너 2개 이상 → 스와이프 동작 (스냅 정렬)
- [ ] 활성 배너 0개 → 다가오는 모임 1~2개 카드 렌더
- [ ] 이미지/텍스트 배너 각각 정상 렌더
- [ ] 외부 URL 링크 새 탭 오픈, 빈값은 클릭해도 아무 일 없음 (리로드 X)
- [ ] 스크롤바 시각적으로 숨김 (L-6)

---

## WP9-2. D-Day 입장권

**목표:** 오늘/내일 confirmed 모임이 있으면 티켓 스타일 카드로 홈에 노출. 네이버 지도 인라인 링크.

**사용자 가치:** 회원이 임박한 참여 예정 모임을 한눈에 인지. 당일 늦지 않고 도착.

**선행 조건:** WP7-2 (detail_address 컬럼), WP7-5 (홈 탭)

**UI 선행 필요:** **`/frontend-design` 스킬 선행** — 티켓 카드 UI (절취선/홀 펀치 모티프), 인라인 지도 링크 스타일

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | DDayTicketSection 컴포넌트 | Server Component, KST 기준 오늘/내일 confirmed 쿼리 |
| 2 | 티켓 카드 UI | 날짜 강조 + 모임명 + 시간 + 장소 + 지도 링크 |
| 3 | 장소 옆 인라인 "지도" 링크 | detail_address → 네이버 지도 URL (`https://map.naver.com/v5/search/{encoded}`), 별도 버튼 행 아님 |
| 4 | 최대 2개 표시 | 오늘 먼저, 내일 아래 |
| 5 | 비표시 조건 | 해당하는 confirmed 0건 시 섹션 자체 비렌더 |

**검증 기준:**
- [ ] 오늘 confirmed 1건 → 티켓 1장 렌더 (오늘 라벨)
- [ ] 오늘 + 내일 각 1건 → 2장 (오늘 위, 내일 아래)
- [ ] 해당 없음 → 섹션 비표시
- [ ] detail_address 있으면 지도 링크 클릭 시 네이버 지도 열림
- [ ] detail_address 없으면 지도 링크 미표시

---

## WP9-3. 이번 주 한 줄 — 제출 + 표시

**목표:** 회원이 책 한 줄을 제출(pending 저장). 운영자 승인된 한 줄 3~5개를 홈에 표시.

**사용자 가치:** 회원이 독서 감상을 공유하고 타인 감상을 읽으며 커뮤니티 소속감.

**선행 조건:** WP7-2 (book_quotes 테이블), WP8-2 (운영자 승인 워크플로우), WP7-5 (홈 탭)

**UI 선행 필요:** **`/frontend-design` 스킬 선행** — 한 줄 카드 스택, 제출 폼 모달/인라인, 닉네임 마스킹 디자인

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | BookQuoteSection 컴포넌트 | 최근 approved 3~5개 SELECT (created_at DESC) |
| 2 | 세로 스택 카드 UI | book_title, quote_text (200자 이내), 닉네임 마스킹 |
| 3 | 닉네임 마스킹 로직 | "김영수" → "김○님", "홍길동" → "홍○님" (첫 글자 + "○님") |
| 4 | "나도 한 줄 남기기" 버튼 | **항상 표시** (타인 글 유무/본인 제출 후에도 유지) |
| 5 | 제출 폼 (모달 또는 별도 페이지) | book_title (필수) + quote_text (필수, 200자 CHECK) |
| 6 | 제출 API | `POST /api/book-quotes` — status=pending, submitted_by=auth.uid() |
| 7 | 제출 후 UX | "제출되었습니다. 운영자 승인 후 홈에 노출됩니다" 안내. 버튼 유지 |

**검증 기준:**
- [ ] 승인된 한 줄 3개 있으면 3장 렌더, 5개 이상이면 최근 5개만
- [ ] 닉네임 마스킹 정확 (첫 글자 + "○님")
- [ ] "나도 한 줄 남기기" 버튼 항상 노출 (쿼트 0개일 때도)
- [ ] 제출 성공 → pending 상태로 저장
- [ ] 제출 후 버튼 유지 (재제출 가능)
- [ ] quote_text 200자 초과 시 저장 거부 (DB CHECK)
- [ ] pending/rejected 상태는 홈에 노출되지 않음

---

## WP9-4. 소셜 프루프 4종

**목표:** "합류 티커 / 최근 가입 / 인기 모임 / 참석 TOP" 4개 항목으로 서비스 활기 가시화. 데이터 없는 항목만 비표시.

**사용자 가치:** 회원이 서비스 활성도를 체감하여 신뢰/참여 동기 상승.

**선행 조건:** WP7-5 (홈 탭)

**UI 선행 필요:** **`/frontend-design` 스킬 선행** — 4개 항목 레이아웃 (그리드/카드/리스트 조합), 각 항목별 데이터 표현 방식

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | SocialProofSection 컴포넌트 | 4개 서브섹션 조합 |
| 2 | 합류 티커 | 최근 confirmed/waitlisted registration 5건 (시간 + 모임명 + 닉네임 마스킹) |
| 3 | 최근 가입 | 최근 profiles created_at 5건 (닉네임 마스킹) |
| 4 | 인기 모임 | confirmed 수 기준 상위 3개 예정 모임 |
| 5 | 참석 TOP | 이번 달 attended=true 기준 상위 3명 (닉네임 마스킹) |
| 6 | N:1 JOIN 타입 처리 | **Supabase JOIN 결과는 단일 객체 (배열 아님) — L-3 반영** |
| 7 | 빈 데이터 비표시 | 해당 항목 데이터 0건 → 서브섹션 렌더 제외 |

**검증 기준:**
- [ ] 4개 항목이 각각 렌더 또는 비표시
- [ ] 닉네임은 모두 마스킹
- [ ] Supabase JOIN 응답 타입이 단일 객체로 처리됨 (배열 오해 0건)
- [ ] 모든 항목 데이터 0 → 섹션 전체 비표시
- [ ] 인기 모임 집계는 active 상태만 포함

---

## WP9-5. 인라인 배너 (모임 일정 탭)

**목표:** `/` (모임 일정) 리스트에 featured 모임을 인라인 배너로 삽입. 3번째 아이템 뒤 1개.

**사용자 가치:** 운영자가 주목시키고 싶은 모임을 회원이 자연스럽게 발견.

**선행 조건:** WP7-2 (is_featured 컬럼), WP7-4 (모임 폼 체크박스)

**UI 선행 필요:** **`/frontend-design` 스킬 선행** — 인라인 배너 카드 스타일 (일반 MeetingCard와 시각적 구분)

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | MeetingsView에서 featured 모임 분리 | is_featured=true인 다가오는 모임 1개 선별 |
| 2 | 삽입 규칙 구현 | 모임 3개 이상: 3번째 아이템 뒤에 1개. **날짜 그룹마다 아님** |
| 3 | 모임 3개 미만: 맨 아래 배치 | |
| 4 | 시각적 구분 | MeetingCard와 다른 배경/테두리/라벨("추천") |

**검증 기준:**
- [ ] featured 모임 0개 → 인라인 배너 없음
- [ ] featured 모임 1개 + 일반 모임 5개 → 3번째 뒤 삽입 (총 6아이템)
- [ ] featured 모임 1개 + 일반 모임 2개 → 맨 아래 삽입 (총 3아이템)
- [ ] featured 모임 여러 개 → 최근/임박 1개만 사용
- [ ] 일반 MeetingCard와 시각적으로 구분됨

---

# M10. 관리자 심화 — 정산 + 회원 생애주기

## WP10-1. 정산 admin 전용 이동 + 고도화

**목표:** 정산을 admin 전용으로 제한. 월 선택 + 연도별 추이 + 재정 요약 정확성 강화.

**사용자 가치:** admin이 재정 관리를 대시보드 수준으로 수행. editor는 정산 접근 차단(권한 원칙).

**선행 조건:** WP7-3 (사이드바 메뉴)

**UI 선행 필요:** **`/frontend-design` 스킬 선행** — 월 선택 UI, 연도 추이 차트/테이블, 공간별 정산 테이블, 정산 완료 버튼

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | `/admin/settlements` 라우트 이동 | admin role만 접근 허용 (editor 차단) |
| 2 | 월 선택 컨트롤 | 기본: 이번 달. 이전/다음 달 버튼 |
| 3 | 연도별 추이 | 선택 월의 연도 12개월 요약 |
| 4 | 정산 요약 강화 | 총 매출, 환불, 순매출 — **취소 건 refunded_amount 정확 차감 (L-1 적용)** |
| 5 | 공간별 정산 테이블 | venues별 정산 내역 |
| 6 | 정산 완료 처리 | `POST /api/admin/venues/settle` 호출 |

**검증 기준:**
- [ ] admin 계정으로 `/admin/settlements` 접근 성공
- [ ] editor 계정으로 접근 시 403 또는 리다이렉트
- [ ] 월 변경 시 데이터 재조회
- [ ] 재정 요약에서 confirmed 매출 - 취소 환불 = 순매출 정확 검증 (샘플 쿼리 1건)
- [ ] 정산 완료 처리 후 해당 월 잠김 상태

---

## WP10-2. 회원 생애주기 분석 대시보드

**목표:** 회원 관리 페이지에 5단계 생애주기(신규/활성/휴면/이탈/미참석) + 전환 지표 + 지역/TOP/이탈 추이 분석.

**사용자 가치:** 운영자가 회원 상태를 파악하고 개입 포인트(휴면/이탈) 식별.

**선행 조건:** WP7-3 (사이드바)

**UI 선행 필요:** **`/frontend-design` 스킬 선행** — 5단계 카드/탭, 지표 카드 (중앙값/평균), 랭킹 리스트, 이탈 추이 차트

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | 5단계 집계 로직 | 신규(가입 30일 이내) / 활성(최근 90일 참여) / 휴면(90~180일 미참여) / 이탈(180일+ 미참여) / 미참석(가입 후 참여 0건) |
| 2 | 단계별 회원 수 + 목록 | 클릭 시 해당 단계 회원 리스트 |
| 3 | 가입→첫 참여 소요일 | 중앙값, 평균 |
| 4 | 재참석 전환율 | 1회→2회 전환 % |
| 5 | 지역별 활동량 | region별 참여 수 집계 |
| 6 | 이번 달 참석 TOP | attended=true 상위 10명 |
| 7 | 이탈 추이 | 월별 이탈 회원 수 (최근 6개월) |

**검증 기준:**
- [ ] 5단계 합이 총 회원 수와 일치
- [ ] 단계 카드 클릭 시 회원 목록 노출
- [ ] 신규/활성/휴면/이탈 정의가 기준 날짜 기반 재계산 (하드코딩 X)
- [ ] 수동 검증용 샘플 쿼리 1건 작성 + 결과 일치

---

## WP10-3. 모임 폼 2차 확장 + 링크 정리

**목표:** 모임 폼에 detail_address/chat_link/reading_link "추가 옵션" 접힘 섹션 노출. AdminMeetingCard 링크 완전 재연결.

**사용자 가치:** 운영자가 모임에 상세 주소/오픈채팅 링크/도서 링크를 등록. M9 D-Day의 지도 링크 데이터 완성.

**선행 조건:** WP7-2 (3컬럼 DB), WP7-4 (모임 폼 1차)

**UI 선행 필요:** **`/frontend-design` 스킬 선행** — 접힘(accordion) 섹션 UI, 필드별 placeholder/도움말

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | MeetingForm 추가 옵션 섹션 | 기본 접힘, 클릭 시 펼침 |
| 2 | detail_address 필드 | 선택, placeholder: "예: 경주시 황오동 123-4, 1층" |
| 3 | chat_link 필드 | 선택, URL validation |
| 4 | reading_link 필드 | 선택, URL validation |
| 5 | edit 시 initialValues 전달 | 3개 필드 모두 기존 값 채움 |
| 6 | AdminMeetingCard 링크 재연결 | `/admin/meetings/[id]`로 완전 전환 (WP7-4 잔여 정리) |

**검증 기준:**
- [ ] 추가 옵션 섹션 기본 접힘, 펼침 정상 동작
- [ ] 3개 필드 저장/로드 정상
- [ ] URL 형식 validation (간단 체크)
- [ ] 수정 진입 시 기존 값 채워짐
- [ ] AdminMeetingCard → `/admin/meetings/[id]` 이동

---

# M11. 디자인 토큰 통합 + 접근성 정리

## WP11-1. 디자인 토큰 하드코딩 제거

**목표:** 기존 화면(MVP + Phase 2 + Phase 3 산출물 포함)의 하드코딩된 색상/크기를 디자인 토큰으로 통합.

**사용자 가치:** 직접 가치 낮음. 유지보수성 향상, 향후 토큰 변경 시 전파 자동화.

**선행 조건:** WP9, WP10 완료 (범위 확정)

**UI 선행 필요:** 없음 (기존 시각 보존 원칙). 변경 중 시각 변화 발생 시 **`/frontend-design`으로 해당 컴포넌트 리뷰**.

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | grep 기반 하드코딩 탐지 | `text-gray-`, `bg-gray-`, hex 색상 (`#`), px 단위 하드코딩 |
| 2 | 토큰 교체 | `globals.css`의 `@theme inline` 토큰으로 대체 |
| 3 | 문서화 | `DESIGN_TOKENS.md`에 신규 토큰 추가 (필요 시) |

**검증 기준:**
- [ ] grep 검사: `text-gray-\|bg-gray-\|#[0-9a-fA-F]{3,6}` 0건 (설계 의도한 예외 제외)
- [ ] 시각적 회귀 없음 (screenshot 비교)
- [ ] `npm run prelaunch` 통과

---

## WP11-2. WCAG AA 접근성 정리

**목표:** 색상 대비 AA 미달 부분 개선. 키보드 포커스/스크린리더 문제 최소 수정.

**사용자 가치:** 시각 약자 + 키보드 유저 접근성 향상.

**선행 조건:** WP11-1 (토큰 정리 후 대비 재평가)

**UI 선행 필요:** **`/frontend-design` 스킬 선행** — 대비 개선 방향 (기존 미학 유지하며 AA 통과)

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | 대비 검사 | WebAIM Contrast Checker 또는 axe DevTools |
| 2 | 미달 항목 수정 | text-neutral-400 등 본문/버튼/라벨 AA 통과 |
| 3 | 포커스 링 표시 | 모든 interactive 요소에 visible focus |
| 4 | 주요 이미지 alt | 배너/프로필 이미지 alt 텍스트 |

**검증 기준:**
- [ ] axe DevTools 또는 Lighthouse Accessibility ≥ 90점
- [ ] 키보드 Tab으로 모든 버튼/링크 포커스 도달 + 시각 표시
- [ ] 모든 `<img>` alt 속성 존재
- [ ] 색상 대비 AA 통과 (주요 텍스트/버튼)

---

# M12. 통합 검증 + 배포

## WP12-1. 풀스캔 재실행 + 실사용자 회귀 검증

**목표:** Phase 3 전체 회귀 검증. 로컬 테스트 피드백 14건 재확인. 풀스캔 Critical 0 확인.

**사용자 가치:** 배포 전 리스크 최소화.

**선행 조건:** WP11 완료

**UI 선행 필요:** 없음

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | 풀스캔 재실행 | Critical 0건 확인 |
| 2 | 실사용자 시나리오 14건 회귀 | `phase3-requirements.md`의 로컬 테스트 피드백 항목 |
| 3 | E2E MVP 플로우 회귀 | 로그인→모임→결제→취소→환불 |
| 4 | Vercel Preview 검증 | (main) 라우트는 Preview에서만 가능 (L-7) |
| 5 | prelaunch 파이프라인 | lint + tsc + test + build 전부 통과 |

**검증 기준:**
- [ ] 풀스캔 Critical 0건
- [ ] 사용자 피드백 14건 모두 OK
- [ ] MVP 플로우 회귀 없음
- [ ] `npm run prelaunch` PASS

---

## WP12-2. 프로덕션 배포

**목표:** main 머지 → Vercel 프로덕션 배포 → 사후 검증 → Phase 3 종료.

**사용자 가치:** Phase 3 모든 신규 기능이 실제 서비스에 노출.

**선행 조건:** WP12-1 완료

**UI 선행 필요:** 없음

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | main 머지 | 마지막 Preview 검증 후 |
| 2 | 프로덕션 배포 자동 트리거 | Vercel |
| 3 | 사후 검증 | 주요 플로우 프로덕션에서 재확인 |
| 4 | 카카오톡 채널 공지 | 서비스 업데이트 알림 (운영자 판단) |
| 5 | milestones-phase3.md 완료 체크 | v1.2로 업데이트 |

**검증 기준:**
- [ ] 프로덕션 URL에서 홈 탭 4섹션 정상 렌더
- [ ] 운영자가 프로덕션에서 배너/한 줄 관리 동작 확인
- [ ] 한 줄 제출 → 관리자 승인 → 홈 노출 end-to-end 동작
- [ ] 기존 MVP 플로우(결제/취소/환불) 정상
- [ ] milestones-phase3.md 모든 체크박스 체크됨

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v1.0 | 2026-04-17 | milestones-phase3.md 기반 최초 WP 수립 (WP7-1 ~ WP12-2, 총 19개) |
