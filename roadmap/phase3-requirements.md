# Phase 3 통합 요구사항 — 처음부터 제대로

> 이 문서는 Phase 3에서 구현할 모든 것을 하나로 통합한 요구사항 원본이다.
> 소스: Phase 3 설계서(4/11) + 사용자 로컬 테스트 피드백(4/15) + 풀스캔 3회(4/6, 4/8, 4/15) + 교훈 8건
> 작성일: 2026-04-16

---

## 1. Phase 3의 두 가지 문제

**문제 A (회원):** "신청하러 왔다가 끝나면 나간다" → 재방문 이유와 체류 시간을 만들어야 함
**문제 B (운영자):** "관리자 페이지가 한 화면에 다 몰려있어 쓰기 힘들다" → 데스크톱 확장 + 기능별 분리

---

## 2. Part A: 회원 서비스 — 홈 탭 + 콘텐츠

### A-1. 탭 구조 변경 (2탭 → 3탭)

| 탭 | 경로 | 역할 |
|---|---|---|
| 홈 | `/home` | 배너, D-Day 입장권, 이번 주 한 줄, 소셜 프루프 |
| 모임 일정 | `/` | 모임 리스트 + 인라인 배너 (기본 랜딩) |
| 내 신청 | `/my` | 내 신청 내역 |

- 기본 랜딩은 모임 일정(`/`). 홈은 능동적 탭.

### A-2. 홈 탭 섹션 (위→아래)

#### 홍보 배너 (최상단)
- 활성 배너 1~2개 스와이프 (CSS scroll-snap)
- 이미지 배너 / 텍스트 배너 형태 분기
- **배너 0개일 때: 다가오는 모임 1~2개를 카드로 fallback 표시**
- 외부 URL: `<a target="_blank">`, 내부: `<Link>`, **빈값: `<div>` (페이지 리로드 방지)**
- **이미지: URL 아닌 파일 업로드 (Supabase Storage)**
- **삭제 시 Storage 파일도 함께 삭제**

#### D-Day 입장권
- 오늘/내일 confirmed 모임만 표시 (없으면 비표시)
- 티켓 스타일 카드 + 지도 링크 (**네이버 지도**, detail_address 기반)
- 장소 옆 인라인 "지도" 링크 (별도 버튼 행 아님)
- 최대 2개 카드 (오늘 먼저, 내일 아래)

#### 이번 주 한 줄
- 최근 승인 3~5개 세로 표시 (쌓이는 구조)
- **"나도 한 줄 남기기" 버튼 — 항상 표시 (다른 사람 글 유무와 무관)**
- **제출 완료 후에도 다시 제출 가능 (버튼 유지)**
- 제출 폼: 책 제목 + 구절/감상 (200자 제한)
- 닉네임 마스킹: 첫 글자 + "○님"

#### 소셜 프루프
- 4개 항목: 합류 티커, 최근 가입, 인기 모임, 참석 TOP
- **Supabase N:1 JOIN 타입: 단일 객체 (배열 아님)**
- 데이터 없는 항목만 비표시

### A-3. 인라인 배너 (모임 일정 탭)

- featured 모임을 모임 리스트에 삽입
- **삽입 규칙: 3번째 아이템 뒤에 1개, 최대 1개** (날짜 그룹마다 아님)
- 모임 3개 미만이면 맨 아래 배치
- 모임 생성/수정 모두에서 is_featured 설정 가능

---

## 3. Part B: 관리자 서비스 — 데스크톱 전환

### B-1. 레이아웃

- 좌측 사이드바 (데스크톱) + 햄버거 메뉴 (모바일)
- 사이드바 메뉴: 대시보드, 모임 관리, 정산, 회원 관리, 설정, **배너 관리, 한 줄 관리** (독립 메뉴)

### B-2. 대시보드 (`/admin`)

- "30초 안에 오늘 뭐 해야 돼?" 파악하는 허브
- 긴급 알림 + 이번 주 요약 + 핵심 수치 3개 + 바로가기 링크
- 모임 목록은 별도 페이지로 이동

### B-3. 모임 관리 (`/admin/meetings`)

- 모임 목록 (필터: 진행중/지난달/전체 + 지역)
- `/admin/meetings/[id]` — 운영자 전용 상세 (신청자 목록 + 입금 토글 + 재정 요약)
- **AdminMeetingCard 링크: `/admin/meetings/[id]`로** (회원 페이지 아님)
- 회원 `/meetings/[id]`의 AdminMeetingSection → "관리자 페이지에서 보기" 링크만
- **모임 상세 재정 요약: 취소 건 환불이 순매출에 정확히 반영되어야 함**

### B-4. 모임 폼 확장

- region 선택 (필수, 한글 — `VALID_REGIONS` 참조)
- is_featured 체크박스 (모임 생성/수정 모두)
- 추가 옵션 (접힘): detail_address, chat_link, reading_link
- **edit 폼에서 initialValues에 새 필드 모두 전달**

### B-5. 정산 (`/admin/settlements`)

- admin 전용 (editor 접근 불가)
- 월 선택 + 연도별 추이
- 정산 요약 + 공간별 정산 + 정산 완료 처리

### B-6. 회원 관리 (`/admin/members`)

- 기존 회원 목록 + 검색 + 역할 변경
- **생애주기 상세 분석 (요약이 아닌 대시보드 수준):**
  - 5단계: 신규/활성/휴면/이탈/미참석 — **단계별 회원 수 + 회원 목록**
  - 가입 → 첫 참여 소요일 (중앙값, 평균)
  - 재참석 전환율 (1회→2회)
  - 지역별 활동량 비교
  - 이번 달 참석 TOP 랭킹
  - 이탈 추이 (월별 이탈자 수)

### B-7. 설정

- `/admin/settings` — 사이트 설정
- `/admin/settings/venues` — 공간 관리
- **배너 관리, 한 줄 관리는 사이드바 독립 메뉴로 분리**

### B-8. 배너 관리 (독립 메뉴)

- CRUD + 활성/비활성 토글
- **이미지 파일 업로드 (Supabase Storage)**
- **삭제 시 Storage 파일 함께 삭제**
- 표시 순서: "숫자가 작을수록 먼저" 라벨

### B-9. 한 줄 관리 (독립 메뉴)

- 대기 중 / 승인됨 / 거절됨 탭
- **승인 취소 (approved → rejected) 기능**
- **삭제 기능**

---

## 4. 풀스캔 기존 이슈 (Phase 3과 함께 수정)

### 배포 차단급

| # | 이슈 | 파일 |
|---|------|------|
| S-1 | 웹훅 orderId 교차 검증 | webhooks/tosspayments/route.ts |
| S-2 | paymentKey encodeURIComponent | lib/tosspayments.ts |
| S-3 | payment.ts orderId 검증 | lib/payment.ts |
| S-4 | 웹훅 RPC 실패 시 환불 처리 | webhooks/tosspayments/route.ts |

### 인프라

| # | 이슈 | 파일 |
|---|------|------|
| I-1 | 보안 헤더 (X-Frame-Options 등) | next.config.ts |
| I-2 | TossPayments fetch 타임아웃 8초 | lib/tosspayments.ts |
| I-3 | attendance API try-catch | api/registrations/attendance/route.ts |
| I-4 | Cron waitlist-refund 병렬화 | api/cron/waitlist-refund/route.ts |
| I-5 | confirm-transfer 정원 체크 | api/admin/registrations/confirm-transfer/route.ts |

### 문구/UX

| # | 이슈 |
|---|------|
| U-1 | "입금 후 운영자 확인까지 대기합니다" 삭제 |
| U-2 | API 응답 형식 통일 ({ status, message }) |

---

## 5. DB 변경 전체

### 기존 테이블 변경

| 테이블 | 컬럼 | 타입 |
|--------|------|------|
| meetings | region | TEXT DEFAULT '경주' |
| meetings | is_featured | BOOLEAN DEFAULT false |
| meetings | chat_link | TEXT (nullable) |
| meetings | reading_link | TEXT (nullable) |
| meetings | detail_address | TEXT (nullable) |

### 신규 테이블

| 테이블 | 용도 |
|--------|------|
| banners | 홍보 배너 (title, description, link_url, image_url, is_active, display_order) |
| book_quotes | 이번 주 한 줄 (book_title, quote_text, submitted_by, status, approved_at) |

### RLS 정책

- banners: select_active (로그인 유저), admin_all (FOR ALL)
- book_quotes: select_approved, select_own, **select_editor_or_admin**, insert, update_editor_or_admin

---

## 6. 교훈 (구현 시 반드시 적용)

| # | 교훈 | 적용 시점 |
|---|------|----------|
| L-1 | 집계 계산에서 좌우 행 범위 일치 검증 | 재정 요약, 정산 |
| L-2 | 서브에이전트 생성 후 UI 품질 반드시 확인 | 모든 컴포넌트 생성 후 |
| L-3 | 서브에이전트 API 연동 필드 크로스체크 | API + 클라이언트 쌍 생성 시 |
| L-4 | 운영자 워크플로우 먼저 파악 | 관리자 기능 설계 시 |
| L-5 | 같은 파일 다중 수정 시 순차 커밋 | WP 실행 시 |
| L-6 | 가로 스크롤 UI → 스크롤바 숨김 검증 | 배너 스와이프 |
| L-7 | (main) 라우트 로컬 테스트 불가 → Vercel Preview | 검증 시 |
| L-8 | Windows preview_start → cmd /c 래퍼 | 로컬 개발 |

---

## 7. UI 품질 요구사항

- **모든 UI 작업 전 `/frontend-design` 스킬 선행** (필수): 신규 화면/섹션/컴포넌트를 만들기 전에 디자인 방향을 먼저 확정한다. 후행 통째 리디자인을 방지하고 각 단계에서 품질을 확보한다. 텍스트/로직 수정 등 UI "구성"이 아닌 작업은 제외.
- **디자인 토큰 100% 적용**: 하드코딩 색상/크기 0건
- **WCAG AA 색상 대비**: text-neutral-400 등 개선
- **"따뜻한 독립서점의 정기 간행물"** 미학 유지
- **구현 후 반드시 실제 화면 확인** (빌드 통과 ≠ UI 품질)
- ❌ **"전체 리디자인"은 범위 외**: 각 마일스톤에서 `/frontend-design` 선행으로 신규 화면 품질을 확보하므로, Phase 3 후반에 전체 화면을 통째로 갈아엎는 작업은 하지 않는다. 기존 화면의 토큰 하드코딩/접근성 미달은 별도 정리 마일스톤(M11)에서 처리.
