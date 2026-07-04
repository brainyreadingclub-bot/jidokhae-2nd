# 입금/환불 통합 관리 화면 설계서

- **작성일:** 2026-07-04
- **대상 마일스톤:** Phase 3 M10 (관리자 심화 — 정산) 선행 착수
- **라우트:** `/admin/settlements` (현재 M10 placeholder 대체)
- **권한:** admin 전용 (editor 접근 불가 — 개인정보/정산이므로 역할 매트릭스 준수)

---

## 1. 배경 & 문제

운영자(admin)는 계좌이체 입금 확인을 **모임마다 하나씩 상세 페이지에 들어가서** 처리해야 한다. 입금자가 여러 모임에 흩어져 있으면 모임 개수만큼 왕복이 발생한다. 월말 정산일에 몰아서 처리하는 운영 패턴상 이 반복이 가장 큰 고통이다.

집계는 대시보드 한 곳에 모이지만("입금 확인 대기 N건") 정작 **처리(체크)는 모임별로 흩어져** 있다. 이 설계는 **전체 계좌이체 건을 status 기준으로 한 화면에 모아** 대조 → 선택 → 일괄 처리하도록 한다.

핵심 사용 맥락: **은행 명세서를 옆에 띄워두고** 대조하는 작업이므로 **데스크톱 우선**.

---

## 2. 목표 / 비목표

**목표**
- 전체 `pending_transfer` 건을 한 화면에서 은행 명세서와 대조하고 **일괄 입금 확인**
- 전체 환불 대기 건(계좌이체 취소, 미환불)을 한 화면에서 확인하고 **환불 완료 체크**
- 스텝 할인(반값) 금액을 명확히 표시해 금액 오판 방지
- 신청 후 경과일을 표시해 **미입금 스트래글러(자리 잠금)** 식별

**비목표**
- 자동 환불/자동 송금 (환불은 운영자 수동 이체 유지)
- 회원 계좌번호 저장 (저장 안 함 — 연락처로 문의)
- editor 접근 (admin 전용)
- 입금 확인 시 회원 알림톡 발송 (**금지** — 월말 일괄 처리 맥락, CLAUDE.md 규칙)
- 카드 결제 건 (전자 처리라 대상 아님)

---

## 3. 화면 구조

`/admin/settlements` 한 페이지, **탭 2개로 완전 분리** (같은 리스트에 섞지 않음):

```
[ 입금 확인 대기 (N) ]  [ 환불 대기 (M) ]
```

### 3-1. 탭 A — 입금 확인 대기

- **데이터:** `registrations.status = 'pending_transfer'` (모임 join, 프로필 join)
- **정렬:** 기본 "신청 시각 순(오래된→최신)". 드롭다운으로 전환: 모임별 / 금액순
- **컬럼:**
  | 컬럼 | 값 | 비고 |
  |---|---|---|
  | ☑ 선택 | 체크박스 | 다중 선택 |
  | 입금자명 | `M/D 닉네임` (M/D=모임날짜) | **1순위 대조 키.** 은행 명세서에 찍히는 그대로 |
  | 금액 | `paid_amount` | 스텝 할인은 `5,000 스텝½` 배지 |
  | 신청 시각 | `created_at` (KST, 분 단위) | 입금 시각 매칭용 |
  | 경과 | today − created_at (일) | N일 경과, 임계 초과 시 ⚠ 강조 |
  | 모임 | 모임명 | |
  | 연락처 | `profiles.phone` | 미입금 독촉용 (admin 전용이라 정합) |
- **일괄 액션:** 선택 건 → `선택 입금 확인` 버튼 → `POST /api/admin/registrations/confirm-transfer` (`registrationIds[]`, `action:'confirm'`) — **이미 배치 지원(최대 50건)**
- **부분 실패 표시:** API가 `partial` + `failedReasons` 반환 → 상단 배너 "N건 확인 · M건 실패(사유)". 실패는 주로 `capacity_full`(그 사이 정원 참)

### 3-2. 탭 B — 환불 대기

- **데이터:** `status='cancelled' AND payment_method='transfer' AND refunded_amount IS NULL AND paid_amount>0` (getTransferAlerts 환불 쿼리와 동일)
- **컬럼:** 닉네임 · **환불액(자동계산, 규칙 표시)** · 취소 시각 · 모임 · **연락처** · 환불 완료 토글
- **환불액:** 서버가 `calculateRefund(meeting.date, paid_amount, cancelled_at)`로 계산 (mark-refunded 라우트가 이미 수행)
- **액션:** 행별 `환불 완료` 토글 → 기존 `POST /api/admin/registrations/mark-refunded` (`action:'mark'|'unmark'`, 단건). **배치 불필요** (환불 건수 적음, 계좌 확인 후 개별 처리)
- **연락처가 핵심:** 회원 계좌를 저장하지 않으므로 연락처로 계좌를 받아 송금 후 체크

---

## 4. 재검토로 검증된 사실 (코드 근거)

1. **범위 = `pending_transfer`만.** 계좌이체 대기자(`waitlisted`)는 입금을 받지 않는다 — confirm 페이지가 `waitlisted`에는 계좌 정보를 노출하지 않고 "취소자 발생 시 자동 확정"만 안내(`confirm/page.tsx`). 승격 시점에 입금 안내. → 대기자는 이 화면에서 자연 제외가 정답.
2. **삭제 모임 오탐 없음.** 모임 삭제 시 `pending_transfer` → `cancelled` + `refunded_amount = 0`(delete route). 환불 탭 쿼리는 `refunded_amount IS NULL`이라 이들을 제외. 입금 안 한 사람이 환불 탭에 뜨지 않는다.
3. **삭제 모임의 confirmed 계좌이체 건은 환불 탭에 정확히 잡힘.** 삭제 시 `refunded_amount = NULL`로 남으므로 status 기준 조회인 이 화면에 자동 노출 → 기존 "삭제 모임은 상세가 `notFound()`라 SQL 수동 처리" 한계 해소(보너스).
4. **입금 확인 배치 API 기존재.** `confirm-transfer` 라우트가 이미 `registrationIds[]`(최대 50건) + `partial` 결과를 지원. 백엔드 추가 작업 최소.
5. **알림톡 금지 규칙 유지.** confirm-transfer / mark-refunded 모두 성공 후 알림 발송 없음 — 그대로 둔다.

**계획 시 교차 확인 필요(이 화면과 별개):** 계좌이체 대기자 승격 시 `confirmed`가 아니라 `pending_transfer`로 전환되어 이 화면에 올라오는지 (`promote_next_waitlisted`). 만약 바로 confirmed면 미입금 확정 버그.

---

## 5. 반응형

- **데스크톱(≥ md):** 6~7컬럼 테이블 (주 사용 맥락)
- **모바일:** 카드형(1건 = 1카드) 또는 가로 스크롤. 관리자 레이아웃이 이미 반응형이라 무리 없음. 정산은 데스크톱이 실제 맥락이므로 모바일은 "볼 수 있는" 수준까지만.

---

## 6. 대시보드 연동

- `AdminDashboardHub`의 "입금 확인 대기 N건 · 처리하기 →" 링크를 `/admin/meetings`에서 **`/admin/settlements`(입금 확인 탭)** 로 변경
- "환불 대기" 알림이 있으면 환불 탭으로 링크

---

## 7. 컴포넌트/파일 (예상)

- `src/app/(admin)/admin/settlements/page.tsx` — placeholder 대체, 서버 컴포넌트(데이터 페치 + 권한)
- `src/components/admin/SettlementTabs.tsx` — 탭 전환 (client)
- `src/components/admin/DepositConfirmTable.tsx` — 입금 확인 탭 (client, 다중 선택 + 배치 호출 + 부분 실패 배너)
- `src/components/admin/RefundWaitingTable.tsx` — 환불 대기 탭 (RefundToggle 재사용)
- `src/lib/settlement.ts` — 두 탭 데이터 조회 헬퍼 (service_role, 정렬 옵션)
- 재사용: `RefundToggle`, `calculateRefund`, `confirm-transfer` API, `mark-refunded` API, KST 유틸

신규 백엔드는 **조회 헬퍼**가 주. 쓰기 API는 기존 것 재사용.

---

## 8. 엣지 케이스 체크리스트 (구현 시)

- [ ] 빈 상태(0건) — 각 탭 empty state
- [ ] 입금 확인 배치 부분 실패 — 배너 + 실패 행 표시, 성공 행은 목록에서 사라짐
- [ ] `capacity_full` 실패 후 목록 새로고침 (router.refresh)
- [ ] 스텝 할인 금액 배지 정확성 (`paid_amount`가 반값인지)
- [ ] 삭제된 모임의 환불 대기 건 — 모임명 join 실패해도 렌더(모임명 "삭제됨" 표시)
- [ ] admin 전용 이중 방어 (layout role check + API role check) — phone 노출 화면이므로 필수
- [ ] 경과일 임계값 확정 (며칠부터 ⚠? — 구현 전 사용자 확인)
- [ ] SW 캐시: phone 포함 화면 — admin HTML은 NetworkFirst라 캐시 fallback 존재. 민감도 낮으나 인지
