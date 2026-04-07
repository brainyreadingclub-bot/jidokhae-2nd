# 다음 세션 핸드오프

**마지막 갱신:** 2026-04-07

## 현재 진행 상태

- **계좌이체 브릿지:** 구현 완료 + 검증 완료 (feature/bank-transfer 브랜치)
  - 5개 검증 에이전트 풀 스캔 → P0 3건 + P1 4건 수정 완료
  - 종합 보고서: `verification-squad/reports/2026-04-06/08-final-report.md`
  - 설계서: `docs/superpowers/specs/2026-04-04-bank-transfer-bridge-design.md`

## 다음 할 일 (우선순위 순)

1. **main 병합 + push** — DB 마이그레이션 실행 후 push
2. **Supabase SQL 마이그레이션 3개 실행** (migration-bank-transfer.sql → functions.sql → settings.sql)
3. **프로덕션 수동 테스트** — 계좌이체 신청/취소/운영자 확인 흐름
4. **PG 심사 통과 후** — site_settings.payment_mode → 'card_only' 전환

## 블로커

- 토스페이먼츠 라이브 키 심사 대기 중 (계좌이체 브릿지로 우회)

## 주의사항

- DB 마이그레이션은 코드 배포 전에 실행해야 함 (register_transfer RPC 필요)
- migration-bank-transfer-settings.sql의 계좌 정보를 실제 값으로 교체
- (main) 라우트 그룹 페이지는 카카오 로그인 필수 → 로컬 프리뷰 불가, Vercel에서만 확인
