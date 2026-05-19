-- ============================================================
-- Staff Discount System — Schema Migration (Phase 1)
-- ============================================================
--
-- 배경
--   정기모임 진행을 돕는 스텝(+ admin/editor)에게 50% 할인 적용.
--   모임당 최대 2명까지만 할인 슬롯 사용 가능.
--
-- 변경 내용
--   - profiles.is_staff BOOLEAN — 진행 도우미 스텝 지정용 (admin/editor는 자동 자격)
--   - registrations.is_staff_discount BOOLEAN — 결제 시점 할인 적용 기록
--
-- 적용 순서
--   1) 이 파일(migration-staff-discount.sql)을 Supabase SQL Editor에서 실행
--   2) migration-staff-discount-rpcs.sql 실행 (RPC 재정의)
--   3) Vercel 코드 deploy
--
-- 롤백
--   migration-staff-discount-rollback.sql 사용
--
-- Forward-compatibility
--   - 컬럼 추가만 하므로 기존 코드는 영향 없음 (default false)
--   - 새 RPC가 등록되어도 기존 RPC 시그니처는 동일
-- ============================================================

-- ============================================================
-- 1. profiles.is_staff
-- ============================================================
-- admin, editor는 role 기반 자동 자격이므로 별도 토글 불필요.
-- is_staff는 일반 회원이지만 진행 돕는 스텝으로 지정된 사람을 위함.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_staff BOOLEAN NOT NULL DEFAULT false;

-- 스텝 회원 조회용 partial 인덱스 (스텝은 소수라 partial이 효율적)
CREATE INDEX IF NOT EXISTS idx_profiles_is_staff
  ON public.profiles(is_staff)
  WHERE is_staff = true;

COMMENT ON COLUMN public.profiles.is_staff IS
  '스텝(진행 도우미) 지정 여부. admin/editor는 role로 자동 자격이라 별도 토글 불필요.';

-- ============================================================
-- 2. registrations.is_staff_discount
-- ============================================================
-- 결제 시점에 스텝 할인이 적용되었는지 기록.
-- 슬롯 카운트(WHERE is_staff_discount = true AND status IN (...))에 사용.

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS is_staff_discount BOOLEAN NOT NULL DEFAULT false;

-- 슬롯 카운트 쿼리 최적화용 partial 인덱스
-- WHERE 절: 할인 적용 + 활성 상태(슬롯 점유 중)
CREATE INDEX IF NOT EXISTS idx_registrations_staff_discount_slot
  ON public.registrations(meeting_id)
  WHERE is_staff_discount = true
    AND status IN ('confirmed', 'pending_transfer', 'waitlisted');

COMMENT ON COLUMN public.registrations.is_staff_discount IS
  '스텝 할인 적용 여부. RPC 내부에서 자격+슬롯 검증 후 true 기록.';

-- ============================================================
-- 검증 쿼리 (참고용 — 마이그레이션 후 수동 실행 가능)
-- ============================================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('profiles', 'registrations')
--   AND column_name IN ('is_staff', 'is_staff_discount');
--
-- 기대 결과: 2행
--   profiles      | is_staff           | boolean | NO | false
--   registrations | is_staff_discount  | boolean | NO | false
