-- ============================================================
-- 토론모임 개편 · 1조각-B — 물어보기 해소 원장 (book_asks)
-- ============================================================
-- 변경 요약:
--   book_asks : 회원 × 정기모임 ask 해소 기록 (answered / dismissed)
--               strip이 같은 모임을 다시 안 띄우게 + 측정 분자(닫음/담음)
--
-- 안전성:
--   - forward-compatible: 신규 테이블만 추가, 기존 코드/테이블 무영향
--   - Plan A(books/library_entries) 이후 실행 전제
--   - 플래그 OFF 시 화면 노출 0
--
-- 실행 환경: Supabase SQL Editor (prod: ycqqzzvyixvtdorjxkrn)
-- 멱등성: IF NOT EXISTS → 재실행 안전
-- 롤백: migration-library-asks-rollback.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.book_asks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('answered', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, meeting_id)   -- 모임 1건당 1회만 해소
);

CREATE INDEX IF NOT EXISTS idx_book_asks_status
  ON public.book_asks(status);

ALTER TABLE public.book_asks ENABLE ROW LEVEL SECURITY;

-- 본인 것만 조회. 쓰기는 service_role만(정책 없음)
DROP POLICY IF EXISTS "book_asks_select_own" ON public.book_asks;
CREATE POLICY "book_asks_select_own"
  ON public.book_asks FOR SELECT
  USING (auth.uid() = user_id);

-- 확인용 (실행 후 주석 해제)
-- SELECT status, count(*) FROM public.book_asks GROUP BY status;
