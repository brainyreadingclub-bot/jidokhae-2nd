-- ============================================================
-- 무료 회원 (100% 할인) — Schema Rollback
-- ============================================================
--
-- 실행 시점
--   migration-free-member.sql 적용 후 문제 발생 시.
--   배포된 코드(settlement.ts / dashboard.ts의 is_free 필터)가 먼저 revert되어야 안전.
--
-- ⚠️ 주의
--   is_free = true인 profiles가 존재하면 무료 지정이 사라진다(정산 노이즈 재발).
--   롤백 전 다음 쿼리로 영향 범위 확인:
--     SELECT COUNT(*) FROM public.profiles WHERE is_free = true;
--   0이 아니면 단무지님께 보고 후 결정.
-- ============================================================

-- 1. 인덱스 제거
DROP INDEX IF EXISTS public.idx_profiles_is_free;

-- 2. 컬럼 제거
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_free;
