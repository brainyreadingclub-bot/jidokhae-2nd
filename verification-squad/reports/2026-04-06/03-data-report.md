# 데이터 무결성 보고서

**검증 대상**: `jidokhae-web/` 전체 (API Routes, DB Functions, 비즈니스 로직, 마이그레이션)
**검증 일시**: 2026-04-06
**프로젝트**: JIDOKHAE 2nd (지독해 — 독서 모임 웹서비스)

---

## 프로필 기반 파악 사항

- **데이터베이스**: PostgreSQL (Supabase 호스팅), RLS 적용
- **외부 서비스**: TossPayments (결제/환불), Solapi (KakaoTalk 알림톡)
- **금전 거래**: 있음 (TossPayments 카드 결제 + 계좌이체 브릿지)
- **핵심 데이터 엔티티**: profiles, meetings, registrations, notifications, site_settings, venues, venue_settlements
- **추가 감지 사항**:
  - `pending_transfer` 상태 및 `payment_method` 컬럼 추가 (계좌이체 브릿지 — `feature/bank-transfer` 브랜치)
  - `register_transfer()` 새 RPC 함수
  - `confirm-transfer`, `mark-refunded` 새 관리자 API 라우트
  - `migration-bank-transfer*.sql` 3개 파일 (미적용 상태 추정)

---

## 동시성 위험 분석

| # | 시나리오 | 위험도 | 현재 보호 수단 | 권장 조치 |
|---|----------|--------|---------------|----------|
| C1 | 동일 사용자가 같은 모임에 동시 신청 (카드+카드) | **Info** | `confirm_registration()` RPC에서 FOR UPDATE 락 + 중복 체크. payment_id 멱등성 Layer 1 | 현재 보호 충분 |
| C2 | 동일 사용자가 같은 모임에 카드+계좌이체 동시 신청 | **Warning** | `confirm_registration()`과 `register_transfer()`가 동일한 중복 체크 사용 (status IN confirmed/waitlisted/pending_transfer) + FOR UPDATE 락 | PostgreSQL 트랜잭션 직렬화로 보호되나, 두 RPC가 별도 트랜잭션으로 실행 시 극미한 TOCTOU 가능성. 실제 위험은 낮음 (동일 사용자 동시 액션은 UI 수준에서 차단) |
| C3 | 두 사용자가 마지막 1석에 동시 신청 | **Info** | FOR UPDATE 락이 meetings 행을 잠그므로 직렬화됨. 하나는 confirmed, 나머지는 waitlisted | 현재 보호 충분 |
| C4 | 사용자 취소와 대기자 승격의 동시 발생 | **Warning** | cancel API에서 DB 업데이트 후 `promoteNextWaitlisted()` 호출. promote 함수도 FOR UPDATE 사용. 그러나 cancel의 DB 업데이트와 promote 호출 사이에 다른 취소가 끼면 2명 승격 가능성 | promote 함수 내부에서 confirmed 수 < capacity 체크가 있어 초과 승격은 차단됨. **단, `pending_transfer`도 카운트에 포함하므로 안전** |
| C5 | 동시 취소 요청 (같은 registration) | **Info** | `.eq('status', 'confirmed')` optimistic lock — 두 번째 요청은 0-row update로 `already_cancelled` 반환 | 현재 보호 충분 |
| C6 | Cron 환불과 사용자 대기 취소 동시 발생 | **Warning** | 둘 다 `.eq('status', 'waitlisted')` optimistic lock 사용. TossPayments 환불은 한쪽만 성공. 그러나 **둘 다 TossPayments cancelPayment를 호출한 후 DB 업데이트 시도** 가능 | TossPayments는 이미 취소된 결제에 대해 에러 반환 → catch에서 getPayment 확인 → `CANCELED`면 진행. DB는 optimistic lock으로 한쪽만 성공. **이중 환불 위험 없음** |
| C7 | admin confirm-transfer와 사용자 cancel이 동시 발생 (pending_transfer 건) | **Critical** | `confirm-transfer`는 `.eq('status', 'pending_transfer')`로 업데이트, cancel은 `.eq('status', reg.status)`로 업데이트. 그러나 cancel.ts에서 `reg.status`를 조회 시점에 읽고, TossPayments 호출 없이 바로 DB 업데이트. 두 요청 모두 성공할 수 없음 (optimistic lock). **하지만 cancel이 먼저 성공하면 confirm-transfer는 0-row → failed 반환, 문제 없음. confirm-transfer가 먼저 성공하면 cancel은 0-row → already_cancelled 반환, 문제 없음** | 실제로는 안전하나, confirm-transfer의 실패 시 사용자에게 명확한 피드백 필요 |
| C8 | 모임 삭제와 신규 신청이 동시 발생 | **Info** | 삭제 시 meeting status를 `deleting`으로 변경 → `confirm_registration()`이 `not_active` 반환 | 현재 보호 충분 |

---

## 트랜잭션 실패 시나리오

| # | 작업 흐름 | 실패 지점 | 실패 시 데이터 상태 | 복구 가능 여부 |
|---|-----------|----------|-------------------|--------------|
| T1 | 결제 확인 (카드) | TossPayments confirmPayment 성공 후, DB RPC 실패 | **돈은 빠졌으나 DB에 신청 기록 없음**. `safeCancel()`로 즉시 환불 시도 | **Warning** — safeCancel 실패 시 돈만 빠진 상태. TossPayments에서 미확인 결제는 자동 취소되지 않음 (이미 confirm된 상태). 수동 환불 필요 |
| T2 | 결제 확인 (카드) | DB RPC 성공 후 registrationId 조회 실패 | 신청은 정상 등록됨. registrationId가 빈 문자열로 반환 | **Info** — 데이터 손실 없음. 알림톡이 registrationId 없이 호출될 수 있으나 핵심 데이터 무결 |
| T3 | 사용자 취소 (카드) | TossPayments cancelPayment 성공 후, DB 업데이트 실패 | **환불은 되었으나 DB status는 여전히 confirmed** | **Critical** — 사용자는 환불받았으나 시스템은 신청 유지로 표시. 사용자가 재시도하면 TossPayments에서 이미 취소 → getPayment CANCELED → DB 업데이트 진행 (복구됨). **그러나 재시도하지 않으면 불일치 지속** |
| T4 | 사용자 취소 (카드) | TossPayments cancelPayment 성공 후, DB 업데이트 성공 후, promoteNextWaitlisted 실패 | 취소는 완료되었으나 대기자 승격 안 됨. **빈 자리가 채워지지 않음** | **Warning** — 데이터 정합성은 유지 (취소 자체는 정상). 대기자 승격 누락은 다음 취소 시에도 복구되지 않음. 수동 승격 또는 별도 복구 메커니즘 필요 |
| T5 | 대기자 취소 (카드) | TossPayments cancelPayment 성공 후, DB 업데이트 실패 | **환불은 되었으나 DB status는 여전히 waitlisted** | **Critical** — T3과 동일 패턴. Cron이 다음 날 이 건을 다시 환불 시도 → TossPayments에서 이미 CANCELED → getPayment 확인 → DB 업데이트. **Cron catch-up이 사실상 자동 복구 역할** (단, 카드 결제건에 한해) |
| T6 | Cron 대기 환불 | TossPayments cancelPayment 성공 후, DB 업데이트 실패 | 환불은 되었으나 DB는 waitlisted 유지 | **Warning** — 다음 날 Cron이 catch-up 쿼리로 재시도. TossPayments 이미 CANCELED → DB 업데이트 성공. **자동 복구됨** |
| T7 | 모임 삭제 일괄 환불 | N건 중 일부 환불 성공, 일부 실패 | meeting은 `deleting` 상태 유지. 성공한 건은 cancelled/waitlist_refunded, 실패한 건은 원래 상태 유지 | **Warning** — 재시도 가능 (deleting 상태에서 재삭제 허용). 하지만 **이미 환불 성공 + DB 업데이트 실패인 건은 재시도 시 TossPayments CANCELED 확인 → DB 업데이트로 복구** |
| T8 | 계좌이체 취소 (transfer) | DB 업데이트 실패 | cancel.ts에서 transfer는 TossPayments 호출 없이 DB만 업데이트. 실패 시 원래 상태 유지 | **Info** — 재시도 가능. 돈 관련 외부 호출 없으므로 불일치 없음 |
| T9 | confirm-transfer (관리자 입금 확인) | 일부 ID만 업데이트 성공 | 각 registrationId를 개별 업데이트. 성공한 건은 confirmed, 실패한 건은 pending_transfer 유지 | **Info** — 부분 실패 시 failed 카운트 반환. 재시도 가능 |
| T10 | Webhook 결제 확인 | RPC 실패 시 | Webhook에서는 `safeCancel` 미호출. RPC 에러 시 단순 `{ status: 'ok' }` 반환 | **Critical** — **TossPayments에서 결제 확인 + Webhook RPC 실패 시, 돈은 빠졌으나 DB 기록 없고 환불도 안 됨**. redirect 경로가 정상 처리했다면 멱등성으로 보호되나, redirect도 실패한 상태에서 webhook RPC가 실패하면 **돈만 빠진 고아 결제** 발생 |

---

## 외부 서비스 장애 시 데이터 정합성 영향

| 서비스 | 장애 시 데이터 상태 | 재시도 로직 | 멱등성 | 데이터 손실 위험 |
|--------|-------------------|-----------|--------|----------------|
| **TossPayments — confirmPayment** | 결제 실패 → 신청 미생성. 타임아웃 시 결제 상태 불확실 | 없음 (사용자 재시도 필요). Webhook이 백업 역할 | confirmPayment 자체는 멱등 (TossPayments 서버 측) | **Warning** — 타임아웃 시 결제됐는지 알 수 없음. Webhook이 백업이나, T10 취약점 존재 |
| **TossPayments — cancelPayment** | 환불 실패 → DB status 유지 (confirmed/waitlisted). 사용자에게 에러 반환 | 사용자 재시도. Cron catch-up (waitlisted만) | TossPayments 측 멱등. 코드에서도 getPayment로 이미 CANCELED 확인 | **Info** — 재시도로 복구 가능 |
| **TossPayments — getPayment** | 조회 실패 → cancelPayment catch 내에서 getPayment도 실패 → 에러 반환 | 없음 | 읽기 전용 | **Info** — 데이터 변경 없음, 사용자에게 재시도 안내 |
| **Solapi (알림톡)** | 발송 실패 → notifications 테이블에 `failed` 기록 | 없음 (fire-and-forget). 재발송 메커니즘 없음 | INSERT pending → UNIQUE INDEX로 중복 차단 | **Info** — 알림 누락이지 데이터 손실 아님. 결제/신청 흐름에 영향 없음 |
| **Supabase DB** | DB 장애 → 모든 API 실패 | 없음 | DB 함수 내 FOR UPDATE 직렬화 | **Critical** — DB 장애 중 TossPayments 결제만 성공한 경우 고아 결제. 단, TossPayments 미확인 결제는 일정 시간 후 자동 취소됨 (confirm 전이면). confirm 후 DB 장애는 T1/T10 시나리오 |
| **Vercel Cron** | Cron 미실행 → 대기자 환불 지연, 리마인드 미발송 | catch-up 쿼리 (`date <= tomorrow`)가 다음 날 누락분 포함 처리 | 대기 환불: optimistic lock + TossPayments 상태 확인. 리마인드: UNIQUE INDEX | **Info** — 지연은 있으나 데이터 손실 없음 |

---

## 식별된 결함 상세

### [Critical] F1: Webhook RPC 실패 시 환불 누락

**위치**: `src/app/api/webhooks/tosspayments/route.ts` 88~95행

**문제**: Webhook에서 `confirm_registration` RPC가 에러를 반환하거나 실패해도, redirect 경로의 `safeCancel()` 같은 환불 시도가 없다. RPC 에러 시 `{ status: 'ok' }` 200을 반환할 뿐이다.

```typescript
const { data: result } = await supabase.rpc('confirm_registration', { ... })
// rpcError 체크 없음 — data가 null이면 result도 null
const rpcResult = result as string
// rpcResult가 null이면 아래 모든 if문 통과 → 마지막 return { status: 'ok' }
```

**실패 시 데이터 상태**: TossPayments에서 결제 DONE 확인 완료 (돈은 빠짐) + DB에 registration 미생성 + 환불 미시도 = **고아 결제**.

**발생 조건**: redirect 경로 실패 + webhook RPC도 실패 (DB 일시 장애, 네트워크 등).

**권장 조치**: Webhook에서도 RPC 실패 시 `cancelPayment()`을 호출하거나, 최소한 에러 로깅 + 재시도 큐 도입. 또는 `rpcError` 체크 추가 후 환불 처리.

---

### [Critical] F2: 사용자 취소 시 환불 성공 + DB 실패 = 불일치

**위치**: `src/lib/cancel.ts` 78~133행

**문제**: TossPayments `cancelPayment()` 성공 후 DB 업데이트가 실패하면, 사용자는 환불받았으나 DB에는 `confirmed`로 남음. 사용자가 재시도하면 자동 복구되나 (getPayment CANCELED 확인 후 DB 업데이트), **재시도하지 않으면 불일치 지속**.

**실패 시 데이터 상태**: 돈은 환불됨 + DB status = confirmed + refunded_amount 미기록. 운영자 관점에서 유효한 신청으로 보임.

**영향**: 모임 참석자 수 과다 집계. 해당 자리에 대기자 승격 미발생.

**권장 조치**: DB 업데이트 실패 시 별도 recovery 테이블에 기록하거나, 주기적으로 TossPayments 결제 상태와 DB status를 대사(reconciliation)하는 배치 작업 도입.

---

### [Warning] F3: 대기자 승격 실패 시 빈 자리 미복구

**위치**: `src/app/api/registrations/cancel/route.ts` 56~63행

**문제**: `promoteNextWaitlisted()` 실패 시 catch만 하고 로그만 남김. 해당 빈 자리는 다음 취소가 발생할 때까지 영구적으로 비어 있게 됨. **별도 복구 메커니즘이 없음**.

**실패 시 데이터 상태**: 취소는 정상 완료. 정원에 빈 자리 존재하나 대기자는 여전히 waitlisted.

**권장 조치**: 승격 실패 건을 별도 큐/테이블에 기록하고, Cron 등으로 주기적 재시도. 또는 관리자 대시보드에서 "미승격 대기자" 알림 표시.

---

### [Warning] F4: mark-refunded API에 status 체크 없음

**위치**: `src/app/api/admin/registrations/mark-refunded/route.ts` 63~67행

**문제**: `refunded_amount`를 업데이트할 때 registration의 status 체크가 없다. `.eq('id', registrationId)`만으로 업데이트하므로, **어떤 상태의 registration이든 환불 금액을 기록할 수 있다**. confirmed 상태에서 실수로 환불 기록을 남기거나, 이미 완전 환불된 건에 중복 기록 가능.

```typescript
const { error } = await admin
  .from('registrations')
  .update({ refunded_amount: refundedAmount })
  .eq('id', registrationId)
  // status 체크 없음!
```

**권장 조치**: `.in('status', ['cancelled'])` 같은 상태 필터 추가. 또는 `refunded_amount`가 `paid_amount`를 초과하지 않도록 서버 측 검증.

---

### [Warning] F5: 계좌이체 대기자 Cron 환불 시 refunded_amount = 0 설정

**위치**: `src/app/api/cron/waitlist-refund/route.ts` 49~59행

**문제**: 계좌이체 대기자의 Cron 환불 시 `refunded_amount: 0`으로 설정한다. 이는 "환불할 금액이 0"이라는 의미인데, 실제로는 **운영자가 수동으로 환불해야 하는 금액이 존재**한다. 카드 결제 건은 `refunded_amount: reg.paid_amount`로 실제 환불 금액이 기록되는 반면, 계좌이체는 0으로 고정.

**데이터 상태**: status = `waitlist_refunded`, refunded_amount = 0. 운영자가 실제 환불했는지 추적 불가.

**권장 조치**: 계좌이체 건은 `refunded_amount: null` (미환불)로 설정하고, mark-refunded API로 실제 환불 후 기록하는 패턴 적용. 또는 cancel_type으로 구분 가능하므로 현행 유지 + 운영자 대시보드에서 명확히 표시.

---

### [Warning] F6: 모임 삭제 시 계좌이체 confirmed 건의 refunded_amount = null

**위치**: `src/app/api/meetings/[id]/delete/route.ts` 99~111행

**문제**: 계좌이체(transfer) + confirmed 건의 삭제 환불 시 `refunded_amount: null`로 설정. 운영자가 수동 환불해야 하는데, `null`과 "환불 불필요"를 구분하기 어렵다. pending_transfer는 `refunded_amount: 0` (미입금이므로 환불 불필요), confirmed는 `null` (수동 환불 대기).

**데이터 상태**: 의미는 올바르나 (null = 미환불), 쿼리로 "운영자 수동 환불 대기 건"을 뽑기 위해 `WHERE payment_method = 'transfer' AND status = 'cancelled' AND refunded_amount IS NULL` 같은 복합 조건 필요.

**권장 조치**: 데이터 설계는 일관되나, 운영자 대시보드에서 미환불 건 목록을 제공하는 기능 추가 권장.

---

### [Info] F7: `new Date().toISOString()` 직접 사용

**위치**: `cancel.ts`, `waitlist.ts`, `delete/route.ts`, `waitlist-refund/route.ts` 등 다수

**문제**: KST 유틸리티 사용 원칙과 달리 `cancelled_at` 기록 시 `new Date().toISOString()`을 직접 사용. `cancelled_at`은 TIMESTAMPTZ 타입이므로 UTC 저장은 기술적으로 올바르나, 코드 컨벤션(`never new Date() directly`) 위반.

**권장 조치**: `cancelled_at` 같은 timestamp 필드는 DB `now()` DEFAULT 활용 또는 최소한 코드 컨벤션 예외를 명시적으로 문서화.

---

### [Info] F8: Webhook orderId 파싱의 UUID 충돌 가능성

**위치**: `src/app/api/webhooks/tosspayments/route.ts` 62~77행

**문제**: orderId에서 UUID의 앞 8자리만 추출 후 `LIKE '{8chars}%'`로 조회. UUID v4의 앞 8자는 hex 32비트로 약 43억 조합이므로, 250명 규모에서 충돌 확률은 무시할 수준이나, 이론적으로 다른 사용자/모임이 같은 prefix를 가질 수 있다.

**권장 조치**: 현재 규모에서 실질적 위험 없음. 규모 확장 시 orderId에 full UUID 포함 검토.

---

## 데이터 삭제 안전성

| 삭제 대상 | 삭제 방식 | 안전성 |
|-----------|----------|--------|
| Meeting | soft delete (status → deleted) | **안전** — 물리 삭제 없음, 복구 가능 |
| Registration | soft delete (status 변경) | **안전** — 물리 삭제 없음 |
| Profile | CASCADE (auth.users 삭제 시) | **Warning** — profiles, registrations 모두 CASCADE 삭제. Supabase Auth에서 사용자 삭제 시 연쇄 삭제 발생. 결제 이력도 삭제됨 |
| Venue | 물리 삭제 API 없음 (status만 변경) | **안전** |
| Notification | 물리 삭제 API 없음 | **안전** |

---

## 마이그레이션 안전성

| 마이그레이션 파일 | 위험도 | 분석 |
|------------------|--------|------|
| `migration-bank-transfer.sql` | **Warning** | `ALTER TABLE ADD COLUMN ... NOT NULL DEFAULT 'card'` — 기존 행에 기본값 적용. `DROP CONSTRAINT` 후 재생성은 원자적이지 않으므로, 중간에 실패 시 CHECK 제약 없는 상태 가능. SQL Editor에서 수동 실행이므로 트랜잭션 제어 가능 |
| `migration-bank-transfer-functions.sql` | **Info** | `CREATE OR REPLACE FUNCTION` — 기존 함수 교체. 배포 중 잠시 이전 버전 실행 가능하나 결과는 호환됨 |
| `migration-bank-transfer-settings.sql` | **Info** | `ON CONFLICT DO UPDATE` — 멱등. 안전 |
| DDL + FUNCTION 분리 | **Info** | 3파일 순서 실행 필요. 문서에 실행 순서 명시됨 |

---

## 백업/복구 상태

- **백업 설정**: Supabase 호스팅 기본 자동 백업 (Pro 플랜: 매일, Free: 없음). 현재 플랜 불명
- **백업 주기**: Supabase 기본 정책 의존
- **마지막 복구 테스트**: 미실시 (추정)
- **Point-in-Time Recovery**: Supabase Pro 플랜에서만 지원
- **TossPayments 결제 대사**: 없음 — DB와 TossPayments 간 정기 reconciliation 미구현
- **수동 복구 도구**: 없음 — 불일치 발생 시 Supabase SQL Editor에서 수동 조치 필요

---

## 종합 판정: 🟡 조건부 통과

**판정 사유**: 핵심 동시성 보호(FOR UPDATE 락, optimistic lock)가 잘 구현되어 있으나, TossPayments 결제 성공 후 DB 실패 시 자동 복구 메커니즘 부재(F1, F2)가 금전 불일치로 이어질 수 있다. 250명 규모 서비스 특성상 발생 확률은 낮으나, 발생 시 수동 개입이 필요하다.

**우선 조치 항목**:
1. **(Critical) F1**: Webhook RPC 실패 시 cancelPayment 호출 또는 에러 반환 추가
2. **(Critical) F2**: TossPayments-DB 간 정기 대사(reconciliation) 배치 도입 또는 실패 건 recovery 테이블 기록
3. **(Warning) F3**: 승격 실패 건 재시도 메커니즘 도입
4. **(Warning) F4**: mark-refunded API에 status 체크 추가
