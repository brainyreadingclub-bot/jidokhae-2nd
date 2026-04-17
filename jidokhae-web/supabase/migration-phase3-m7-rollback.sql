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
-- SECTION 2. book_quotes — 테이블 (CASCADE로 정책/트리거/인덱스 자동 정리)
-- ============================================================
-- 주의: DROP POLICY IF EXISTS ... ON table 은 table이 없으면 42P01 에러.
-- DROP TABLE IF EXISTS ... CASCADE 만으로 충분 (정책/트리거/외래키/인덱스 자동 제거).

DROP TABLE IF EXISTS public.book_quotes CASCADE;


-- ============================================================
-- SECTION 3. banners — 테이블 (CASCADE)
-- ============================================================

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
