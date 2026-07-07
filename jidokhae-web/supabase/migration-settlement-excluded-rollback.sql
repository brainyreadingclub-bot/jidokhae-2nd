-- ============================================================
-- 정산 "확인 제외" — Rollback
-- ============================================================
--
-- 주의
--   먼저 코드를 revert(settlement_excluded 참조 제거)한 뒤 실행할 것.
--   코드가 살아있는 상태에서 컬럼을 지우면 정산/대시보드 쿼리가 깨진다.
-- ============================================================

DROP INDEX IF EXISTS public.idx_registrations_settlement_excluded;

ALTER TABLE public.registrations
  DROP COLUMN IF EXISTS settlement_excluded;
