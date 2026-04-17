-- ============================================================
-- Phase 3 · M7 · WP7-2 — Schema 확장
-- ============================================================
-- 변경 요약:
--   1. meetings 테이블에 컬럼 5종 추가 (region/is_featured/chat_link/reading_link/detail_address)
--   2. banners 테이블 신규 (홍보 배너 CMS)
--   3. book_quotes 테이블 신규 (이번 주 한 줄)
--   4. RLS 정책 (banners 2개, book_quotes 5개)
--   5. Supabase Storage `banners` bucket + storage.objects RLS
--
-- 의존: is_admin(), is_editor_or_admin() SECURITY DEFINER 함수가 이미 존재해야 함
--       (fix-rls-recursion.sql + 이후 migration에서 정의됨)
--
-- 실행 환경: Supabase SQL Editor
-- 실행 순서: DDL → RLS → Storage. 한 번에 실행해도 무방.
-- 멱등성: 모든 CREATE/ALTER가 IF NOT EXISTS 또는 ON CONFLICT 사용 → 재실행 안전.
-- ============================================================


-- ============================================================
-- SECTION 1. meetings 테이블 컬럼 5종 추가
-- ============================================================

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT '경주';

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS chat_link TEXT;

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS reading_link TEXT;

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS detail_address TEXT;

-- featured 필터링 자주 사용 → 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_meetings_featured
  ON meetings (date)
  WHERE is_featured = true AND status = 'active';


-- ============================================================
-- SECTION 2. banners 테이블 신규
-- ============================================================

CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  link_url TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 활성 배너만 표시 순서대로 조회 → 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_banners_active_order
  ON banners (display_order, created_at DESC)
  WHERE is_active = true;

-- updated_at 자동 갱신 트리거 (meetings_updated_at과 동일 함수 재사용)
-- migration.sql에서 정의된 public.update_updated_at() 사용
DROP TRIGGER IF EXISTS banners_updated_at ON banners;
CREATE TRIGGER banners_updated_at
  BEFORE UPDATE ON banners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- SECTION 3. book_quotes 테이블 신규 (이번 주 한 줄)
-- ============================================================

CREATE TABLE IF NOT EXISTS book_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_title TEXT NOT NULL,
  quote_text TEXT NOT NULL CHECK (char_length(quote_text) <= 200),
  submitted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 홈에서 최근 승인된 한 줄 조회 (최신 N개)
CREATE INDEX IF NOT EXISTS idx_book_quotes_approved_recent
  ON book_quotes (approved_at DESC NULLS LAST)
  WHERE status = 'approved';

-- 운영자 한 줄 관리 — 대기 중 탭 조회
CREATE INDEX IF NOT EXISTS idx_book_quotes_pending
  ON book_quotes (created_at DESC)
  WHERE status = 'pending';

-- 본인이 제출한 글 조회
CREATE INDEX IF NOT EXISTS idx_book_quotes_submitter
  ON book_quotes (submitted_by, created_at DESC);


-- ============================================================
-- SECTION 4. RLS — banners
-- ============================================================

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- 로그인 유저는 활성 배너만 SELECT
DROP POLICY IF EXISTS "banners_select_active" ON banners;
CREATE POLICY "banners_select_active" ON banners
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- admin은 전부 (CRUD)
DROP POLICY IF EXISTS "banners_admin_all" ON banners;
CREATE POLICY "banners_admin_all" ON banners
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- SECTION 5. RLS — book_quotes
-- ============================================================

ALTER TABLE book_quotes ENABLE ROW LEVEL SECURITY;

-- 5-1. 로그인 유저는 승인된 한 줄 SELECT
DROP POLICY IF EXISTS "book_quotes_select_approved" ON book_quotes;
CREATE POLICY "book_quotes_select_approved" ON book_quotes
  FOR SELECT
  TO authenticated
  USING (status = 'approved');

-- 5-2. 본인이 제출한 글은 상태 무관하게 SELECT
DROP POLICY IF EXISTS "book_quotes_select_own" ON book_quotes;
CREATE POLICY "book_quotes_select_own" ON book_quotes
  FOR SELECT
  TO authenticated
  USING (submitted_by = auth.uid());

-- 5-3. editor/admin은 모든 상태의 글 SELECT (한 줄 관리 화면용)
DROP POLICY IF EXISTS "book_quotes_select_editor_or_admin" ON book_quotes;
CREATE POLICY "book_quotes_select_editor_or_admin" ON book_quotes
  FOR SELECT
  TO authenticated
  USING (is_editor_or_admin());

-- 5-4. INSERT — 본인 ID로만 가능 (submitted_by = auth.uid() 강제)
DROP POLICY IF EXISTS "book_quotes_insert_own" ON book_quotes;
CREATE POLICY "book_quotes_insert_own" ON book_quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- 5-5. editor/admin은 UPDATE 가능 (승인/거절/승인취소)
DROP POLICY IF EXISTS "book_quotes_update_editor_or_admin" ON book_quotes;
CREATE POLICY "book_quotes_update_editor_or_admin" ON book_quotes
  FOR UPDATE
  TO authenticated
  USING (is_editor_or_admin())
  WITH CHECK (is_editor_or_admin());

-- 5-6. editor/admin DELETE (한 줄 삭제 기능 — 한 줄 관리 요구사항)
DROP POLICY IF EXISTS "book_quotes_delete_editor_or_admin" ON book_quotes;
CREATE POLICY "book_quotes_delete_editor_or_admin" ON book_quotes
  FOR DELETE
  TO authenticated
  USING (is_editor_or_admin());


-- ============================================================
-- SECTION 6. Supabase Storage — banners bucket
-- ============================================================

-- bucket 생성 (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- 모두 읽기 가능 (public bucket이라 사실상 자동이지만 명시적 정책)
DROP POLICY IF EXISTS "banner_storage_public_read" ON storage.objects;
CREATE POLICY "banner_storage_public_read" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'banners');

-- admin만 INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "banner_storage_admin_insert" ON storage.objects;
CREATE POLICY "banner_storage_admin_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'banners' AND is_admin());

DROP POLICY IF EXISTS "banner_storage_admin_update" ON storage.objects;
CREATE POLICY "banner_storage_admin_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'banners' AND is_admin())
  WITH CHECK (bucket_id = 'banners' AND is_admin());

DROP POLICY IF EXISTS "banner_storage_admin_delete" ON storage.objects;
CREATE POLICY "banner_storage_admin_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'banners' AND is_admin());


-- ============================================================
-- 검증용 쿼리 (실행 후 SELECT로 확인)
-- ============================================================
--
-- -- 컬럼 추가 확인
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'meetings'
--   AND column_name IN ('region', 'is_featured', 'chat_link', 'reading_link', 'detail_address');
--
-- -- 신규 테이블 확인
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN ('banners', 'book_quotes');
--
-- -- RLS 정책 확인
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('banners', 'book_quotes')
-- ORDER BY tablename, policyname;
--
-- -- Storage bucket 확인
-- SELECT id, name, public FROM storage.buckets WHERE id = 'banners';
--
-- ============================================================
