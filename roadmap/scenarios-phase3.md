# JIDOKHAE Phase 3 Scenarios

> 이 문서는 `roadmap/work-packages-phase3.md`의 각 WP를 **Scenario(시나리오)** 단위로 분해한 문서입니다.
> 하나의 Scenario = 하나의 행동 = 하나의 검증.
> 성공 케이스와 실패 케이스는 별도 Scenario로 분리되어 있습니다.

---

## 읽는 법

```
Scenario [WP번호]-[순번]: [행동 기반 명칭]
  Given: [사전 상태/조건]
  When:  [실행할 행동]
  Then:  [기대 결과]
  선행 Scenario: [의존 번호 또는 "없음"]
```

---

# M7. 기반 정리 + 레이아웃 전환

## WP7-1. 풀스캔 기존 이슈 정리

### Scenario 7-1-01: 웹훅 orderId 교차 검증 성공

- **Given:** 결제 완료된 정상 orderId + paymentKey가 TossPayments Webhook으로 전달된다
- **When:** `/api/webhooks/tosspayments`가 orderId를 파싱하고 DB 레코드와 교차 검증한다
- **Then:** meetingId/userId가 orderId 접두사와 일치 확인, 처리 정상 진행
- **선행 Scenario:** 없음

### Scenario 7-1-02: 웹훅 orderId 불일치 시 거부

- **Given:** orderId 접두사가 DB의 meetingId/userId와 일치하지 않는 조작된 웹훅 요청
- **When:** 웹훅이 교차 검증을 수행한다
- **Then:** 요청이 거부되고(400 또는 401) DB 변경 없음
- **선행 Scenario:** 7-1-01

### Scenario 7-1-03: paymentKey URL 인코딩 적용

- **Given:** 특수문자가 포함된 paymentKey로 TossPayments API 호출 필요
- **When:** `src/lib/tosspayments.ts`에서 paymentKey를 URL에 포함시킨다
- **Then:** `encodeURIComponent(paymentKey)` 처리되어 요청 URL이 안전하게 생성된다
- **선행 Scenario:** 없음

### Scenario 7-1-04: payment.ts orderId 형식 검증

- **Given:** 잘못된 포맷의 orderId가 payment.ts에 전달된다
- **When:** orderId 파싱 로직이 실행된다
- **Then:** 검증 실패 시 명시적 에러 반환, 결제 처리 중단
- **선행 Scenario:** 없음

### Scenario 7-1-05: 웹훅 RPC 실패 시 자동 환불

- **Given:** TossPayments 결제 승인 성공 후 `confirm_registration` RPC가 실패한다
- **When:** 웹훅 핸들러가 RPC 실패를 감지한다
- **Then:** 토스페이먼츠 환불 API 자동 호출되어 고아 결제 방지
- **선행 Scenario:** 7-1-01

### Scenario 7-1-06: 보안 헤더 적용

- **Given:** `next.config.ts`에 X-Frame-Options, X-Content-Type-Options 등 보안 헤더 설정
- **When:** 프로덕션 빌드로 페이지에 접근한다
- **Then:** 응답 헤더에 보안 헤더가 포함된다 (curl/개발자 도구 확인)
- **선행 Scenario:** 없음

### Scenario 7-1-07: TossPayments fetch 타임아웃 동작

- **Given:** TossPayments API 응답이 8초 이상 지연되는 상황
- **When:** `src/lib/tosspayments.ts`의 fetch 호출이 실행된다
- **Then:** 8초에 AbortController로 중단되고 타임아웃 에러 반환
- **선행 Scenario:** 없음

### Scenario 7-1-08: attendance API 예외 처리

- **Given:** attendance 토글 중 DB 오류 발생
- **When:** `POST /api/registrations/attendance` 호출이 예외를 던진다
- **Then:** try-catch로 500 응답 + 구조화된 에러 메시지 반환 (프로세스 중단 X)
- **선행 Scenario:** 없음

### Scenario 7-1-09: waitlist-refund 크론 병렬 처리

- **Given:** 오늘 + 내일의 waitlisted 레코드 여러 건 존재
- **When:** `/api/cron/waitlist-refund`가 실행된다
- **Then:** `Promise.allSettled`로 병렬 환불 처리, 개별 실패가 전체를 막지 않음
- **선행 Scenario:** 없음

### Scenario 7-1-10: confirm-transfer 정원 재검증

- **Given:** 운영자가 입금 확인하려는 시점에 이미 정원이 찬 모임
- **When:** `/api/admin/registrations/confirm-transfer`가 호출된다
- **Then:** 정원 체크 실패 → 에러 반환 (pending_transfer → confirmed 전환 중단)
- **선행 Scenario:** 없음

### Scenario 7-1-11: "입금 후 운영자 확인까지 대기합니다" 문구 제거

- **Given:** 계좌이체 신청 완료 화면에 해당 문구가 기존에 노출됨
- **When:** 계좌이체 신청 완료 후 화면을 본다
- **Then:** 해당 문구 미노출, 대체 안내로 교체됨
- **선행 Scenario:** 없음

### Scenario 7-1-12: API 응답 형식 `{ status, message }` 통일

- **Given:** Phase 3 이전에 일부 API가 `{ error }` 또는 비표준 응답 형식 사용
- **When:** 해당 API Route 호출 응답을 확인한다
- **Then:** 모든 응답이 `{ status, message, data? }` 형식으로 통일됨
- **선행 Scenario:** 없음

---

## WP7-2. DB 마이그레이션 — meetings 확장 + banners + book_quotes

### Scenario 7-2-01: meetings.region 컬럼 추가

- **Given:** 기존 meetings 테이블 (region 컬럼 없음)
- **When:** 마이그레이션 SQL 실행
- **Then:** region (TEXT DEFAULT '경주', NOT NULL) 컬럼 추가, 기존 레코드는 '경주'로 채워짐
- **선행 Scenario:** 없음

### Scenario 7-2-02: meetings.is_featured 컬럼 추가

- **Given:** 기존 meetings 테이블
- **When:** 마이그레이션 실행
- **Then:** is_featured (BOOLEAN DEFAULT false, NOT NULL) 추가, 기존 레코드는 false
- **선행 Scenario:** 7-2-01

### Scenario 7-2-03: meetings.detail_address/chat_link/reading_link 추가

- **Given:** 기존 meetings 테이블
- **When:** 마이그레이션 실행
- **Then:** 3개 nullable TEXT 컬럼 추가, 기존 레코드는 NULL
- **선행 Scenario:** 7-2-01

### Scenario 7-2-04: banners 테이블 생성

- **Given:** banners 테이블 미존재
- **When:** 마이그레이션 실행
- **Then:** id/title/description/link_url/image_url/is_active/display_order/created_at/updated_at 컬럼 구성된 테이블 생성
- **선행 Scenario:** 없음

### Scenario 7-2-05: book_quotes 테이블 생성 + CHECK 제약

- **Given:** book_quotes 테이블 미존재
- **When:** 마이그레이션 실행
- **Then:** 테이블 생성 + quote_text 컬럼에 LENGTH <= 200 CHECK 제약 적용
- **선행 Scenario:** 없음

### Scenario 7-2-06: banners RLS — 일반 유저는 활성 배너만 조회

- **Given:** is_active=true 2건 + is_active=false 1건
- **When:** member role로 SELECT * FROM banners
- **Then:** 2건만 반환
- **선행 Scenario:** 7-2-04

### Scenario 7-2-07: banners RLS — admin은 전체 CRUD

- **Given:** admin role 유저
- **When:** banners에 INSERT/UPDATE/DELETE 수행
- **Then:** 모든 작업 성공
- **선행 Scenario:** 7-2-04

### Scenario 7-2-08: book_quotes RLS — submitted_by = auth.uid() 강제

- **Given:** member role 유저 A
- **When:** 유저 B의 ID를 submitted_by에 넣고 INSERT
- **Then:** RLS에 의해 차단
- **선행 Scenario:** 7-2-05

### Scenario 7-2-09: book_quotes RLS — 본인/승인 + editor/admin 전체 조회

- **Given:** 본인 pending 1건 + 타인 approved 1건 + 타인 pending 1건
- **When:** member 본인이 SELECT
- **Then:** 본인 pending + 타인 approved 총 2건 반환 (타인 pending 제외)
- **선행 Scenario:** 7-2-05

### Scenario 7-2-10: Supabase Storage banners 버킷 생성

- **Given:** banners bucket 미존재
- **When:** 관리자가 Supabase 대시보드 또는 CLI로 버킷 생성
- **Then:** public read 활성, admin write 가능 상태
- **선행 Scenario:** 없음

### Scenario 7-2-11: 타입 정의 파일 추가 + 컴파일 통과

- **Given:** banners + book_quotes 테이블 구조가 확정되어 있다
- **When:** `src/types/banner.ts`, `src/types/book_quote.ts` 생성하고 `Banner`, `BookQuote` 인터페이스 정의 후 `npx tsc --noEmit` 실행
- **Then:** 타입 에러 없이 컴파일 통과. 이후 WP8-1/WP8-2/WP9-1/WP9-3에서 이 타입을 import하여 사용 가능
- **선행 Scenario:** 7-2-04, 7-2-05

---

## WP7-3. 관리자 데스크톱 사이드바 레이아웃

### Scenario 7-3-01: 데스크톱에서 사이드바 고정 렌더

- **Given:** viewport ≥ 1024px, admin 계정 로그인
- **When:** `/admin` 접근
- **Then:** 좌측에 사이드바 고정 표시, 메뉴 7종 노출
- **선행 Scenario:** 없음

### Scenario 7-3-02: 모바일에서 햄버거 메뉴 토글

- **Given:** viewport < 1024px, admin 계정
- **When:** `/admin`에서 햄버거 버튼 클릭
- **Then:** 사이드바 오버레이로 오픈, 외부 클릭 시 닫힘
- **선행 Scenario:** 7-3-01

### Scenario 7-3-03: 사이드바 메뉴 7종 존재

- **Given:** 사이드바 렌더됨
- **When:** 메뉴 항목을 확인한다
- **Then:** 대시보드/모임 관리/정산/회원 관리/설정/배너 관리/한 줄 관리 총 7개 노출
- **선행 Scenario:** 7-3-01

### Scenario 7-3-04: 현재 경로 active 표시

- **Given:** `/admin/meetings` 접근 상태
- **When:** 사이드바를 본다
- **Then:** "모임 관리" 메뉴가 active 스타일로 강조
- **선행 Scenario:** 7-3-03

### Scenario 7-3-05: editor role도 사이드바 접근

- **Given:** editor role 유저
- **When:** `/admin` 접근
- **Then:** 사이드바 렌더 (메뉴 접근 권한은 개별 페이지에서 체크)
- **선행 Scenario:** 7-3-01

### Scenario 7-3-06: 일반 회원 `/admin` 접근 차단

- **Given:** member role 유저
- **When:** `/admin` 접근 시도
- **Then:** 리다이렉트 또는 403 (기존 role 체크 유지)
- **선행 Scenario:** 7-3-01

### Scenario 7-3-07: 배너/한 줄 메뉴 placeholder 연결

- **Given:** M7 완료 상태 (M8 미구현)
- **When:** 배너 관리 메뉴 클릭
- **Then:** "준비 중" placeholder 페이지 렌더 (M8에서 실구현)
- **선행 Scenario:** 7-3-03

---

## WP7-4. 관리자 모임 관리 페이지 분리 + 모임 폼 1차 확장

### Scenario 7-4-01: `/admin` 대시보드 허브 렌더

- **Given:** admin 계정
- **When:** `/admin` 접근
- **Then:** 긴급 알림 + 이번 주 요약 + 핵심 수치 3개 + 바로가기 표시 (모임 목록 아님)
- **선행 Scenario:** 7-3-01

### Scenario 7-4-02: `/admin/meetings` 목록 렌더

- **Given:** admin 계정
- **When:** `/admin/meetings` 접근
- **Then:** 진행중/지난달/전체 필터 + 지역 필터 + 모임 목록 노출
- **선행 Scenario:** 7-4-01

### Scenario 7-4-03: 지역 필터 동작

- **Given:** 경주 5건, 포항 3건의 모임 존재
- **When:** 지역 필터에서 "경주" 선택
- **Then:** 경주 모임 5건만 표시
- **선행 Scenario:** 7-4-02

### Scenario 7-4-04: `/admin/meetings/[id]` 운영자 상세 렌더

- **Given:** 특정 모임 ID + admin 계정
- **When:** `/admin/meetings/[id]` 접근
- **Then:** 신청자 목록 + 입금 토글 + 재정 요약 렌더
- **선행 Scenario:** 7-4-02

### Scenario 7-4-05: `/meetings/[id]` AdminMeetingSection 축소

- **Given:** 기존에 `/meetings/[id]`에 AdminMeetingSection이 있었다
- **When:** admin 계정으로 `/meetings/[id]` 접근
- **Then:** AdminMeetingSection 자리에 "관리자 페이지에서 보기" 링크만 노출
- **선행 Scenario:** 7-4-04

### Scenario 7-4-06: AdminMeetingCard 링크 재연결

- **Given:** `/admin/meetings`의 AdminMeetingCard
- **When:** 카드 클릭
- **Then:** `/admin/meetings/[id]`로 이동 (`/meetings/[id]` 아님)
- **선행 Scenario:** 7-4-04

### Scenario 7-4-07: 모임 생성 폼 region 필수

- **Given:** 모임 생성 폼
- **When:** region 미선택 상태로 제출
- **Then:** "지역을 선택해주세요" 에러, 저장 차단
- **선행 Scenario:** 없음

### Scenario 7-4-08: 모임 생성 폼 is_featured 체크 저장

- **Given:** 모임 생성 폼에서 is_featured 체크, region '포항' 선택
- **When:** 제출
- **Then:** is_featured=true, region='포항'으로 INSERT 성공
- **선행 Scenario:** 7-4-07

### Scenario 7-4-09: 모임 수정 폼 is_featured 기존값 반영

- **Given:** is_featured=true인 기존 모임
- **When:** 수정 페이지 진입
- **Then:** is_featured 체크박스가 체크된 상태로 노출 (initialValues 전달)
- **선행 Scenario:** 7-4-08

### Scenario 7-4-10: `VALID_REGIONS` 13개 노출

- **Given:** 모임 폼 region select
- **When:** 드롭다운 열기
- **Then:** `src/lib/regions.ts`의 13개 지역 모두 노출
- **선행 Scenario:** 7-4-07

---

## WP7-5. 회원 탭 2→3탭 전환 (홈 뼈대)

### Scenario 7-5-01: BottomNav 3탭 렌더

- **Given:** member 계정 로그인, (main) 라우트
- **When:** BottomNav를 확인한다
- **Then:** 홈 / 모임 일정 / 내 신청 3개 탭 노출
- **선행 Scenario:** 없음

### Scenario 7-5-02: `/home` placeholder 렌더

- **Given:** 3탭 전환 완료
- **When:** `/home` 접근
- **Then:** placeholder 메시지 또는 "홈 탭 준비 중" 렌더 (섹션은 M9에서)
- **선행 Scenario:** 7-5-01

### Scenario 7-5-03: 로그인 직후 기본 랜딩 `/`

- **Given:** 신규 로그인 완료
- **When:** 리다이렉트 처리 후 최종 경로 확인
- **Then:** `/` (모임 일정)로 이동 (`/home` 아님)
- **선행 Scenario:** 7-5-01

### Scenario 7-5-04: 홈 탭 active 표시

- **Given:** `/home` 접근 상태
- **When:** BottomNav를 확인
- **Then:** 홈 아이콘/레이블이 active 스타일
- **선행 Scenario:** 7-5-02

---

# M8. 관리자 CMS — 배너 + 한 줄

## WP8-1. 배너 관리 CMS

### Scenario 8-1-01: 배너 목록 페이지 렌더

- **Given:** admin 계정, banners 0건
- **When:** `/admin/banners` 접근
- **Then:** 빈 목록 + "배너 추가" 버튼 노출
- **선행 Scenario:** 7-3-07

### Scenario 8-1-02: 이미지 배너 신규 생성

- **Given:** 유효한 이미지 파일 + title/description 입력
- **When:** `/admin/banners/new` 폼 제출
- **Then:** 이미지 Supabase Storage 업로드 + banners INSERT 성공, 목록에 표시
- **선행 Scenario:** 7-2-10

### Scenario 8-1-03: 텍스트 배너 신규 생성 (이미지 없음)

- **Given:** title + description만 입력, image_url 비움
- **When:** 폼 제출
- **Then:** image_url=NULL로 저장 성공
- **선행 Scenario:** 8-1-02

### Scenario 8-1-04: 배너 is_active 토글

- **Given:** is_active=true 배너 1건
- **When:** 목록에서 토글 스위치 클릭
- **Then:** is_active=false로 즉시 업데이트, UI 반영
- **선행 Scenario:** 8-1-02

### Scenario 8-1-05: 배너 display_order 변경 재정렬

- **Given:** order=1, 2, 3 배너 3건
- **When:** order=3 배너를 order=0으로 수정
- **Then:** 해당 배너가 목록 맨 앞으로 이동
- **선행 Scenario:** 8-1-02

### Scenario 8-1-06: 배너 삭제 + Storage 파일 동기 삭제

- **Given:** 이미지 배너 1건 (Storage 파일 존재)
- **When:** 목록에서 "삭제" 클릭
- **Then:** banners 레코드 삭제 + Storage 파일 삭제 확인 (URL 404)
- **선행 Scenario:** 8-1-02

### Scenario 8-1-07: URL 직접 입력으로 image_url 저장 차단

- **Given:** 배너 폼
- **When:** image_url 필드에 외부 URL 직접 입력 시도
- **Then:** 업로드 컴포넌트 외 직접 입력 불가 (UI 제약)
- **선행 Scenario:** 8-1-02

### Scenario 8-1-08: 일반 회원 `/admin/banners` 접근 차단

- **Given:** member role
- **When:** `/admin/banners` 접근 시도
- **Then:** 레이아웃 role 체크에 의해 리다이렉트
- **선행 Scenario:** 8-1-01

### Scenario 8-1-09: 표시 순서 라벨 안내 노출

- **Given:** 배너 폼 display_order 필드
- **When:** 필드 옆 설명 확인
- **Then:** "숫자가 작을수록 먼저 표시됩니다" 라벨 노출
- **선행 Scenario:** 8-1-02

### Scenario 8-1-10: 배너 수정 시 기존 이미지 유지

- **Given:** 이미지 배너 수정 진입
- **When:** 이미지 재업로드 없이 title만 수정 후 제출
- **Then:** 기존 이미지 URL 유지, title 업데이트
- **선행 Scenario:** 8-1-02

---

## WP8-2. 한 줄 관리 승인 워크플로우

### Scenario 8-2-01: 대기 탭에 pending 한 줄 노출

- **Given:** status=pending 3건, approved 2건, rejected 1건
- **When:** `/admin/book-quotes` 접근 (기본 대기 탭)
- **Then:** pending 3건만 노출
- **선행 Scenario:** 7-3-07

### Scenario 8-2-02: 승인됨 탭 전환

- **Given:** 위 상태
- **When:** "승인됨" 탭 클릭
- **Then:** approved 2건만 노출
- **선행 Scenario:** 8-2-01

### Scenario 8-2-03: 한 줄 승인 처리

- **Given:** pending 한 줄 1건
- **When:** "승인" 버튼 클릭
- **Then:** status=approved, approved_at=now() 업데이트, 대기 탭에서 사라지고 승인됨 탭으로 이동
- **선행 Scenario:** 8-2-01

### Scenario 8-2-04: 한 줄 거절 처리

- **Given:** pending 한 줄 1건
- **When:** "거절" 클릭
- **Then:** status=rejected, 거절됨 탭으로 이동
- **선행 Scenario:** 8-2-01

### Scenario 8-2-05: 승인 취소 (approved → rejected)

- **Given:** approved 한 줄 1건
- **When:** 승인됨 탭에서 "승인 취소" 클릭
- **Then:** status=rejected, 거절됨 탭으로 이동 (pending 아님)
- **선행 Scenario:** 8-2-03

### Scenario 8-2-06: 한 줄 삭제

- **Given:** 탭 상관없이 한 줄 1건
- **When:** "삭제" 클릭 + 확인
- **Then:** book_quotes 레코드 삭제, 모든 탭에서 사라짐
- **선행 Scenario:** 8-2-01

### Scenario 8-2-07: 제출자 닉네임 원본 노출(관리자만)

- **Given:** submitted_by의 nickname이 "김영수"
- **When:** 관리자 한 줄 관리 페이지에서 카드 확인
- **Then:** 마스킹 전 원본 "김영수" 노출 (회원 홈과 달리)
- **선행 Scenario:** 8-2-01

### Scenario 8-2-08: 일반 회원 `/admin/book-quotes` 접근 차단

- **Given:** member role
- **When:** 접근 시도
- **Then:** 리다이렉트 또는 403
- **선행 Scenario:** 8-2-01

---

# M9. 회원 홈 콘텐츠 전면 오픈

## WP9-1. 홈 홍보 배너 (스와이프 + fallback)

### Scenario 9-1-01: 활성 배너 1개 렌더

- **Given:** is_active=true 배너 1건
- **When:** `/home` 접근
- **Then:** BannerSection에 1장 카드 렌더
- **선행 Scenario:** 7-5-02, 8-1-04

### Scenario 9-1-02: 활성 배너 2개 이상 스와이프 동작

- **Given:** is_active=true 배너 3건
- **When:** `/home`에서 배너 영역을 좌우로 스와이프
- **Then:** scroll-snap으로 카드별 스냅, 다음 카드로 이동
- **선행 Scenario:** 9-1-01

### Scenario 9-1-03: 이미지 배너 + 텍스트 배너 혼합 렌더

- **Given:** image_url 있는 배너 1건 + image_url 없는 텍스트 배너 1건
- **When:** `/home` 접근
- **Then:** 각각 다른 렌더링(이미지 오버레이 vs 텍스트 카드)으로 노출
- **선행 Scenario:** 9-1-01

### Scenario 9-1-04: 외부 URL 링크 새 탭 오픈

- **Given:** link_url이 "https://external.com"인 배너
- **When:** 배너 클릭
- **Then:** 새 탭에서 외부 페이지 오픈 (`<a target="_blank" rel="noopener">`)
- **선행 Scenario:** 9-1-01

### Scenario 9-1-05: 내부 URL 링크 SPA 이동

- **Given:** link_url이 "/meetings/123"인 배너
- **When:** 배너 클릭
- **Then:** Next `<Link>`로 SPA 이동, 페이지 리로드 없음
- **선행 Scenario:** 9-1-01

### Scenario 9-1-06: 빈 link_url 클릭 시 아무 일 없음

- **Given:** link_url=NULL 또는 빈 문자열 배너
- **When:** 배너 클릭
- **Then:** 페이지 리로드 없음, 아무 이동도 없음 (`<div>` 렌더)
- **선행 Scenario:** 9-1-01

### Scenario 9-1-07: 활성 배너 0개 fallback — 다가오는 모임 카드

- **Given:** is_active=true 배너 0건, active 모임 3건
- **When:** `/home` 접근
- **Then:** 다가오는 모임 1~2개가 배너 영역에 카드로 렌더
- **선행 Scenario:** 9-1-01

### Scenario 9-1-08: 스크롤바 숨김 확인 (L-6)

- **Given:** 배너 스와이프 컨테이너
- **When:** 브라우저 개발자 도구로 style 확인
- **Then:** `scrollbar-width: none`, `::-webkit-scrollbar { display: none }` 적용, 스크롤바 비표시
- **선행 Scenario:** 9-1-02

---

## WP9-2. D-Day 입장권

### Scenario 9-2-01: 오늘 confirmed 1건 → 티켓 1장

- **Given:** 오늘 date의 active 모임 + 본인 confirmed 1건
- **When:** `/home` 접근
- **Then:** DDayTicketSection에 티켓 1장 렌더 ("오늘" 라벨)
- **선행 Scenario:** 7-5-02

### Scenario 9-2-02: 내일 confirmed 1건 → 티켓 1장

- **Given:** 내일 date 모임 confirmed 1건 (오늘 없음)
- **When:** `/home` 접근
- **Then:** 티켓 1장 ("내일" 라벨)
- **선행 Scenario:** 9-2-01

### Scenario 9-2-03: 오늘+내일 각 1건 → 2장 순서

- **Given:** 오늘 1건 + 내일 1건 모두 confirmed
- **When:** `/home` 접근
- **Then:** 오늘 티켓 위, 내일 티켓 아래로 2장 렌더
- **선행 Scenario:** 9-2-01

### Scenario 9-2-04: 해당 없음 → 섹션 비표시

- **Given:** 오늘/내일 confirmed 0건
- **When:** `/home` 접근
- **Then:** DDayTicketSection 자체가 DOM에 렌더되지 않음
- **선행 Scenario:** 9-2-01

### Scenario 9-2-05: detail_address 있으면 지도 링크 노출

- **Given:** 오늘 confirmed 모임에 detail_address="경주시 황오동 123"
- **When:** 티켓 확인
- **Then:** 장소 옆에 "지도" 인라인 링크 노출
- **선행 Scenario:** 9-2-01

### Scenario 9-2-06: 지도 링크 클릭 시 네이버 지도 오픈

- **Given:** 위 상태
- **When:** "지도" 링크 클릭
- **Then:** `https://map.naver.com/v5/search/{encoded detail_address}` 새 탭 오픈
- **선행 Scenario:** 9-2-05

### Scenario 9-2-07: detail_address 없으면 지도 링크 미표시

- **Given:** 오늘 confirmed 모임의 detail_address=NULL
- **When:** 티켓 확인
- **Then:** "지도" 링크 없음, 장소 텍스트만 노출
- **선행 Scenario:** 9-2-05

---

## WP9-3. 이번 주 한 줄 — 제출 + 표시

### Scenario 9-3-01: 승인 3개 이상 시 3~5개 렌더

- **Given:** approved 7건 존재
- **When:** `/home` 접근
- **Then:** 최근 created_at DESC 5건 렌더 (또는 설정된 상한 3~5)
- **선행 Scenario:** 7-5-02, 8-2-03

### Scenario 9-3-02: 승인 0개 시 "나도 한 줄 남기기" 버튼만 노출

- **Given:** approved 0건
- **When:** `/home` 접근
- **Then:** BookQuoteSection에 카드 없고, "나도 한 줄 남기기" 버튼은 여전히 노출
- **선행 Scenario:** 9-3-01

### Scenario 9-3-03: 닉네임 마스킹 정확성

- **Given:** submitted_by의 nickname="김영수"인 approved 한 줄
- **When:** 카드에 표시되는 닉네임 확인
- **Then:** "김○님" 형식 (첫 글자 + ○ + "님")
- **선행 Scenario:** 9-3-01

### Scenario 9-3-04: 한 줄 제출 성공 — pending 저장

- **Given:** 로그인 상태, "나도 한 줄 남기기" 클릭 후 폼 오픈
- **When:** book_title "홍길동전" + quote_text "의미있는 구절" 입력 후 제출
- **Then:** book_quotes INSERT (status=pending, submitted_by=auth.uid())
- **선행 Scenario:** 9-3-01

### Scenario 9-3-05: 한 줄 제출 후 "승인 대기" 안내

- **Given:** 위 제출 직후
- **When:** 제출 완료 화면 확인
- **Then:** "제출되었습니다. 운영자 승인 후 홈에 노출됩니다" 메시지 + "나도 한 줄 남기기" 버튼 계속 노출
- **선행 Scenario:** 9-3-04

### Scenario 9-3-06: 200자 초과 저장 차단

- **Given:** 폼에 201자 quote_text 입력
- **When:** 제출
- **Then:** DB CHECK 제약 위반 또는 클라이언트 validation으로 저장 실패
- **선행 Scenario:** 9-3-04

### Scenario 9-3-07: pending/rejected는 홈 미노출

- **Given:** 본인 pending 1건 + 타인 rejected 1건
- **When:** `/home` 확인
- **Then:** 두 건 모두 BookQuoteSection에 노출되지 않음
- **선행 Scenario:** 9-3-01

### Scenario 9-3-08: 재제출 가능

- **Given:** 이미 제출 완료한 상태
- **When:** "나도 한 줄 남기기" 재클릭 후 다시 제출
- **Then:** 새 book_quotes 레코드 INSERT (제한 없음)
- **선행 Scenario:** 9-3-05

---

## WP9-4. 소셜 프루프 4종

### Scenario 9-4-01: 합류 티커 — 최근 confirmed/waitlisted 5건

- **Given:** 최근 registrations(confirmed + waitlisted) 10건 존재
- **When:** `/home` 접근
- **Then:** SocialProofSection에 최근 5건 노출 (시간 + 모임명 + 닉네임 마스킹)
- **선행 Scenario:** 7-5-02

### Scenario 9-4-02: 최근 가입 — profiles 5건

- **Given:** 최근 가입 profiles 5건
- **When:** `/home` 확인
- **Then:** 가입 티커 5건 노출 (닉네임 마스킹)
- **선행 Scenario:** 9-4-01

### Scenario 9-4-03: 인기 모임 — confirmed 상위 3개

- **Given:** 모임 A(10명), B(5명), C(8명), D(2명) — 모두 예정
- **When:** `/home` 확인
- **Then:** A, C, B 순으로 상위 3개 노출
- **선행 Scenario:** 9-4-01

### Scenario 9-4-04: 참석 TOP — attended 이번 달 상위 3명

- **Given:** 이번 달 attended=true 다수 유저
- **When:** `/home` 확인
- **Then:** 참석 횟수 상위 3명 노출 (닉네임 마스킹)
- **선행 Scenario:** 9-4-01

### Scenario 9-4-05: N:1 JOIN 타입 단일 객체 처리 (L-3)

- **Given:** registrations와 meetings JOIN 쿼리
- **When:** 응답 데이터를 타입으로 핸들링한다
- **Then:** `meeting: Meeting` (단일 객체)로 처리, `meeting[0]` 접근 오류 없음
- **선행 Scenario:** 9-4-01

### Scenario 9-4-06: 빈 데이터 항목 비표시

- **Given:** 합류 티커 데이터 0건
- **When:** `/home` 확인
- **Then:** 합류 티커 서브섹션만 렌더에서 제외, 나머지 3종은 정상 표시
- **선행 Scenario:** 9-4-01

### Scenario 9-4-07: 모든 4종 데이터 0건 → 전체 비표시

- **Given:** 4종 모두 데이터 0
- **When:** `/home` 확인
- **Then:** SocialProofSection 자체 비렌더
- **선행 Scenario:** 9-4-06

### Scenario 9-4-08: 인기 모임은 active만 포함

- **Given:** active 모임 3개 + deleting 모임 2개 (confirmed 수는 deleting이 더 많음)
- **When:** 인기 모임 집계
- **Then:** active 3개만 상위에 반영 (deleting 제외)
- **선행 Scenario:** 9-4-03

---

## WP9-5. 인라인 배너 (모임 일정 탭)

### Scenario 9-5-01: featured 0개 → 인라인 배너 없음

- **Given:** is_featured=true 다가오는 모임 0건
- **When:** `/` 접근
- **Then:** 모임 목록에 인라인 배너 삽입 없음
- **선행 Scenario:** 7-4-08

### Scenario 9-5-02: featured 1개 + 일반 5개 → 3번째 뒤 삽입

- **Given:** 일반 5건 + featured 1건 (다가오는)
- **When:** `/` 접근
- **Then:** 1,2,3,[배너],4,5 순으로 총 6아이템 렌더
- **선행 Scenario:** 9-5-01

### Scenario 9-5-03: featured 1개 + 일반 2개 → 맨 아래

- **Given:** 일반 2건 + featured 1건
- **When:** `/` 접근
- **Then:** 1,2,[배너] 총 3아이템 (3개 미만이므로 아래)
- **선행 Scenario:** 9-5-01

### Scenario 9-5-04: featured 여러 개 → 가장 임박한 1개만

- **Given:** featured 3건 (날짜 상이)
- **When:** `/` 접근
- **Then:** 가장 임박(날짜 근접) 1건만 인라인 배너로 삽입
- **선행 Scenario:** 9-5-01

### Scenario 9-5-05: 인라인 배너 시각 구분

- **Given:** 인라인 배너 렌더됨
- **When:** 일반 MeetingCard와 비교
- **Then:** 배경/테두리/라벨("추천") 등 시각적 구분 존재
- **선행 Scenario:** 9-5-02

---

# M10. 관리자 심화 — 정산 + 회원 생애주기

## WP10-1. 정산 admin 전용 이동 + 고도화

### Scenario 10-1-01: admin 계정 `/admin/settlements` 접근 성공

- **Given:** admin role 유저
- **When:** `/admin/settlements` 접근
- **Then:** 정산 페이지 렌더
- **선행 Scenario:** 7-3-05

### Scenario 10-1-02: editor 계정 접근 차단

- **Given:** editor role 유저
- **When:** `/admin/settlements` 접근 시도
- **Then:** 403 또는 리다이렉트, 페이지 렌더 안 됨
- **선행 Scenario:** 10-1-01

### Scenario 10-1-03: 월 선택 UI 기본값 이번 달

- **Given:** 정산 페이지 진입
- **When:** 월 선택 컨트롤 확인
- **Then:** 현재 월이 기본 선택 상태
- **선행 Scenario:** 10-1-01

### Scenario 10-1-04: 이전 달로 변경 시 데이터 재조회

- **Given:** 이번 달 정산 표시 중
- **When:** "이전 달" 버튼 클릭
- **Then:** 이전 달 매출/환불/순매출 데이터로 갱신
- **선행 Scenario:** 10-1-03

### Scenario 10-1-05: 재정 요약 정확성 (L-1 좌우 범위 일치)

- **Given:** confirmed 10건(총 100,000원) + 취소 환불 2건(총 15,000원)
- **When:** 해당 월 재정 요약 확인
- **Then:** 총 매출 100,000 − 환불 15,000 = 순매출 85,000원 정확 표시
- **선행 Scenario:** 10-1-03

### Scenario 10-1-06: 공간별 정산 테이블 렌더

- **Given:** venues 3개 + 관련 confirmed 레코드
- **When:** 정산 페이지
- **Then:** 공간별 매출 테이블 3행 노출
- **선행 Scenario:** 10-1-05

### Scenario 10-1-07: 정산 완료 처리

- **Given:** 이번 달 매출 집계 완료
- **When:** "정산 완료" 버튼 클릭
- **Then:** 해당 월 잠김 상태, venue_settlements INSERT
- **선행 Scenario:** 10-1-06

---

## WP10-2. 회원 생애주기 분석 대시보드

### Scenario 10-2-01: 5단계 집계 합이 총 회원 수와 일치

- **Given:** 총 100명 회원
- **When:** 5단계 분석 실행
- **Then:** 신규+활성+휴면+이탈+미참석 = 100 (중복/누락 없음)
- **선행 Scenario:** 7-3-05

### Scenario 10-2-02: 신규 단계 기준 — 가입 30일 이내

- **Given:** 기준 날짜 2026-04-17
- **When:** 가입일 2026-03-20 (28일 전) 유저
- **Then:** 신규로 분류
- **선행 Scenario:** 10-2-01

### Scenario 10-2-03: 활성 단계 — 최근 90일 내 참여

- **Given:** 가입 100일 전, 마지막 참여 30일 전
- **When:** 분류 실행
- **Then:** 활성으로 분류
- **선행 Scenario:** 10-2-01

### Scenario 10-2-04: 미참석 단계 — 가입 후 참여 0건

- **Given:** 가입 60일 전, attended=true 0건
- **When:** 분류 실행
- **Then:** 미참석으로 분류
- **선행 Scenario:** 10-2-01

### Scenario 10-2-05: 단계 카드 클릭 시 회원 목록

- **Given:** 단계별 집계 카드 렌더
- **When:** "휴면" 카드 클릭
- **Then:** 휴면 회원 목록이 노출됨
- **선행 Scenario:** 10-2-01

### Scenario 10-2-06: 가입→첫 참여 소요일 중앙값/평균

- **Given:** 참여 이력 있는 회원 20명, 소요일 각각 상이
- **When:** 지표 계산
- **Then:** 중앙값 + 평균 두 값 모두 표시
- **선행 Scenario:** 10-2-01

### Scenario 10-2-07: 재참석 전환율 (1회 → 2회)

- **Given:** 1회 참석자 50명, 중 2회 이상 참석자 20명
- **When:** 전환율 계산
- **Then:** 40% 표시
- **선행 Scenario:** 10-2-01

### Scenario 10-2-08: 이탈 추이 월별 차트

- **Given:** 최근 6개월간 이탈 회원 발생
- **When:** 이탈 추이 확인
- **Then:** 6개월 월별 이탈자 수 표시
- **선행 Scenario:** 10-2-01

### Scenario 10-2-09: 5단계 집계 수동 검증 쿼리 작성

- **Given:** 생애주기 5단계 로직이 구현되어 UI 수치가 노출된다
- **When:** `docs/` 또는 `scripts/`에 각 단계의 정의(신규/활성/휴면/이탈/미참석)를 순수 SQL로 재현한 수동 검증 쿼리 1건을 작성하고 실행한다
- **Then:** UI 노출 수치와 SQL 쿼리 결과 수치가 완전히 일치. 쿼리는 repo에 커밋되어 이후 기준 변경 시 참조 가능
- **선행 Scenario:** 10-2-01

---

## WP10-3. 모임 폼 2차 확장 + 링크 정리

### Scenario 10-3-01: 추가 옵션 섹션 기본 접힘

- **Given:** 모임 생성 폼 진입
- **When:** 초기 상태 확인
- **Then:** "추가 옵션" 섹션이 접혀 있음 (detail_address 등 미노출)
- **선행 Scenario:** 7-4-07

### Scenario 10-3-02: 섹션 펼침

- **Given:** 위 상태
- **When:** "추가 옵션" 토글 클릭
- **Then:** detail_address/chat_link/reading_link 3필드 노출
- **선행 Scenario:** 10-3-01

### Scenario 10-3-03: detail_address 저장/로드

- **Given:** "경주시 황오동 123" 입력
- **When:** 모임 저장 후 수정 진입
- **Then:** detail_address 필드에 기존 값 채워짐
- **선행 Scenario:** 10-3-02

### Scenario 10-3-04: chat_link URL validation 실패

- **Given:** chat_link에 "http://" 혹은 잘못된 형식
- **When:** 제출 시도
- **Then:** 클라이언트 validation 또는 API 응답 에러
- **선행 Scenario:** 10-3-02

### Scenario 10-3-05: reading_link 빈값 저장

- **Given:** reading_link 비움
- **When:** 저장
- **Then:** reading_link=NULL 저장 성공
- **선행 Scenario:** 10-3-02

### Scenario 10-3-06: AdminMeetingCard 링크 최종 재연결

- **Given:** WP7-4에서 일부 호출부만 전환된 상태 (잔여)
- **When:** 모든 AdminMeetingCard 호출부 점검
- **Then:** 100% `/admin/meetings/[id]`로 연결 (`/meetings/[id]` 호출 0건)
- **선행 Scenario:** 7-4-06

---

# M11. 디자인 토큰 통합 + 접근성 정리

## WP11-1. 디자인 토큰 하드코딩 제거

### Scenario 11-1-01: grep 검사 — text-gray-/bg-gray- 0건

- **Given:** WP11-1 완료 후 코드베이스
- **When:** `grep -r "text-gray-\|bg-gray-" src/`
- **Then:** 의도된 예외 제외 0건
- **선행 Scenario:** 없음

### Scenario 11-1-02: grep 검사 — hex 색상 하드코딩 0건

- **Given:** 위 코드베이스
- **When:** `grep -r "#[0-9a-fA-F]\{3,6\}"` (설정 파일 제외)
- **Then:** 0건 또는 의도된 예외만
- **선행 Scenario:** 11-1-01

### Scenario 11-1-03: 시각 회귀 없음

- **Given:** WP11-1 전/후 홈, 모임 목록, 관리자 화면
- **When:** screenshot 비교
- **Then:** 눈에 띄는 시각 변화 없음
- **선행 Scenario:** 11-1-01

### Scenario 11-1-04: prelaunch 통과

- **Given:** 토큰 교체 완료
- **When:** `npm run prelaunch`
- **Then:** lint + tsc + test + build 전부 PASS
- **선행 Scenario:** 11-1-01

---

## WP11-2. WCAG AA 접근성 정리

### Scenario 11-2-01: Lighthouse Accessibility ≥ 90

- **Given:** WP11-2 완료
- **When:** Chrome Lighthouse Accessibility 검사 (홈/모임 목록/관리자)
- **Then:** 모든 페이지에서 90점 이상
- **선행 Scenario:** 없음

### Scenario 11-2-02: 키보드 Tab 포커스 이동

- **Given:** 로그인된 홈 페이지
- **When:** Tab 키 순차 이동
- **Then:** 모든 interactive 요소에 visible focus ring 노출
- **선행 Scenario:** 11-2-01

### Scenario 11-2-03: 이미지 alt 속성 존재

- **Given:** 배너/프로필 이미지 포함 페이지
- **When:** DOM 점검
- **Then:** 모든 `<img>`에 의미 있는 alt 속성 (장식용은 alt="")
- **선행 Scenario:** 11-2-01

### Scenario 11-2-04: 색상 대비 AA 통과

- **Given:** WebAIM Contrast Checker 또는 axe
- **When:** 주요 텍스트/버튼 대비 측정
- **Then:** AA 기준(본문 4.5:1, 큰 텍스트 3:1) 통과
- **선행 Scenario:** 11-2-01

---

# M12. 통합 검증 + 배포

## WP12-1. 풀스캔 재실행 + 실사용자 회귀 검증

### Scenario 12-1-01: 풀스캔 Critical 0건

- **Given:** Phase 3 모든 WP 완료
- **When:** 풀스캔 실행
- **Then:** Critical 0건 확인
- **선행 Scenario:** 없음

### Scenario 12-1-02: 사용자 로컬 테스트 피드백 14건 회귀 OK

- **Given:** `phase3-requirements.md`의 로컬 테스트 피드백 14건 목록
- **When:** 각 항목을 Preview에서 재확인
- **Then:** 전 항목 OK (회귀 없음)
- **선행 Scenario:** 12-1-01

### Scenario 12-1-03: MVP E2E 플로우 회귀

- **Given:** 로그인 → 모임 선택 → 결제 → 신청 완료 → 취소 → 환불 전체 흐름
- **When:** Preview에서 실행
- **Then:** MVP 플로우 회귀 없음 (Phase 3 변경이 기존 동작을 깨지 않음)
- **선행 Scenario:** 12-1-01

### Scenario 12-1-04: prelaunch 파이프라인 통과

- **Given:** main 머지 직전
- **When:** `npm run prelaunch`
- **Then:** lint + tsc + test + build 전부 PASS
- **선행 Scenario:** 12-1-01

### Scenario 12-1-05: (main) 라우트 Vercel Preview 검증 (L-7)

- **Given:** 로컬 OAuth 콜백 불가
- **When:** Preview URL에서 로그인 + 홈 탭 접근
- **Then:** 정상 동작 확인
- **선행 Scenario:** 12-1-03

---

## WP12-2. 프로덕션 배포

### Scenario 12-2-01: main 머지 성공

- **Given:** WP12-1 완료 + Preview 승인
- **When:** PR 머지
- **Then:** main 브랜치에 반영, Vercel 프로덕션 자동 배포 트리거
- **선행 Scenario:** 12-1-05

### Scenario 12-2-02: 프로덕션 홈 탭 렌더

- **Given:** 배포 완료
- **When:** 프로덕션 URL에서 로그인 후 `/home` 접근
- **Then:** 배너/D-Day/한 줄/소셜 프루프 정상 렌더
- **선행 Scenario:** 12-2-01

### Scenario 12-2-03: 프로덕션 배너/한 줄 관리 동작

- **Given:** admin 계정
- **When:** 프로덕션에서 `/admin/banners`, `/admin/book-quotes` 사용
- **Then:** CRUD + 승인 워크플로우 정상
- **선행 Scenario:** 12-2-01

### Scenario 12-2-04: 한 줄 end-to-end 프로덕션 확인

- **Given:** member 계정이 한 줄 제출
- **When:** admin 승인 후 member가 `/home` 재접근
- **Then:** 승인된 한 줄 노출 확인
- **선행 Scenario:** 12-2-02, 12-2-03

### Scenario 12-2-05: milestones-phase3.md 완료 체크

- **Given:** 위 모든 시나리오 통과
- **When:** 로드맵 문서 업데이트
- **Then:** milestones-phase3.md의 모든 체크박스 체크됨, v1.2 변경 이력 추가
- **선행 Scenario:** 12-2-04

---

## Phase 3 시나리오 총괄

| Milestone | WP | Scenario 수 |
|:---:|:---:|:---:|
| M7 | 5 | 12+11+7+10+4 = **44** |
| M8 | 2 | 10+8 = **18** |
| M9 | 5 | 8+7+8+8+5 = **36** |
| M10 | 3 | 7+9+6 = **22** |
| M11 | 2 | 4+4 = **8** |
| M12 | 2 | 5+5 = **10** |
| **합계** | **19** | **138** |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v1.0 | 2026-04-17 | work-packages-phase3.md 기반 최초 Scenario 수립 (총 136개) |
| v1.1 | 2026-04-17 | 역검토 반영: 7-2-11(타입 정의 추가) + 10-2-09(5단계 수동 검증 쿼리) 2건 추가. 총 138개 |
