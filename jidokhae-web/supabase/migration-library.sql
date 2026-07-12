-- ============================================================
-- 토론모임 개편 · 1조각-A — 서재 기반 스키마 (books + library_entries)
-- ============================================================
-- 변경 요약:
--   books           : 공용 책 카탈로그 (isbn13 정규화 키, 카카오 도서 API 출처)
--   library_entries : 회원 × 책 (담음/완독 + 출처 라벨)
--
-- 안전성:
--   - forward-compatible: 신규 테이블만 추가, 기존 코드/테이블 무영향
--   - 코드가 이 테이블을 소비하지 않으면 잠재 상태 (플래그 OFF 시 화면 노출 0)
--   - 표지는 카카오 thumbnail URL 문자열만 저장 (이미지 재호스팅 안 함)
--
-- 실행 환경: Supabase SQL Editor (prod: ycqqzzvyixvtdorjxkrn)
-- 멱등성: IF NOT EXISTS 패턴 → 재실행 안전
-- 롤백: migration-library-rollback.sql
-- ============================================================

-- 1. books (공용 카탈로그)
CREATE TABLE IF NOT EXISTS public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  isbn13 TEXT UNIQUE,               -- 정규화 키. NULL 허용(희귀본 자유입력 fallback; NULL은 UNIQUE 중복 아님)
  title TEXT NOT NULL,
  authors TEXT,                     -- 저자 결합 문자열 (", "로 join)
  publisher TEXT,
  thumbnail TEXT,                   -- 카카오 thumbnail URL (재호스팅 안 함)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. library_entries (회원 × 책)
CREATE TABLE IF NOT EXISTS public.library_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ask')),      -- manual=직접 검색, ask=물어보기(Plan B)
  source_meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  completed BOOLEAN NOT NULL DEFAULT false,   -- 완독은 항상 수동
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, book_id)                   -- 같은 책 중복 담기 방지
);

CREATE INDEX IF NOT EXISTS idx_library_entries_user
  ON public.library_entries(user_id, created_at DESC);

-- 3. RLS
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_entries ENABLE ROW LEVEL SECURITY;

-- books: 로그인 회원은 카탈로그 조회 가능(비민감). 쓰기는 service_role만(정책 없음)
DROP POLICY IF EXISTS "books_select_authenticated" ON public.books;
CREATE POLICY "books_select_authenticated"
  ON public.books FOR SELECT
  TO authenticated
  USING (true);

-- library_entries: 본인 것만 조회. 쓰기는 service_role만(정책 없음)
DROP POLICY IF EXISTS "library_entries_select_own" ON public.library_entries;
CREATE POLICY "library_entries_select_own"
  ON public.library_entries FOR SELECT
  USING (auth.uid() = user_id);

-- 확인용 (실행 후 주석 해제)
-- SELECT count(*) FROM public.books;
-- SELECT count(*) FROM public.library_entries;
