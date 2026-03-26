# 다음 세션 핸드오프

**마지막 갱신:** 2026-03-26

## 현재 진행 상태

- Phase 2-3 백오피스: **완료** (기본 4기능 + 고급 6기능 모두 완료, 기간 필터 포함)
- **UI 디테일 개선 4건 완료 + 푸시됨:**
  1. `MyRegistrationContent.tsx`: Empty State CTA 회귀 수정 (모임 둘러보기 링크 복원)
  2. `MeetingDetailInfo.tsx` + `MeetingCard.tsx`: 0명일 때 "N명 모집 중" 표시 + "모집 중" 띄어쓰기 통일
  3. `MeetingDetailInfo.tsx`: 참가비 아이콘 DollarSign → Banknote
  4. `MeetingForm.tsx`: 참가비 입력 실시간 콤마 포맷팅
- CLAUDE.md: capacity display 규칙 0명 예외 추가, 누락 lib 파일/컴포넌트 보완

## 다음 할 일 (우선순위 순)

1. **PG 심사 통과 대기** — TossPayments 승인 후 실결제 테스트
2. 사용자가 새 지시서를 전달하면 실행

## 블로커

- PG 심사 승인 대기 중

## 주의사항

- Windows 환경: preview_start는 `cmd /c` 래퍼 필요 (feedback_2026-03-26_preview-windows.md)
- 집계 로직 수정 시: A - B 행 범위 일치 확인 (feedback_2026-03-26_aggregate-logic.md)
- 같은 파일 다중 작업 시: 편집-커밋 순차 실행 (feedback_2026-03-26_commit-ordering.md)
