-- ============================================================
-- 토론모임 개편 · 1조각 재설계 — 물어보기 노출 계측 + dismiss soft화
-- ============================================================
-- 변경 요약:
--   book_asks.status : 'viewed' 상태 추가 (노출만 됨, 미응답)
--   book_asks.first_viewed_at : 최초 노출 시각 (응답률 분석 분자/분모 정밀화)
--   book_asks.dismissed_at    : 닫음 시각 (dismiss soft화 — 언제 닫았는지 추적)
--
-- 안전성:
--   - forward-compatible: 컬럼 추가 + CHECK 확장만. 기존 answered/dismissed 무영향
--   - 배포 순서: 이 SQL 먼저 실행 → 코드 배포 (신규 코드가 'viewed' INSERT/컬럼 사용)
--   - 플래그 OFF 시 화면 노출 0
--
-- 실행 환경: Supabase SQL Editor (prod: ycqqzzvyixvtdorjxkrn)
-- 멱등성: IF NOT EXISTS / DROP CONSTRAINT IF EXISTS → 재실행 안전
-- 롤백: migration-library-asks-view-rollback.sql
-- ============================================================

-- 1. 노출/닫음 시각 컬럼
ALTER TABLE public.book_asks
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

-- 2. status CHECK에 'viewed' 추가 (인라인 제약 자동명: book_asks_status_check)
ALTER TABLE public.book_asks DROP CONSTRAINT IF EXISTS book_asks_status_check;
ALTER TABLE public.book_asks
  ADD CONSTRAINT book_asks_status_check
  CHECK (status IN ('viewed', 'answered', 'dismissed'));

-- 확인용 (실행 후 주석 해제)
-- SELECT status, count(*), count(first_viewed_at) AS viewed_at_set
-- FROM public.book_asks GROUP BY status;
