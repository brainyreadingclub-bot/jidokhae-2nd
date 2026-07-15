-- 롤백: 1조각-A 서재 스키마 제거
-- ⚠️ library_entries/books 데이터가 삭제됨. 운영 데이터 있으면 신중히.
DROP TABLE IF EXISTS public.library_entries;
DROP TABLE IF EXISTS public.books;
