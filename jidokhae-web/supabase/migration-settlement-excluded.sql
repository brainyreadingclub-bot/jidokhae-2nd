-- ============================================================
-- 정산 "확인 제외" — Schema Migration
-- ============================================================
--
-- 배경
--   계좌이체로 신청했지만 입금 여부가 불확실한(입금해도 되고 안 해도 되는)
--   특정 건을 운영자가 "입금 확인 대기" 목록에서 개별적으로 숨기고 싶다.
--   이들은 매출에 포함하지 않으며 입금 확인도 하지 않는다.
--
--   is_free(회원 단위 무료)와 달리 이건 "신청 건 단위" 표식이다.
--   실제 registration은 그대로 두므로 정원·명단에는 영향이 없고,
--   정산 목록/배지 쿼리에서만 제외한다. (pending_transfer는 원래 매출 미포함)
--
-- 변경 내용
--   - registrations.settlement_excluded BOOLEAN — 정산 확인 제외 표식
--
-- 적용 순서
--   1) 이 파일(migration-settlement-excluded.sql)을 Supabase SQL Editor에서 실행
--   2) Vercel 코드 deploy
--   (코드가 .eq('settlement_excluded', false)로 조회하므로 컬럼이 먼저 있어야 함)
--
-- 롤백
--   migration-settlement-excluded-rollback.sql 사용
--
-- Forward-compatibility
--   - 컬럼 추가만 하므로 기존 코드는 영향 없음 (default false)
--   - 회원 신청/결제/취소 흐름 무변경
-- ============================================================

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS settlement_excluded BOOLEAN NOT NULL DEFAULT false;

-- 제외 건 조회용 partial 인덱스 (제외 건은 소수라 partial이 효율적)
CREATE INDEX IF NOT EXISTS idx_registrations_settlement_excluded
  ON public.registrations(settlement_excluded)
  WHERE settlement_excluded = true;

COMMENT ON COLUMN public.registrations.settlement_excluded IS
  '정산 "확인 제외" 여부. 입금 확인 대기 목록/배지에서 제외됨. 신청 건 단위(is_free는 회원 단위)와 별개.';

-- ============================================================
-- 검증 쿼리 (참고용 — 마이그레이션 후 수동 실행 가능)
-- ============================================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'registrations'
--   AND column_name = 'settlement_excluded';
--
-- 기대 결과: 1행
--   registrations | settlement_excluded | boolean | NO | false
