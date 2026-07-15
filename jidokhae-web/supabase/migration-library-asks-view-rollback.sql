-- 롤백: 물어보기 노출 계측 컬럼 + 'viewed' 상태 제거
-- ⚠️ 'viewed' 행이 있으면 CHECK 축소가 실패 → 먼저 정리 필요.
DELETE FROM public.book_asks WHERE status = 'viewed';

ALTER TABLE public.book_asks DROP CONSTRAINT IF EXISTS book_asks_status_check;
ALTER TABLE public.book_asks
  ADD CONSTRAINT book_asks_status_check
  CHECK (status IN ('answered', 'dismissed'));

ALTER TABLE public.book_asks
  DROP COLUMN IF EXISTS first_viewed_at,
  DROP COLUMN IF EXISTS dismissed_at;
