## 보안 공격 보고서

**검증 대상**: `jidokhae-web/` 전체 (API Routes, Middleware, DB Schema, Client Components)
**검증 일시**: 2026-04-06
**프로젝트**: JIDOKHAE 2nd (지독해 독서 모임 웹서비스)

### 프로필 기반 파악 사항
- **인증 방식**: Supabase Auth + Kakao OAuth (PKCE), 세션 쿠키 기반
- **데이터 민감도**: 개인정보(실명, 전화번호, 이메일) + 금전 거래(TossPayments 카드결제, 계좌이체)
- **외부 서비스 연동**: TossPayments (결제/환불), Solapi (KakaoTalk 알림톡), Vercel Analytics, GA4, Supabase (PostgreSQL + Auth)
- **추가 감지 사항**:
  - 계좌이체 브릿지 기능(`/api/registrations/transfer`, `/api/admin/registrations/confirm-transfer`, `/api/admin/registrations/mark-refunded`)이 구현되어 있음 (CLAUDE.md에 미기재)
  - TossPayments 웹훅에 서명(signature) 검증 없음 -- `getPayment()`으로 대체 검증
  - Security headers (CSP, HSTS, X-Frame-Options 등) 설정 없음 (`next.config.ts` 비어 있음)
  - Rate limiting 구현 없음

---

### 공격 시나리오

#### 🔴 Critical (즉시 악용 가능)

##### C-1. TossPayments 웹훅 서명 미검증 — 위조 웹훅으로 무료 등록

- **공격 벡터**: `/api/webhooks/tosspayments` 엔드포인트는 미들웨어에서 제외되어 인증 없이 접근 가능 (`api/webhooks/` 패턴 매칭). 이 웹훅은 TossPayments가 보내는 `secret` 헤더 서명을 전혀 검증하지 않는다. 대신 `getPayment(paymentKey)`로 결제를 조회하여 상태를 확인하는데, 이 방어가 효과적이다. 공격자가 위조한 `paymentKey`를 보내면 TossPayments API에서 `DONE`이 아닌 상태가 반환되므로 무시된다. 그러나 이 방어는 TossPayments API의 가용성에 의존한다 -- TossPayments API가 다운되면 500 에러를 반환할 뿐 등록은 차단된다.
- **영향 범위**: 현재 `getPayment()` 검증 덕에 위조 등록은 불가. 단, 서명 검증 없이 누구든 웹훅 URL에 POST를 무한 반복할 수 있으며, 매 요청마다 TossPayments API를 호출한다 (비용/rate limit 소모).
- **난이도**: 초보
- **해당 코드**: `src/app/api/webhooks/tosspayments/route.ts:7-138` (전체)
- **PoC**:
```bash
# 위조 웹훅 스팸 — TossPayments API 호출 유발
for i in $(seq 1 1000); do
  curl -X POST https://brainy-club.com/api/webhooks/tosspayments \
    -H "Content-Type: application/json" \
    -d '{"eventType":"PAYMENT_STATUS_CHANGED","data":{"paymentKey":"fake_'$i'","orderId":"jdkh-aaaaaaaa-bbbbbbbb-123"}}'
done
```
- **판정**: `getPayment()` 대체 검증으로 등록 위조는 차단되지만, 서명 검증 부재로 스팸/DoS 벡터가 열려 있다. **Warning으로 하향 조정** -- 실제 금전 피해는 없지만 TossPayments API rate limit 소진 가능.

---

##### C-2. `mark-refunded` API — admin이 임의 금액을 환불 기록으로 기입 가능 (검증 부재)

- **공격 벡터**: `/api/admin/registrations/mark-refunded`는 `registrationId`와 `refundedAmount`만 받고, `refundedAmount`의 범위를 전혀 검증하지 않는다. 음수, 0, 또는 `paid_amount`를 초과하는 금액도 DB에 기록된다. admin 계정이 탈취되면 재무 기록 조작이 가능하다.
- **영향 범위**: 환불 기록 조작 (실제 TossPayments 환불은 이 API에서 발생하지 않으므로 실금전 피해는 제한적이나, 회계 무결성 훼손)
- **난이도**: 중급 (admin 세션 필요)
- **해당 코드**: `src/app/api/admin/registrations/mark-refunded/route.ts:63-67`
- **PoC**:
```javascript
// admin 세션으로 실행
fetch('/api/admin/registrations/mark-refunded', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    registrationId: 'any-valid-id',
    refundedAmount: -999999 // 음수 금액 기록
  })
})
```

---

#### 🟡 Warning (조건부 악용 가능)

##### W-1. Rate Limiting 전무 — 결제/취소/로그인 API 무차별 호출 가능

- **공격 벡터**: 모든 API 엔드포인트에 rate limiting이 없다. 인증된 사용자가 `/api/registrations/cancel`을 수천 번 호출하거나, `/api/registrations/confirm`을 반복 호출하면 TossPayments API 할당량을 소모시킬 수 있다. `/api/registrations/transfer`를 반복 호출하면 DB에 불필요한 부하를 준다(RPC의 중복 체크로 실제 등록은 안 되지만 DB 락이 반복 발생).
- **영향 범위**: 서비스 가용성 저해, TossPayments API rate limit 소진으로 정상 사용자 결제 불가
- **난이도**: 초보
- **해당 코드**: 모든 API route (`src/app/api/` 하위 전체)
- **PoC**:
```bash
# 인증 쿠키 탈취 후 — cancel API 폭격
for i in $(seq 1 500); do
  curl -X POST https://brainy-club.com/api/registrations/cancel \
    -H "Content-Type: application/json" \
    -H "Cookie: sb-xxx-auth-token=stolen_token" \
    -d '{"registrationId":"valid-reg-id"}'
done
```

##### W-2. Security Headers 미설정 — Clickjacking, MIME Sniffing 노출

- **공격 벡터**: `next.config.ts`가 비어 있고, 별도의 `headers()` 설정이 없다. Vercel은 기본으로 `X-Frame-Options`를 설정하지 않는다. 공격자가 지독해 사이트를 iframe에 삽입하여 clickjacking 공격을 수행할 수 있다 — 예를 들어 "취소하기" 버튼 위에 투명 레이어를 올려 사용자 모르게 취소를 유도.
- **영향 범위**: Clickjacking을 통한 의도치 않은 결제 취소/모임 삭제 유도
- **난이도**: 중급
- **해당 코드**: `next.config.ts:1-7` (빈 설정)
- **PoC**:
```html
<!-- 공격자 사이트 -->
<iframe src="https://brainy-club.com/meetings/some-id"
        style="opacity:0; position:absolute; top:0; left:0; width:100%; height:100%;">
</iframe>
<button style="position:absolute; top:500px; left:100px;">
  무료 경품 받기  <!-- 실제로는 iframe의 취소 버튼 위치 -->
</button>
```

##### W-3. 웹훅 orderId 파싱 — UUID 8자리 prefix 충돌 가능성

- **공격 벡터**: 웹훅에서 orderId의 `meetingId8`과 `userId8` (UUID 앞 8자리)로 `.like('id', '${meetingId8}%')`를 수행한다. UUID v4에서 8자리(16진수) = 약 40억 조합이므로 충돌 확률은 극히 낮으나, 의도적으로 같은 prefix를 가진 UUID가 존재한다면 잘못된 사용자/모임에 등록될 수 있다. `limit(1)`이므로 첫 번째 매칭 결과만 사용.
- **영향 범위**: 극히 낮은 확률로 잘못된 사용자에게 등록 귀속 (250명 규모에서 실질적 위험 없음)
- **난이도**: 전문가 (의도적 충돌 생성 불가 — UUID는 서버에서 생성)
- **해당 코드**: `src/app/api/webhooks/tosspayments/route.ts:62-77`
- **PoC**: 실질적 공격 불가. 정보 제공 차원.

##### W-4. Admin API 에러 응답에 Supabase 내부 에러 메시지 노출

- **공격 벡터**: 다수의 admin API 엔드포인트가 Supabase `error.message`를 응답에 포함한다. 이 메시지에는 테이블명, 컬럼명, 제약조건명 등 DB 스키마 정보가 포함될 수 있다.
- **영향 범위**: 공격자가 DB 스키마를 파악하여 후속 공격에 활용 (admin 인증 필요)
- **난이도**: 중급 (admin 세션 필요)
- **해당 코드**:
  - `src/app/api/admin/venues/route.ts:62` — `생성 실패: ${error.message}`
  - `src/app/api/admin/venues/[id]/route.ts:66` — `수정 실패: ${error.message}`
  - `src/app/api/admin/settings/route.ts:60` — `저장 실패: ${error.message}`
  - `src/app/api/admin/venues/settle/route.ts:58` — `정산 확정 실패: ${error.message}`

##### W-5. 계좌이체 `pending_transfer` 상태 — 결제 미확인 상태로 정원 점유

- **공격 벡터**: `/api/registrations/transfer`는 인증된 사용자가 계좌이체 신청만 하면 `pending_transfer` 상태로 정원을 점유한다. 실제 입금 없이도 자리를 차지한다. admin이 수동 확인하기 전까지 무한정 대기 가능.
- **영향 범위**: 악의적 사용자가 여러 모임에 계좌이체 신청 후 미입금하여 정원을 독점. 정상 사용자가 참여 불가.
- **난이도**: 초보 (로그인한 일반 사용자)
- **해당 코드**: `src/app/api/registrations/transfer/route.ts` + `supabase/migration-bank-transfer-functions.sql:131-179` (`register_transfer` RPC)
- **PoC**:
```javascript
// 여러 모임에 계좌이체 신청 (입금 안 함)
const meetingIds = ['meeting-1', 'meeting-2', 'meeting-3']
for (const id of meetingIds) {
  await fetch('/api/registrations/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId: id })
  })
}
// 정원이 1인 모임은 이것만으로 마감됨
```

##### W-6. Cron 엔드포인트의 CRON_SECRET 브루트포스

- **공격 벡터**: `/api/cron/meeting-remind`와 `/api/cron/waitlist-refund`는 미들웨어에서 제외되고, `Authorization: Bearer {CRON_SECRET}` 헤더만으로 인증한다. CRON_SECRET의 엔트로피가 낮으면 브루트포스 가능. Rate limiting 없음.
- **영향 범위**: 공격 성공 시 임의 시점에 리마인드 알림톡 대량 발송, 또는 대기자 환불 조기 실행
- **난이도**: 중급 (CRON_SECRET이 충분히 길면 실질적 불가)
- **해당 코드**: `src/app/api/cron/meeting-remind/route.ts:15-16`, `src/app/api/cron/waitlist-refund/route.ts:14-15`

---

#### 🔵 Info (잠재적 위험)

##### I-1. `dangerouslySetInnerHTML` 사용 — GA4 초기화 스크립트

- **공격 벡터**: `src/app/layout.tsx:86-93`에서 `dangerouslySetInnerHTML`을 사용하지만, 삽입되는 값은 환경변수 `GA_ID`이며, 정규식 `/^G-[A-Z0-9]+$/`으로 검증된다. XSS 주입 불가.
- **영향 범위**: 없음 (안전하게 구현됨)
- **해당 코드**: `src/app/layout.tsx:86-93`

##### I-2. React의 기본 XSS 방어 — 사용자 입력 텍스트 렌더링

- **공격 벡터**: 모임 제목/설명/장소 등 사용자(admin) 입력 텍스트는 React JSX 내 `{meeting.title}`, `{meeting.description}` 형태로 렌더링된다. React는 기본적으로 텍스트를 이스케이프하므로 XSS 불가.
- **영향 범위**: 없음
- **해당 코드**: `src/components/meetings/MeetingDetailInfo.tsx:23-30`

##### I-3. 에러 페이지 개발 환경 정보 노출

- **공격 벡터**: `error.tsx`에서 `process.env.NODE_ENV === 'development'`일 때만 `error.message`를 표시한다. 프로덕션에서는 노출되지 않는다.
- **영향 범위**: 없음 (안전하게 구현됨)
- **해당 코드**: `src/app/(main)/error.tsx:41-44`

##### I-4. CSRF 방어 — Next.js SameSite 쿠키 기본 동작

- **공격 벡터**: API Routes는 별도의 CSRF 토큰을 사용하지 않는다. 그러나 Supabase Auth 쿠키는 `SameSite=Lax`가 기본값이므로, 타 사이트에서 POST 요청을 보내면 쿠키가 전송되지 않는다. 따라서 CSRF는 기본적으로 방어된다.
- **영향 범위**: 없음 (SameSite 쿠키로 방어됨)
- **확인 필요**: Supabase SSR 쿠키의 SameSite 속성이 실제로 `Lax`인지 운영 환경에서 확인 필요.

##### I-5. SQL 인젝션 — Supabase Client SDK 사용

- **공격 벡터**: 모든 DB 접근은 Supabase JavaScript SDK의 체이닝 메서드(`.eq()`, `.like()`, `.in()` 등)와 RPC를 사용한다. raw SQL 쿼리를 직접 작성하는 코드는 없다. Supabase SDK는 내부적으로 파라미터화된 쿼리를 사용하므로 SQL 인젝션 불가.
- **영향 범위**: 없음
- **해당 코드**: 전체 API Routes

---

### 인증/인가 분석 결과

| 엔드포인트/기능 | 인증 필요 | 인증 적용됨 | 권한 검증 | 상태 |
|---------------|----------|-----------|----------|------|
| `POST /api/registrations/confirm` | ✅ | ✅ (쿠키 기반 getUser) | ✅ (본인 user.id 사용) | 🟢 |
| `POST /api/registrations/cancel` | ✅ | ✅ | ✅ (userId 매칭) | 🟢 |
| `POST /api/registrations/waitlist-cancel` | ✅ | ✅ | ✅ (userId 매칭) | 🟢 |
| `POST /api/registrations/transfer` | ✅ | ✅ | ✅ (본인 user.id 사용) | 🟢 |
| `POST /api/registrations/attendance` | ✅ | ✅ | ✅ (editor/admin role) | 🟢 |
| `POST /api/meetings/[id]/delete` | ✅ | ✅ | ✅ (admin role) | 🟢 |
| `POST /api/admin/members/role` | ✅ | ✅ | ✅ (admin role + 자기변경 차단 + admin 대상 차단) | 🟢 |
| `POST /api/admin/registrations/confirm-transfer` | ✅ | ✅ | ✅ (admin role) | 🟢 |
| `POST /api/admin/registrations/mark-refunded` | ✅ | ✅ | ✅ (admin role) | 🟡 (금액 검증 부재) |
| `POST /api/admin/settings` | ✅ | ✅ | ✅ (admin role) | 🟢 |
| `POST /api/admin/venues` | ✅ | ✅ | ✅ (admin role) | 🟢 |
| `POST /api/admin/venues/[id]` | ✅ | ✅ | ✅ (admin role) | 🟢 |
| `POST /api/admin/venues/settle` | ✅ | ✅ | ✅ (admin role) | 🟢 |
| `POST /api/welcome` | ✅ | ✅ | ✅ (본인 profile만 수정) | 🟢 |
| `POST /api/profile/setup` | ✅ | ✅ | ✅ (본인 profile만 수정) | 🟢 |
| `POST /api/webhooks/tosspayments` | ❌ (외부) | ❌ (미들웨어 제외) | ❌ (서명 미검증) | 🟡 |
| `GET /api/cron/meeting-remind` | ❌ (서버) | ✅ (CRON_SECRET) | N/A | 🟢 |
| `GET /api/cron/waitlist-refund` | ❌ (서버) | ✅ (CRON_SECRET) | N/A | 🟢 |
| `(admin) layout` | ✅ | ✅ | ✅ (admin/editor role) | 🟢 |
| `/policy/*` 페이지 | ❌ | ❌ (의도적) | N/A | 🟢 |

### 데이터 노출 분석

| 노출 항목 | 위치 | 심각도 |
|----------|------|--------|
| Supabase URL (NEXT_PUBLIC) | 클라이언트 번들 | 🔵 (의도된 공개값, RLS로 보호) |
| Supabase Anon Key (NEXT_PUBLIC) | 클라이언트 번들 | 🔵 (의도된 공개값, RLS로 보호) |
| TossPayments Client Key (NEXT_PUBLIC) | 클라이언트 번들 | 🔵 (의도된 공개값) |
| TossPayments Secret Key | 서버 전용 (`tosspayments.ts`) | 🟢 (노출 없음) |
| Supabase Service Role Key | 서버 전용 (`admin.ts`) | 🟢 (노출 없음) |
| `.env*.local` | `.gitignore`에서 제외 | 🟢 |
| Supabase DB 에러 메시지 | admin API 4개 응답 | 🟡 (admin 인증 필요) |

### 체크리스트 결과

- [x] SQL/NoSQL 인젝션 가능한 입력 지점이 없는가 — Supabase SDK 사용, raw SQL 없음
- [x] XSS 가능한 사용자 입력 렌더링이 없는가 — React JSX 이스케이프, `dangerouslySetInnerHTML`은 검증된 환경변수만
- [x] CSRF 방어가 적용되어 있는가 — SameSite=Lax 쿠키 기본 동작으로 방어 (확인 필요: 운영 환경 쿠키 속성)
- [x] API 키/시크릿이 클라이언트 코드에 노출되어 있지 않은가 — Secret Key/Service Role Key 서버 전용
- [x] 환경변수 파일이 버전 관리에서 제외되어 있는가 — `.gitignore` 확인 완료
- [x] 데이터베이스 행 단위 접근 제어가 적용되어 있는가 — RLS 활성화, 정책 적용
- [x] 접근 제어 정책이 실제로 다른 사용자 데이터 접근을 차단하는가 — `registrations_select_own` + `profiles_select_own` 정책, cancel/waitlist-cancel에서 userId 매칭
- [ ] 인증 토큰 만료 시간이 적절한가 — 코드에서 확인 불가, Supabase 대시보드 설정에 의존 (운영 환경 확인 필요)
- [x] 금전 거래 금액이 서버 사이드에서 검증되는가 — `payment.ts:52`에서 `amount !== meeting.fee` 검증
- [ ] 결제 게이트웨이 웹훅 서명 검증이 구현되어 있는가 — **미구현** (`getPayment()`으로 대체)
- [ ] 로그인/결제/민감 API에 Rate limiting이 적용되어 있는가 — **미구현**
- [ ] CORS 설정이 허용된 도메인만 포함하는가 — 별도 CORS 설정 없음 (Next.js API Routes는 same-origin만 기본 허용)
- [ ] 보안 관련 HTTP 헤더가 설정되어 있는가 — **미설정** (next.config.ts 비어 있음)
- [x] 에러 메시지가 내부 구현 정보를 노출하지 않는가 — admin API 4개에서 `error.message` 노출 (admin 전용)
- [x] 파일 업로드가 있으면 파일 타입/크기 검증이 있는가 — 파일 업로드 기능 없음

---

### 종합 판정: 🟡 조건부 통과

**판정 사유**: 핵심 결제 흐름(금액 서버 검증, 정원 원자적 체크, 소유권 검증)은 견고하나, rate limiting 전무 + security headers 미설정 + 계좌이체 정원 점유 남용 가능성이 서비스 가용성 위협 요인이다. 웹훅 서명 미검증은 `getPayment()` 대체로 실질 위험이 낮지만 모범 사례에 미달한다.

**우선 조치 권고 (공격자 관점 위험 순서)**:
1. `next.config.ts`에 `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` 헤더 추가
2. 웹훅, 결제, 취소 API에 기본 rate limiting 도입 (Vercel Edge Middleware 또는 Upstash Redis)
3. `pending_transfer` 자동 만료 로직 추가 (예: 24시간 미입금 시 자동 취소)
4. `mark-refunded` API에 `refundedAmount` 범위 검증 추가 (`0 <= refundedAmount <= paid_amount`)
5. Admin API의 `error.message` 노출 제거 — 제네릭 메시지로 대체
