---
name: 다음 세션 핸드오프
description: 계좌이체 브릿지 배포 완료 상태 — 다음 세션에서 이어갈 작업
type: project
---

# 다음 세션 핸드오프

**마지막 갱신:** 2026-04-08

## 현재 진행 상태

- **계좌이체 브릿지:** 프로덕션 배포 완료 (main, Vercel)
  - DB 마이그레이션 3개 실행 완료 (Supabase)
  - `payment_mode = 'transfer_only'`
  - 계좌: 카카오뱅크 3333270661539 임재윤(지독해)
  - 신청 모달(카드결제 준비중 + 계좌이체), 취소 흐름(환불 규정 + 1:1톡 안내), 관리자 입금 토글(양방향) 모두 구현

- **검증:** 5개 에이전트 풀 스캔 → P0 3건 + P1 4건 수정 완료
  - 종합 보고서: `verification-squad/reports/2026-04-06/08-final-report.md`

- **추가 수정:**
  - `data.error` → `data.message` (admin 버튼 에러 필드)
  - `!refunded_amount` → `=== null` (환불완료 버튼 표시 조건)
  - 입금자명 본명 → 닉네임
  - DepositToggle: `router.refresh()` → 낙관적 상태 업데이트 (깜박임 제거)
  - 대시보드 "입금 대기 N건": 클릭 시 모임 목록으로 스크롤

## 다음 할 일 (우선순위 순)

1. **프로덕션 수동 테스트** — 계좌이체 신청/취소/운영자 확인 전체 흐름
2. **관리자 신청자 목록 UI 레이아웃 정리** — 오른쪽 뱃지/버튼 산만 (사용자 지적)
3. **풀스캔 검토 지시서 검토** — `검토문서/풀스캔-검토-지시서.md` (A-1~C-5, 기존 코드 전체 이슈)
4. **PG 심사 통과 후** — `UPDATE site_settings SET value = 'card_only' WHERE key = 'payment_mode'`

## 블로커

- 토스페이먼츠 라이브 키 심사 대기 중 (계좌이체 브릿지로 우회 완료)
- 프로덕션 수동 테스트 필요 (카카오 OAuth → 로컬 불가)

## 주의사항

- `(main)` 라우트 그룹 페이지는 카카오 로그인 필수 → 로컬 프리뷰 불가, Vercel에서만 확인
- `ConfirmTransferButton`과 `MarkRefundedButton` 파일은 유지되어 있으나 UI에서 미사용 (DepositToggle로 대체)
- CLAUDE.md에 계좌이체 브릿지 관련 내용 추가됨 (Bank transfer bridge, register_transfer RPC 등)
