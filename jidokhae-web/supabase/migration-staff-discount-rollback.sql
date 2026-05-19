-- ============================================================
-- Staff Discount System — Schema Rollback
-- ============================================================
--
-- 실행 시점
--   migration-staff-discount.sql 적용 후 문제 발생 시.
--   배포된 코드(pricing.ts 등)가 먼저 revert되어야 안전.
--
-- ⚠️ 주의
--   is_staff_discount = true인 registrations가 존재하면 데이터 손실.
--   롤백 전 다음 쿼리로 영향 범위 확인:
--     SELECT COUNT(*) FROM public.registrations WHERE is_staff_discount = true;
--   0이 아니면 단무지님께 보고 후 결정.
-- ============================================================

-- 1. RPC 원복 (signature는 동일하므로 migration-bank-transfer-functions.sql 재실행으로 복구)
--    → migration-staff-discount-rpcs.sql 다음에 migration-bank-transfer-functions.sql 재실행
--      또는 단일 정의로 강제 회귀.

-- 2. 인덱스 제거
DROP INDEX IF EXISTS public.idx_registrations_staff_discount_slot;
DROP INDEX IF EXISTS public.idx_profiles_is_staff;

-- 3. 컬럼 제거
ALTER TABLE public.registrations DROP COLUMN IF EXISTS is_staff_discount;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_staff;
