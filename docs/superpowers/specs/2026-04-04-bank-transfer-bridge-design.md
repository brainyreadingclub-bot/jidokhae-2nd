# 계좌이체 브릿지 설계서

**Date:** 2026-04-04
**Status:** Implemented
**Purpose:** 토스페이먼츠 심사 대기 기간 동안 계좌이체로 즉시 출시, 심사 통과 후 카드결제 전환

---

## 1. 배경 & 전략

### 상황
- 토스페이먼츠 라이브 키 심사 대기 중 → 카드결제 불가
- 250명 규모 독서모임 서비스 출시 필요
- 현재 MVP는 "결제 완료 = 신청 확정" 자동화에 최적화

### 전략: 하이브리드 브릿지 (C안)
- 계좌이체를 정식 결제 수단으로 임시 통합
- `site_settings.payment_mode` 플래그로 카드/이체 전환
- 심사 통과 후 `card_only`로 전환 → 이체 코드 정리 제거

### 전환 계획
| 시점 | `payment_mode` | 결제 수단 |
|------|---------------|-----------|
| 지금 (심사 전) | `transfer_only` | 계좌이체만 |
| 심사 통과 후 | `card_only` | 카드결제만 (이체 제거) |

### ⚠ 의도적 Tradeoff 선언

이 브릿지는 다음 PRD 원칙을 **의도적으로 일시 위반**합니다:

| PRD 원칙 | 위반 내용 | 허용 근거 |
|----------|----------|----------|
| "결제 완료 = 신청 확정" | 이체는 "신청 접수 → 입금 대기 → 운영자 확인 → 확정" | 심사 전 한정, 출시 우선 |
| "운영자 개입 월 0건" | 입금 확인 + 수동 환불 필요 | 250명 규모에서 월 수건, 운영 가능 |
| "자동 환불" | 이체 건은 운영자 수동 이체 | 심사 통과 후 카드 전환 시 해소 |

**심사 통과 후 `card_only` 전환 시 모든 위반이 자동 해소됩니다.**

---

## 2. 사용자 흐름 (회원)

### 2-1. 신청 흐름

```
모임 상세 → "신청하기" 클릭
  → /meetings/[id]/transfer (계좌이체 안내 페이지)
  → "신청하기" 클릭 (DB 기록 + 정원 차감)
  → /meetings/[id]/confirm?type=pending_transfer (완료 페이지)
```

#### 계좌이체 안내 페이지 (`/meetings/[id]/transfer`)

표시 내용:
- 모임명, 참가비
- 입금 안내: 은행명, 계좌번호, 예금주 (site_settings에서 로드)
- "계좌번호 복사" 버튼 (원탭 복사)
- 입금자명 안내: "입금자명을 '{real_name}'(으)로 입금해주세요" (프로필 실명 자동 표시)
- 하단: "신청하기" 버튼

UI 형태 결정 근거 (행동심리학):
- **별도 페이지** 채택 (모달 아님)
- 구현 의도 효과: 구체적 행동 지시서 → 실행률 2~3배 증가
- 자이가르닉 효과: 미완료 상태 유지 → 이체 완료 동기 강화
- 스크린샷 용이: 은행앱 이동 시 참조 가능
- 커밋먼트 에스컬레이션: 페이지 이동 = 심리적 진행 → 포기율 감소

#### 완료 페이지 (기존 confirm 페이지 확장)

`/meetings/[id]/confirm?type=pending_transfer` 표시:
- 체크 아이콘 + "신청이 접수되었습니다"
- "입금 확인 후 참여가 확정됩니다"
- 계좌 정보 다시 표시 (은행앱 이동 직전 최종 참조)
- "계좌번호 복사" 버튼
- "모임 일정으로" 버튼

### 2-2. 신청 후 상태 표시

모임 상세 페이지 재방문 시 (`pending_transfer` 상태):
- 안내 박스: "입금 확인 대기 중입니다"
- 계좌 정보 재표시 (미입금 시 참조)
- "신청 취소" 버튼

### 2-3. My 페이지 (`/my`)

`MyRegistrationContent` 변경:
- 상태 필터에 `pending_transfer` 추가 (기존: confirmed/waitlisted만 조회)
- 뱃지: `pending_transfer` → "입금 대기" (accent 컬러, 기존 "대기 중"과 구분)
- `isUpcoming` 판정: `pending_transfer`도 포함 (활성 신청)
- 카드에 계좌 정보 재표시 (미입금 시 참조 가능)

### 2-4. 취소 흐름

**`pending_transfer` 상태에서 취소:**
- TossPayments API 호출 없음 (결제 자체가 없으므로)
- DB만 업데이트: status → 'cancelled'
- 정원 즉시 복구
- 대기자 승격 트리거 (기존 로직)

**`confirmed` 상태에서 취소 (운영자 입금 확인 후):**
- TossPayments API 호출 없음 (계좌이체이므로)
- DB 업데이트: status → 'cancelled', cancel_type에 기록
- 환불 필요 목록에 추가 (운영자 수동 환불)
- 환불 규칙 적용: 3일전 100%, 2일전 50%, 전일/당일 0%
- 사용자 안내: "취소 접수됨. 환불은 운영자가 처리 후 입금됩니다."

### 2-5. 대기 신청

정원 초과 시:
- 기존과 동일하게 `waitlisted` 상태, `payment_method: 'transfer'`
- 대기 승격 시: `waitlisted` → `pending_transfer` (카드는 자동 `confirmed`이지만, 이체는 입금 미확인)
- 대기 취소: TossPayments API 호출 없음, DB만 업데이트

### 2-6. 알림톡 분기

이체 건은 알림톡 내용이 달라야 합니다:

| 알림 종류 | 카드 | 이체 |
|----------|------|------|
| 신청 확인 | "신청이 완료되었습니다" | 발송 안 함 (입금 미확인) |
| 운영자 입금 확인 | 해당 없음 | (향후) "입금이 확인되어 참여가 확정되었습니다" |
| 대기 승격 | "자리가 나서 참여가 확정되었습니다" | "자리가 났습니다. 아래 계좌로 입금해주세요" (계좌 정보 포함) |
| 리마인드 | confirmed만 대상 | `pending_transfer`는 리마인드 대상 아님 (미입금) |

> **Phase 1 (지금):** 알림톡 분기 없이 출시. 이체 건 알림은 향후 추가.
> **이유:** Solapi 템플릿 추가 심사가 필요하므로, 출시 속도를 위해 알림 없이 시작.

### 2-7. 환불률 계산 기준

환불률은 **모임일 - 취소일** 기준 (기존 로직 그대로):
- 신청일, 입금 확인일과 무관
- `calculateRefund(meetingDate, paidAmount, kstToday)` 함수 그대로 사용
- `pending_transfer` 취소: 환불 계산 불필요 (미입금이므로)
- `confirmed` + `transfer` 취소: 환불 규칙 적용, 운영자 수동 이체

---

## 3. 운영자 흐름 (백오피스)

### 3-1. 입금 확인 워크플로우

**진입점 1: 대시보드 카드**
- `admin/page` 대시보드에 "입금 대기 N건" 카드 추가
- 클릭 시 미확인 건 목록으로 이동 (또는 스크롤)

**진입점 2: 모임별 신청자 목록**
- `admin/meetings/[id]/edit` 페이지의 신청자 테이블 확장
- `pending_transfer` 건에 "입금확인" 버튼 표시
- 체크박스 선택 → "선택 항목 일괄 확인" 버튼

**일괄 확인 흐름:**
1. 운영자: 은행 앱/웹에서 통장 내역 확인
2. 백오피스: 입금 대기 목록에서 확인된 건 체크
3. "일괄 확인" 클릭 → 확인 모달
4. API: 선택된 registrations → status: 'confirmed'

### 3-2. 환불 필요 건 관리

계좌이체 `confirmed` 건 취소 시:
- 대시보드: "환불 처리 필요 N건" 표시
- 목록: 이름, 모임, 금액, 상태 표시
- 운영자가 실제 이체 후: "환불완료" 버튼 클릭
- API: `refunded_amount` 기록 + 상태 갱신

### 3-3. 미입금 건 처리

자동 만료 없음 (250명 규모에서 불필요).
운영자가 직접 판단하여:
- 연락 후 취소 처리, 또는
- 입금 확인 처리

---

## 4. 데이터 모델 변경

### 4-1. DB 스키마

**registrations 테이블 — 컬럼 추가:**
```sql
ALTER TABLE registrations
ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'card'
CHECK (payment_method IN ('card', 'transfer'));
```

**registrations.status — 값 추가:**
- 기존: `confirmed | cancelled | waitlisted | waitlist_cancelled | waitlist_refunded`
- 추가: `pending_transfer`
- `pending_transfer`는 정원 카운트에 포함

**site_settings — 키 추가:**
| key | value (예시) | 설명 |
|-----|-------------|------|
| `payment_mode` | `'transfer_only'` | 결제 모드 플래그 |
| `bank_name` | `'카카오뱅크'` | 입금 은행명 |
| `bank_account` | `'3333-12-3456789'` | 계좌번호 |
| `bank_holder` | `'홍길동'` | 예금주 |

### 4-2. DB Functions 변경

**`confirm_registration()` RPC:**
- 정원 카운트 쿼리: `status IN ('confirmed', 'pending_transfer')` 포함
- 이체 신청용 새 RPC `register_transfer(p_user_id, p_meeting_id, p_paid_amount)` 추가:
  - `FOR UPDATE` 락으로 원자적 정원 체크 + INSERT
  - 여석 있음 → `pending_transfer` INSERT, 정원 초과 → `waitlisted` INSERT
  - 중복 체크: `confirmed`, `pending_transfer`, `waitlisted` 모두 확인

**`get_confirmed_counts()` 함수:**
- `pending_transfer`도 카운트에 포함

**`promote_next_waitlisted()` RPC:**
- `payment_method`에 따라 승격 결과 분기:
  - `card` → 기존대로 `confirmed`
  - `transfer` → `pending_transfer` (입금 미확인이므로 자동 확정 불가)

### 4-3. Registration 타입 확장

```typescript
// src/types/registration.ts
type Registration = {
  // ... 기존 필드
  payment_method: 'card' | 'transfer'
  status: 'confirmed' | 'cancelled' | 'waitlisted'
        | 'waitlist_cancelled' | 'waitlist_refunded'
        | 'pending_transfer'  // 추가
}
```

---

## 5. API 설계

### 5-1. 새 API Routes

**`POST /api/registrations/transfer`** — 계좌이체 신청
```
요청: { meetingId: string }
인증: 사용자 세션 (쿠키)
처리:
  1. 모임 active 확인 + fee 조회
  2. 중복 신청 확인 (confirmed/pending_transfer/waitlisted)
  3. 정원 확인 (confirmed + pending_transfer 카운트)
  4. 여석 있음: INSERT (status: 'pending_transfer', payment_method: 'transfer')
  5. 정원 초과: INSERT (status: 'waitlisted', payment_method: 'transfer')
응답: { status: 'pending_transfer' | 'waitlisted' | 'already_registered' | 'error' }
```

**`POST /api/admin/registrations/confirm-transfer`** — 운영자 입금 확인
```
요청: { registrationIds: string[] }
인증: 관리자 세션
처리:
  1. 각 registration: status 'pending_transfer' → 'confirmed'
  2. 낙관적 잠금: .eq('status', 'pending_transfer')
응답: { confirmed: number, failed: number }
```

**`POST /api/admin/registrations/mark-refunded`** — 운영자 환불 완료 처리
```
요청: { registrationId: string, refundedAmount: number }
인증: 관리자 세션
처리:
  1. refunded_amount 업데이트
  2. 상태 확인 갱신
응답: { status: 'success' }
```

> **"환불 필요 목록"은 별도 테이블이 아님.**
> 기존 `registrations` 테이블에서 조건 쿼리로 조회:
> `status = 'cancelled' AND payment_method = 'transfer' AND refunded_amount IS NULL AND paid_amount > 0`
> 운영자가 "환불완료" 처리 시 `refunded_amount`에 금액 기록 → 목록에서 제외.

### 5-2. 기존 API 변경

| API | 변경 사항 |
|-----|----------|
| `POST /api/registrations/cancel` | `payment_method === 'transfer'`면 TossPayments API 스킵. `pending_transfer` 건은 환불 없이 취소. `confirmed` + `transfer` 건은 환불 필요 목록에 추가 |
| `POST /api/meetings/[id]/delete` | `pending_transfer` 건: 환불 없이 취소. `confirmed` + `transfer` 건: 환불 필요 목록에 추가 (자동 환불 불가) |
| `GET /api/cron/waitlist-refund` | `transfer` 건은 TossPayments 환불 스킵, 환불 필요 목록에 추가 |

---

## 6. 기존 코드 영향 범위 (전체)

### 6-1. 새로 생성할 파일

| 파일 | 용도 |
|------|------|
| `src/app/(main)/meetings/[id]/transfer/page.tsx` | 계좌이체 안내 페이지 |
| `src/app/api/registrations/transfer/route.ts` | 이체 신청 API |
| `src/app/api/admin/registrations/confirm-transfer/route.ts` | 운영자 입금 확인 API |
| `src/app/api/admin/registrations/mark-refunded/route.ts` | 운영자 환불 완료 API |

### 6-2. 수정할 클라이언트 컴포넌트

| 컴포넌트 | 변경 |
|---------|------|
| `MeetingActionButton` | `payment_mode` 분기: `transfer_only` → 이체 안내 페이지로 이동 |
| `MeetingDetailContent` | `pending_transfer` 상태 조회 + 안내 박스 표시 |
| `MyRegistrationContent` | 상태 필터에 `pending_transfer` 추가 + "입금 대기" 뱃지 |
| `AdminDashboardContent` | 입금 대기 건수 카드 추가 |
| `AdminMeetingSection` | 입금확인 버튼 + 체크박스 일괄 확인 UI |
| `confirm/page.tsx` | `?type=pending_transfer` 분기 + 계좌 정보 재표시 |

### 6-3. 수정할 서버 컴포넌트 / 라이브러리

| 파일 | 변경 |
|------|------|
| `src/lib/cancel.ts` | `payment_method` 분기: transfer면 TossPayments API 스킵 |
| `src/lib/waitlist.ts` | 승격 결과가 `pending_transfer`일 때 처리 분기 |
| `src/lib/kst.ts` | `getButtonState()` — `pending_transfer` 상태 반환 추가 |
| `src/lib/site-settings.ts` | `bank_name`, `bank_account`, `bank_holder`, `payment_mode` 키 로드 |
| `src/lib/dashboard.ts` | 입금 대기 집계 + 환불 필요 건수 추가 |
| `src/types/registration.ts` | `payment_method` 필드 + `pending_transfer` 상태 추가 |

### 6-4. 수정할 API Routes

| API | 변경 |
|-----|------|
| `registrations/cancel` | `payment_method` 조회 + transfer면 TossPayments 스킵. `pending_transfer`도 취소 허용 |
| `meetings/[id]/delete` | 상태 필터에 `pending_transfer` 추가. transfer 건은 환불 없이 취소 |
| `cron/waitlist-refund` | transfer 건은 TossPayments 환불 스킵, 환불 필요 목록에 추가 |

### 6-5. DB 변경 (Supabase SQL Editor)

| 대상 | 변경 |
|------|------|
| `registrations` 테이블 | `payment_method` 컬럼 추가 + CHECK 제약 |
| `registrations.status` CHECK | `pending_transfer` 값 추가 |
| `confirm_registration()` RPC | 정원 카운트에 `pending_transfer` 포함 |
| `get_confirmed_counts()` RPC | `pending_transfer` 카운트 포함 |
| `promote_next_waitlisted()` RPC | `payment_method` 분기 추가 |
| 새 RPC: `register_transfer()` | FOR UPDATE 락 + 원자적 정원 체크 + INSERT |
| `site_settings` 데이터 | `payment_mode`, `bank_name`, `bank_account`, `bank_holder` INSERT |

### 6-6. 변경 불필요 확인 완료

| 파일 | 이유 |
|------|------|
| `middleware.ts` | 새 라우트에 특별 처리 불필요 |
| `webhooks/tosspayments` | 이체 건은 웹훅 발생 안 함 |
| `cron/meeting-remind` | confirmed만 대상, `pending_transfer` 자동 제외 |
| `registrations/attendance` | confirmed만 대상 |
| RLS 정책 | status 값에 무관, 기존 정책 유효 |
| `MeetingCard`, `MeetingDetailInfo` | `get_confirmed_counts()` RPC 업데이트로 자동 반영 |

---

## 7. 엣지 케이스

| 상황 | 처리 |
|------|------|
| 미입금 장기 방치 | 운영자 직접 판단하여 취소 (자동 만료 없음) |
| 이체 후 모임 삭제 | `pending_transfer`: 환불 불필요, DB만 취소. `confirmed`+`transfer`: 환불 필요 목록 추가 |
| 동일 인원 중복 신청 | 기존 중복 체크 로직 재사용 (confirmed/pending_transfer/waitlisted 확인) |
| 대기 → 승격 (이체 건) | `waitlisted`+`transfer` → `pending_transfer` (입금 미확인이므로 자동 확정 불가) |
| 입금자명 불일치 | 운영 영역. 프로필 `real_name` 안내로 최소화 |
| `real_name` 미설정 | 프로필 설정 게이트에서 차단 (이미 존재) |
| 정원 카운트 | `confirmed` + `pending_transfer` + `waitlisted` 모두 포함 |
| `payment_mode` 전환 시점의 진행 중 건 | 전환은 새 신청에만 적용. 기존 `pending_transfer` 건은 운영자가 마무리 |

---

## 8. 제거 전략 (심사 통과 후)

### 8-1. 즉시 전환 (5분)
- `site_settings.payment_mode` → `'card_only'`
- 새 신청은 즉시 카드결제로

### 8-2. 잔여 처리 (운영)
- 기존 `pending_transfer` 건: 운영자가 입금 확인/취소 마무리
- 기존 `confirmed`+`transfer` 건: 환불 필요 시 수동 처리

### 8-3. 코드 정리 (개발)
삭제 대상:
- `/meetings/[id]/transfer` 페이지
- `/api/registrations/transfer` API
- `/api/admin/registrations/confirm-transfer` API
- `/api/admin/registrations/mark-refunded` API
- `MeetingActionButton` 이체 분기
- `site_settings`의 `bank_*` 키

유지 대상:
- `payment_method` 컬럼 (기존 데이터 보존)
- `pending_transfer` status (기존 데이터 보존)
- 코드에서만 분기 제거, DB 스키마는 유지

---

## 9. 테스트 전략

### 단위 테스트
- `pending_transfer` 상태의 정원 카운트 포함 확인
- 이체 건 취소 시 TossPayments API 미호출 확인
- `getButtonState()`의 `pending_transfer` 분기 검증

### 수동 테스트
- 계좌이체 신청 → 완료 → 상태 확인
- 운영자 입금 확인 (개별/일괄)
- 이체 건 취소 흐름
- 정원 초과 → 대기 → 승격 흐름 (이체)
- `payment_mode` 전환 후 카드결제 정상 동작
