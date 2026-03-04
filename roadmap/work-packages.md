# JIDOKHAE MVP Work Packages

> 이 문서는 milestones.md의 각 Milestone을 **실행 가능한 Work Package(WP)** 단위로 분해한 문서입니다.
> 각 WP는 Vertical Slice 원칙에 따라 사용자 가치를 전달하며, WP 완료 시 소프트웨어는 **동작하는 상태**입니다.

---

## 읽는 법

| 용어 | 의미 |
|------|------|
| WP | Work Package — Milestone 내 실행 단위 |
| Phase | WP 내부의 구현 순서 (P1, P2, ...) |
| 선행 조건 | 이 WP를 시작하기 전에 완료되어야 하는 항목 |
| 검증 기준 | WP 완료를 판단하는 구체적 테스트 |

**의존성 흐름:**

```
WP1-1 → WP1-2 → WP1-3 → WP2-1 → WP2-2 → WP3-1 → WP3-2 → WP3-3 → WP4-1 → WP4-2 → WP4-3 → WP5-1 → WP5-2 → WP6-1 → WP6-2
```

---

## M1. 프로젝트 기반 구축

### WP1-1. 프로젝트 초기화 + 배포 파이프라인

**목표:** Next.js 앱이 Vercel에 자동 배포되고, 개발 환경이 갖춰진다.

**선행 조건:** 없음 (최초 WP)

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | Next.js 프로젝트 생성 | App Router + TypeScript. `create-next-app` 사용 |
| 2 | GitHub 저장소 연결 | 코드 push 가능한 상태 |
| 3 | Vercel 연동 + 자동 배포 | GitHub push → Vercel 자동 빌드/배포 확인 |
| 4 | 환경 변수 구조 설정 | `.env.local` 템플릿 (Supabase URL/Keys, 포트원 API Key 등). `.env.example` 파일 제공 |
| 5 | Supabase Client 유틸리티 | Server용 `createClient()` (anon key), Admin용 `createServiceClient()` (service_role key), Client용 `createClient()` — 3종 구현 |

**검증 기준:**
- [ ] `npm run dev`로 localhost:3000에서 앱 실행 가능
- [ ] GitHub push 시 Vercel에 자동 배포되어 URL로 접속 가능
- [ ] Supabase Client 3종이 import 가능하고 초기화 에러 없음

---

### WP1-2. DB 스키마 + RLS + Functions + Triggers

**목표:** Supabase에 3개 테이블, RLS 정책, DB Functions, Trigger가 구축되어 이후 모든 Milestone의 데이터 기반이 된다.

**선행 조건:** WP1-1 완료 (Supabase 프로젝트 생성 + 환경 변수)

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | `profiles` 테이블 | `id`(UUID, PK=auth.users.id), `kakao_id`(nullable), `nickname`(NOT NULL, default ''), `email`(nullable), `role`(NOT NULL, default 'member'), `created_at` |
| 2 | `meetings` 테이블 | `id`(UUID), `title`, `date`(DATE), `time`(TIME), `location`, `capacity`, `fee`, `status`(active/deleting/deleted, default 'active'), `created_at`, `updated_at` |
| 3 | `registrations` 테이블 | `id`(UUID), `user_id`(FK→profiles), `meeting_id`(FK→meetings), `status`(confirmed/cancelled), `cancel_type`(null/user_cancelled/meeting_deleted), `payment_id`, `paid_amount`, `refunded_amount`, `attended`(nullable, MVP 미사용), `created_at`, `cancelled_at`. **user_id + meeting_id에 UNIQUE 제약 걸지 말 것** |
| 4 | RLS 정책 | profiles: member=자기 레코드만 SELECT/UPDATE, admin=전체 SELECT. meetings: 전체 SELECT, admin만 INSERT/UPDATE/DELETE. registrations: member=자기 레코드만 SELECT, admin=전체 SELECT, INSERT/UPDATE는 API Route(service_role)에서만 |
| 5 | DB Trigger | `auth.users` INSERT 시 → `profiles` 자동 생성. `raw_user_meta_data`에서 kakao_id, nickname, email 추출 |
| 6 | DB Function: `confirm_registration` | `(p_user_id, p_meeting_id, p_payment_id, p_paid_amount)` → FOR UPDATE 잠금 → confirmed 수 체크 → INSERT 또는 'full' 반환. **SECURITY DEFINER** |
| 7 | DB Function: 모임별 confirmed 수 조회 | 모임 ID 배열을 받아 각 모임의 confirmed 신청 수를 반환. **SECURITY DEFINER** (RLS 우회하여 전체 registrations 카운트) |

**핵심 규칙:**
- `registrations`의 `user_id + meeting_id`는 UNIQUE가 아니다 (재신청 시 복수 레코드 허용)
- `confirm_registration`은 FOR UPDATE 행 잠금으로 동시 신청을 직렬화한다
- profiles Trigger는 카카오 미제공 필드(email, nickname)에 대해 null 또는 빈 문자열로 안전 처리

**검증 기준:**
- [ ] 3개 테이블이 Supabase에 생성됨 (컬럼이 기술 스택 §4-1과 일치)
- [ ] member 유저로 meetings SELECT 가능, registrations는 자기 것만 SELECT 가능
- [ ] admin 유저로 meetings INSERT/UPDATE/DELETE 가능
- [ ] registrations에 대한 프론트 직접 INSERT 불가 (RLS 차단)
- [ ] `confirm_registration` 함수 호출 시 정원 체크 + INSERT 동작 확인
- [ ] SECURITY DEFINER 카운트 함수로 모임별 confirmed 수 조회 가능
- [ ] auth.users에 유저 생성 시 profiles에 자동 레코드 생성

---

### WP1-3. 모바일 우선 레이아웃 + 글로벌 스타일

**목표:** 모바일 우선 반응형 레이아웃과 디자인 토큰 시스템이 구축되어, 이후 모든 UI 작업의 기반이 된다.

**선행 조건:** WP1-1 완료

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | 모바일 우선 레이아웃 | 하단 탭 2개: "모임 일정" / "내 신청". 360px 기준 설계. PC는 기본 대응 |
| 2 | 글로벌 스타일 시스템 | Tailwind CSS 설정. 디자인 토큰 (컬러, 타이포그래피, 간격, 그림자, border-radius). 8px 그리드 |
| 3 | 기본 컴포넌트 | 공통 레이아웃 셸 (Header/Footer 또는 탭 네비게이션) |

**검증 기준:**
- [ ] 모바일(360px)에서 하단 탭이 정상 렌더링됨
- [ ] PC 화면에서 기본 레이아웃이 깨지지 않음
- [ ] Tailwind 디자인 토큰이 적용된 상태 (색상, 폰트 등)

---

## M2. 인증 (카카오 로그인)

### WP2-1. 카카오 로그인 + 프로필 자동 생성

**목표:** 카카오 계정으로 로그인하면 프로필이 자동 생성되고 메인 페이지로 이동한다.

**선행 조건:**
- M1 산출물 검증 완료 (특히 profiles Trigger)
- Supabase 대시보드에서 Kakao OAuth provider 활성화
- 카카오 개발자 콘솔에서 앱 등록 + Redirect URI 설정 (localhost + Vercel 도메인)

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | Supabase Auth ↔ Kakao OAuth 연동 | Supabase 대시보드 설정 + 카카오 개발자 콘솔 Redirect URI |
| 2 | OAuth Callback Route | `/auth/callback` — auth code → session 교환. `pendingCookies` 패턴으로 redirect 시 쿠키 유실 방지 |
| 3 | 로그인 페이지 UI | 카카오 로그인 버튼. 모바일 우선 디자인. 서비스 브랜딩 포함 |
| 4 | 프로필 자동 생성 확인 | DB Trigger가 `raw_user_meta_data`에서 `kakao_id`(nullable), `nickname`(default ''), `email`(nullable) 추출하는지 검증 |
| 5 | 로그인 성공 → 메인 리다이렉트 | Callback에서 `/` (모임 일정 목록)으로 redirect. 메인 페이지는 "곧 만나요" placeholder |

**엣지 케이스:**
- 카카오에서 이메일 미동의 → `email = null`으로 처리 (크래시 금지)
- 카카오 닉네임 없음 → `nickname = ''`, UI에서 빈 닉네임 대응
- 카카오톡 인앱 브라우저에서 OAuth redirect 동작 확인

**검증 기준:**
- [ ] 카카오 로그인 버튼 클릭 → 카카오 인증 → 메인 페이지 도착
- [ ] `profiles` 테이블에 해당 유저 레코드 생성 확인 (`kakao_id`, `nickname`, `email` 값 확인)
- [ ] 로그인 실패(사용자 취소) 시 로그인 페이지로 복귀

---

### WP2-2. 세션 관리 + 접근 제어 + 로그아웃

**목표:** 재방문 시 자동 로그인, 미인증 시 로그인으로 리다이렉트, 로그아웃 동작, admin 역할 구분이 가능하다.

**선행 조건:** WP2-1 완료

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | Auth Middleware | `middleware.ts` — 모든 비정적 요청에서 세션 확인. `/auth/callback`은 미들웨어 건너뜀 (쿠키 덮어쓰기 방지) |
| 2 | 미인증 리다이렉트 | 보호 경로 접근 시 `/auth/login`으로 리다이렉트 |
| 3 | 세션 유지 (재방문) | Supabase session refresh로 재방문 시 자동 인증. 브라우저 탭 닫았다 재접속해도 유지 |
| 4 | 로그아웃 기능 | 로그아웃 버튼 → Supabase `signOut()` → 로그인 페이지로 이동 |
| 5 | Admin 역할 설정 + 확인 | Supabase 대시보드에서 `UPDATE profiles SET role = 'admin'` 수동 실행. 코드에서 `profiles.role` 조회로 admin/member 구분 |
| 6 | Supabase Client 유틸리티 확인 | Server용 `createClient()`, Client용 `createClient()`, Admin용 `createServiceClient()` 3종 정상 동작 확인 |

**엣지 케이스:**
- `auth.uid()` 존재하지만 `profiles` 미생성 (Trigger 지연) → 프로필 조회 실패 시 graceful 처리
- 세션 만료 후 API 호출 → 자동 리프레시 또는 로그인 유도

**검증 기준:**
- [ ] 브라우저 탭 닫고 재접속 → 로그인 없이 메인 페이지 진입
- [ ] 시크릿 모드로 보호 경로 접근 → 로그인 페이지 리다이렉트
- [ ] 로그아웃 → 다시 보호 경로 접근 불가
- [ ] admin 유저와 member 유저로 각각 로그인 시 `profiles.role` 값 확인 가능

---

## M3. 모임 일정 조회 + 운영자 CRUD

### WP3-1. 모임 일정 목록 (회원 뷰)

**목표:** 회원이 로그인하면 다가오는 모임을 매력적인 카드 UI로 한눈에 볼 수 있다.

**선행 조건:**
- WP2-2 완료
- M1의 SECURITY DEFINER 카운트 함수 정상 동작 확인

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | KST 날짜 유틸리티 | 공통 유틸 함수: `getKSTToday()`, `toKSTDate()`. Vercel UTC 환경에서 KST 날짜 비교용. **이후 M3~M5 전체에서 사용** |
| 2 | 모임 목록 데이터 조회 | Supabase 쿼리: `meetings WHERE date >= today(KST) AND status = 'active'`. SECURITY DEFINER 함수로 모임별 confirmed 수 조회 |
| 3 | 모임 카드 UI 컴포넌트 | **"참여하고 싶게 생긴" 시각적 디자인**. 모임명, 날짜, 시간, 장소, 남은 자리("O명 참여", 정원은 비표시), 참가비 |
| 4 | "마감" 뱃지 | confirmed 수 >= capacity → 카드에 "마감" 뱃지 표시 |
| 5 | 날짜 오름차순 정렬 | 가장 가까운 모임이 맨 위 |
| 6 | 빈 상태 UI | 다가오는 모임이 없을 때 안내 화면 |
| 7 | 3초 이내 로딩 | 목록 로딩 성능 확인 |

**핵심 규칙:**
- 남은 자리 표시: "O명 참여"로 현재 인원만 표시. **최대 정원은 회원에게 절대 노출하지 않는다**
- 날짜 비교: 반드시 KST 기준. `new Date()` 직접 사용 금지, KST 유틸 사용

**검증 기준:**
- [ ] 로그인 후 메인 페이지에 다가오는 모임 카드가 표시됨
- [ ] 오늘 날짜의 모임도 목록에 포함됨 (KST 기준)
- [ ] 마감된 모임에 "마감" 뱃지가 정확히 표시됨
- [ ] 모바일(360px)에서 카드 UI가 매력적으로 렌더링됨
- [ ] 모임이 없을 때 빈 상태 화면 표시됨
- [ ] 모임 목록 로딩 3초 이내

---

### WP3-2. 모임 상세 페이지 + 목록 "신청완료" 뱃지

**목표:** 모임 카드를 누르면 상세 정보를 확인하고, 상태에 따라 적절한 버튼이 표시된다. 목록에서 내가 신청한 모임이 구분된다.

**선행 조건:** WP3-1 완료

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | 모임 상세 페이지 | `/meetings/[id]` — 날짜, 시간, 장소, 남은 자리, 참가비 표시 |
| 2 | 버튼 분기 5종 구현 | PRD §6-2 기준. confirmed 유무 × 모임 시점으로 결정. **cancelled 레코드는 무시** |
| 3 | "신청하기" 버튼 (placeholder) | 활성 상태로 표시하되, M4 연결 전까지 "곧 오픈 예정" 안내 또는 비활성 처리 |
| 4 | 목록 "신청완료" 뱃지 | 현재 유저의 `registrations WHERE status='confirmed'` 조회. 카드에 "신청완료" 표시 |
| 5 | 시간 포맷 | `meetings.time`(TIME 타입) → "오후 7:00" 형식 한국어 표시 |

**버튼 분기 (PRD 기준, 반드시 준수):**

| 조건 | 표시 |
|------|------|
| 모임 전 + confirmed 없음 + 자리 있음 | "신청하기" (활성) |
| 모임 전 + confirmed 없음 + 마감 | "마감" (비활성) |
| 모임 당일 이전(포함) + confirmed 있음 | "취소하기" (활성, M5에서 연결) |
| 모임 지남 + confirmed 있음 | "참여 완료" 텍스트 |
| 모임 지남 + confirmed 없음 | 버튼 없음 |

**엣지 케이스:**
- 같은 유저가 동일 모임에 cancelled + confirmed 레코드 보유 (재신청 후 상태) → confirmed만 체크
- 모임 당일 자정(KST) 경계: 오늘 모임 = "모임 전"으로 취급 (취소하기 표시)
- 모임 다음 날 = "모임 지남"으로 취급

**검증 기준:**
- [ ] 모임 카드 터치 → 상세 페이지 정상 진입
- [ ] 5종 버튼 분기가 조건에 따라 정확히 표시됨
- [ ] 목록에서 내가 신청한 모임에 "신청완료" 뱃지 표시됨
- [ ] 시간 표시가 한국어 포맷으로 올바르게 렌더링됨

---

### WP3-3. 운영자 모임 관리 (CRUD)

**목표:** 운영자가 모임을 생성/수정/삭제할 수 있고, 변경 사항이 회원 목록에 즉시 반영된다.

**선행 조건:** WP3-2 완료

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | 운영자 접근 제어 | admin 전용 라우트 보호. `profiles.role` 확인 → member 접근 시 차단 |
| 2 | 운영자 모임 목록 | 과거 모임 + deleting 포함, deleted 제외. **날짜 내림차순** (회원과 반대) |
| 3 | 모임 생성 폼 | 입력: 모임명, 날짜, 시간, 장소, 정원, 참가비. RLS로 admin만 INSERT 허용. Supabase Client 직접 사용 (API Route 불필요) |
| 4 | 모임 수정 | 기존 모임 정보 수정. **참가비 변경 시 기존 결제 건에 영향 없음** (불변 규칙) |
| 5 | 모임 삭제 (제한적) | **이 단계에서는 신청자가 없는 모임만 삭제 가능.** 신청자 존재 시 삭제 버튼 비활성 + "신청자가 있어 삭제할 수 없습니다" 안내. M5에서 환불 포함 삭제로 업그레이드 |
| 6 | 신청자 목록 UI 틀 | 모임 상세 하단에 빈 테이블 레이아웃. "아직 신청자가 없습니다" 표시. M4에서 실제 데이터 연결 |

**RLS 활용 (기술 스택 문서 §2-3 기준):**
- `meetings` INSERT/UPDATE/DELETE: RLS로 admin만 허용 → 프론트엔드 Supabase Client에서 직접 처리 가능
- API Route 불필요 (admin 판별은 RLS가 담당)

**검증 기준:**
- [ ] 운영자: 모임 생성 → 회원 목록에 즉시 반영됨
- [ ] 운영자: 모임 수정 → 변경 사항 즉시 반영됨
- [ ] 운영자: 신청자 없는 모임 삭제 → 목록에서 사라짐
- [ ] 운영자: 운영자 목록에 과거 모임과 deleting 모임이 표시됨
- [ ] member 유저: 운영자 페이지 접근 불가

---

## M4. 결제 + 신청

### WP4-1. 포트원 결제 파이프라인

**목표:** 결제 → 서버 검증 → 원자적 등록이 하나의 안전한 파이프라인으로 동작한다.

**선행 조건:**
- WP3-3 완료
- **(외부) 포트원 V2 계정 생성 + PG사(토스페이먼츠/KCP) 심사 승인** — 리드타임 있으므로 M2 시작과 동시에 신청 권장
- M1의 `confirm_registration` DB Function 정상 동작 확인 (동시 호출 테스트 포함)

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | 포트원 V2 SDK 연동 | 프론트엔드에 PortOne SDK 설치. **반드시 V2 API. V1 코드 사용 금지** |
| 2 | 결제 검증 API Route | `POST /api/registrations/confirm` — service_role key 사용 |
| 3 | 포트원 REST API 클라이언트 | 결제 검증 + 환불 기능을 **재사용 가능한 모듈**로 구현. M5에서 재사용 |
| 4 | 결제 검증 로직 | ① 포트원 API로 결제 상태 확인 (paid 여부) ② 결제 금액 = meetings.fee 일치 확인 ③ meeting.status = 'active' 확인 |
| 5 | 원자적 등록 | `confirm_registration` DB Function 호출 → 'success' 또는 'full' 반환 |
| 6 | 정원 초과 자동 환불 | DB Function이 'full' 반환 시 → 포트원 환불 API 호출 → "마감" 응답 |

**4단계 결제 흐름 (기술 스택 문서 §4-2 기준, 엄격히 준수):**

```
① 프론트: 포트원 SDK → PG사 결제창 열기
② 결제 완료: 포트원 → 프론트 콜백 (payment_id 전달)
③ 프론트 → API Route: "이 결제를 검증해줘" (payment_id 전달)
④ API Route → 포트원 REST API 검증 → DB Function → 응답
```

> **핵심 규칙: 프론트의 "결제됐다"는 말을 그대로 믿지 않는다. 서버가 포트원에 직접 검증한다.**

**엣지 케이스:**
- 결제 성공 후 API Route 호출 실패 (네트워크 오류) → 결제는 완료되었으나 등록 미생성. 프론트에 안내 메시지 표시, 포트원 콘솔에서 운영자 수동 확인 (MVP 한계)
- 두 명이 마지막 1자리 동시 신청 → FOR UPDATE 잠금으로 직렬화. 한 명만 성공, 나머지는 자동 환불
- 결제 금액 위변조 시도 (프론트 조작) → 서버에서 meetings.fee와 대조하여 불일치 시 거부 + 환불
- 정원 초과 환불 API 호출 실패 → 에러 로깅 + "일시적 오류" 메시지. 포트원 콘솔에서 수동 처리
- 이미 confirmed 신청이 있는 사용자의 중복 결제 시도 → DB Function이 기존 confirmed 존재를 감지하고 중복 등록 거부 + 환불

**검증 기준:**
- [ ] 테스트 결제 → 포트원 검증 → registrations INSERT 확인 (status: confirmed)
- [ ] 결제 금액 ≠ 모임비 → 거부 + 환불 확인
- [ ] 정원 초과 시 자동 환불 + "마감" 응답 확인
- [ ] DB Function 동시 호출 시 정원 이상 INSERT 불가 확인

---

### WP4-2. 신청 UX 완성 (3클릭 결제)

**목표:** 회원이 목록 → 상세 → 신청하기 3클릭으로 결제를 완료하고, 확정 화면을 확인한다.

**선행 조건:** WP4-1 완료

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | "신청하기" 버튼 연결 | WP3-2의 placeholder를 실제 결제 플로우로 교체. 클릭 → 포트원 결제창 |
| 2 | 신청 확정 화면 | "신청이 완료되었습니다" + 모임 정보 요약 (날짜, 시간, 장소, 결제 금액) |
| 3 | 결제 실패 처리 | PG 취소/한도 초과/오류 → 모임 상세로 복귀 + "결제가 완료되지 않았습니다. 다시 시도해주세요." 토스트 |
| 4 | 목록 "신청완료" 뱃지 실데이터 | WP3-2에서 구현한 뱃지가 실제 registrations 데이터와 연동 확인 |
| 5 | 마감 상태 실시간 반영 | 결제 완료로 정원이 찬 경우, 다른 사용자에게 "마감" 뱃지 표시 |

**3클릭 규칙 (PRD 기준):**

```
모임 카드 터치 (1클릭) → 모임 상세 "신청하기" (2클릭) → 결제창 진입 (3클릭)
※ PG사 결제창 내부 클릭은 제외
```

**검증 기준:**
- [ ] 목록 → 상세 → 신청하기: 결제 화면 진입까지 정확히 3클릭
- [ ] 결제 완료 → 확정 화면 표시 → 목록 복귀 시 "신청완료" 뱃지
- [ ] 결제 실패 → 상세 페이지 + 에러 토스트 → 바로 재시도 가능
- [ ] 모바일에서 결제창이 정상 표시됨 (팝업 차단 이슈 없음)

---

### WP4-3. 내 신청 내역 + 운영자 신청 목록

**목표:** 회원은 자신의 신청/결제 이력을, 운영자는 모임별 신청자 현황을 확인한다.

**선행 조건:** WP4-2 완료

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | 내 신청 내역 페이지 | 하단 탭 "내 신청" → 내가 신청한 모임 목록 |
| 2 | 상태 뱃지 3종 | confirmed + 모임 전 = "신청완료", confirmed + 모임 지남 = "참여 완료", cancelled = "취소됨" |
| 3 | 과거 이력 포함 | 지난 모임도 표시. **날짜 내림차순** (최근 신청이 맨 위) |
| 4 | 내 신청 → 모임 상세 연결 | 내 신청 목록에서 모임 터치 → 상세 페이지로 이동 (버튼 분기 그대로 동작) |
| 5 | 운영자 신청자 목록 실데이터 | WP3-3의 빈 테이블에 실제 데이터 연결: 이름(닉네임), 결제 상태, 결제 일시 |

**검증 기준:**
- [ ] 내 신청 탭에서 신청한 모임 확인 가능
- [ ] 상태 뱃지가 조건에 따라 정확히 표시됨
- [ ] 운영자: 모임 상세에서 신청자 이름 + 결제 상태 확인 가능
- [ ] 내역에서 모임 터치 → 상세 페이지 이동 → 올바른 버튼 표시

---

## M5. 취소 + 환불

### WP5-1. 회원 셀프 취소 + 자동 환불

**목표:** 회원이 직접 취소하면 환불 규정에 따라 자동으로 환불된다.

**선행 조건:** WP4-3 완료

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | "취소하기" 버튼 활성화 | WP3-2에서 구현한 버튼 분기 중 "취소하기"를 실제 동작으로 연결 |
| 2 | 취소 가능 여부 판정 | 모임 당일(KST)까지 취소 가능. **모임 다음 날부터 취소 불가** (버튼 미표시) |
| 3 | 환불 규정 안내 UI | 환불 예정 금액 + 비율 표시. "문의: 단무지에게 1대1톡" 카카오 링크 포함 |
| 4 | 취소 확정 다이얼로그 | "취소를 확정하시겠습니까?" + 환불 금액 재확인 |
| 5 | 취소/환불 API Route | `POST /api/registrations/cancel` — service_role key 사용 |
| 6 | KST 환불 금액 계산 | WP3-1의 KST 유틸 사용. 기술 스택 §4-2 의사코드 그대로 구현 |
| 7 | 포트원 환불 호출 | WP4-1의 포트원 클라이언트 재사용. 0원이면 API 호출 생략 |
| 8 | DB 상태 업데이트 | `status → cancelled`, `cancel_type → user_cancelled`, `refunded_amount`, `cancelled_at` |
| 9 | 취소 완료 화면 | 환불 예정 금액 + 환불 소요 시간 안내 |
| 10 | 재신청 가능 확인 | 취소 후 상세 페이지에서 자리 남으면 "신청하기" 다시 표시. 새 registrations 레코드 생성 |

**환불 금액 계산 (기술 스택 문서 의사코드, 반드시 준수):**

```
today = KST 기준 오늘 날짜
days_remaining = meeting.date - today

days_remaining >= 3 → 100% (전액)
days_remaining >= 2 → 50% (반액)
days_remaining < 2  → 0%  (환불 불가, 취소는 가능)

refund_amount = paid_amount × refund_rate
```

> **주의:** `paid_amount`(실제 결제 금액) 기준. `meetings.fee`(현재 참가비)가 아님. 참가비가 변경되었어도 결제 시점 금액으로 환불.

**엣지 케이스:**
- 자정(KST) 경계: 3/2 23:59 vs 3/3 00:00 → refund rate 100% vs 50%
- 0원 환불 확정: "환불 금액: 0원 (환불 불가 기간)" 명확히 표시 후 사용자 동의 받고 취소
- 부분 환불: 포트원 V2 API의 partial refund 파라미터 확인 필수
- 취소 후 같은 모임 재신청: 새 registrations 레코드 생성 (이전 cancelled 레코드 유지)

**검증 기준:**
- [ ] 3일 전 취소 → 100% 환불 확인
- [ ] 2일 전 취소 → 50% 환불 확인
- [ ] 전날/당일 취소 → 0원 환불, 취소는 완료됨
- [ ] 모임 다음 날 → 취소 버튼 자체가 미표시
- [ ] 취소 후 모임 상세 → "신청하기" 버튼 다시 표시 (자리 있을 때)
- [ ] 취소 → 재신청 → 새 registrations 레코드 생성 확인
- [ ] 내 신청 내역에서 "취소됨" 뱃지 표시

---

### WP5-2. 운영자 모임 삭제 + 일괄 환불

**목표:** 운영자가 신청자 있는 모임을 삭제하면 전원 100% 자동 환불 후 삭제된다. 실패 건은 재시도 가능하다.

**선행 조건:** WP5-1 완료

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | M3 삭제 로직 업그레이드 | WP3-3의 "신청자 없는 모임만 삭제"를 제거. 신청자 유무 관계없이 삭제 가능으로 변경 |
| 2 | 삭제 확인 다이얼로그 | "이 모임에 신청자가 N명 있습니다. 삭제 시 모든 신청자에게 100% 환불됩니다." |
| 3 | 모임 삭제 API Route | `POST /api/meetings/[id]/delete` — service_role key 사용 |
| 4 | 상태 전이: deleting | 즉시 `meetings.status → 'deleting'` (새 신청 차단) |
| 5 | 병렬 환불 | `Promise.allSettled`로 confirmed 신청자 전원 100% 환불. **순차 처리 금지 (Vercel 10초 타임아웃)** |
| 6 | 상태 전이: deleted / 유지 | 전원 성공 → `deleted`. 실패 건 존재 → `deleting` 유지 |
| 7 | 성공/실패 건 DB 업데이트 | 환불 성공: `cancelled + meeting_deleted + refunded_amount`. 실패: `confirmed` 유지 |
| 8 | "환불 미처리" 표시 | 운영자 목록에서 deleting 모임에 "환불 미처리" 뱃지 |
| 9 | 환불 재시도 | deleting 모임 상세 → confirmed 남아있는 건 = 미처리 → "환불 재시도" 버튼. 전원 성공 시 → deleted |

**10초 타임아웃 대응 (필수):**

```
정원 14명 × 포트원 API 1~3초/건 = 순차 14~42초 → 타임아웃
Promise.allSettled 병렬 = 전원 1~3초 → 안전
```

**엣지 케이스:**
- 10명 중 8명 성공, 2명 실패 → 8명 cancelled, 2명 confirmed 유지. meetings는 deleting
- 재시도 시 이미 환불된 건을 다시 환불하지 않도록 → confirmed 상태인 건만 대상
- 삭제 시 환불은 **항상 100%** (모임 일정 무관, 환불 규정 무관)
- deleting 모임은 회원 목록에서 보이지 않음 (status ≠ 'active')

**검증 기준:**
- [ ] 신청자 3명인 모임 삭제 → 전원 100% 환불 + deleted 상태
- [ ] 환불 1건 실패 시뮬레이션 → deleting 유지 + "환불 미처리" 뱃지
- [ ] 재시도 → 실패 건만 환불 시도 → 성공 시 deleted
- [ ] 삭제된 모임이 회원 목록에서 사라짐
- [ ] deleting 모임은 운영자 목록에만 표시됨

---

## M6. 통합 검증 + 출시 준비

### WP6-1. E2E 검증 + 버그 수정

**목표:** 전체 MVP 흐름을 시나리오 기반으로 검증하고 발견된 버그를 수정한다.

**선행 조건:** WP5-2 완료

**E2E 테스트 시나리오:**

| # | 시나리오 | 검증 내용 |
|---|---------|----------|
| 1 | 회원 정상 흐름 | 카카오 로그인 → 목록 확인 → 모임 선택 → 결제 → 확정 화면 → 내역 확인 |
| 2 | 회원 취소 흐름 | 내 신청 → 상세 → 취소 → 환불 규정 확인 → 확정 → 취소 완료 |
| 3 | 회원 재신청 | 취소 후 → 같은 모임 상세 → 신청하기 → 결제 → 재등록 확인 |
| 4 | 운영자 모임 관리 | 모임 생성 → 회원 신청 확인 → 모임 수정 → 변경 반영 확인 |
| 5 | 운영자 모임 삭제 | 신청자 있는 모임 삭제 → 일괄 환불 → deleted 확인 |
| 6 | 동시 신청 (정원 초과) | 마지막 1자리에 2명 동시 결제 → 1명 성공 + 1명 자동 환불 |
| 7 | 결제 실패 | PG 결제 중 취소 → 상세 복귀 + 에러 메시지 → 재시도 가능 |
| 8 | 환불 실패 재시도 | 모임 삭제 중 환불 실패 → deleting 유지 → 재시도 → 성공 |
| 9 | KST 날짜 경계 | 자정 전후 환불율 변경, 모임 당일/다음날 취소 가능 여부 |
| 10 | 카카오톡 인앱 브라우저 | 카카오톡에서 링크 클릭 → 로그인 → 결제까지 전체 흐름 |

**추가 검증:**

| 항목 | 기준 |
|------|------|
| 모바일 호환성 | iOS Safari, Android Chrome, 카카오톡 인앱 브라우저 |
| 성능 | 목록 로딩 3초 이내 |
| 빈 상태 | 모임 없음, 신청 없음 등 모든 empty state |
| 권한 분리 | member가 admin 기능 접근 시 차단 확인 |

**검증 기준:**
- [ ] 10개 시나리오 전체 통과
- [ ] 발견된 버그 전부 수정
- [ ] 카카오톡 인앱 브라우저에서 전체 흐름 정상 동작

---

### WP6-2. 프로덕션 배포 + 출시

**목표:** 프로덕션 환경에서 실제 운영 가능한 상태로 배포하고, 출시한다.

**선행 조건:** WP6-1 완료

**산출물:**

| # | 작업 | 상세 |
|---|------|------|
| 1 | Supabase 프로덕션 확인 | RLS, DB Functions, Triggers가 프로덕션에 모두 반영되어 있는지 확인 |
| 2 | 포트원 실결제 전환 | 테스트 모드 → 라이브 모드 전환. PG사 실 연동 확인 |
| 3 | Vercel 프로덕션 배포 | 프로덕션 도메인 설정. 환경 변수 프로덕션 값 세팅 |
| 4 | 카카오 OAuth 프로덕션 | Redirect URI에 프로덕션 도메인 추가 |
| 5 | Admin 계정 설정 | 영탁(단무지)님 카카오 로그인 → profiles 생성 → `role = 'admin'` 수동 변경 |
| 6 | 실결제 E2E 테스트 | 프로덕션 환경에서 실제 결제 → 취소 → 환불 1회 전체 흐름 확인 |
| 7 | 출시 준비 | 카카오톡 오픈채팅방 공유용 링크 + 안내 메시지 준비 |

**MVP 출시 체크리스트 (전부 ✅ 되어야 출시):**

- [ ] 회원이 카카오 로그인으로 접속할 수 있다
- [ ] 모임 일정 목록이 보인다 (마감 상태 포함)
- [ ] 모임을 선택하고 결제까지 완료하면 신청이 확정된다
- [ ] 내 신청 내역을 확인할 수 있다
- [ ] 회원이 직접 취소할 수 있고, 환불 규정에 따라 자동 환불된다
- [ ] 운영자가 모임을 생성/수정/삭제할 수 있다
- [ ] 운영자가 신청자 목록과 결제/취소 상태를 확인할 수 있다

---

## 전체 WP 요약

| WP | Milestone | 이름 | 핵심 산출물 |
|----|-----------|------|-----------|
| WP1-1 | M1 | 프로젝트 초기화 + 배포 파이프라인 | Next.js 앱, GitHub, Vercel 자동 배포, Supabase Client 3종 |
| WP1-2 | M1 | DB 스키마 + RLS + Functions + Triggers | 3개 테이블, RLS, confirm_registration, 카운트 함수, profiles Trigger |
| WP1-3 | M1 | 모바일 우선 레이아웃 + 글로벌 스타일 | 하단 탭, Tailwind 디자인 토큰, 레이아웃 셸 |
| WP2-1 | M2 | 카카오 로그인 + 프로필 생성 | 로그인 → 프로필 자동 생성 → 메인 이동 |
| WP2-2 | M2 | 세션 관리 + 접근 제어 | 미들웨어, 세션 유지, 로그아웃, admin 구분 |
| WP3-1 | M3 | 모임 일정 목록 (회원) | 카드 UI, 마감 뱃지, KST 유틸 |
| WP3-2 | M3 | 모임 상세 + 목록 뱃지 | 5종 버튼 분기, "신청완료" 뱃지 |
| WP3-3 | M3 | 운영자 모임 CRUD | 생성/수정/삭제(제한적), 신청자 UI 틀 |
| WP4-1 | M4 | 포트원 결제 파이프라인 | 결제 → 검증 → 원자적 등록, 정원 초과 환불 |
| WP4-2 | M4 | 신청 UX 완성 | 3클릭 결제, 확정 화면, 실패 처리 |
| WP4-3 | M4 | 내 신청 내역 + 운영자 목록 | 상태 뱃지, 과거 이력, 신청자 실데이터 |
| WP5-1 | M5 | 회원 셀프 취소 + 환불 | KST 환불 계산, 포트원 환불, 재신청 |
| WP5-2 | M5 | 운영자 삭제 + 일괄 환불 | 병렬 환불, deleting 상태 머신, 재시도 |
| WP6-1 | M6 | E2E 검증 + 버그 수정 | 10개 시나리오, 카카오톡 인앱 테스트 |
| WP6-2 | M6 | 프로덕션 배포 + 출시 | 실결제 전환, admin 설정, 출시 체크리스트 |

---

## 조기 착수 필요 항목 (외부 의존성)

| 항목 | 시작 시점 | 이유 |
|------|----------|------|
| 포트원 가입 + PG사 심사 | **M2 시작과 동시** | 심사 승인까지 수일~수주 소요. M4 시작 전 완료 필요 |
| 카카오 개발자 앱 등록 | **M2 시작 전** | OAuth Redirect URI 설정 필요 |
| Vercel 도메인 설정 | **M6 이전** | 프로덕션 URL이 카카오 OAuth, 포트원 리다이렉트에 반영되어야 함 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v1.0 | 2026-03-03 | milestones.md + core 3개 문서 기반 최초 Work Package 수립 (12 WP) |
| v1.1 | 2026-03-03 | M1 Work Package 추가 (WP1-1, WP1-2, WP1-3). 총 15 WP |
| v1.2 | 2026-03-04 | 정합성 검토 반영: WP3-1 검증 기준에 3초 로딩 추가, WP4-1 엣지 케이스에 중복 결제 방어 + 네트워크 오류 추가 |
