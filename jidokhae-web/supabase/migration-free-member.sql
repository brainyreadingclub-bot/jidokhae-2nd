-- ============================================================
-- 무료 회원 (100% 할인) — Schema Migration
-- ============================================================
--
-- 배경
--   운영자(admin) 본인 + 소수의 고정 무료 참석자는 계좌이체로 신청하지만
--   실제 입금하지 않는다(코멥). 이들은 매번 "입금 확인 대기" 목록에 남아
--   운영자 정산 화면에 영구 노이즈를 만든다.
--
--   이 사람들은 (1) 실제 참석(정원·명단 포함), (2) 완전 무료(0원), 이라
--   is_free 표식을 두고 "입금 확인 대기" 목록/배지에서만 숨긴다.
--   스텝 50% 할인(is_staff)과는 완전히 별개 시스템이다.
--
-- 변경 내용
--   - profiles.is_free BOOLEAN — 무료 참석자(100% 할인) 지정용
--
-- 적용 순서
--   1) 이 파일(migration-free-member.sql)을 Supabase SQL Editor에서 실행
--   2) Vercel 코드 deploy
--   (RPC 변경 없음 — 대상자는 기존 계좌이체 흐름 그대로 신청하고,
--    정산 목록/배지 쿼리에서만 is_free를 제외한다.)
--
-- 롤백
--   migration-free-member-rollback.sql 사용
--
-- Forward-compatibility
--   - 컬럼 추가만 하므로 기존 코드는 영향 없음 (default false)
--   - 회원 신청/결제/취소 흐름 무변경
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT false;

-- 무료 회원 조회용 partial 인덱스 (무료 회원은 소수라 partial이 효율적)
CREATE INDEX IF NOT EXISTS idx_profiles_is_free
  ON public.profiles(is_free)
  WHERE is_free = true;

COMMENT ON COLUMN public.profiles.is_free IS
  '무료 참석자(100% 할인) 지정 여부. 정산 입금 확인 대기 목록/배지에서 제외됨. 스텝 할인(is_staff)과 별개.';

-- ============================================================
-- 대상자 지정 (참고용 — 실제 무료 회원 닉네임으로 교체하여 실행)
-- ============================================================
-- UPDATE public.profiles SET is_free = true WHERE nickname = '단무지';
--
-- 해제:
-- UPDATE public.profiles SET is_free = false WHERE nickname = '단무지';

-- ============================================================
-- 검증 쿼리 (참고용 — 마이그레이션 후 수동 실행 가능)
-- ============================================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'profiles'
--   AND column_name = 'is_free';
--
-- 기대 결과: 1행
--   profiles | is_free | boolean | NO | false
