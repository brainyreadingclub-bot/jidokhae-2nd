# JIDOKHAE MVP Scenarios

> 이 문서는 work-packages.md의 각 WP를 **Scenario(시나리오)** 단위로 분해한 문서입니다.
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

# M1. 프로젝트 기반 구축

## WP1-1. 프로젝트 초기화 + 배포 파이프라인 ✅ (2026-03-07 검증 완료)

### Scenario 1-1-01: Next.js 프로젝트 로컬 실행

- **Given:** Next.js(App Router + TypeScript) 프로젝트가 생성되어 있다
- **When:** `npm run dev`를 실행한다
- **Then:** localhost:3000에서 앱이 정상 렌더링된다. 에러 없음
- **선행 Scenario:** 없음

### Scenario 1-1-02: GitHub push 시 Vercel 자동 배포

- **Given:** GitHub 저장소와 Vercel 프로젝트가 연동되어 있다
- **When:** 코드를 GitHub에 push한다
- **Then:** Vercel이 자동으로 빌드/배포하고, 배포 URL로 접속 시 앱이 정상 동작한다
- **선행 Scenario:** 1-1-01

### Scenario 1-1-03: 환경 변수 구조 설정 확인

- **Given:** `.env.local`에 Supabase URL/Keys, 포트원 API Key 등 환경 변수가 설정되어 있다
- **When:** `.env.example` 파일을 확인한다
- **Then:** 필요한 모든 환경 변수 키가 `.env.example`에 목록화되어 있다 (값은 비어 있음)
- **선행 Scenario:** 1-1-01

### Scenario 1-1-04: Supabase Server Client 초기화 성공

- **Given:** 환경 변수에 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 설정되어 있다
- **When:** Server용 `createClient()`를 import하고 호출한다
- **Then:** Supabase Client가 에러 없이 초기화된다. anon key로 동작한다
- **선행 Scenario:** 1-1-03

### Scenario 1-1-05: Supabase Admin Client 초기화 성공

- **Given:** 환경 변수에 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있다
- **When:** Admin용 `createServiceClient()`를 import하고 호출한다
- **Then:** service_role key로 Supabase Client가 초기화된다. RLS를 우회할 수 있다
- **선행 Scenario:** 1-1-03

### Scenario 1-1-06: Supabase Client(브라우저) 초기화 성공

- **Given:** 환경 변수에 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 설정되어 있다
- **When:** 브라우저용 `createClient()`를 import하고 호출한다
- **Then:** Supabase Client가 에러 없이 초기화된다. 브라우저 환경에서 동작한다
- **선행 Scenario:** 1-1-03

---

## WP1-2. DB 스키마 + RLS + Functions + Triggers ✅ (2026-03-07 검증 완료)

### Scenario 1-2-01: profiles 테이블 생성 확인

- **Given:** Supabase 프로젝트가 존재한다
- **When:** `profiles` 테이블 구조를 확인한다
- **Then:** `id`(UUID, PK=auth.users.id), `kakao_id`(nullable), `nickname`(NOT NULL, default ''), `email`(nullable), `role`(NOT NULL, default 'member'), `created_at` 컬럼이 존재한다
- **선행 Scenario:** 1-1-04

### Scenario 1-2-02: meetings 테이블 생성 확인

- **Given:** Supabase 프로젝트가 존재한다
- **When:** `meetings` 테이블 구조를 확인한다
- **Then:** `id`(UUID), `title`, `date`(DATE), `time`(TIME), `location`, `capacity`, `fee`, `status`(default 'active'), `created_at`, `updated_at` 컬럼이 존재한다
- **선행 Scenario:** 1-1-04

### Scenario 1-2-03: registrations 테이블 생성 확인

- **Given:** Supabase 프로젝트가 존재한다
- **When:** `registrations` 테이블 구조를 확인한다
- **Then:** `id`(UUID), `user_id`(FK→profiles), `meeting_id`(FK→meetings), `status`, `cancel_type`, `payment_id`, `paid_amount`, `refunded_amount`, `attended`(nullable), `created_at`, `cancelled_at` 컬럼이 존재한다. **user_id + meeting_id에 UNIQUE 제약이 없다**
- **선행 Scenario:** 1-1-04

### Scenario 1-2-04: registrations에 user_id + meeting_id UNIQUE 제약 없음 확인

- **Given:** `registrations` 테이블이 존재한다
- **When:** 동일 user_id + meeting_id 조합으로 2개 레코드를 INSERT한다
- **Then:** 에러 없이 2개 레코드가 모두 저장된다 (재신청 시나리오 대비)
- **선행 Scenario:** 1-2-03

### Scenario 1-2-05: RLS — member가 meetings SELECT 가능

- **Given:** `role='member'` 유저가 인증된 상태
- **When:** meetings 테이블에 SELECT 쿼리를 실행한다
- **Then:** 모든 meetings 레코드가 조회된다
- **선행 Scenario:** 1-2-02

### Scenario 1-2-06: RLS — member가 registrations에서 자기 것만 SELECT

- **Given:** `role='member'` 유저가 인증된 상태. 다른 유저의 registrations도 존재한다
- **When:** registrations 테이블에 SELECT 쿼리를 실행한다
- **Then:** 자신의 user_id와 일치하는 레코드만 반환된다. 다른 유저 레코드는 조회 불가
- **선행 Scenario:** 1-2-03

### Scenario 1-2-07: RLS — member가 registrations에 직접 INSERT 차단

- **Given:** `role='member'` 유저가 프론트엔드 Supabase Client(anon key)를 사용한다
- **When:** registrations 테이블에 직접 INSERT를 시도한다
- **Then:** RLS에 의해 차단된다. INSERT가 거부된다
- **선행 Scenario:** 1-2-03

### Scenario 1-2-08: RLS — admin이 meetings INSERT/UPDATE/DELETE 가능

- **Given:** `role='admin'` 유저가 인증된 상태
- **When:** meetings 테이블에 INSERT, UPDATE, DELETE를 실행한다
- **Then:** 모든 작업이 성공한다
- **선행 Scenario:** 1-2-02

### Scenario 1-2-09: RLS — admin이 전체 registrations SELECT 가능

- **Given:** `role='admin'` 유저가 인증된 상태. 여러 유저의 registrations가 존재한다
- **When:** registrations 테이블에 SELECT 쿼리를 실행한다
- **Then:** 모든 유저의 registrations가 조회된다
- **선행 Scenario:** 1-2-03

### Scenario 1-2-10: DB Trigger — auth.users INSERT 시 profiles 자동 생성

- **Given:** `profiles` 테이블에 해당 유저의 레코드가 없다
- **When:** `auth.users`에 새 유저가 INSERT된다 (카카오 OAuth 등)
- **Then:** DB Trigger에 의해 `profiles` 레코드가 자동 생성된다. `raw_user_meta_data`에서 kakao_id, nickname, email이 추출된다
- **선행 Scenario:** 1-2-01

### Scenario 1-2-11: DB Trigger — 카카오 미제공 필드 안전 처리

- **Given:** `raw_user_meta_data`에 email이 없고 nickname이 없는 유저
- **When:** auth.users INSERT 시 Trigger가 실행된다
- **Then:** `profiles.email = null`, `profiles.nickname = ''`(빈 문자열)로 안전 저장. Trigger가 실패하지 않는다
- **선행 Scenario:** 1-2-10

### Scenario 1-2-12: DB Function — confirm_registration 정상 동작

- **Given:** 정원 14명인 모임에 confirmed 10건 존재
- **When:** `confirm_registration(p_user_id, p_meeting_id, p_payment_id, p_paid_amount)`를 호출한다
- **Then:** FOR UPDATE 잠금 후 confirmed 수 체크 → 14명 미만이므로 registrations INSERT → 'success' 반환
- **선행 Scenario:** 1-2-03

### Scenario 1-2-13: DB Function — confirm_registration 정원 초과 시 'full' 반환

- **Given:** 정원 14명인 모임에 confirmed 14건 존재
- **When:** `confirm_registration`을 호출한다
- **Then:** confirmed 수 = capacity → 'full' 반환. registrations INSERT 없음
- **선행 Scenario:** 1-2-12

### Scenario 1-2-14: DB Function — SECURITY DEFINER 카운트 함수 동작

- **Given:** 모임 A(confirmed 5건), 모임 B(confirmed 10건)가 존재한다
- **When:** 모임 ID 배열 [A, B]로 카운트 함수를 호출한다
- **Then:** A=5, B=10으로 정확히 반환된다. RLS를 우회하여 전체 registrations를 카운트한다
- **선행 Scenario:** 1-2-03

### Scenario 1-2-15: DB Function — 동일 사용자 중복 등록 방어

- **Given:** 사용자 A가 모임 X에 `status='confirmed'` 신청이 이미 존재한다
- **When:** 동일 사용자 A, 모임 X에 대해 `confirm_registration`을 호출한다 (다른 payment_id)
- **Then:** 1.5단계에서 기존 confirmed를 감지하여 'already_registered' 반환. INSERT 없음
- **선행 Scenario:** 1-2-12

---

## WP1-3. 모바일 우선 레이아웃 + 글로벌 스타일 ✅ (2026-03-07 검증 완료)

### Scenario 1-3-01: 모바일(360px)에서 하단 탭 정상 렌더링

- **Given:** 모바일 뷰포트(360px) 환경
- **When:** 앱에 접속한다
- **Then:** 하단 탭 2개("모임 일정", "내 신청")가 정상 렌더링된다. 탭 터치가 동작한다
- **선행 Scenario:** 1-1-01

### Scenario 1-3-02: PC 화면에서 레이아웃 깨지지 않음

- **Given:** PC 브라우저(1280px 이상) 환경
- **When:** 앱에 접속한다
- **Then:** 기본 레이아웃이 깨지지 않고 정상 렌더링된다
- **선행 Scenario:** 1-3-01

### Scenario 1-3-03: Tailwind 디자인 토큰 적용 확인

- **Given:** Tailwind CSS 설정에 커스텀 디자인 토큰(컬러, 타이포그래피, 간격, 그림자, border-radius)이 정의되어 있다
- **When:** 토큰을 사용하는 UI 요소를 렌더링한다
- **Then:** 정의된 디자인 토큰 값이 올바르게 적용된다. 8px 그리드 체계가 반영되어 있다
- **선행 Scenario:** 1-1-01

### Scenario 1-3-04: 레이아웃 셸 컴포넌트 동작

- **Given:** 공통 레이아웃 셸(Header/Footer 또는 탭 네비게이션)이 구현되어 있다
- **When:** 앱의 어떤 페이지를 방문해도
- **Then:** 동일한 레이아웃 셸이 일관되게 렌더링된다. 하단 탭으로 "모임 일정"과 "내 신청" 간 전환이 가능하다
- **선행 Scenario:** 1-3-01

---

# M2. 인증 (카카오 로그인)

## WP2-1. 카카오 로그인 + 프로필 자동 생성 ✅

### Scenario 2-1-01: 카카오 로그인 성공 시 메인 페이지로 이동 ✅

- **Given:** 미인증 사용자가 로그인 페이지(`/auth/login`)에 있다
- **When:** 카카오 로그인 버튼을 클릭하고, 카카오 인증을 완료한다
- **Then:** `/auth/callback`을 거쳐 메인 페이지(`/`)로 리다이렉트된다. Supabase Auth에 세션이 생성된다
- **선행 Scenario:** 없음

### Scenario 2-1-02: 로그인 시 profiles 레코드 자동 생성 ✅

- **Given:** 처음 로그인하는 카카오 사용자 (profiles 테이블에 레코드 없음)
- **When:** 카카오 로그인을 완료한다
- **Then:** DB Trigger에 의해 `profiles` 테이블에 레코드가 자동 생성된다. `kakao_id`는 카카오 제공 값, `nickname`은 카카오 닉네임, `email`은 카카오 이메일, `role`은 `'member'`
- **선행 Scenario:** 2-1-01

### Scenario 2-1-03: 카카오 이메일 미동의 시 정상 로그인 ✅

- **Given:** 카카오 인증 시 이메일 제공에 동의하지 않은 사용자
- **When:** 카카오 로그인을 완료한다
- **Then:** `profiles.email = null`로 저장되며, 로그인은 정상 완료된다. 크래시 없음
- **선행 Scenario:** 2-1-01

### Scenario 2-1-04: 카카오 닉네임 없이 로그인 성공 ✅

- **Given:** 카카오 프로필에 닉네임이 없는(또는 빈) 사용자
- **When:** 카카오 로그인을 완료한다
- **Then:** `profiles.nickname = ''`(빈 문자열)로 저장되며, 로그인은 정상 완료된다
- **선행 Scenario:** 2-1-01

### Scenario 2-1-05: 카카오 인증 취소 시 로그인 페이지 복귀 ✅

- **Given:** 미인증 사용자가 카카오 인증 화면에 진입했다
- **When:** 카카오 인증 화면에서 "취소" 또는 뒤로가기를 누른다
- **Then:** 로그인 페이지(`/auth/login`)로 복귀한다. 세션은 생성되지 않는다. 에러 페이지가 뜨지 않는다
- **선행 Scenario:** 없음

### Scenario 2-1-06: OAuth Callback에서 쿠키 유실 없이 세션 설정 ✅

- **Given:** 카카오 인증이 완료되어 `/auth/callback`으로 리다이렉트됐다
- **When:** Callback Route가 auth code를 session으로 교환한다
- **Then:** `pendingCookies` 패턴으로 redirect 응답에 세션 쿠키가 올바르게 설정된다. 미들웨어는 `/auth/callback`을 건너뛰어 쿠키를 덮어쓰지 않는다
- **선행 Scenario:** 2-1-01

### Scenario 2-1-07: 카카오톡 인앱 브라우저에서 OAuth redirect 정상 동작 ✅

- **Given:** 카카오톡 앱 내에서 서비스 링크를 터치하여 인앱 브라우저가 열린 상태
- **When:** 카카오 로그인 버튼을 클릭하고 인증을 완료한다
- **Then:** 인앱 브라우저 환경에서 OAuth redirect가 정상 동작하여 메인 페이지에 도착한다. 세션 쿠키가 올바르게 설정된다
- **선행 Scenario:** 2-1-01

---

## WP2-2. 세션 관리 + 접근 제어 + 로그아웃 ✅

### Scenario 2-2-01: 미인증 사용자가 보호 경로 접근 시 로그인 리다이렉트 ✅

- **Given:** 세션이 없는(미인증) 사용자
- **When:** 보호된 경로(예: `/`, `/meetings/[id]`)에 직접 접근한다
- **Then:** `/auth/login`으로 리다이렉트된다
- **선행 Scenario:** 없음

### Scenario 2-2-02: 인증된 사용자가 보호 경로 정상 접근 ✅

- **Given:** 카카오 로그인이 완료된 사용자 (유효한 세션 존재)
- **When:** 보호된 경로에 접근한다
- **Then:** 해당 페이지가 정상 렌더링된다. 리다이렉트 없음
- **선행 Scenario:** 2-1-01

### Scenario 2-2-03: 브라우저 재방문 시 세션 유지 ✅

- **Given:** 로그인 후 브라우저 탭을 닫은 사용자
- **When:** 동일 브라우저에서 서비스 URL에 다시 접속한다
- **Then:** Supabase session refresh가 동작하여 로그인 없이 메인 페이지에 진입한다
- **선행 Scenario:** 2-1-01

### Scenario 2-2-04: 로그아웃 후 로그인 페이지로 이동 ✅

- **Given:** 로그인 상태의 사용자
- **When:** 로그아웃 버튼을 클릭한다
- **Then:** Supabase `signOut()`이 호출되고, `/auth/login`으로 이동한다. 세션 쿠키가 삭제된다
- **선행 Scenario:** 2-2-02

### Scenario 2-2-05: 로그아웃 후 보호 경로 접근 불가 ✅

- **Given:** 로그아웃을 완료한 사용자
- **When:** 브라우저 뒤로가기 또는 URL 직접 입력으로 보호 경로에 접근한다
- **Then:** `/auth/login`으로 리다이렉트된다
- **선행 Scenario:** 2-2-04

### Scenario 2-2-06: admin 역할 사용자 확인 ✅

- **Given:** Supabase 대시보드에서 `profiles.role = 'admin'`으로 설정된 사용자
- **When:** 로그인 후 프로필 정보를 조회한다
- **Then:** `role` 값이 `'admin'`으로 반환된다
- **선행 Scenario:** 2-1-02

### Scenario 2-2-07: member 역할 사용자 확인 ✅

- **Given:** 일반 카카오 로그인으로 가입한 사용자 (role 수동 변경 안 함)
- **When:** 로그인 후 프로필 정보를 조회한다
- **Then:** `role` 값이 `'member'`(기본값)로 반환된다
- **선행 Scenario:** 2-1-02

### Scenario 2-2-08: profiles 미생성 시 graceful 처리 ✅

- **Given:** `auth.uid()`는 존재하지만 DB Trigger 지연으로 `profiles` 레코드가 아직 없는 상태
- **When:** 프로필 조회 쿼리가 실행된다
- **Then:** 크래시 없이 빈 결과 또는 로딩 상태가 표시된다. 앱이 정상 동작한다
- **선행 Scenario:** 2-1-01

### Scenario 2-2-09: 세션 만료 후 페이지 접근 시 자동 리프레시 또는 로그인 유도 ✅

- **Given:** 로그인 후 장시간 미사용으로 Supabase access token이 만료된 상태
- **When:** 보호된 경로에 접근한다
- **Then:** Supabase refresh token으로 세션이 자동 갱신된다. 갱신 실패 시(refresh token도 만료) `/auth/login`으로 리다이렉트된다. 앱이 크래시하지 않는다
- **선행 Scenario:** 2-2-03

---

# M3. 모임 일정 조회 + 운영자 CRUD

## WP3-1. 모임 일정 목록 (회원 뷰)

### Scenario 3-1-01: 다가오는 모임 목록 정상 조회

- **Given:** active 상태의 모임이 3개 존재한다 (오늘, 내일, 다음 주)
- **When:** 로그인한 회원이 메인 페이지(`/`)에 접속한다
- **Then:** 3개 모임이 카드 UI로 표시된다. 각 카드에 모임명, 날짜, 시간, 장소, "O명 참여", 참가비가 표시된다
- **선행 Scenario:** 2-2-02

### Scenario 3-1-02: 오늘 날짜 모임이 목록에 포함됨 (KST 기준)

- **Given:** 오늘(KST 기준) 날짜의 active 모임이 존재한다
- **When:** 회원이 메인 페이지에 접속한다
- **Then:** 오늘 모임이 목록에 포함되어 표시된다. `date >= today(KST)` 필터가 정상 동작한다
- **선행 Scenario:** 3-1-01

### Scenario 3-1-03: 과거 모임이 회원 목록에 미표시

- **Given:** 어제(KST 기준) 날짜의 active 모임이 존재한다
- **When:** 회원이 메인 페이지에 접속한다
- **Then:** 해당 모임은 목록에 표시되지 않는다
- **선행 Scenario:** 3-1-01

### Scenario 3-1-04: deleting/deleted 모임이 회원 목록에 미표시

- **Given:** `status = 'deleting'`인 모임 1개와 `status = 'deleted'`인 모임 1개가 존재한다
- **When:** 회원이 메인 페이지에 접속한다
- **Then:** 두 모임 모두 목록에 표시되지 않는다. `status = 'active'`인 모임만 표시된다
- **선행 Scenario:** 3-1-01

### Scenario 3-1-05: 마감된 모임에 "마감" 뱃지 표시

- **Given:** 정원 14명인 모임에 confirmed 신청이 14건 존재한다
- **When:** 회원이 메인 페이지에 접속한다
- **Then:** 해당 모임 카드에 "마감" 뱃지가 표시된다
- **선행 Scenario:** 3-1-01

### Scenario 3-1-06: 여유 있는 모임에 참여 인원수만 표시

- **Given:** 정원 14명인 모임에 confirmed 신청이 5건 존재한다
- **When:** 회원이 메인 페이지에 접속한다
- **Then:** 카드에 "5명 참여"로 표시된다. 정원(14명)은 표시되지 않는다
- **선행 Scenario:** 3-1-01

### Scenario 3-1-07: 모임 목록 날짜 오름차순 정렬

- **Given:** 3/10, 3/5, 3/15 날짜의 active 모임이 존재한다
- **When:** 회원이 메인 페이지에 접속한다
- **Then:** 3/5 → 3/10 → 3/15 순서로 표시된다 (가장 가까운 모임이 맨 위)
- **선행 Scenario:** 3-1-01

### Scenario 3-1-08: 모임이 없을 때 빈 상태 UI 표시

- **Given:** 오늘 이후 active 모임이 하나도 없다
- **When:** 회원이 메인 페이지에 접속한다
- **Then:** 빈 상태 안내 화면이 표시된다 (예: "다가오는 모임이 없습니다")
- **선행 Scenario:** 2-2-02

### Scenario 3-1-09: 모임 목록 3초 이내 로딩

- **Given:** 모임 데이터가 10개 이하로 존재한다
- **When:** 회원이 메인 페이지에 접속한다
- **Then:** 목록이 3초 이내에 로딩 완료된다
- **선행 Scenario:** 3-1-01

### Scenario 3-1-10: 모바일(360px)에서 모임 카드 UI 렌더링

- **Given:** 모바일 뷰포트(360px) 환경에서 다가오는 모임이 존재한다
- **When:** 회원이 메인 페이지에 접속한다
- **Then:** 모임 카드가 모바일 화면에 맞게 렌더링된다. 텍스트 잘림 없이 모임명, 날짜, 장소가 표시된다. "참여하고 싶게 생긴" 시각적 디자인이 유지된다
- **선행 Scenario:** 3-1-01

---

## WP3-2. 모임 상세 페이지 + 목록 "신청완료" 뱃지

### Scenario 3-2-01: 모임 카드 터치로 상세 페이지 진입

- **Given:** 메인 페이지에 모임 카드가 표시되어 있다
- **When:** 모임 카드를 터치한다
- **Then:** `/meetings/[id]` 상세 페이지로 이동한다. 날짜, 시간, 장소, 남은 자리, 참가비가 표시된다
- **선행 Scenario:** 3-1-01

### Scenario 3-2-02: 시간 포맷 한국어 표시

- **Given:** `meetings.time = '19:00'`(TIME 타입)인 모임이 있다
- **When:** 상세 페이지에서 시간을 확인한다
- **Then:** "오후 7:00" 형식으로 표시된다
- **선행 Scenario:** 3-2-01

### Scenario 3-2-03: 버튼 — 모임 전 + 미신청 + 자리 있음 → "신청하기"

- **Given:** 모임 날짜가 미래이고, 현재 사용자의 confirmed 신청이 없고, 정원에 여유가 있다
- **When:** 모임 상세 페이지에 접속한다
- **Then:** "신청하기" 버튼이 활성 상태로 표시된다 (M4 연결 전까지 placeholder)
- **선행 Scenario:** 3-2-01

### Scenario 3-2-04: 버튼 — 모임 전 + 미신청 + 마감 → "마감"

- **Given:** 모임 날짜가 미래이고, 현재 사용자의 confirmed 신청이 없고, 정원이 가득 찼다
- **When:** 모임 상세 페이지에 접속한다
- **Then:** "마감" 텍스트가 비활성 상태로 표시된다. 클릭 불가
- **선행 Scenario:** 3-2-01

### Scenario 3-2-05: 버튼 — 모임 당일(포함) + 신청 있음 → "취소하기"

- **Given:** 모임 날짜가 오늘(KST)이고, 현재 사용자의 confirmed 신청이 존재한다
- **When:** 모임 상세 페이지에 접속한다
- **Then:** "취소하기" 버튼이 활성 상태로 표시된다 (M5 연결 전까지 placeholder)
- **선행 Scenario:** 3-2-01

### Scenario 3-2-06: 버튼 — 모임 지남 + 신청 있음 → "참여 완료"

- **Given:** 모임 날짜가 어제 이전(KST)이고, 현재 사용자의 confirmed 신청이 존재한다
- **When:** 모임 상세 페이지에 접속한다
- **Then:** "참여 완료" 텍스트가 표시된다. 버튼 없음
- **선행 Scenario:** 3-2-01

### Scenario 3-2-07: 버튼 — 모임 지남 + 미신청 → 버튼 없음

- **Given:** 모임 날짜가 어제 이전(KST)이고, 현재 사용자의 confirmed 신청이 없다
- **When:** 모임 상세 페이지에 접속한다
- **Then:** 하단에 아무 버튼도 표시되지 않는다
- **선행 Scenario:** 3-2-01

### Scenario 3-2-08: cancelled만 있는 유저는 미신청 취급

- **Given:** 현재 사용자가 해당 모임에 `cancelled` 상태 신청만 보유 (confirmed 없음). 모임은 미래이고 자리 있음
- **When:** 모임 상세 페이지에 접속한다
- **Then:** "신청하기" 버튼이 표시된다 (cancelled는 무시, 미신청과 동일 취급)
- **선행 Scenario:** 3-2-01

### Scenario 3-2-09: 목록에서 내가 신청한 모임에 "신청완료" 뱃지

- **Given:** 현재 사용자가 모임 A에 `confirmed` 신청이 있고, 모임 B에는 없다
- **When:** 메인 페이지 모임 목록을 확인한다
- **Then:** 모임 A 카드에 "신청완료" 뱃지가 표시된다. 모임 B에는 뱃지 없음
- **선행 Scenario:** 3-1-01

### Scenario 3-2-10: 모임 당일 자정(KST) 경계 판정

- **Given:** 모임 날짜 = 3월 5일. 현재 KST 시각 = 3월 5일 23:59 (모임 당일)
- **When:** 상세 페이지의 버튼 분기를 판정한다
- **Then:** "모임 전"으로 취급된다 (취소하기 표시). 3월 6일 00:00부터 "모임 지남"
- **선행 Scenario:** 3-2-01

---

## WP3-3. 운영자 모임 관리 (CRUD)

### Scenario 3-3-01: member 유저가 운영자 페이지 접근 시 차단

- **Given:** `role = 'member'`인 사용자가 로그인한 상태
- **When:** 운영자 전용 경로(예: `/admin`)에 접근한다
- **Then:** 접근이 차단된다 (리다이렉트 또는 403 에러)
- **선행 Scenario:** 2-2-07

### Scenario 3-3-02: admin 유저가 운영자 페이지 정상 접근

- **Given:** `role = 'admin'`인 사용자가 로그인한 상태
- **When:** 운영자 전용 경로에 접근한다
- **Then:** 운영자 모임 목록 페이지가 정상 렌더링된다
- **선행 Scenario:** 2-2-06

### Scenario 3-3-03: 운영자 모임 목록 필터 및 정렬

- **Given:** active 모임 2개(미래, 과거), deleting 모임 1개, deleted 모임 1개가 존재한다
- **When:** 운영자가 모임 목록 페이지에 접속한다
- **Then:** active 2개 + deleting 1개 = 3개 표시. deleted는 미표시. **날짜 내림차순** (최근이 맨 위)
- **선행 Scenario:** 3-3-02

### Scenario 3-3-04: 모임 생성 성공

- **Given:** admin 유저가 모임 생성 폼에 있다
- **When:** 모임명, 날짜, 시간, 장소, 정원, 참가비를 입력하고 "등록" 버튼을 누른다
- **Then:** `meetings` 테이블에 `status = 'active'`로 INSERT된다. 운영자 목록에 즉시 반영된다
- **선행 Scenario:** 3-3-02

### Scenario 3-3-05: 모임 생성 후 회원 목록에 즉시 반영

- **Given:** 운영자가 오늘 이후 날짜의 모임을 방금 생성했다
- **When:** 회원이 메인 페이지에 접속한다
- **Then:** 새로 생성된 모임이 카드로 표시된다
- **선행 Scenario:** 3-3-04

### Scenario 3-3-06: 모임 수정 성공

- **Given:** admin 유저가 기존 모임의 수정 화면에 있다
- **When:** 모임명을 "독서모임 A"에서 "독서모임 B"로 변경하고 저장한다
- **Then:** `meetings` 테이블이 UPDATE된다. 회원 목록에서도 변경된 이름이 표시된다
- **선행 Scenario:** 3-3-04

### Scenario 3-3-07: 모임 참가비 수정 시 기존 결제 건 불변

- **Given:** 참가비 10,000원인 모임에 paid_amount=10,000원인 신청이 존재한다
- **When:** 운영자가 참가비를 15,000원으로 수정한다
- **Then:** `meetings.fee`는 15,000으로 변경되지만, 기존 `registrations.paid_amount`는 10,000 그대로 유지된다
- **선행 Scenario:** 3-3-06

### Scenario 3-3-08: 신청자 없는 모임 삭제 성공

- **Given:** confirmed 신청이 0건인 active 모임이 존재한다
- **When:** 운영자가 해당 모임에서 "삭제" 버튼을 누르고 확인한다
- **Then:** 모임이 삭제된다 (또는 `status = 'deleted'`). 회원 목록과 운영자 목록에서 사라진다
- **선행 Scenario:** 3-3-04

### Scenario 3-3-09: 신청자 있는 모임 삭제 차단 (M3 단계)

- **Given:** confirmed 신청이 3건인 active 모임이 존재한다
- **When:** 운영자가 해당 모임의 삭제를 시도한다
- **Then:** 삭제가 차단된다. "신청자가 있어 삭제할 수 없습니다" 안내가 표시된다. (M5에서 환불 포함 삭제로 업그레이드)
- **선행 Scenario:** 3-3-04

### Scenario 3-3-10: 신청자 목록 UI 틀 표시 (빈 테이블)

- **Given:** admin 유저가 신청이 0건인 모임 상세를 확인한다
- **When:** 모임 상세 하단의 신청자 목록 영역을 확인한다
- **Then:** "아직 신청자가 없습니다" 텍스트가 표시된다. 테이블 레이아웃 틀은 존재한다
- **선행 Scenario:** 3-3-02

---

# M4. 결제 + 신청

## WP4-1. 포트원 결제 파이프라인

### Scenario 4-1-01: 포트원 SDK로 결제창 호출 성공

- **Given:** 포트원 V2 SDK가 프론트엔드에 연동되어 있다
- **When:** 결제 요청 함수를 호출한다 (모임 정보 + 금액 전달)
- **Then:** PG사 결제창이 정상 표시된다 (팝업 또는 리다이렉트)
- **선행 Scenario:** 없음

### Scenario 4-1-02: 결제 검증 + 원자적 등록 성공

- **Given:** 사용자가 PG사 결제를 완료하여 payment_id를 받았다. 해당 모임에 정원 여유가 있다
- **When:** 프론트엔드가 `POST /api/registrations/confirm`에 payment_id를 전송한다
- **Then:** ① 포트원 REST API로 결제 상태 = 'paid' 확인 ② 결제 금액 = meetings.fee 일치 확인 ③ `confirm_registration` DB Function 호출 → 'success' 반환 ④ `registrations`에 `status='confirmed'` 레코드 INSERT. 성공 응답 반환
- **선행 Scenario:** 4-1-01

### Scenario 4-1-03: 결제 금액과 모임비 불일치 시 거부 + 환불

- **Given:** 포트원에서 검증된 결제 금액이 5,000원이지만, 해당 모임의 fee는 10,000원이다
- **When:** API Route가 결제를 검증한다
- **Then:** 금액 불일치로 등록이 거부된다. 포트원 환불 API로 5,000원 전액 환불이 호출된다. 에러 응답 반환
- **선행 Scenario:** 4-1-01

### Scenario 4-1-04: 비활성 모임에 대한 결제 검증 거부

- **Given:** `status = 'deleting'` 또는 `'deleted'`인 모임에 대한 결제가 포트원에서 완료됐다
- **When:** API Route가 결제를 검증한다
- **Then:** 모임 상태가 active가 아니므로 등록이 거부된다. 전액 환불 처리
- **선행 Scenario:** 4-1-01

### Scenario 4-1-05: 정원 초과 시 자동 환불 + "마감" 응답

- **Given:** 정원 14명인 모임에 이미 confirmed 14건이 있다. 새 사용자가 결제를 완료했다
- **When:** API Route가 DB Function `confirm_registration`을 호출한다
- **Then:** DB Function이 'full' 반환 → 포트원 환불 API로 전액 환불 호출 → 프론트에 "마감" 응답 반환. registrations에 레코드가 INSERT되지 않는다
- **선행 Scenario:** 4-1-02

### Scenario 4-1-06: 마지막 1자리에 2명 동시 결제 시 직렬화

- **Given:** 정원 14명 모임에 confirmed 13건. 사용자 A와 B가 거의 동시에 결제를 완료했다
- **When:** 두 API Route 요청이 동시에 `confirm_registration`을 호출한다
- **Then:** FOR UPDATE 잠금으로 직렬 처리된다. 먼저 도착한 1명만 'success' (등록 완료), 나머지 1명은 'full' (자동 환불). 최종 confirmed 수 = 14 (정원 초과 불가)
- **선행 Scenario:** 4-1-02

### Scenario 4-1-07: 정원 초과 환불 API 호출 실패

- **Given:** DB Function이 'full'을 반환했으나, 포트원 환불 API 호출이 네트워크 오류로 실패했다
- **When:** API Route가 환불 처리를 시도한다
- **Then:** 에러가 로그에 기록된다. 프론트에 "일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요." 메시지 반환. 결제 건은 포트원 콘솔에서 운영자가 수동 확인
- **선행 Scenario:** 4-1-05

### Scenario 4-1-08: 이미 confirmed 신청이 있는 사용자의 중복 결제 방어

- **Given:** 사용자가 해당 모임에 이미 `status='confirmed'` 신청이 존재한다
- **When:** 동일 모임에 대해 다시 결제를 시도하고 API Route가 호출된다
- **Then:** DB Function이 기존 confirmed 존재를 감지하고 중복 등록을 거부한다. 환불 처리
- **선행 Scenario:** 4-1-02

### Scenario 4-1-09: 결제 성공 후 프론트 콜백/redirect 복귀 실패

- **Given:** 사용자가 PG사 결제를 완료하여 payment_id를 받았다
- **When:** 프론트엔드 콜백 또는 redirect 복귀가 실패하여 API Route가 호출되지 않는다
- **Then:** 포트원 Webhook이 서버에 직접 결제 완료를 통지하여 등록 처리를 시도한다. Webhook도 실패 시 포트원 콘솔에서 운영자 수동 확인
- **선행 Scenario:** 4-1-01

### Scenario 4-1-10: Webhook으로 미등록 결제 자동 복구

- **Given:** 사용자가 PG사 결제를 완료했으나 프론트 콜백이 실패하여 registrations에 레코드가 없다
- **When:** 포트원 Webhook이 `/api/webhooks/portone`에 결제 완료를 통지한다
- **Then:** Webhook 서명을 검증한 후, payment_id로 미등록을 확인하고, 결제 검증 → confirm_registration 호출 → 등록 완료. 이미 등록된 경우 무시
- **선행 Scenario:** 4-1-02

### Scenario 4-1-11: 동일 payment_id 재호출 시 멱등 성공

- **Given:** payment_id = "pay_A"로 결제 확인이 완료되어 registrations에 confirmed 레코드가 존재한다
- **When:** 동일 payment_id = "pay_A"로 결제 확인 API를 다시 호출한다 (네트워크 재시도, redirect 새로고침, Webhook 중복 등)
- **Then:** 기존 confirmed 등록을 확인하여 성공 응답을 반환한다. 환불이 호출되지 않는다. 새 레코드가 INSERT되지 않는다
- **선행 Scenario:** 4-1-02

---

## WP4-2. 신청 UX 완성 (3클릭 결제)

### Scenario 4-2-01: 3클릭으로 결제 화면 진입

- **Given:** 회원이 로그인 후 메인 페이지에 있다. 신청 가능한 모임이 있다
- **When:** 모임 카드 터치(1클릭) → 상세 페이지 "신청하기" 터치(2클릭) → 결제창 진입(3클릭)
- **Then:** PG사 결제 화면이 표시된다. 결제 화면 진입까지 정확히 3클릭
- **선행 Scenario:** 4-1-01

### Scenario 4-2-02: 결제 완료 후 신청 확정 화면 표시

- **Given:** 사용자가 PG사 결제를 완료하고 서버 검증이 성공했다
- **When:** API Route가 성공 응답을 반환한다
- **Then:** "신청이 완료되었습니다" 확정 화면이 표시된다. 모임명, 날짜, 시간, 장소, 결제 금액이 요약 표시된다
- **선행 Scenario:** 4-1-02

### Scenario 4-2-03: 확정 후 목록 복귀 시 "신청완료" 뱃지 표시

- **Given:** 사용자가 신청 확정 화면을 확인했다
- **When:** 메인 페이지(모임 목록)로 돌아간다
- **Then:** 방금 신청한 모임 카드에 "신청완료" 뱃지가 표시된다
- **선행 Scenario:** 4-2-02

### Scenario 4-2-04: 결제 실패 (사용자 취소) 시 상세 페이지 복귀

- **Given:** 사용자가 PG사 결제창에서 "취소" 또는 뒤로가기를 눌렀다
- **When:** 포트원 SDK가 결제 실패 콜백을 반환한다
- **Then:** 모임 상세 페이지로 복귀한다. "결제가 완료되지 않았습니다. 다시 시도해주세요." 토스트 메시지가 표시된다. registrations에 레코드가 생성되지 않는다
- **선행 Scenario:** 4-1-01

### Scenario 4-2-05: 결제 실패 후 즉시 재시도 가능

- **Given:** 결제 실패로 모임 상세 페이지에 복귀한 상태
- **When:** "신청하기" 버튼을 다시 누른다
- **Then:** PG사 결제창이 다시 표시된다. 재시도가 정상 동작한다
- **선행 Scenario:** 4-2-04

### Scenario 4-2-06: 결제 완료로 정원이 찬 경우 타 사용자에게 "마감" 반영

- **Given:** 정원 14명 모임에 confirmed 13건. 사용자 A가 결제를 완료하여 14건이 됐다
- **When:** 사용자 B가 메인 페이지를 새로고침한다
- **Then:** 해당 모임 카드에 "마감" 뱃지가 표시된다. 상세 진입 시 "마감" (비활성) 표시
- **선행 Scenario:** 4-1-02

### Scenario 4-2-07: 모바일 브라우저에서 결제창 정상 표시 (팝업 차단 없음)

- **Given:** 모바일 브라우저(iOS Safari, Android Chrome)에서 모임 상세 페이지에 있다
- **When:** "신청하기" 버튼을 터치하여 결제창을 호출한다
- **Then:** PG사 결제창이 팝업 차단 없이 정상 표시된다. 결제 진행 및 완료 후 앱으로 정상 복귀한다
- **선행 Scenario:** 4-2-01

### Scenario 4-2-08: 신청하기 버튼 연속 클릭 시 결제창 1회만 열림

- **Given:** 모임 상세 페이지에서 "신청하기" 버튼이 활성화되어 있다
- **When:** 버튼을 빠르게 2회 이상 연속 클릭한다
- **Then:** 결제창은 1번만 열린다. 버튼이 즉시 비활성화되고 로딩 인디케이터가 표시된다
- **선행 Scenario:** 4-2-01

### Scenario 4-2-09: redirect 복귀 페이지에서 결제 확정 처리

- **Given:** 카카오톡 인앱 브라우저에서 redirect 방식으로 결제가 완료되어 returnUrl로 돌아왔다
- **When:** 복귀 페이지가 URL 파라미터에서 payment_id를 읽어 결제 확인 API를 호출한다
- **Then:** 결제 검증 → 등록 완료 → 신청 확정 화면이 표시된다. popup 콜백과 동일한 결과
- **선행 Scenario:** 4-2-01

---

## WP4-3. 내 신청 내역 + 운영자 신청 목록

### Scenario 4-3-01: 내 신청 목록 정상 표시

- **Given:** 현재 사용자가 모임 A(confirmed), 모임 B(cancelled) 신청이 있다
- **When:** "내 신청" 탭을 터치한다
- **Then:** 모임 A, 모임 B 모두 목록에 표시된다 (모든 상태의 신청 표시)
- **선행 Scenario:** 4-2-02

### Scenario 4-3-02: 뱃지 — confirmed + 모임 전 → "신청완료"

- **Given:** 미래 모임에 `status='confirmed'` 신청이 있다
- **When:** 내 신청 목록에서 해당 항목을 확인한다
- **Then:** "신청완료" 뱃지가 표시된다
- **선행 Scenario:** 4-3-01

### Scenario 4-3-03: 뱃지 — confirmed + 모임 지남 → "참여 완료"

- **Given:** 과거 모임에 `status='confirmed'` 신청이 있다
- **When:** 내 신청 목록에서 해당 항목을 확인한다
- **Then:** "참여 완료" 뱃지가 표시된다
- **선행 Scenario:** 4-3-01

### Scenario 4-3-04: 뱃지 — cancelled → "취소됨"

- **Given:** `status='cancelled'` 신청이 있다 (모임 시점 무관)
- **When:** 내 신청 목록에서 해당 항목을 확인한다
- **Then:** "취소됨" 뱃지가 표시된다
- **선행 Scenario:** 4-3-01

### Scenario 4-3-05: 과거 이력 포함 + 날짜 내림차순 정렬

- **Given:** 3/1(과거), 3/10(미래), 2/15(과거) 모임에 신청 이력이 있다
- **When:** 내 신청 목록을 확인한다
- **Then:** 3/10 → 3/1 → 2/15 순서로 표시된다 (최근이 맨 위, 과거 포함)
- **선행 Scenario:** 4-3-01

### Scenario 4-3-06: 내 신청 목록에서 모임 상세로 이동

- **Given:** 내 신청 목록에 모임이 표시되어 있다
- **When:** 해당 모임을 터치한다
- **Then:** 모임 상세 페이지(`/meetings/[id]`)로 이동한다. 버튼 분기가 현재 상태에 맞게 정확히 표시된다
- **선행 Scenario:** 4-3-01

### Scenario 4-3-07: 운영자 신청자 목록에 실데이터 표시

- **Given:** admin 유저가 confirmed 3건, cancelled 1건인 모임 상세를 확인한다
- **When:** 모임 상세 하단의 신청자 목록을 확인한다
- **Then:** 4건 모두 표시된다. 각 항목에 닉네임, 결제 상태(결제완료/취소됨), 결제 일시가 표시된다
- **선행 Scenario:** 3-3-10

### Scenario 4-3-08: 신청 내역 없을 때 빈 상태

- **Given:** 현재 사용자의 신청 이력이 0건이다
- **When:** "내 신청" 탭을 터치한다
- **Then:** 빈 상태 안내가 표시된다 (예: "신청 내역이 없습니다")
- **선행 Scenario:** 2-2-02

---

# M5. 취소 + 환불

## WP5-1. 회원 셀프 취소 + 자동 환불

### Scenario 5-1-01: 취소하기 버튼 터치 시 환불 규정 안내 표시

- **Given:** 모임 전 + confirmed 있음 상태에서 상세 페이지에 "취소하기" 버튼이 활성화되어 있다
- **When:** "취소하기" 버튼을 터치한다
- **Then:** 환불 규정 안내가 표시된다: 환불 예정 금액, 환불 비율, "문의: 단무지에게 1대1톡" 카카오 링크
- **선행 Scenario:** 3-2-05

### Scenario 5-1-02: 3일 전 취소 → 100% 환불

- **Given:** 모임 날짜 = 3/8, 오늘(KST) = 3/5 (days_remaining = 3). paid_amount = 10,000원
- **When:** 취소를 확정한다
- **Then:** 포트원 환불 API에 10,000원(100%) 환불 요청. `registrations` 업데이트: `status='cancelled'`, `cancel_type='user_cancelled'`, `refunded_amount=10000`, `cancelled_at=현재시각`
- **선행 Scenario:** 5-1-01

### Scenario 5-1-03: 2일 전 취소 → 50% 환불

- **Given:** 모임 날짜 = 3/8, 오늘(KST) = 3/6 (days_remaining = 2). paid_amount = 10,000원
- **When:** 취소를 확정한다
- **Then:** 포트원 환불 API에 5,000원(50%) 부분 환불 요청. `refunded_amount=5000`
- **선행 Scenario:** 5-1-01

### Scenario 5-1-04: 전날 취소 → 0원 환불 + 취소 완료

- **Given:** 모임 날짜 = 3/8, 오늘(KST) = 3/7 (days_remaining = 1). paid_amount = 10,000원
- **When:** 환불 규정에 "환불 금액: 0원 (환불 불가 기간)" 표시 → 사용자가 취소를 확정한다
- **Then:** 포트원 환불 API 호출 **생략** (0원). `registrations` 업데이트: `status='cancelled'`, `refunded_amount=0`. 취소 완료 화면 표시
- **선행 Scenario:** 5-1-01

### Scenario 5-1-05: 당일 취소 → 0원 환불 + 취소 완료

- **Given:** 모임 날짜 = 3/8, 오늘(KST) = 3/8 (days_remaining = 0). paid_amount = 10,000원
- **When:** 사용자가 취소를 확정한다
- **Then:** 0원 환불 (API 생략). `status='cancelled'`, `refunded_amount=0`. 취소 완료 처리
- **선행 Scenario:** 5-1-01

### Scenario 5-1-06: 모임 다음 날 → 취소 버튼 미표시

- **Given:** 모임 날짜 = 3/8, 오늘(KST) = 3/9. 현재 사용자의 confirmed 신청이 존재한다
- **When:** 모임 상세 페이지에 접속한다
- **Then:** "참여 완료" 텍스트가 표시되고 "취소하기" 버튼은 표시되지 않는다
- **선행 Scenario:** 3-2-06

### Scenario 5-1-07: 취소 확정 다이얼로그에서 확정

- **Given:** 환불 규정 안내가 표시된 상태
- **When:** "취소를 확정하시겠습니까?" 다이얼로그에서 "확정" 버튼을 누른다
- **Then:** `POST /api/registrations/cancel` API가 호출된다. 환불 처리 진행
- **선행 Scenario:** 5-1-01

### Scenario 5-1-08: 취소 확정 다이얼로그에서 취소 (되돌리기)

- **Given:** "취소를 확정하시겠습니까?" 다이얼로그가 표시된 상태
- **When:** 다이얼로그를 닫거나 "아니요"를 누른다
- **Then:** 다이얼로그가 닫히고 모임 상세 페이지로 복귀한다. 신청 상태는 변경 없음
- **선행 Scenario:** 5-1-01

### Scenario 5-1-09: 취소 완료 화면 표시

- **Given:** 취소/환불 API가 성공적으로 완료됐다
- **When:** 프론트엔드가 성공 응답을 수신한다
- **Then:** 취소 완료 화면이 표시된다: 환불 예정 금액, 환불 예상 소요 시간 안내
- **선행 Scenario:** 5-1-02

### Scenario 5-1-10: "단무지에게 1대1톡" 링크 표시 및 동작

- **Given:** 환불 규정 안내 또는 취소 완료 화면이 표시된 상태
- **When:** "단무지에게 1대1톡" 링크를 확인한다
- **Then:** 카카오톡 1:1 채팅 링크가 올바르게 표시되며, 클릭 시 카카오톡 채팅으로 연결된다
- **선행 Scenario:** 5-1-01

### Scenario 5-1-11: 취소 후 모임 상세에서 "신청하기" 재표시

- **Given:** 사용자가 방금 취소를 완료했다. 해당 모임에 정원 여유가 있다
- **When:** 해당 모임 상세 페이지에 다시 접속한다
- **Then:** "신청하기" 버튼이 표시된다 (confirmed 없음 + 자리 있음 → 재신청 가능)
- **선행 Scenario:** 5-1-02

### Scenario 5-1-12: 취소 후 재신청 시 새 registrations 레코드 생성

- **Given:** 모임 A에 cancelled 레코드가 1건 존재하는 사용자. 정원 여유 있음
- **When:** 모임 A에 다시 결제 → 신청을 완료한다
- **Then:** 새로운 `registrations` 레코드가 INSERT된다 (기존 cancelled 레코드는 그대로 유지). 동일 user_id + meeting_id로 2개 레코드 공존
- **선행 Scenario:** 5-1-11

### Scenario 5-1-13: 취소 후 내 신청 내역에 "취소됨" 뱃지

- **Given:** 사용자가 모임 A 취소를 완료했다
- **When:** "내 신청" 탭을 확인한다
- **Then:** 모임 A에 "취소됨" 뱃지가 표시된다
- **선행 Scenario:** 5-1-02

### Scenario 5-1-14: KST 자정 경계 — 3일 전 → 2일 전 전환

- **Given:** 모임 날짜 = 3/8. 현재 KST = 3/5 23:59 (days_remaining = 3, 100% 환불)
- **When:** KST 3/6 00:00이 되어 취소를 시도한다
- **Then:** days_remaining = 2 → 50% 환불로 계산된다. 날짜 단위 전환이 정확하다
- **선행 Scenario:** 5-1-01

### Scenario 5-1-15: 취소 확정 후 환불 API 실패 → 신청 상태 유지

- **Given:** 사용자가 "취소 확정"을 눌러 API Route가 포트원 환불 API를 호출했다
- **When:** 포트원 환불 API가 네트워크 오류로 실패한다
- **Then:** registrations 상태는 confirmed 유지 (cancelled로 변경하지 않음). 프론트에 "환불 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요." 에러 메시지 표시
- **선행 Scenario:** 5-1-07

---

## WP5-2. 운영자 모임 삭제 + 일괄 환불

### Scenario 5-2-01: 삭제 확인 다이얼로그에 환불 대상 인원 표시

- **Given:** admin 유저가 confirmed 5건인 모임의 삭제를 시도한다
- **When:** "삭제" 버튼을 누른다
- **Then:** "이 모임에 신청자가 5명 있습니다. 삭제 시 모든 신청자에게 100% 환불됩니다." 확인 다이얼로그가 표시된다
- **선행 Scenario:** 3-3-09

### Scenario 5-2-02: 모임 삭제 → 전원 100% 환불 + deleted

- **Given:** confirmed 3건(각 paid_amount=10,000원)인 모임. 운영자가 삭제를 확정했다
- **When:** `POST /api/meetings/[id]/delete` API가 호출된다
- **Then:** ① `meetings.status → 'deleting'` ② `Promise.allSettled`로 3건 병렬 환불 (각 10,000원 전액) ③ 3건 모두 성공 → 각 registration: `status='cancelled'`, `cancel_type='meeting_deleted'`, `refunded_amount=10000` ④ `meetings.status → 'deleted'`
- **선행 Scenario:** 5-2-01

### Scenario 5-2-03: 부분 환불 실패 → deleting 유지

- **Given:** confirmed 5건 모임. 환불 처리 중 2건이 포트원 API 오류로 실패했다
- **When:** `Promise.allSettled` 결과가 반환된다
- **Then:** 성공 3건: `cancelled + meeting_deleted`. 실패 2건: `confirmed` 유지. `meetings.status`는 `'deleting'` 유지 (deleted로 변경하지 않음)
- **선행 Scenario:** 5-2-02

### Scenario 5-2-04: deleting 모임에 "환불 미처리" 뱃지 표시

- **Given:** `status='deleting'`이고 confirmed 신청이 2건 남아있는 모임
- **When:** 운영자가 모임 목록에 접속한다
- **Then:** 해당 모임에 "환불 미처리" 뱃지가 표시된다
- **선행 Scenario:** 5-2-03

### Scenario 5-2-05: 환불 재시도 — confirmed만 대상

- **Given:** deleting 모임에 cancelled 3건 + confirmed 2건 (환불 실패 건)
- **When:** 운영자가 "환불 재시도" 버튼을 누른다
- **Then:** confirmed 상태인 2건에 대해서만 환불 API가 호출된다. 이미 cancelled인 3건은 건너뛴다
- **선행 Scenario:** 5-2-03

### Scenario 5-2-06: 재시도 전원 성공 → deleted

- **Given:** deleting 모임. 재시도로 나머지 2건이 환불 성공했다
- **When:** 환불 재시도 결과가 반환된다
- **Then:** 2건 `cancelled + meeting_deleted`. confirmed 0건 → `meetings.status → 'deleted'`. 운영자 목록에서 사라진다
- **선행 Scenario:** 5-2-05

### Scenario 5-2-07: deleting 모임이 회원 목록에 미표시

- **Given:** `status='deleting'`인 모임이 존재한다
- **When:** 회원이 메인 페이지에 접속한다
- **Then:** 해당 모임은 표시되지 않는다 (회원은 active만 조회)
- **선행 Scenario:** 5-2-03

### Scenario 5-2-08: 신청자 없는 모임 삭제 → 환불 없이 바로 deleted

- **Given:** confirmed 0건인 모임. 운영자가 삭제를 확정한다
- **When:** 삭제 API가 호출된다
- **Then:** 환불 처리 없이 바로 `meetings.status → 'deleted'`. deleting 상태를 거치지 않아도 됨
- **선행 Scenario:** 3-3-08

### Scenario 5-2-09: 삭제 시 환불은 항상 100% (날짜 무관)

- **Given:** 모임 날짜 = 내일 (정상 취소라면 50% 환불). confirmed 2건 존재
- **When:** 운영자가 모임을 삭제한다
- **Then:** 2건 모두 paid_amount 전액(100%) 환불. 환불 규정(3일/2일)은 적용하지 않는다
- **선행 Scenario:** 5-2-02

---

# M6. 통합 검증 + 출시 준비

## WP6-1. E2E 검증 + 버그 수정

### Scenario 6-1-01: E2E — 회원 정상 흐름 (로그인 → 결제 → 확인)

- **Given:** active 모임이 존재하고, 테스트 카카오 계정이 준비되어 있다
- **When:** 카카오 로그인 → 목록 확인 → 모임 선택 → 결제 완료 → 확정 화면 확인 → 내 신청 내역 확인
- **Then:** 전체 흐름이 에러 없이 완료된다. 각 단계의 UI가 올바르게 표시된다
- **선행 Scenario:** 없음 (전체 기능 완성 후 실행)

### Scenario 6-1-02: E2E — 회원 취소 흐름 (취소 → 환불 → 뱃지)

- **Given:** confirmed 신청이 존재하는 상태
- **When:** 내 신청 → 모임 상세 → 취소하기 → 환불 규정 확인 → 확정 → 취소 완료 화면
- **Then:** 환불 금액이 규정에 맞게 계산되고, 내 신청에서 "취소됨" 뱃지로 변경된다
- **선행 Scenario:** 6-1-01

### Scenario 6-1-03: E2E — 취소 후 재신청

- **Given:** 방금 취소를 완료한 사용자. 해당 모임에 정원 여유 있음
- **When:** 같은 모임 상세 → 신청하기 → 결제 → 확정
- **Then:** 새 registrations 레코드가 생성되고 "신청완료" 상태가 된다. 이전 cancelled 레코드도 유지
- **선행 Scenario:** 6-1-02

### Scenario 6-1-04: E2E — 운영자 모임 관리

- **Given:** admin 계정으로 로그인한 상태
- **When:** 모임 생성 → 회원이 신청 → 신청자 목록 확인 → 모임 수정 → 변경 반영 확인
- **Then:** 전체 운영 흐름이 정상 동작한다
- **선행 Scenario:** 6-1-01

### Scenario 6-1-05: E2E — 운영자 모임 삭제 + 일괄 환불

- **Given:** 신청자가 있는 모임이 존재한다
- **When:** 운영자가 삭제 → 확인 → 일괄 환불 → deleted 확인
- **Then:** 모든 신청자에게 100% 환불이 완료되고, 모임이 deleted 상태가 된다
- **선행 Scenario:** 6-1-04

### Scenario 6-1-06: E2E — 동시 신청 (정원 초과)

- **Given:** 정원 1명인 모임. 2개의 브라우저/세션에서 동시 결제
- **When:** 두 사용자가 거의 동시에 결제를 완료하고 검증 API를 호출한다
- **Then:** 1명만 등록 성공, 1명은 자동 환불. registrations에 confirmed 1건만 존재
- **선행 Scenario:** 6-1-01

### Scenario 6-1-07: E2E — 결제 실패 후 재시도

- **Given:** 사용자가 모임 상세에서 결제창을 열었다
- **When:** PG사 결제창에서 취소 → 상세 복귀 → 다시 "신청하기" → 결제 완료
- **Then:** 첫 실패 시 에러 토스트. 재시도 시 정상 등록 완료
- **선행 Scenario:** 6-1-01

### Scenario 6-1-08: E2E — 환불 실패 재시도

- **Given:** 운영자 삭제로 일부 환불이 실패한 deleting 모임
- **When:** 운영자가 "환불 재시도" → 성공
- **Then:** deleting → deleted 전환. 운영자 목록에서 사라진다
- **선행 Scenario:** 6-1-05

### Scenario 6-1-09: E2E — KST 날짜 경계 검증

- **Given:** KST 자정 전후로 테스트 가능한 환경
- **When:** 자정 전/후에 취소를 시도한다
- **Then:** days_remaining이 날짜 전환에 따라 정확히 변경된다 (예: 3→2일 전, 환불율 100%→50%)
- **선행 Scenario:** 6-1-02

### Scenario 6-1-10: E2E — 카카오톡 인앱 브라우저 전체 흐름

- **Given:** 카카오톡 앱에서 서비스 링크를 터치한 상태
- **When:** 카카오톡 인앱 브라우저에서 로그인 → 목록 → 결제까지 전체 흐름 수행
- **Then:** OAuth 리다이렉트, 결제 팝업, 모든 UI가 정상 동작한다
- **선행 Scenario:** 6-1-01

### Scenario 6-1-11: 모바일 호환성 — iOS Safari

- **Given:** iPhone의 Safari 브라우저
- **When:** 서비스 전체 흐름을 수행한다
- **Then:** 모든 기능이 정상 동작하고, 카드 UI가 올바르게 렌더링된다
- **선행 Scenario:** 6-1-01

### Scenario 6-1-12: 모바일 호환성 — Android Chrome

- **Given:** Android의 Chrome 브라우저
- **When:** 서비스 전체 흐름을 수행한다
- **Then:** 모든 기능이 정상 동작한다
- **선행 Scenario:** 6-1-01

### Scenario 6-1-13: 빈 상태 UI 전체 확인

- **Given:** 모임 0건, 신청 0건인 상태
- **When:** 메인 페이지, 내 신청 탭, 운영자 신청자 목록을 각각 확인한다
- **Then:** 각 화면에 적절한 빈 상태 안내가 표시된다
- **선행 Scenario:** 6-1-01

### Scenario 6-1-14: 권한 분리 — member의 admin 접근 차단

- **Given:** member 역할 사용자가 로그인한 상태
- **When:** URL 직접 입력으로 운영자 경로에 접근한다
- **Then:** 접근이 차단된다
- **선행 Scenario:** 6-1-01

### Scenario 6-1-15: 성능 — 목록 로딩 3초 이내

- **Given:** 모임 10개 이하 존재
- **When:** 메인 페이지에 접속한다
- **Then:** 목록이 3초 이내에 완전히 렌더링된다
- **선행 Scenario:** 6-1-01

---

## WP6-2. 프로덕션 배포 + 출시

### Scenario 6-2-01: Supabase 프로덕션 환경 확인

- **Given:** Supabase 프로덕션 프로젝트
- **When:** RLS 정책, DB Functions(`confirm_registration`, 카운트 함수), Triggers(profiles 자동 생성)를 확인한다
- **Then:** 모든 항목이 개발 환경과 동일하게 설정되어 있다
- **선행 Scenario:** 없음

### Scenario 6-2-02: 포트원 실결제 모드 전환

- **Given:** 포트원 테스트 모드에서 개발이 완료된 상태
- **When:** 포트원 대시보드에서 라이브 모드로 전환하고, API 키를 프로덕션 값으로 교체한다
- **Then:** PG사(토스페이먼츠/KCP) 실 결제가 가능한 상태가 된다
- **선행 Scenario:** 없음

### Scenario 6-2-03: Vercel 프로덕션 도메인 + 환경 변수 설정

- **Given:** Vercel 프로젝트
- **When:** 프로덕션 도메인을 설정하고, 모든 환경 변수(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, PORTONE_API_KEY 등)를 프로덕션 값으로 세팅한다
- **Then:** 프로덕션 도메인으로 접속 시 앱이 정상 동작한다
- **선행 Scenario:** 없음

### Scenario 6-2-04: 카카오 OAuth Redirect URI에 프로덕션 도메인 추가

- **Given:** 카카오 개발자 콘솔에 localhost만 등록된 상태
- **When:** 프로덕션 도메인을 Redirect URI에 추가한다
- **Then:** 프로덕션 도메인에서 카카오 로그인이 정상 동작한다
- **선행 Scenario:** 6-2-03

### Scenario 6-2-05: Admin 계정(영탁) 설정

- **Given:** 영탁(단무지)님이 프로덕션 환경에서 카카오 로그인을 완료하여 profiles가 생성됐다
- **When:** Supabase 대시보드에서 해당 프로필의 `role`을 `'admin'`으로 변경한다
- **Then:** 영탁님이 운영자 기능에 접근 가능하다
- **선행 Scenario:** 6-2-04

### Scenario 6-2-06: 프로덕션 실결제 E2E 테스트

- **Given:** 프로덕션 환경에서 포트원 라이브 모드 활성화
- **When:** 실제 결제(소액) → 신청 확정 → 취소 → 환불 전체 흐름을 1회 수행한다
- **Then:** 실제 PG사 결제 + 환불이 정상 처리된다. registrations에 올바르게 기록된다
- **선행 Scenario:** 6-2-05

### Scenario 6-2-07: MVP 출시 체크리스트 전체 통과

- **Given:** 프로덕션 배포 + 실결제 테스트 완료
- **When:** 7개 MVP 출시 기준을 확인한다: ① 카카오 로그인 ② 모임 목록 ③ 결제=신청 확정 ④ 내 신청 내역 ⑤ 셀프 취소+자동 환불 ⑥ 운영자 CRUD ⑦ 운영자 신청자 목록
- **Then:** 7개 항목 전부 ✅ 확인됨
- **선행 Scenario:** 6-2-06

### Scenario 6-2-08: 출시 — 오픈채팅방 링크 공유

- **Given:** MVP 출시 체크리스트 전체 통과
- **When:** 카카오톡 오픈채팅방에 서비스 링크와 안내 메시지를 공유한다
- **Then:** 회원들이 링크를 통해 서비스에 접속할 수 있다
- **선행 Scenario:** 6-2-07

---

## Scenario 전체 요약

| WP | 성공 | 실패/엣지 | 합계 |
|----|:----:|:---------:|:----:|
| WP1-1 | 6 | 0 | **6** |
| WP1-2 | 10 | 5 | **15** |
| WP1-3 | 4 | 0 | **4** |
| WP2-1 | 3 | 4 | **7** |
| WP2-2 | 5 | 4 | **9** |
| WP3-1 | 6 | 4 | **10** |
| WP3-2 | 6 | 4 | **10** |
| WP3-3 | 6 | 4 | **10** |
| WP4-1 | 2 | 9 | **11** |
| WP4-2 | 5 | 4 | **9** |
| WP4-3 | 5 | 3 | **8** |
| WP5-1 | 8 | 7 | **15** |
| WP5-2 | 5 | 4 | **9** |
| WP6-1 | 15 | 0 | **15** |
| WP6-2 | 8 | 0 | **8** |
| **합계** | **94** | **52** | **146** |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v1.0 | 2026-03-03 | work-packages.md + core 3개 문서 기반 최초 Scenario 수립 (111 Scenarios) |
| v1.1 | 2026-03-03 | M1 Scenario 추가 (WP1-1: 6, WP1-2: 14, WP1-3: 4). 총 135 Scenarios |
| v1.2 | 2026-03-04 | 정합성 검토 반영: 5개 Scenario 추가 (2-1-07, 2-2-09, 3-1-10, 4-1-09, 4-2-07). 총 140 Scenarios |
| v1.3 | 2026-03-05 | MVP 검토 v1.3 반영: 6개 Scenario 추가 (1-2-15, 4-1-10, 4-1-11, 4-2-08, 4-2-09, 5-1-15), 4-1-09 수정. 총 146 Scenarios |
| v1.4 | 2026-03-07 | M1 검증 완료: WP1-1(6), WP1-2(15), WP1-3(4) 총 25 Scenarios 검증 통과 |
| v1.5 | 2026-03-10 | M2 검증 완료: WP2-1(7), WP2-2(9) 총 16 Scenarios 수동 검증 통과 |
