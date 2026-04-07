## 로직 감사 보고서

**검증 대상**: `jidokhae-web/src/` 전체 (API Routes, lib, components, types)
**검증 일시**: 2026-04-06
**프로젝트**: JIDOKHAE 2nd (지독해 -- 독서 모임 웹서비스)
**요구사항 문서**: 미제공

### 프로필 기반 파악 사항
- 기술 스택: Next.js 16.1.6 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL + Auth + RLS), TossPayments REST API + SDK, Solapi SDK, Vercel (배포 + Cron), Vercel Analytics, GA4
- 추가 감지된 스택: 없음 (프로필에 기술된 스택과 코드에서 발견된 스택 일치)
- 프로필 정보 부족 항목: 없음

### 요구사항 대조 결과

요구사항 문서 미제공으로 대조 검증 범위 제한됨. 코드 자체 결함 분석만 수행.

### 발견된 문제

#### 🔴 Critical (배포 차단)

- **C-1. TossPayments 웹훅 서명 검증 누락**
- **위치**: `src/app/api/webhooks/tosspayments/route.ts` (전체 파일)
- **시나리오**: 프로필의 기술 결정에 "Webhook backup -- Signature verification required"로 명시되어 있으나, 코드에 서명 검증 로직이 전혀 없다. `POST` 요청의 body를 그대로 신뢰하고, `paymentKey`로 TossPayments API를 호출하여 결제 상태를 확인하지만, 위조된 `paymentKey + orderId` 조합으로 공격 가능하다.
- **영향**: 외부 공격자가 웹훅 엔드포인트에 위조 요청을 보내 임의 사용자를 모임에 등록시키거나, `orderId` 형식을 조작하여 의도치 않은 사용자/모임 매칭을 유발할 수 있다. 다만 `getPayment(paymentKey)` 호출로 실제 결제 여부를 확인하므로, 결제 없는 등록은 불가하나, 이미 결제 완료 건의 paymentKey를 알고 있는 경우 재시도 공격이 가능하다 (idempotency 체크로 1차 방어되나, 서명 검증이 근본 해결책).

---

- **C-2. 웹훅 RPC 에러 시 결제 미환��**
- **위치**: `src/app/api/webhooks/tosspayments/route.ts:88-95`
- **시��리오**: 웹훅에서 `confirm_registration` RPC 호출 시 에러가 발생하면 (line 88의 `data`가 null), `rpcResult`가 `null as string`이 되어 어떤 조건분기에도 매칭되지 않고, line 137에서 `{ status: 'ok' }`를 반환한다. 결제는 이미 TossPayments에서 승인(`DONE`)된 상태이지만, DB에 등록이 안 되고 환불도 안 된다.
- **영향**: 사용자의 돈이 빠져나갔으나 등록이 누락되고 환불도 되지 않는 상황 발생 가능. 결제는 완료되었으나 서비스 미제공 상태.

---

- **C-3. attendance API -- body 파싱 try-catch 누락**
- **위치**: `src/app/api/registrations/attendance/route.ts:50`
- **시나리오**: `const body = await request.json()`에 try-catch가 없다. 잘못된 JSON body가 전송되면 unhandled exception이 발생하여 500 에러를 반환한다. 동일 파일의 다른 API 라우트들은 모두 try-catch로 감싸고 있어 일관성 위반이다.
- **영향**: 비정상 요청 시 사용자에게 불친절한 에러 메시지 반환. 로그에 불필요한 에러 스택 기록.

#### 🟡 Warning (배포 가능하나 수정 권장)

- **W-1. `cancelled_at`에 `new Date().toISOString()` 사용 -- UTC 타임스탬프**
- **위치**: `src/lib/cancel.ts:60,116`, `src/lib/waitlist.ts:108`, `src/app/api/cron/waitlist-refund/route.ts:55,82`, `src/app/api/meetings/[id]/delete/route.ts:107,137`
- **시나리오**: 프로필에 "모든 date 계산은 KST, never `new Date()` directly"라 되어 있으나 `cancelled_at`, `sent_at`, `welcomed_at`, `profile_completed_at` 등에 `new Date().toISOString()`을 사용한다. `toISOString()`은 UTC 시각을 반환하므로 DB에 UTC로 저장된다. Supabase가 `timestamptz` 컬럼이면 문제없지만, `timestamp` (without time zone) 컬럼이면 9시간 차이가 발생한다.
- **영향**: 코드에서 확인 불가, 운영 환경 확인 필요. DB 컬럼이 `timestamptz`라면 문제없음. `timestamp`라면 취소 시각, 알림 발송 시각 등이 9시간 차이로 기록됨.

---

- **W-2. `calculateRefund` 함수의 날짜 파싱 -- 로컬 타임존 의존**
- **위치**: `src/lib/refund.ts:44-45`
- **시나리오**: `new Date(meetingDate + 'T00:00:00')` 형식은 타임존 오프셋이 없어 브라우저/서버의 로컬 타임존으로 해석된다. 서버(Vercel)가 UTC 기준이고 클라이언트(한국)가 KST 기준이므로, 동일 날짜에 대해 서버와 클라이언트가 다른 daysRemaining을 계산할 수 있다. 단, 양쪽 모두 동일한 형식을 사용하므로 `meetingMs - todayMs`의 차이는 동일하다 (둘 다 같은 타임존으로 파싱되므로). 실질적 문제가 되려면 서버와 클라이언트에서 서로 다른 `kstToday` 값이 전달되어야 한다.
- **영향**: 현재 서버 경로(`processUserCancel`)에서는 `getKSTToday()`로 주입하므로 문제없음. 클라이언트 경로(`MeetingActionButton`)에서는 `calculateRefund(meetingDate, paidAmount)`로 `kstToday` 생략 시 내부에서 `getKSTToday()`를 호출하므로 역시 문제없음. 다만 `new Date('...')` without timezone offset 파싱 자체는 불안정한 패턴이므로 주의 필요.

---

- **W-3. 모임 삭제 시 `pending_transfer` + `waitlisted` (계좌이체)의 `refunded_amount` 불일치**
- **위치**: `src/app/api/meetings/[id]/delete/route.ts:99-111`
- **시나리오**: 계좌이체 + `waitlisted` 상태에서 모임 삭제 시 `refunded_amount: isPending ? 0 : null`로 설정되는데, `isWaitlisted`가 true이면 `isPending`은 false이므로 `refunded_amount`가 `null`이 된다. 그러나 대기 취소(`waitlist.ts:107`)에서는 `refunded_amount: paidAmount`로 설정한다. 계좌이체 waitlisted의 경우, 모임 삭제로 인한 자동 환불 시 `refunded_amount`가 `null`인 것이 운영자 수동 환불 대기를 의미하는지, 아니면 환불 불필요(미입금)를 의미하는지 모호하다.
- **영향**: 계좌이체 대기자의 모임 삭제 시 운영자가 환불 대상을 파악하기 어려울 수 있음.

---

- **W-4. 웹훅 orderId 파싱에서 하이픈 포함 가능성**
- **위치**: `src/app/api/webhooks/tosspayments/route.ts:56-63`
- **시나리오**: orderId 형식이 `jdkh-{meetingId8}-{userId8}-{timestamp}`이고, `parts.length < 4` 검증을 한다. 그러나 timestamp에 하이픈이 포함될 경우(현재 `Date.now()`를 사용하므로 불가) `parts` 배열의 길이가 달라질 수 있다. 현재 구현에서는 `Date.now()`가 숫자만 반환하므로 문제없으나, orderId 생성 로직 변경 시 파싱 실패 가능.
- **영향**: 현재는 문제없음. orderId 생성 로직 변경 시 주의 필요.

---

- **W-5. `mark-refunded` API에 환불 금액 음수/비정상 값 검증 누락**
- **위치**: `src/app/api/admin/registrations/mark-refunded/route.ts:55-61`
- **시나리오**: `refundedAmount`에 대해 `undefined` 체크만 수행하고, 음수이거나 `paid_amount`를 초과하는 값, 또는 문자열이 입력되어도 그대로 DB에 저장된다. `refundedAmount === undefined`만 체크하므로 `null`, `NaN`, 음수 등도 통과한다.
- **영향**: admin 전용 API이므로 외부 공격 가능성은 낮으나, UI 버그로 비정상 값이 전송되면 DB에 잘못된 환불 금액이 기록됨.

---

- **W-6. 대기자 자동 환불 크론에서 계좌이체 waitlisted에 알림톡 미발송**
- **위치**: `src/app/api/cron/waitlist-refund/route.ts:48-61`
- **시나리오**: 계좌이체(`payment_method === 'transfer'`) 대기자의 자동 환불 시, DB 업데이트 후 `continue`로 넘어가서 `sendWaitlistRefundedNotification` 호출을 건너뛴다 (line 59에서 `continue`). 일반 결제 대기자는 알림톡을 받지만, 계좌이체 대기자는 미승격 환불 알림을 받지 못한다.
- **영향**: 계좌이체 대기 사용자가 미승격 환불 사실을 통보받지 못함. 단, 프로필에 "계좌이체는 Phase 1에서 알림톡 미발송"이라는 언급이 있어 의도적일 수 있음.

---

- **W-7. 모임 삭제 시 deleting 상태 전환의 zero-row 업데이트 미검증**
- **위치**: `src/app/api/meetings/[id]/delete/route.ts:59-69`
- **시나리오**: `status`를 `deleting`으로 변경할 때, `.in('status', ['active', 'deleting'])` 필터를 사용하지만, 반환된 결과에서 실제 업데이트된 행 수를 확인하지 않는다. 이미 `deleted` 상태인 모임에 대해 삭제를 시도하면 `statusError`가 없으므로 계속 진행하여, 등록이 없는 경우 다시 `deleted`로 설정하는 무의미한 작업을 수행한다.
- **영향**: 이미 삭제된 모임에 대해 불필요한 쿼리 실행. 기능적 결함은 아님.

#### 🔵 Info (참고 사항)

- **I-1. `new Date().toISOString()` 사용 위치가 많으나 기능적 결함은 아님**
- **위치**: 13곳 (cancel.ts, waitlist.ts, notification.ts, cron routes, admin routes 등)
- **시나리오**: 프로필에서 "`new Date()` directly 사용 금지"라 되어 있으나, 이는 날짜 비교/계산 맥락에서의 규칙이다. `cancelled_at`, `sent_at` 등 타임스탬프 기록 용도에서는 `toISOString()`이 UTC 타임스탬프를 반환하며, Supabase `timestamptz` 컬럼과 호환된다. 다만 일관성 측면에서 확인 필요.

---

- **I-2. `formatFee`에 음수/NaN 입력 처리 없음**
- **위치**: `src/lib/kst.ts:59-61`
- **시나��오**: `fee.toLocaleString('ko-KR')`은 NaN 입력 시 `"NaN"` 문자열을 반환한다. 음수 입력 시 `-10,000`과 같은 형식을 반환한다. 현재 코드에서 `formatFee`에 음수나 NaN이 전달되는 경로는 확인되지 않으나, 방어적 처리가 없다.

---

- **I-3. `getWeekLater` 함수의 타임존 비의존 파싱**
- **위치**: `src/lib/kst.ts:91-97`
- **시나리오**: `new Date(dateStr + 'T00:00:00')` 형식으로 파싱하여 로컬 타임존에 의존한다. UTC 환경(Vercel)에서 사용되므로 KST 날짜 경계에서 1일 차이가 발생할 수 있다. 그러나 이 함수는 dashboard 집계(`getUpcomingMeetings`)에서만 사용되며, 1일 범위 오차는 대시보드 표시에 큰 영향을 미치지 않는다.

---

- **I-4. admin role 체크에서 editor 권한 불일치**
- **위치**: `src/app/api/admin/registrations/confirm-transfer/route.ts:38`, `src/app/api/admin/registrations/mark-refunded/route.ts:38`
- **시나리오**: 두 API 모두 `admin` 역할만 허용하고 `editor`는 거부한다. 반면 `attendance` API는 `admin` 또는 `editor`를 허용한다. 프로필에 "admin/editor role check"라 되어 있으나, 어떤 API가 admin 전용이고 어떤 것이 editor도 허용인지 명세가 없어, 의도적 설계인지 확인 필요.

---

- **I-5. Solapi SDK의 `send` 메서드 반환값 타입 미확인**
- **위치**: `src/lib/notification.ts:107`
- **시나리오**: `(result as any)?.groupId`로 Solapi 반환값에서 `groupId`를 추출한다. Solapi SDK v5의 실제 반환 구조가 `{ groupId: string }` 형식인지 코드에서 확인 불가. 잘못된 경우 `solapi_message_id`가 항상 `null`로 저장된다.
- **영향**: 알림 이력 추적에만 영향. 발송 자체에는 무관.

### 환각 API 검출 결과

| 호출 코드 | 위치 | 존재 여부 | 근거 |
|----------|------|----------|------|
| `loadTossPayments` | MeetingActionButton.tsx:92 | ✅ 확인됨 | `@tosspayments/payment-sdk` v1.x 공식 API |
| `tossPayments.requestPayment('카드', {...})` | MeetingActionButton.tsx:98 | ✅ 확인됨 | TossPayments SDK redirect 방식 |
| `SolapiMessageService` | solapi.ts:6 | ✅ 확인됨 | `solapi` v5.x 공식 클래스 |
| `messageService.send({...})` | solapi.ts:20-28 | ✅ 확인됨 | Solapi SDK 공식 메서드 |
| `createServerClient` | @supabase/ssr | ✅ 확인됨 | @supabase/ssr v0.9.x 공식 API |
| `createBrowserClient` | @supabase/ssr | ✅ 확인됨 | @supabase/ssr v0.9.x 공식 API |
| `createClient` | @supabase/supabase-js | ✅ 확인됨 | @supabase/supabase-js v2.x 공식 API |
| `supabase.rpc('confirm_registration', {...})` | payment.ts:69 | ✅ 확인됨 | DB 함수 `migration-bank-transfer-functions.sql`에 정의�� |
| `supabase.rpc('promote_next_waitlisted', {...})` | waitlist.ts:20 | ✅ 확인됨 | DB 함수 `migration-bank-transfer-functions.sql`에 정의됨 |
| `supabase.rpc('get_confirmed_counts', {...})` | MeetingDetailContent.tsx:28 | ✅ 확인됨 | DB 함수 `migration-bank-transfer-functions.sql`에 정��됨 |
| `supabase.rpc('register_transfer', {...})` | transfer/route.ts:73 | ��� 확인됨 | DB 함수 `migration-bank-transfer-functions.sql`에 정의됨 |
| `cache` from 'react' | auth.ts, profile.ts, meeting.ts, site-settings.ts | ✅ 확인됨 | React 19 서버 유틸리티 (React cache API) |
| `Intl.DateTimeFormat('en-CA', {...})` | kst.ts | ✅ 확��됨 | 표준 JavaScript API. `en-CA` 로캘은 YYYY-MM-DD 형식 반환 |
| `kakaoOptions` in Solapi send | solapi.ts:23 | ⚠️ 확인 필요 | Solapi v5 SDK에서 `kakaoOptions.variables` 필드의 정확한 구조는 SDK 문서에서 확인 필요. `pfId`, `templateId`, `variables` 필드명이 올바른지 코드에서 확인 불가 |

### 종합 판정: 🟡 조건부 통과

**판정 사유**: Critical 3건 중 C-1(웹훅 서명 검증 누락)은 보안 취약점이나 `getPayment()` 2차 검증으로 부분 완화됨. C-2(웹훅 RPC 에러 시 미환불)는 사용자 자금 안전성에 직접 영향을 미치며, 웹훅은 프런트엔드 redirect 실패 시의 백업 경로이므로 발생 빈도는 낮으나 발생 시 수동 복구가 필요함. C-3(attendance body 파싱)은 admin 전용 API로 영향 범위 제한적. Warning 7건은 엣지케이스 또는 운영 환경 의존적. 핵심 결제/취소/환불 흐름의 로직은 정확하며, 안전 패턴(idempotency, optimistic lock, safeCancel, Promise.allSettled)이 적절히 적용되어 있다.
