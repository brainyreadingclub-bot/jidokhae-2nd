# 지독해(JIDOKHAE) 서비스 정의서

> **작성일** 2026-09-19 · **기준 코드** `feat/agent-team` 브랜치(`1a7c3c2`), 프로덕션 기준선 `origin/main` = `7d902f5`
> **작성 방식** 기획 문서가 아니라 **코드를 읽어서** 쓴 문서다. 문서와 코드가 다르면 코드를 따랐고, 다른 지점은 본문에 표시했다.

---

## 1. 서비스 개요

### 1-1. 한 줄 정의

**경주·포항 지역 오프라인 독서모임 「지독해」의 운영 백본.** 회원은 웹에서 모임 일정을 보고 결제까지 마치고, 운영자는 신청·정원·입금·환불·공간 정산을 한 곳에서 처리한다.

### 1-2. 핵심 가치 — 코드가 실제로 지키고 있는 것

서비스 개요 문서는 세 원칙을 내건다: **쉬워야 / 모여야 / 보여야.** 이게 수사(修辭)가 아니라 코드 제약으로 박혀 있는 지점들:

| 원칙 | 코드에 박힌 형태 |
|---|---|
| **쉬워야** (3초 확인·3클릭 신청) | 카카오 OAuth 단일 로그인(이메일/비번 없음), 결제는 `payMethod: 'EASY_PAY'` 카카오페이 단일 채널, 홈은 모바일 단일 컬럼 `max-w-screen-sm` |
| **모여야** (흩어진 일정·신청을 한 곳에) | 모임·신청·결제·환불·알림 이력·공간 정산이 **하나의 Postgres 17테이블**에 모여 있다. 별도 스프레드시트 운영이 필요 없게 설계됨 |
| **보여야** (상태가 명확히) | `registrations.status` 6종(`confirmed`/`cancelled`/`waitlisted`/`waitlist_cancelled`/`waitlist_refunded`/`pending_transfer`)이 화면 문구·버튼 상태·정산 목록을 **모두** 구동한다. `getButtonState()`(`src/lib/kst.ts`)가 버튼 분기 단일 소스 |

### 1-3. 타겟 유저 — 코드에서 역산되는 3층

**① 일반 회원 (`role='member'`)**
- 규모: 코드에 숫자를 박지 않는 규칙(`site_settings.member_count` 또는 `profiles` 카운트). 주석에는 *"250명 규모라 `book_asks` 전량 스캔 OK"*(`src/lib/asks.ts:147`)라고 적혀 있어 **수백 명 규모**를 전제로 설계됐다.
- 지역: `VALID_REGIONS` 13개(`src/lib/regions.ts`)이지만 실제 매출 집계는 경주·포항 2개 공간(우연히책방·공간지그시)에 집중.
- 디자인 타깃: **2535 세대**. 2026-07 전면 리디자인(잉크그린 `#127A5A` + 감귤코럴 `#F4552A` + Noto Serif KR 에디토리얼)이 이 타깃을 향해 실행됨.
- 결제 수단: 카카오페이 또는 **계좌이체**. 후자는 운영자가 손으로 입금을 확인한다 — 이게 정산 로직 절반의 존재 이유다.

**② 운영진 (`role='editor'`)**
- 모임 CRUD + 회원 조회(이름/닉네임/지역만) + 배너·한 줄 관리.
- **개인정보(phone/email)·정산·사이트 설정 접근 불가.** `adminOnly` 메뉴 4개(정산·공지 보내기·알림톡 이력·설정)로 차단.

**③ 총괄운영자 (`role='admin'`)**
- 전권. 실질적으로 **1인**이다. 코드 곳곳의 주석이 이를 드러낸다: *"운영자가 월말 정산일에 하루 몰아서 입금 확인을 처리하므로"*(알림톡 금지 규칙), *"고정 소수 무료 참석자"*(`is_free` 토글 UI 없이 SQL로 지정).
- **이 서비스의 병목은 서버가 아니라 운영자 1명의 시간이다.** 계좌이체 확인·환불 이체·공간 정산이 전부 수작업이다.

**④ (교차) 스텝 (`is_staff=true`)**
- 회원이면서 운영을 돕는 층. 정기모임 참가비 **50% 할인**(모임당 2슬롯). 2026-08-17부터 **발제 등록 권한**(`isCurator()`)까지 부여 — `is_staff`에 할인 외 권한이 붙은 첫 사례.

---

## 2. 시스템 아키텍처 및 기술 스택

### 2-1. 구성도

```
┌─────────────────────────────────────────────────────────────────────┐
│  클라이언트 (모바일 웹 / PWA)                                          │
│  Next.js 16.1.6 App Router · React 19.2 · TS 5 · Tailwind v4        │
│  Serwist Service Worker (@serwist/next 9.5)                         │
│    └ API/auth/_next-data = NetworkOnly (절대 캐시 금지)               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │  middleware.ts (Edge)   │  모든 요청에서 Supabase 세션 갱신
              │  · 미인증 → /auth/login │  + 목적지를 httpOnly 쿠키로 기억
              │  · 제외: /policy, /auth/callback,
              │          api/webhooks/, api/cron/, PWA 아이콘, OG 이미지
              └────────────┬────────────┘
                           │
        ┌──────────────────┼──────────────────┬───────────────────┐
        ▼                  ▼                  ▼                   ▼
   (main) 6p          (next) 11p         (admin) 14p         policy 6p
   현행 회원 UI       5탭 개편 UI         운영자 백오피스        비로그인 공개
                     ⚠️ 플래그 OFF
        │                  │                  │                   │
        └──────────────────┴────────┬─────────┴───────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │  API Routes 35개 (Node 런타임)  │
                    │  service_role 키 · RLS 우회     │
                    └───────────────┬───────────────┘
                                    │
   ┌────────────────┬───────────────┼───────────────┬────────────────┐
   ▼                ▼               ▼               ▼                ▼
┌────────┐   ┌───────────┐   ┌───────────┐   ┌──────────┐   ┌─────────────┐
│Supabase│   │ PortOne V2│   │  Solapi   │   │  Kakao   │   │ GA4 +Vercel │
│Postgres│   │ (카카오페이)│   │ (알림톡)   │   │ Books API│   │ Analytics   │
│ +Auth  │   │           │   │           │   │ (책 검색) │   │             │
│ 17 테이블│   │ TossPay   │   │ 7종 템플릿 │   │          │   │             │
│ RLS+RPC│   │ (레거시 잔존)│  │           │   │          │   │             │
└────────┘   └───────────┘   └───────────┘   └──────────┘   └─────────────┘
       ▲
       │  Kakao OAuth (Supabase Auth 경유)
       │
┌──────┴──────────────────────────────┐
│  Vercel Cron 2개                     │
│  · 18:30 KST 미승격 대기자 자동 환불    │
│  · 19:00 KST 모임 전날 리마인드        │
│  (Authorization: Bearer CRON_SECRET) │
└─────────────────────────────────────┘
```

> **백엔드는 Supabase 단일, 호스팅은 Vercel 단일이다.** Firebase·GCP 등 다른 클라우드는 쓰지 않는다.

### 2-2. 기술 스택 명세

| 층 | 선택 | 버전 | 비고 |
|---|---|---|---|
| 프레임워크 | Next.js App Router | 16.1.6 | Server Components 기본. 동적 params가 `Promise<{id}>` |
| UI | React | 19.2.3 | Client Component는 명시적 `'use client'`만 (총 91개 컴포넌트 중 소수) |
| 스타일 | Tailwind CSS | v4 | **`tailwind.config.ts` 없음** — `globals.css`의 `@theme inline`이 토큰 단일 소스 |
| 언어 | TypeScript | 5.x | **Supabase 생성 타입 미사용** — `src/types/*.ts` 수기 정의 + `as Meeting` 캐스팅 |
| DB | Supabase Postgres | — | Pro plan + Micro compute, auto-pause OFF, 일일 백업 ON |
| 인증 | Supabase Auth ↔ Kakao OAuth | `@supabase/ssr` 0.9 | PKCE. 콜백이 prod 도메인으로 고정되어 **로컬에서 인증 화면 테스트 불가** |
| 결제 | PortOne V2 | browser 0.1.6 / server 0.19 | 카카오페이 채널. TossPayments SDK 1.9 **미사용 잔존**(롤백 안전망) |
| 알림 | Solapi → 카카오 알림톡 | 5.5.4 | 7종 템플릿, 전부 심사 APPROVED |
| PWA | Serwist | 9.5.7 | configurator 모드 (Turbopack 호환). 빌드가 `next build && serwist build` 2단계 |
| 테스트 | Vitest | 4.1 | **205 테스트 / 16 파일, 전부 통과** (2026-09-19 실행 확인) |
| E2E | — | — | **없음.** Playwright는 스크린샷 캡처용 devDependency일 뿐 |
| CI/CD | Vercel 자동 배포 | — | **GitHub Actions 없음.** 품질 게이트는 로컬 `npm run prelaunch` 수동 실행 |

### 2-3. Supabase 클라이언트 3분화 — 보안 경계의 핵심

```
src/lib/supabase/server.ts  → anon key + RLS   (Server Component)
src/lib/supabase/client.ts  → anon key + RLS   (Client Component)
src/lib/supabase/admin.ts   → service_role     (API Route 전용, RLS 우회)
```

**이 분리가 무너지면 전체 권한 모델이 무너진다.** 실제 방어는 3중:
1. **레이아웃 게이트** — `(admin)/layout.tsx`가 role 검사 후 redirect
2. **RLS 정책** — `is_admin()` / `is_editor_or_admin()` SECURITY DEFINER 함수 (`search_path=''`로 고정해 탈취 방지)
3. **RPC 락** — 정원·할인 슬롯처럼 경합이 나는 판정은 `FOR UPDATE` 행 잠금 안에서 **서버가 재검증**

### 2-4. 데이터 모델 (프로덕션 17테이블)

```
auth.users ──trigger(on_auth_user_created)──▶ profiles
                                               │ role, is_staff, is_free, real_name,
                                               │ phone, region[], nickname_changed_at,
                                               │ welcomed_at, profile_completed_at
                                               │
venues ──▶ meetings ◀──────────────────────── registrations ◀── (user)
  │          │ meeting_type: regular|discussion      │ status 6종
  │          │ region, is_featured, chat_link,       │ payment_id, payment_method
  │          │ reading_link, detail_address,         │ paid_amount, refunded_amount
  │          │ capacity, fee, status                 │ is_staff_discount
  │          │                                       │ settlement_excluded
  │          │
  ▼          ├──▶ discussion_topics ──▶ topic_answers ──┬──▶ answer_replies
venue_          │   (발제문)              (답변, pinned)   └──▶ answer_reactions
settlements     │
                └──▶ books ──┬──▶ library_entries  (개인 서재)
                             └──▶ book_asks        (물어보기 + 응답률 계측)

notifications      (알림톡 발송 이력 — 중복 방지 partial UNIQUE INDEX 5개)
app_notifications  (인앱 알림함)
site_settings      (key-value 운영 플래그 — 여기서 기능을 켜고 끈다)
banners            (M8 대기, 스키마만 선반영)
book_quotes        (M8 대기, 스키마만 선반영)
```

**설계상 눈에 띄는 결정 3가지**

1. **`user_id + meeting_id`에 UNIQUE를 걸지 않았다.** 재신청이 새 행을 만든다 → 신청 이력이 보존된다. 대신 중복 방지를 **DB 함수 안 조건문**으로 처리한다(취소 후 재신청은 허용, 살아있는 신청 중복은 거부).
2. **`payment_id`가 멱등성 키다.** API 레벨(`payment_id` 조회) + DB 레벨(user+meeting) **2층 방어**.
3. **모든 날짜 연산이 KST.** `new Date()` 직접 사용 금지, `src/lib/kst.ts` 경유가 규약. 환불 규칙이 **날짜 단위**라(시각 무관) 타임존이 한 칸 밀리면 곧바로 돈이 틀린다.

### 2-5. 기능 플래그 — 이 서비스의 배포 전략 그 자체

```ts
// src/lib/next-ui.ts
export async function isNextUiEnabled(): Promise<boolean> {
  if (process.env.NEXT_UI_PREVIEW === 'on') return true      // Preview 전용 우회
  const settings = await getSiteSettings()
  return settings['next_ui'] === 'on'                         // prod는 DB flip
}
```

같은 패턴이 `isLibraryEnabled()`(`src/lib/library.ts`)에도 있다. **핵심 효과: prod에 코드를 넣어두고 회원 노출만 0으로 유지한다("다크 배포").** 켜는 순간 재배포 없이 DB 한 줄로 전환된다.

**현재 이 플래그 뒤에 잠들어 있는 것:**

| 플래그 | 상태 | 가려진 것 |
|---|---|---|
| `next_ui` | **OFF** | 5탭 전면개편 UI 전체 — `(next)` 라우트 **11페이지** + 토스 스킨 + 발제 스레드 |
| `library_enabled` | **OFF** | 서재 + 물어보기 + 응답률 계측 |
| `discussion_meeting_enabled` | prod에 **행 자체가 없음** | 토론모임 노출 |

> 코드가 완성돼 prod에 올라가 있는 대형 기능 2세트가 **몇 달째 회원에게 한 번도 보인 적이 없다.** 기술 문제가 아니라 **의사결정 병목**이다(§5-1).

---

## 3. 핵심 비즈니스 로직

### 3-1. 가입 → 온보딩 플로우

```
① 카카오 로그인 (/auth/login → Supabase OAuth → /auth/callback)
        │  trigger on_auth_user_created 가 profiles 행 자동 생성
        │  (카카오 메타데이터에서 nickname/email 추출)
        ▼
② WelcomeScreen  ──▶ profiles.welcomed_at 기록
        │              (POST /api/welcome)
        ▼
③ ProfileSetup   ──▶ real_name · phone · region[] 입력
        │              (POST /api/profile/setup)
        │              → profiles.profile_completed_at 기록
        ▼
④ 온보딩 완료 판정 = isOnboarded(profile)
        = welcomed_at && profile_completed_at && real_name   ← 셋 다 AND
```

**설계 포인트**
- `isOnboarded()`(`src/lib/onboarding.ts`)가 **단일 소스**다. 구 홈(`HomeContent`)의 이중 게이트와 새 `(next)` 레이아웃 게이트가 같은 함수를 본다 — 두 UI가 다른 기준으로 갈라지지 않게.
- **전화번호가 사실상 필수**인 이유: 알림톡 발송 키다. 없으면 `sendNotification`이 `status='skipped'` 이력만 남기고 조용히 넘어간다(`src/lib/notification.ts:56`).
- **닉네임 1회 변경 제한** — `nickname_changed_at` + 낙관적 락 + 중복 409. 닉네임이 전 채널 호칭 단일 소스라 자주 바뀌면 안 된다.

### 3-2. 모임 신청 플로우 — 2갈래

서비스는 **결제 수단 2개를 동시에 운영**한다. `site_settings.payment_mode`(`transfer_only`/`card_only`)로 전환 가능하도록 만들어졌다 — PG 심사 기간을 버티려고 만든 "브릿지"가 그대로 상시 기능이 됐다.

```
                      모임 상세 → [신청하기]
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
      ㉮ 카드/카카오페이                   ㉯ 계좌이체
              │                               │
      PortOne 결제창                   POST /api/registrations/transfer
              │                               │
      payment-redirect                 RPC register_transfer()
              │                          (FOR UPDATE 락)
      POST /api/registrations/confirm          │
              │                               ▼
      processPaymentConfirmation()      status='pending_transfer'
              │                          + payment_method='transfer'
      RPC confirm_registration()               │
       (FOR UPDATE 락)                         │  회원은 M/D 닉네임 형식으로 입금
              │                               │  (예: "5/17 초록고래")
              ▼                               ▼
      confirmed  또는  waitlisted      운영자가 /admin/settlements에서 확인
              │                               │
      알림톡 즉시 발송                   RPC admin_confirm_transfer()
                                               │  (정원 재검증 + FOR UPDATE)
                                               ▼
                                          confirmed
                                          ⚠️ 알림톡 발송 **안 함** (의도적)
```

**㉯ 경로의 의도적 설계 결정 2가지**

1. **`pending_transfer`는 정원을 차지한다.** 즉 미입금 상태에서도 자리가 잡힌다. 회원 입장에서 "신청 완료"와 구분이 안 되므로, 코드는 여러 곳에서 `pending_transfer`를 `confirmed`와 **동등 취급**한다 — 참여자 명단(`PARTICIPATED_STATUSES`), 리마인드 대상, 신청 완료 배너, 물어보기 자격.
2. **입금 확인 시 알림톡을 보내지 않는다.** *"운영자가 월말 정산일에 하루 몰아서 처리하므로 동시다발 알림이 혼란을 유발"* (2026-04-23 확정). → **운영 리듬이 알림 설계를 규정한 사례.**

### 3-3. 결제 연동 — 토스페이먼츠 → 포트원 마이그레이션

#### 히스토리

| 시점 | 사건 |
|---|---|
| M4 | **TossPayments 직연동**으로 최초 구현 (`confirmPayment`로 승인) |
| — | **토스 PG 라이브 심사 거절** |
| PR #28 | **PortOne V2 경유로 마이그레이션.** 카카오페이 채널 |
| 현재 | `src/lib/tosspayments.ts` + `api/webhooks/tosspayments` **미사용 잔존**(롤백 안전망), env도 보존 |

#### 두 PG의 결정적 차이 — 이걸 놓치면 로직을 오독한다

```
토스 직연동:   결제창 완료 → [미승인 상태] → 서버가 confirmPayment 호출 → 돈이 이동
포트원 V2:     결제창 완료 → [이미 승인됨]  → 서버는 getPayment로 검증만
```

즉 **현재 서버는 돈을 움직이지 않는다. 확인만 한다.** (`src/lib/portone.ts:47`)

#### `processPaymentConfirmation()` 검증 체인 (`src/lib/payment.ts`)

`/api/registrations/confirm`(redirect 경로)과 `/api/webhooks/portone`(백업 경로)이 **같은 함수**를 부른다.

| # | 검증 | 실패 시 |
|:--:|---|---|
| 1 | **멱등성** — 이 `payment_id`로 이미 `confirmed`/`waitlisted` 행이 있나? | 성공 반환 (환불 안 함) |
| 2 | 모임 존재 + `status='active'` | 거절 |
| 3 | **토론모임 D-7 마감** — `isDiscussionApplyOpen()` | **자동 환불** 후 거절 |
| 4 | PortOne `getPayment()` → `status === 'PAID'` | 거절 |
| 5 | **금액 화이트리스트** — `[fee]` 또는 `[fee, fee/2]`(스텝 할인 가능 유형만) | **자동 환불** 후 거절 |
| 6 | **paymentId prefix 교차검증** — `jdkh-{meetingId8}-{userId8}-{ts}`의 8자 prefix가 요청의 meetingId·userId와 일치하나? | **자동 환불** 후 거절 |
| 7 | **RPC `confirm_registration()`** — `FOR UPDATE` 락 안에서 정원·중복·스텝 자격·슬롯 **재검증** | 결과별 자동 환불 |

RPC 반환값 7종: `success` / `waitlisted` / `already_registered` / `not_found` / `not_active` / `discount_not_eligible` / `staff_slot_full`.

**돈 안전 원칙 (코드에 반복 등장):**
> `safeCancel()`은 **절대 throw하지 않는다.** 환불 실패 시 `confirmed` 상태를 유지한다 — *"돈도 없고 신청도 없는"* 상태가 최악이기 때문. (`src/lib/payment.ts:182`)

#### 🔴 웹훅 백업 경로는 **한 번도 작동한 적이 없다**

`src/app/api/webhooks/portone/route.ts:70-77`:

```ts
supabase.from('meetings').select('id').like('id', `${meetingId8}%`).limit(1)
supabase.from('profiles').select('id').like('id', `${userId8}%`).limit(1)
```

`meetings.id`·`profiles.id`는 **`uuid` 타입**이다. Postgres에 `uuid LIKE text` 연산자가 없다 → 에러 **42883**. 그런데 코드는 에러와 "대상 없음"을 구분하지 않고 둘 다 `{status:'ignored'}` **200**으로 덮는다(`:80`).

→ **M4 최초 구현부터 2026-09-11 발견까지, 브라우저 redirect가 실패한 모든 결제가 조용히 유실됐다.** 실제 사고(대기 환불 누락)로 발각됨. 조사 기록: `docs/agent-team/조사/2026-09-10-에드워드책-대기환불-누락.md`

✅ **수정본은 2026-09-24에 머지돼 prod에서 돌고 있다**(그 뒤 중복환불 수정 둘이 더 얹혔다 — 2026-10-06). 고친 내용:
- `.like()` → **구간 비교** `.gte(lo).lte(hi)`(`lib/payment-id.ts` `uuidPrefixRange`) — uuid 정렬이 16바이트 memcmp라 prefix 집합과 구간이 정확히 일치하고 PK 인덱스도 탄다
- `classifyIdLookup`이 **4갈래**로 분류: `resolved` / `query_failed` / `not_found` / `ambiguous` — 실패는 **500으로 시끄럽게**
- `.limit(2)` — `.limit(1)`이면 prefix 충돌을 모른 채 **남의 명의로 신청이 만들어진다**
- 실패를 `payment_failures` 표에 기록(`lib/payment-failure.ts` — 절대 throw 안 함, 표가 없어도 동작해 배포 순서를 안 탐)
- 부수 작업은 `after()`로 (`void` fire-and-forget은 Vercel 람다 freeze로 유실 — Preview 실측 13분 지연)

✅ **마이그레이션 실행 완료. `payment_failures` 표가 prod에 있다** (2026-10-07 실조회 확인 — public 표 18개 중 하나). 세는 법: `information_schema.tables`에서 `table_schema='public'`.

### 3-4. 취소 / 환불

#### 환불 규칙 — 모임 유형 2벌

| 유형 | 100% | 50% | 0% |
|---|---|---|---|
| **정기모임** | 3일 전까지 | 2일 전 | 전일·당일 |
| **토론모임** | **7일 전까지** | 3일 전까지 | 2일 전부터 |

토론모임이 더 빡빡한 이유: **책을 미리 주문**하기 때문. 그래서 **신청 마감(D-7) = 100% 환불 경계 = 책 주문 마감**이 **같은 날**로 통일됐다(2026-08-17 결정). `getFullRefundDeadline()`이 세 날짜를 한 번에 계산한다(`src/lib/refund.ts:162`).

#### `calculateRefundByType()` — 단일 진입점

```ts
// src/lib/refund.ts:119
export function calculateRefundByType(meetingType, meetingDate, paidAmount, kstToday?) {
  return meetingType === 'discussion'
    ? calculateDiscussionRefund(...)
    : calculateRefund(...)
}
```

실환불(`cancel.ts`) · 권장액(`mark-refunded`) · 취소 모달 · 정책 페이지가 **전부 이 함수를 경유**한다.

> ⚠️ **이 배선 자체가 사고였다.** `calculateDiscussionRefund()`는 만들어져 테스트까지 통과했는데 **호출부가 0개**였다 — 토론모임 환불이 정기 규칙으로 돌아가고 있었다. 교차 세션 스캔이 발견해 PR #64로 배선. 교훈: **테스트 통과가 미배선을 위장한다.**

#### 기준은 `paid_amount`, `meetings.fee`가 아니다

스텝 할인으로 5,000원 낸 사람에게 10,000원 기준 환불이 나가면 **돈이 샌다.** 전 계산이 실결제액 기준.

#### 모임 삭제 시 일괄 환불

```
active → deleting → Promise.allSettled(병렬 환불) → deleted
```
- **무조건 100%** (환불 규칙 무시). `confirmed` + `waitlisted` 전부.
- 병렬이 필수인 이유: **Vercel 10초 제한.** 직렬 루프는 10명만 넘어도 타임아웃.
- 부분 실패 시 `deleting`에 머문다 → 재시도 가능. 대시보드가 `deletingCount`로 경보.

#### 대기열(Waitlist) — B안

```
정원 초과 시 → 미리 결제 → waitlisted
     │
     ├─ 확정자 취소 → RPC promote_next_waitlisted() (FOR UPDATE) → 자동 확정 + 알림톡
     └─ 미승격 → 전날 18:30 크론이 100% 자동 환불 + 알림톡
```

**돈 안전 규칙(코드 주석에 명시):** `waitlisted` 상태에서 `safeCancel`/부분환불 **절대 금지.** 환불은 ① 대기 취소 ② 크론 ③ 모임 삭제 **세 경로에서만.**

### 3-5. 자동화 — Vercel Cron 2개

```json
// vercel.json
{"path": "/api/cron/waitlist-refund", "schedule": "30 9 * * *"}   // KST 18:30
{"path": "/api/cron/meeting-remind",  "schedule": "0 10 * * *"}   // KST 19:00
```

| 크론 | 하는 일 | 설계 포인트 |
|---|---|---|
| `waitlist-refund` | 내일 모임의 미승격 대기자 전액 환불 + 알림톡 | **catch-up 쿼리** `date <= tomorrow` — 지난 실패 건을 매일 자동 재시도 |
| `meeting-remind` | 내일 모임 참여자에게 리마인드 | `Promise.allSettled` 병렬. 대상이 `confirmed` 단독 → `PARTICIPATED_STATUSES`로 교정됨(2026-07-30) — 계좌이체 신청자 **27명이 리마인드를 못 받고 있었다** |

인증은 `Authorization: Bearer CRON_SECRET`. 미들웨어가 `api/cron/`을 제외한다.

**Hobby 플랜 제약:** 19:00 요청은 19:00~19:59 사이 **랜덤 실행**. 분 단위 정밀도 없음.

### 3-6. 알림 — 중복 방지 패턴

알림톡 7종: 신청 확인 · 모임 리마인드 · 대기 확인 · 승격 확정 · 미승격 환불 · **물어보기** · **가입 환영**
(뒤 2종은 draft PR #49·#53에 있어 **아직 main에 없다**)

```
INSERT(status='pending')  ← partial UNIQUE INDEX가 여기서 위반 → 발송 전 차단
       ↓
Solapi 발송
       ↓
UPDATE(status='sent' | 'failed')
```

에러코드 `23505` = 중복 → skip. **알림은 부가 기능** — 실패해도 결제/신청 흐름을 중단시키지 않는다.

> 🔴 **여기서 실제로 돈이 걸린 버그가 있었다.** `meeting_id`에 빈 문자열 `''`을 넘기면 uuid 캐스팅이 깨져(`22P02`) INSERT 자체가 실패한다. `sendWaitlistRefundedNotification`이 `''`를 넘겨 **미승격 환불 알림이 한 번도 발송되지 않고 이력 행조차 남지 않았다**(2026-07-30 발견). 지금은 `params.meetingId || null`로 정규화.

---

## 4. 특화 기능 분석

### 4-1. 보이스 시스템 — 알림톡의 화자(話者) 규격

`jidokhae-web/VOICE.md`(v0.5)가 규정하는 것:

| 항목 | 규칙 |
|---|---|
| **발신 주체** | 지독해가 **아니라 지똑똑**. 카카오 채널명이자 캐릭터("지독해 요정") |
| **왜 캐릭터인가** | 운영자 1인칭은 *"아는 사람의 부탁이라 거절 비용이 비대칭"*. 캐릭터는 실존 인물이 아니라 **회원이 부담 없이 넘길 수 있다** |
| **인사** | `똑똑!` + 강조표기형. `지똑똑입니다`는 금지(채널명이 이미 지똑똑) |
| **어미** | 해요체. *"`똑똑!` 다음에 `~되었습니다`가 오면 요정이 공문을 읽는 꼴"* |
| **활기 배치** | **첫 줄 인사와 마지막 줄 마무리에만.** 금액·일시·장소 사이엔 캐릭터 금지 — 정보가 흐려진다 |
| **느낌표** | 조건부. 좋은 소식/인사 허용, 아쉬운 소식·금액 문장 금지, 한 메시지 최대 2개 |

**효과:** 화자·톤·금칙어가 **문서 한 벌로 규격화돼 있다.** 운영자가 바뀌어도, 채널이 늘어도(알림톡 → 인앱 알림 → 공지) 같은 목소리를 낸다. 소규모 서비스에서 흔치 않은 브랜드 자산이다.

### 4-2. 실제 차별화 기능 3종

#### ① 발제 스레드 (`discussion_topics` → `topic_answers` → `answer_replies` / `answer_reactions`)

오프라인 토론모임의 **전·후를 온라인으로 연장**한다.

- 운영자/스텝(=큐레이터)이 모임 전에 **발제문**(인용 + 페이지 + 질문)을 올린다
- 회원이 **모임 전에 미리 답변**을 쓴다 (`canWriteAnswer()` = `confirmed` 또는 `pending_transfer`만)
- 운영자가 좋은 답변에 **핀**을 꽂는다 = *"모임에서 이어가요"*
- 답글 + 공감(1인 1회)
- 답글이 달리면 **인앱 알림함**(`app_notifications`)에 쌓인다

**권한 설계의 첫 예외:** `isCurator()` = `admin` ∪ `editor` ∪ `is_staff`. 할인 자격이던 `is_staff`에 **콘텐츠 권한**이 붙은 첫 사례다. DB `is_curator()` SQL 함수와 **동기 필수**(어긋나면 화면은 되는데 저장이 안 되거나 그 반대).

#### ② 서재 + 물어보기 (`books` / `library_entries` / `book_asks`)

- **서재** — 회원이 읽은/읽을 책을 담는다. 완독 표시 지원
- **책 검색** — 카카오 책 검색 API(`dapi.kakao.com/v3/search/book`) 래핑. ISBN13 정규화(`src/lib/isbn.ts`), 표지는 Kakao CDN이 `remotePatterns`에 없어 `next/image` 금지 → plain `<img>`
- **물어보기** — 모임 참석 다음 날, *"그때 그 책 뭐였죠?"*를 묻고 답을 서재에 담는다

**진입 방식 pivot (전문가 패널 5인, 2026-07-16):** 토스트·종 알림 **기각**, **알림톡-first + 인앱 조용한 스트립(안전망)** 채택.

#### ③ 스텝 할인 — 참여를 운영 노동과 교환

```ts
STAFF_DISCOUNT_RATE = 0.5                  // src/lib/pricing.ts
STAFF_DISCOUNT_MAX_PER_MEETING = 2
```

- 대상: `admin` / `editor` / `is_staff=true`
- **정기모임 한정** (토론모임은 책값이 들어 제외 — 2026-08-17 확정, RPC 가드까지 추가)
- **모임당 2슬롯**. 경합은 RPC의 `FOR UPDATE` 락으로 해소 → 초과 시 `staff_slot_full` 반환 + **자동 환불**
- ⚠️ **TS 상수 ↔ SQL 함수 `staff_discount_max_per_meeting()` 수동 동기 필수** (§5-6)

### 4-3. 운영 집계 화면 4종

운영자가 열면 **그 자리에서 계산되는**(SSR) 화면들이다. 리포트를 만들어 보내주는 자동 발송·스냅샷 저장·기간 비교 트렌드는 없다 — 자동으로 도는 것은 크론 2개뿐이고, 둘 다 리포트가 아니라 알림톡 발송·환불 실행이다(§3-5).

#### ① 운영자 대시보드 (`src/lib/dashboard.ts` → `/admin`)

| 지표 | 계산 | 주의 |
|---|---|---|
| 월 매출 | `totalPaid`(confirmed+cancelled) − `totalRefunded`(cancelled의 refunded_amount) | **`cancelled`를 총매출에 포함**시키지 않으면 순매출이 음수로 나온다 (M7 Step 2.5 수정) |
| 충원율 | RPC `get_confirmed_counts()` 배치 조회 (N+1 회피) | **50% 미만은 `lowFillAlerts`로 경보** |
| 회원 | 전체 / 프로필 완성 / 전화 등록 / 이번달 신규 | `profiles` **전량 fetch 후 JS 필터** (§5-4) |
| 경보 | `deleting` 잔류 모임, 미정산 공간, 입금 대기, 환불 대기 | |

#### ② 정산 3탭 (`src/lib/settlement.ts` → `/admin/settlements`, **admin 전용**)

- **입금 확인 대기** — `pending_transfer` 목록. 신청시각·입금자명·금액·닉네임·실명·연락처·모임·**경과일수**
  - `is_free=true` 회원 제외 (코멥 — 입금이 없어 영구 잔존 → 노이즈)
  - `settlement_excluded=true` 제외 (운영자 "확인 제외" 토글, 하단 접힘 섹션에서 복구 가능)
- **환불 대기** — 계좌이체 취소 + 미환불 + 실입금 건. `RefundToggle`로 양방향 처리
- **지역별 매출** — 공간대여비 지급 근거. `confirmed`의 `paid_amount`를 지역×월로 집계. **지역은 데이터에서 동적 추출**(하드코딩 금지)
  - ⚠️ 여기 매출은 **gross**(환불 미차감)다. 대시보드 순매출과 **다른 숫자** — 같은 화면에 섞이면 오해를 부른다

#### ③ 공간 정산 (`getVenueSettlementData`)

`percentage`(매출 × 요율) 또는 `fixed`(모임 수 × 정액) 2방식.

#### ④ 물어보기 응답률 (`computeAskStats`) — **유일하게 통계적으로 설계된 지표**

```
분모(denominator) = 자격 참여 (user,meeting) dedup     ← 정기 + active + 과거 + 60일 이내
분자 = 반드시 분모와 교집합                             ← 윈도우 밖·비자격 건 제외
노출률 = exposed / denominator
전환율 = answered / exposed                            ← 북극성 지표
```

> **여기에 실제 사고가 있었다.** 분자를 분모와 교집합하지 않아 **응답률이 100%를 넘었다.** PR #43으로 수정하면서 지표를 **노출률 / 전환율 2개로 분리**하고, 폐기 판단선을 *"노출 누적 30건 신뢰 게이트"*로 재정의했다. 회귀 테스트 6종 추가.
>
> **이 사례가 이 코드베이스에서 가장 성숙한 데이터 작업이다.** 나머지 집계는 이 수준의 정의·검증을 갖고 있지 않다(§5-5).

---

## 5. 현재 시스템의 한계점 — 코드 레벨 기술 부채

> 심각도: 🔴 돈/데이터 위험 · 🟠 성장 차단 · 🟡 운영 마찰

### 5-1. 🔴 완성된 기능 2세트가 플래그 뒤에서 잠자고 있다 — **최대 리스크**

| 잠긴 것 | 규모 | 기간 |
|---|---|---|
| 5탭 전면개편 UI (`next_ui`) | `(next)` 라우트 **11페이지**(상세·신청 확인·완료 포함) + 발제 스레드 5테이블 + 토스 스킨 | 2026-08-17 머지 이후 **한 달+** |
| 서재 + 물어보기 (`library_enabled`) | 3테이블 + `/admin/library` + 응답률 계측 | 2026-07-15 배포 이후 **두 달+** |

**켜는 날 게이트는 기술적으로 전부 닫혔다.** 알림톡 심사 7종 APPROVED, prod SQL 실행 완료, 빌드·테스트 통과 확인. 남은 것은 **대표님 결정 2건**(예고 문구 확정 / 켜는 날짜)뿐이다.

**비용:**
- 두 UI(`(main)` 6p + `(next)` 11p)를 **동시에 유지**한다. 버그 수정도 두 번.
- 플래그 뒤 코드는 **회원 피드백을 0건 받았다.** 켜는 순간 처음 검증된다 — 다크 배포의 안전성은 **켜기 전까지만** 유효하다.
- 코드가 익는 게 아니라 **낡는다.**

### 5-2. ~~🔴 결제 안전망이 아직 머지되지 않았다~~ → ✅ **해소 (2026-09-24 머지, prod 가동)**

§3-3 참조. 코드와 표 둘 다 prod에 있다(2026-10-07 실조회). **지워지지 않은 위험은 이제 「우리가 모르는 유실」이 아니라 「누가 두 번 보내는지 모른다」다** — 2026-10-06 중복환불 사고의 원인은 막았지만 **호출 주체는 아직 모른다**(관찰 기록이 쌓이는 중, 몇 주 걸릴 수 있다). 조사: `docs/agent-team/조사/2026-10-06-중복환불-사고.md`

⚠️ **회원 5명이 「내 신청」에서 결제금액 0원을 본다** — 그 사고의 남은 흔적이고 대표님이 그대로 두기로 했다.

### 5-3. 🟠 `(next)`에 남은 구 화면 이탈 2곳

`(next)`의 **page 파일**에서 구 스킨 `(main)`으로 나가는 링크가 3곳 남아 있다. 넘어가면 하단 탭이 **5개 → 2개**로 바뀌어 회원이 다른 앱에 온 것처럼 느낀다.

| 나가는 곳 | 목적지 | 결정 기록 |
|---|---|---|
| `shelf/page.tsx:105` | `/my#library` (책 담기·관리) | ✅ 있음 — 「서재 탭으로 단일화」(`DECISIONS.md` 2026-09-19, ⏸ 보류 · 착수는 켜는 날 이후) |
| `me/page.tsx:80` | `/my#registrations` (신청 내역) | ❌ 없음 (의도 불명) |
| `me/page.tsx:92` | `/my` (프로필·설정) | ❌ 없음 (의도 불명) |

반면 `src/components/next/**` 안에서 `(main)`으로 나가는 링크는 **0개**다.

> ✅ **한때 여기 적혀 있던 🔴 두 건은 사실이 아니어서 지웠다** (2026-09-19 확인).
> - ~~"`(next)`에 상세·신청·결제 화면이 없다"~~ → **있다.** `meet/[id]`(상세) · `meet/[id]/apply`(신청 확인) · `meet/[id]/done`(완료) 3장. 구경로 `(main)/meetings/[id]`는 `next_ui` ON이면 `/meet/[id]`로 **리다이렉트**된다(알림톡 버튼 URL이 구경로라 재심사 없이 하위 호환).
> - ~~"회원이 환불 조건을 모른 채 돈을 보낸다"~~ → **결제 전에 보인다.** `ApplyConfirmView.tsx:79`의 `<RefundNotice showHeading />`이 결제 버튼(`:81`) **위**에 렌더되고, 비율·날짜는 하드코딩이 아니라 `getRefundScheduleByType()` 계산값이다. 상세 화면은 신청 가능할 때 결제 버튼 대신 `/meet/[id]/apply` 링크만 노출해 **이 화면을 건너뛸 수 없게** 했다.

### 5-4. 🟠 집계가 전부 **전량 fetch + JS 필터**다

```ts
// dashboard.ts:124 — 전 회원 행을 받아 JS로 센다
const { data: profiles } = await supabase.from('profiles').select('profile_completed_at, phone, created_at')

// settlement.ts:151 — 전 confirmed 등록을 받아 JS로 그룹핑
const { data } = await supabase.from('registrations').select('paid_amount, meetings(...)').eq('status','confirmed')

// asks.ts:147 — 주석이 스스로 인정한다: "250명 규모라 book_asks 전량 스캔 OK"
```

- **수백 명까지는 문제없다.** 수천 명이면 Vercel 10초 제한에 닿는다.
- 특히 `getRegionRevenueData`는 **기간 필터 없이 전 기간 confirmed 등록 전량**을 가져온다 — 누적이라 **매년 무조건 무거워진다.**
- 해법 방향: Postgres 집계 함수(RPC)로 이관 또는 월별 스냅샷 테이블. **지금 하면 싸고, 터진 뒤엔 비싸다.**

### 5-5. 🟠 데이터 정의가 화면마다 다르다 — "매출"이 3가지다

| 화면 | 매출 정의 |
|---|---|
| 대시보드 | 순매출 = paid(confirmed+cancelled) − refunded |
| 지역별 매출 | **gross** — 환불 미차감 (코드 주석이 *"앱 대시보드 순매출과 다름"*이라고 명시) |
| 공간 정산 | confirmed의 paid_amount만 |

세 숫자가 같은 백오피스에 있고, **어느 화면에도 "이 매출은 무엇인가"가 적혀 있지 않다.** 운영자는 화면을 오가며 다른 숫자를 본다.

→ **"지난달 매출이 얼마야"에 지금 코드는 3가지로 답한다.**

### 5-6. 🟠 TypeScript ↔ SQL 이중 정의 3쌍 (수동 동기)

| TS | SQL | 어긋나면 |
|---|---|---|
| `STAFF_DISCOUNT_MAX_PER_MEETING = 2` | `staff_discount_max_per_meeting()` | 할인 슬롯 초과 판매 또는 정상 결제 거부 |
| `isCurator()` | `is_curator()` | 화면은 되는데 저장 실패 (또는 그 반대) |
| `VALID_REGIONS` (13개) | `profiles_region_check` CHECK 제약 | 프로필 저장 실패 |

**컴파일러도 테스트도 이 어긋남을 잡지 못한다.** 사람이 기억해야 한다.

### 5-7. 🟠 품질 게이트가 사람의 기억에 의존한다

- **CI/CD 파이프라인 없음.** GitHub Actions 0개. `npm run prelaunch`(lint+tsc+test+build)를 **손으로** 돌린다.
- **E2E 테스트 0개.** Playwright는 스크린샷 캡처용. 결제·취소·환불 전 흐름을 자동으로 밟는 테스트가 없다.
- **단위 테스트 205개는 전부 `src/lib/`의 순수 함수**다. API 라우트·RPC·RLS 정책은 테스트 대상 밖.
- **가장 위험한 조합:** 돈 로직(RPC 락, 환불 배선, 웹훅)이 **테스트가 가장 얇은 층**에 있다. 실제로 §3-4의 환불 미배선과 §3-3의 웹훅 사고가 **둘 다** 여기서 났다.

> **Preview 검증도 위험하다:** Vercel Preview가 **prod Supabase에 그대로 연결**된다(별도 staging 없음). 검증 시 실데이터가 바뀐다.

### 5-8. 🟡 운영 자동화가 비어 있는 자리

| 수작업 | 빈도 | 자동화 가능성 |
|---|---|---|
| 계좌이체 입금 확인 | 월말 일괄 | 은행 API 연동 or 입금자명 매칭 보조 |
| 환불 이체 (계좌이체 건) | 건별 | PG 미경유라 자동화 어려움 — 알림·체크리스트로 보조 |
| 공간 정산 확정 | 월 1회 | 계산은 자동, **확정 버튼만 수동** (적절한 설계) |
| `is_free` 지정 | 드묾 | SQL 직접 실행 (UI 없음 — *"혜택이 editor에 노출"* 우려로 의도적 폐기) |
| deleted 모임의 환불 잔재 | 드묾 | **불가능** — `/admin/meetings/[id]`가 `notFound()`라 RefundToggle 접근 불가 → SQL로만 처리 |

### 5-9. 🟡 문서 부채

- **`.env.example`이 낡았다.** 코드가 실제로 읽는 `KAKAO_REST_API_KEY`, `SOLAPI_TEMPLATE_BOOK_ASK`, `SOLAPI_TEMPLATE_WELCOME`, `NEXT_UI_PREVIEW`, `LIBRARY_PREVIEW`가 **전부 빠져 있다.** 신규 환경 세팅이 조용히 실패한다.
- **Supabase 생성 타입 미사용.** `as Meeting` 캐스팅이라 **스키마가 바뀌어도 tsc가 조용하다.**
- **마이그레이션 CLI 미사용.** `supabase/*.sql` 33개를 SQL Editor에 **손으로 붙여넣는다.** 적용 여부를 추적하는 것은 사람의 기억과 문서뿐 — 실제로 `payment_failures`가 "코드는 있고 표는 없는" 상태다.

---

## 부록. 규모 실측 (2026-09-19, `feat/agent-team`)

| 대상 | 수 | 세는 법 (`jidokhae-web/`에서) |
|---|:--:|---|
| `src/lib/*.ts` | 41 | `ls src/lib/*.ts \| wc -l` |
| API 라우트 | 35 | `find src/app/api -name route.ts \| wc -l` |
| `(admin)` 페이지 | 14 | `find "src/app/(admin)" -name page.tsx \| wc -l` |
| `(next)` 페이지 | 11 | `find "src/app/(next)" -name page.tsx \| wc -l` |
| `(main)` 페이지 | 6 | `find "src/app/(main)" -name page.tsx \| wc -l` |
| 컴포넌트 | 91 | `find src/components -name '*.tsx' \| wc -l` |
| 단위 테스트 | 16파일 / **205 통과** | `npx vitest run` |
| 마이그레이션 SQL | 33 | `ls supabase/*.sql \| wc -l` |
| prod DB 테이블 | 17 | `information_schema.tables` (`table_schema='public'`) |

> 숫자와 함께 **세는 명령**을 적어둔다. 숫자만 적으면 다시 셀 수 없고, 낡은 채로 사실처럼 굳는다.
