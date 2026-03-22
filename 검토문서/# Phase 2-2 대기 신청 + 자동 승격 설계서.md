# Phase 2-2: 대기 신청 + 자동 승격 — 설계서

> **B안 확정:** 대기 신청 시 미리 결제. 승격 시 자동 확정. 미승격 시 자동 전액 환불.
> **구현 주체: Claude Code**

---

## 확정된 설계 결정

| 결정 | 내용 |
|------|------|
| 결제 방식 | B안 — 대기 시 미리 결제, 승격 시 확정 |
| 대기 인원 제한 | 없음 |
| 자동 환불 시점 | 모임 전날 19:00 KST (리마인드 크론과 동시) |
| 대기 순번 | 회원에게 비공개 ("대기 중"으로만 표시), admin에게는 공개 |
| 대기 UI 위치 | 모임 상세 페이지 (기존 "마감" 대신 "대기 신청하기") |

---

## 현재 시스템 분석

### 현재 결제 플로우

```
[모임 상세] → [신청하기] → 토스 결제 → redirect/webhook
  → processPaymentConfirmation()
    → confirmPayment() (토스 승인, 돈 이동)
    → confirm_registration() RPC
      → FOR UPDATE 락
      → 정원 체크
      → 정원 미달: INSERT confirmed → return 'success'
      → 정원 초과: return 'full' → 결제 환불
```

### 현재 취소 플로우

```
[취소하기] → 환불 규칙 계산 → cancelPayment() (토스 환불)
  → registrations UPDATE (status='cancelled', cancel_type='user_cancelled')
```

### 현재 DB 스키마 (변경 대상)

```sql
registrations.status CHECK: ('confirmed', 'cancelled')
registrations.cancel_type CHECK: (NULL, 'user_cancelled', 'meeting_deleted')
```

---

## Phase 2-2 변경 후 전체 흐름

### 1. 대기 신청 (정원 초과 시)

```
[모임 상세: "대기 신청하기"] → 토스 결제 → redirect/webhook
  → processPaymentConfirmation()
    → confirmPayment() (토스 승인, 돈 이동)
    → confirm_registration() RPC (수정됨)
      → FOR UPDATE 락
      → 정원 체크
      → 정원 미달: INSERT confirmed → return 'success'      (기존과 동일)
      → 정원 초과: INSERT waitlisted → return 'waitlisted'  (신규)
```

**핵심 변경:** 정원 초과 시 환불하지 않고, `status='waitlisted'`로 INSERT 후 `'waitlisted'` 반환.

### 2. 취소 → 자동 승격

```
[확정자가 취소] → 환불 규칙 적용 환불 → status='cancelled'
  → ⭐ 대기자 승격 트리거
    → 같은 모임의 가장 오래된 waitlisted 조회
    → status = 'waitlisted' → 'confirmed'
    → "참여 확정됐어요!" 알림톡 발송
```

**승격은 취소 API Route에서 동기적으로 처리.** 크론이 아니라 취소 발생 즉시 승격.

### 3. 대기자가 직접 취소

```
[대기자가 "대기 취소"] → 항상 100% 전액 환불 → status='waitlist_cancelled'
```

**환불 규칙 적용 안 함.** 확정된 적 없는 대기 상태이므로 전액 환불이 공정.

### 4. 모임 전날 자동 환불 (크론)

```
매일 19:00 KST 크론
  ├── 내일 모임 확정자 → 리마인드 알림톡 (Phase 2-1)
  └── 내일 모임 대기자 → 전액 환불 + "승격되지 않았습니다" 알림톡 → status='waitlist_refunded'
```

**기존 meeting-remind 크론에 추가.** 새 크론 불필요.

### 5. 운영자 모임 삭제 시

```
기존: confirmed만 환불
변경: confirmed + waitlisted 모두 환불
  - confirmed: 100% 환불 (기존 로직 그대로)
  - waitlisted: 100% 환불
```

---

## DB 변경

### registrations 테이블 확장

```sql
-- status CHECK 확장
ALTER TABLE public.registrations DROP CONSTRAINT registrations_status_check;
ALTER TABLE public.registrations ADD CONSTRAINT registrations_status_check
  CHECK (status IN ('confirmed', 'cancelled', 'waitlisted', 'waitlist_cancelled', 'waitlist_refunded'));
```

**새 status 값:**

| status | 의미 |
|--------|------|
| `confirmed` | 결제 완료 + 참여 확정 (기존) |
| `cancelled` | 확정 후 취소됨 (기존) |
| `waitlisted` | 대기 신청 완료 (결제됨, 승격 대기 중) |
| `waitlist_cancelled` | 대기자가 직접 취소 (전액 환불) |
| `waitlist_refunded` | 크론에 의해 미승격 자동 환불 |

### cancel_type 확장 (선택적)

```sql
ALTER TABLE public.registrations DROP CONSTRAINT registrations_cancel_type_check;
ALTER TABLE public.registrations ADD CONSTRAINT registrations_cancel_type_check
  CHECK (cancel_type IN (NULL, 'user_cancelled', 'meeting_deleted', 'waitlist_user_cancelled', 'waitlist_auto_refunded'));
```

### 새 인덱스

```sql
-- 대기자 순번 조회용 (같은 모임의 waitlisted를 created_at 순으로)
CREATE INDEX idx_registrations_waitlist
  ON public.registrations(meeting_id, created_at)
  WHERE status = 'waitlisted';
```

---

## confirm_registration() RPC 수정

```sql
CREATE OR REPLACE FUNCTION public.confirm_registration(
  p_user_id UUID,
  p_meeting_id UUID,
  p_payment_id TEXT,
  p_paid_amount INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_capacity INTEGER;
  v_status TEXT;
  v_confirmed_count INTEGER;
  v_duplicate_count INTEGER;
BEGIN
  -- 1. Lock the meeting row
  SELECT capacity, status INTO v_capacity, v_status
  FROM public.meetings WHERE id = p_meeting_id FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_status <> 'active' THEN RETURN 'not_active'; END IF;

  -- 2. 중복 체크 (confirmed OR waitlisted)
  SELECT COUNT(*) INTO v_duplicate_count
  FROM public.registrations
  WHERE user_id = p_user_id
    AND meeting_id = p_meeting_id
    AND status IN ('confirmed', 'waitlisted');

  IF v_duplicate_count > 0 THEN RETURN 'already_registered'; END IF;

  -- 3. 정원 체크
  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND status = 'confirmed';

  -- 4. 정원 미달 → confirmed, 초과 → waitlisted
  IF v_confirmed_count < v_capacity THEN
    INSERT INTO public.registrations (user_id, meeting_id, status, payment_id, paid_amount)
    VALUES (p_user_id, p_meeting_id, 'confirmed', p_payment_id, p_paid_amount);
    RETURN 'success';
  ELSE
    INSERT INTO public.registrations (user_id, meeting_id, status, payment_id, paid_amount)
    VALUES (p_user_id, p_meeting_id, 'waitlisted', p_payment_id, p_paid_amount);
    RETURN 'waitlisted';
  END IF;
END;
$$;
```

**변경점:**
1. 중복 체크에 `waitlisted` 추가 (같은 사람이 확정 + 대기 중복 방지)
2. 정원 초과 시 `'full'` 반환 대신 → `'waitlisted'` INSERT 후 반환
3. `'full'`은 더 이상 반환되지 않음

---

## payment.ts 변경

현재 `processPaymentConfirmation()`에서 RPC 결과 처리:

```typescript
// 현재
if (rpcResult === 'full') {
  await safeCancel(paymentKey, '정원 마감으로 인한 환불')
  return { status: 'full', ... }
}

// 변경
if (rpcResult === 'waitlisted') {
  // 환불하지 않음 — 결제 유지
  return { status: 'waitlisted', registrationId: ... }
}
// 'full'은 더 이상 발생하지 않지만 방어 코드 유지
```

**⚠️ 핵심:** `'waitlisted'`를 성공 케이스로 처리. 환불하면 안 됨.

---

## 취소 API 변경 — 자동 승격

### /api/registrations/cancel 변경

```typescript
// 기존 취소 로직 후에 추가:

if (cancelledRegistration.status === 'confirmed') {
  // ⭐ 대기자 승격 체크
  try {
    await promoteNextWaitlisted(meetingId)
  } catch (error) {
    console.error('대기자 승격 실패:', error)
    // 승격 실패해도 취소 자체는 성공
  }
}
```

### promoteNextWaitlisted() 함수 (src/lib/waitlist.ts 신규)

```typescript
export async function promoteNextWaitlisted(meetingId: string) {
  const supabase = createServiceClient()

  // 1. 모임 정원 확인
  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, capacity, title, date, time, location, fee')
    .eq('id', meetingId)
    .single()

  if (!meeting) return null

  // 2. 현재 confirmed 수 확인
  const { count } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('meeting_id', meetingId)
    .eq('status', 'confirmed')

  // 3. 자리가 없으면 리턴 (동시 취소 2건 → 동시 승격 2건 방지용 재확인)
  if ((count ?? 0) >= meeting.capacity) return null

  // 4. 가장 오래된 대기자 조회
  const { data: nextWaitlisted } = await supabase
    .from('registrations')
    .select('id, user_id')
    .eq('meeting_id', meetingId)
    .eq('status', 'waitlisted')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!nextWaitlisted) return null

  // 5. status 변경: waitlisted → confirmed
  const { data: updated, error } = await supabase
    .from('registrations')
    .update({ status: 'confirmed' })
    .eq('id', nextWaitlisted.id)
    .eq('status', 'waitlisted')  // optimistic lock
    .select('id')
    .single()

  if (error || !updated) return null

  // 6. 승격 알림톡 발송
  try {
    await sendWaitlistPromotedNotification(meeting, nextWaitlisted.user_id)
  } catch {
    // 알림 실패해도 승격은 유효
  }

  return updated.id
}
```

**Race condition 방지:**
- `.eq('status', 'waitlisted')` optimistic lock — 동시에 두 요청이 같은 대기자를 승격하려 하면 하나만 성공
- 승격 전 confirmed 수 재확인 — 정원 초과 승격 방지

---

## 크론 변경 — 대기자 자동 환불

### meeting-remind 크론 확장

```typescript
// 기존 리마인드 로직 후에 추가:

// 내일 모임의 대기자 자동 환불
const { data: waitlistedRegs } = await supabase
  .from('registrations')
  .select('id, user_id, payment_id, paid_amount, meeting_id')
  .in('meeting_id', tomorrowMeetingIds)
  .eq('status', 'waitlisted')

for (const reg of waitlistedRegs ?? []) {
  try {
    // 토스 전액 환불
    await cancelPayment(reg.payment_id, '대기 미승격 자동 환불')

    // status 변경
    await supabase
      .from('registrations')
      .update({
        status: 'waitlist_refunded',
        cancel_type: 'waitlist_auto_refunded',
        refunded_amount: reg.paid_amount,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', reg.id)

    // 알림톡: "승격되지 않았습니다"
    await sendWaitlistRefundedNotification(reg)
  } catch (error) {
    console.error(`대기자 환불 실패: ${reg.id}`, error)
    // 개별 실패는 건너뜀 — 다음 크론에서 재시도 가능
  }
}
```

**⚠️ 크론 이후 승격 중단:** 자동 환불이 실행된 후에는 더 이상 대기자가 없으므로, 이 시점 이후 취소가 발생해도 빈자리는 그대로 남음.

---

## 모임 삭제 변경

### /api/meetings/[id]/delete 변경

현재: `status = 'confirmed'`인 registrations만 환불

변경: `status IN ('confirmed', 'waitlisted')`

```typescript
// 현재
const { data: regsToRefund } = await supabase
  .from('registrations')
  .select('*')
  .eq('meeting_id', meetingId)
  .eq('status', 'confirmed')

// 변경
const { data: regsToRefund } = await supabase
  .from('registrations')
  .select('*')
  .eq('meeting_id', meetingId)
  .in('status', ['confirmed', 'waitlisted'])
```

waitlisted는 항상 100% 환불. confirmed도 모임 삭제 시 100% 환불이므로 동일 로직.

---

## UI 변경

### 모임 상세 페이지 — 버튼 분기

**현재:**

| 상태 | 버튼 |
|------|------|
| 자리 있음 + 미신청 | [신청하기] |
| 자리 있음 + 신청됨 | [취소하기] |
| 마감 | (버튼 없음, "마감" 표시) |

**변경:**

| 상태 | 버튼 |
|------|------|
| 자리 있음 + 미신청 | [신청하기] |
| 자리 있음 + 신청됨 | [취소하기] |
| 마감 + 미대기 | [대기 신청하기] |
| 마감 + 대기 중 | [대기 취소하기] |

### 모임 상세 — 대기 안내 문구

**정원 차 있을 때:**
```
정원 14/14명 (마감)

[대기 신청하기]

* 취소자 발생 시 자동으로 참여가 확정됩니다.
* 승격되지 않으면 모임 전날 자동 전액 환불됩니다.
```

**대기 신청 완료 후:**
```
정원 14/14명 (마감)

대기 중 (10,000원 결제완료)

* 자리가 나면 자동으로 참여가 확정됩니다.
* 모임 전날까지 승격되지 않으면 자동 전액 환불됩니다.

[대기 취소하기]
```

### 내 신청 내역 (/my)

대기 상태 뱃지 추가:

| 상태 | 뱃지 |
|------|------|
| confirmed | 신청완료 (기존) |
| waitlisted | 대기 중 (신규, 주황색) |
| waitlist_cancelled | 대기 취소됨 (신규, 회색) |
| waitlist_refunded | 미승격 환불 (신규, 회색) |

### 모임 목록 카드 (MeetingCard)

대기 상태도 "신청완료"처럼 표시:

```
3월 경주 정기모임
3월 26일 (수) 오후 7:00 · 공간 지그시
14/14명 [마감]
[대기 중]  ← 신규
```

### admin 신청자 목록 (AdminMeetingSection)

대기자 섹션 추가:

```
확정 (14명)
──────────────
홍길동 (길동)  3/15  결제완료  ☑

대기 (2명)
──────────────
#1 김철수 (철수)  3/16  대기 중
#2 이영희 (영희)  3/16  대기 중
```

admin에게는 순번 표시. 수동 승격/취소 버튼은 Phase 2-2에서 넣지 않음 (자동으로 충분).

---

## 알림톡 템플릿 (3종 신규)

### ① WAITLIST_CONFIRM — 대기 신청 완료

```
[지독해] 대기 신청이 완료되었습니다

#{회원명}님, 모임 대기 신청이 완료되었습니다.

■ 모임: #{모임명}
■ 일시: #{모임일시}
■ 장소: #{장소}
■ 결제 금액: #{결제금액}원

취소자 발생 시 자동으로 참여가 확정됩니다.
모임 전날까지 승격되지 않으면 자동 전액 환불됩니다.
```

버튼: 웹링크 / "내 신청 확인" / `https://brainy-club.com/my`

### ② WAITLIST_PROMOTED — 승격 확정

```
[지독해] 참여가 확정되었어요!

#{회원명}님, 대기 중이던 모임의 자리가 나서 참여가 확정되었습니다!

■ 모임: #{모임명}
■ 일시: #{모임일시}
■ 장소: #{장소}
■ 결제 금액: #{결제금액}원 (결제완료)
```

버튼: 웹링크 / "모임 상세 확인" / `https://brainy-club.com/meetings/#{모임ID}`

### ③ WAITLIST_REFUNDED — 미승격 자동 환불

```
[지독해] 대기 신청이 환불됩니다

#{회원명}님, #{모임명} 모임의 대기 중 승격되지 않아 결제 금액이 환불됩니다.

■ 환불 금액: #{결제금액}원 (전액)
■ 환불 예정: 영업일 기준 3~5일

다음에 더 좋은 기회로 뵙겠습니다.
```

버튼: 웹링크 / "다른 모임 보기" / `https://brainy-club.com`

**⚠️ 승인 근거:** 3종 모두 "회원이 결제한 대기 신청에 대한 후속 안내"이므로 정보성 메시지. 알림톡 승인 가능성 높음.

---

## notifications 테이블 확장

```sql
-- type CHECK에 새 값 추가
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'meeting_remind', 'registration_confirm',
    'waitlist_confirm', 'waitlist_promoted', 'waitlist_refunded'
  ));
```

---

## 엣지 케이스 처리

### 1. 동시 취소 → 동시 승격

두 확정자가 동시에 취소하면, 대기자 2명이 동시 승격되어야 함.

**처리:** `promoteNextWaitlisted()`에서 `.eq('status', 'waitlisted')` optimistic lock 사용. 각 호출이 독립적으로 "가장 오래된 waitlisted"를 잡아서 승격. 같은 대기자를 두 번 승격하려 하면 두 번째는 실패 (이미 confirmed).

### 2. 승격된 회원이 다시 취소

정상 확정자와 동일하게 환불 규칙 적용. 승격 시점이 아니라 **모임 날짜 기준** 환불율 계산.

**"승격 직후 취소 시 전액 환불"은 하지 않음.** 회원이 대기 신청할 때 이미 결제 의사를 표명한 것이므로, 승격 후에는 일반 참가자와 동일 대우. 250명 규모에서 이 엣지 케이스는 극히 드물고, 불만이 발생하면 수동 대응.

### 3. 모임 직전 취소 → 승격

전날 19:00 크론 실행 전에 취소가 발생하면 → 대기자 승격. 크론 실행 후에는 대기자가 없으므로 빈자리 유지.

**19:00 이후 취소 시:** 대기자가 이미 환불됐으므로 승격 불가. 빈자리로 남음. 이건 의도된 동작.

### 4. 대기 중 재신청 방지

`confirm_registration()` RPC에서 `status IN ('confirmed', 'waitlisted')` 중복 체크. 같은 사람이 같은 모임에 확정 + 대기, 또는 대기 + 대기 중복 불가.

### 5. 대기자가 0명인데 정원 초과

대기자가 모두 취소했거나 환불됐는데, 새로운 신청이 들어오면 → 다시 waitlisted로 INSERT. 문제없음.

### 6. 정원 증가 시 기존 대기자

admin이 정원을 14→16으로 늘려도 기존 waitlisted 2명이 자동 승격되지는 않음. **Phase 2-2에서 이 기능은 구현하지 않음.** 운영자가 수동으로 연락하거나, 대기자 취소 후 재신청하도록 안내. 빈도가 극히 낮으므로.

---

## 구현 순서

```
선행: 알림톡 템플릿 3종 등록 + 승인 대기 (재윤 직접)
      ↓
작업 1: DB 마이그레이션 (status CHECK, cancel_type CHECK, 인덱스)
작업 2: confirm_registration() RPC 수정
작업 3: payment.ts — 'waitlisted' 처리 추가
작업 4: src/lib/waitlist.ts (신규) — promoteNextWaitlisted()
작업 5: /api/registrations/cancel — 취소 후 승격 트리거 추가
작업 6: /api/registrations/waitlist-cancel (신규) — 대기자 전용 취소
작업 7: /api/meetings/[id]/delete — waitlisted도 환불 대상 추가
작업 8: 크론 확장 — 대기자 자동 환불 로직 추가
작업 9: UI 변경 — MeetingActionButton, MeetingCard, RegistrationCard, AdminMeetingSection
작업 10: 알림톡 3종 발송 로직 (notification.ts 확장)
작업 11: notifications type CHECK 확장
```

---

## 신규/변경 파일 예상

| 파일 | 유형 | 내용 |
|------|:----:|------|
| `src/lib/waitlist.ts` | 신규 | promoteNextWaitlisted(), 대기 관련 유틸 |
| `src/app/api/registrations/waitlist-cancel/route.ts` | 신규 | 대기자 전용 취소 API |
| `src/lib/payment.ts` | 수정 | 'waitlisted' 반환 처리 |
| `src/app/api/registrations/cancel/route.ts` | 수정 | 취소 후 승격 트리거 |
| `src/app/api/meetings/[id]/delete/route.ts` | 수정 | waitlisted도 환불 |
| `src/app/api/cron/meeting-remind/route.ts` | 수정 | 대기자 자동 환불 추가 |
| `src/components/meetings/MeetingActionButton.tsx` | 수정 | 대기 신청/취소 버튼 분기 |
| `src/components/meetings/MeetingCard.tsx` | 수정 | 대기 중 뱃지 |
| `src/components/registrations/RegistrationCard.tsx` | 수정 | 대기 상태 뱃지 |
| `src/components/meetings/AdminMeetingSection.tsx` | 수정 | 대기자 섹션 추가 |
| `src/lib/notification.ts` | 수정 | 대기 알림 3종 추가 |
| `src/types/registration.ts` | 수정 | 새 status 타입 추가 |
| `src/lib/kst.ts` | 수정 | getButtonState() 대기 상태 분기 추가 |
| `supabase/migration.sql` | 수정 | status CHECK, RPC 수정 SQL |

---

## Phase 2-2에서 하지 않는 것

| 항목 | 이유 |
|------|------|
| 대기 순번 회원 공개 | 복잡도 대비 효과 낮음. 나중에 필요하면 추가 |
| admin 수동 승격 버튼 | 자동 승격으로 충분. 250명 규모에서 수동 개입 불필요 |
| 정원 증가 시 자동 승격 | 빈도 극히 낮음. 수동 대응 |
| 대기 신청 인원 제한 | 실제로 많이 대기하지 않을 것 |
| 승격 후 환불 유예 기간 | 엣지 케이스가 극히 드물고 복잡도 높음 |
| 대기 알림 수신 거부 | 250명 규모에서 카톡으로 직접 요청 |
| 대기 상태 이메일 알림 | 알림톡으로 충분 |

---

## 비용 예상 (알림톡)

| 알림 | 빈도 | 대상 | 월 비용 |
|------|------|------|--------|
| 대기 확인 | 월 2~4건 | 개인 | ~52원 |
| 승격 알림 | 월 1~2건 | 개인 | ~26원 |
| 미승격 환불 | 월 1~2건 | 개인 | ~26원 |
| **월 합계** | | | **~100원** |

정원 초과 빈도가 낮아서 비용은 거의 무시 수준.

---

## 환불정책 페이지 업데이트

`/policy/refund` 페이지에 대기 관련 안내 추가:

```
대기 신청 안내
• 정원이 가득 찬 모임에 대기 신청을 할 수 있습니다.
• 대기 신청 시 참가비가 결제되며, 취소자 발생 시 자동으로 참여가 확정됩니다.
• 대기 신청은 언제든 취소할 수 있으며, 전액 환불됩니다.
• 모임 전날까지 승격되지 않으면 자동으로 전액 환불됩니다.
```