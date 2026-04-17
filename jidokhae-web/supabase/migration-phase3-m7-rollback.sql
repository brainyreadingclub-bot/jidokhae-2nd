-- ============================================================
-- Phase 3 · M7 · WP7-2 — ROLLBACK
-- ============================================================
-- 목적: 이전 세션에서 적용한 Phase 3 schema + 이번 세션에 만든 migration-phase3-m7.sql
--       둘 다 커버하여 Phase 3 시작 전 상태로 되돌림.
--
-- 사용자 확인 완료:
--   - banners: 데이터 없음
--   - book_quotes: 1건 (테스트 데이터, 삭제 OK)
--   - meetings 5컬럼: 모두 default 값, 데이터 입력 없음
--
-- 멱등성: 모든 DROP이 IF EXISTS — 재실행 안전, 없는 객체 무시.
-- 실행: Supabase SQL Editor에서 한 번에 실행.
-- ============================================================


-- ============================================================
-- SECTION 1. Storage — SKIP
-- ============================================================
-- 이전 세션 SQL에는 Storage bucket 'banners' 생성이 없음 → 롤백할 대상 없음.
-- Supabase는 storage.objects/buckets 직접 DELETE를 차단하므로 (42501 protect_delete),
-- bucket 생성된 게 있다면 Supabase 대시보드 → Storage에서 수동 삭제 필요.
--
-- 현재는 해당 없음 → 이 섹션 전체 skip.


-- ============================================================
-- SECTION 2. book_quotes — 정책 + 테이블
-- ============================================================

DROP POLICY IF EXISTS "book_quotes_delete_editor_or_admin" ON public.book_quotes;
DROP POLICY IF EXISTS "book_quotes_update_editor_or_admin" ON public.book_quotes;
DROP POLICY IF EXISTS "book_quotes_insert_own" ON public.book_quotes;
DROP POLICY IF EXISTS "book_quotes_insert" ON public.book_quotes;
DROP POLICY IF EXISTS "book_quotes_select_editor_or_admin" ON public.book_quotes;
DROP POLICY IF EXISTS "book_quotes_select_own" ON public.book_quotes;
DROP POLICY IF EXISTS "book_quotes_select_approved" ON public.book_quotes;

-- 인덱스는 테이블 DROP 시 자동 제거되지만 명시적으로
DROP INDEX IF EXISTS public.idx_book_quotes_status_approved;
DROP INDEX IF EXISTS public.idx_book_quotes_approved_recent;
DROP INDEX IF EXISTS public.idx_book_quotes_pending;
DROP INDEX IF EXISTS public.idx_book_quotes_submitter;

DROP TABLE IF EXISTS public.book_quotes CASCADE;


-- ============================================================
-- SECTION 3. banners — 트리거 + 정책 + 테이블
-- ============================================================

DROP TRIGGER IF EXISTS banners_updated_at ON public.banners;

DROP POLICY IF EXISTS "banners_admin_all" ON public.banners;
DROP POLICY IF EXISTS "banners_select_active" ON public.banners;

DROP INDEX IF EXISTS public.idx_banners_active_order;

DROP TABLE IF EXISTS public.banners CASCADE;


-- ============================================================
-- SECTION 4. meetings — 컬럼 5종 + 인덱스 제거
-- ============================================================

DROP INDEX IF EXISTS public.idx_meetings_featured;

ALTER TABLE public.meetings DROP COLUMN IF EXISTS detail_address;
ALTER TABLE public.meetings DROP COLUMN IF EXISTS reading_link;
ALTER TABLE public.meetings DROP COLUMN IF EXISTS chat_link;
ALTER TABLE public.meetings DROP COLUMN IF EXISTS is_featured;
ALTER TABLE public.meetings DROP COLUMN IF EXISTS region;


-- ============================================================
-- 검증 쿼리 (실행 후 확인)
-- ============================================================
--
-- -- 1. meetings 5컬럼 제거 확인 (0 row 반환되어야 함)
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'meetings'
--   AND column_name IN ('region', 'is_featured', 'chat_link', 'reading_link', 'detail_address');
--
-- -- 2. banners / book_quotes 테이블 제거 확인 (0 row)
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN ('banners', 'book_quotes');
--
-- -- 3. 관련 정책 제거 확인 (0 row)
-- SELECT schemaname, tablename, policyname FROM pg_policies
-- WHERE tablename IN ('banners', 'book_quotes');
--
-- ============================================================
