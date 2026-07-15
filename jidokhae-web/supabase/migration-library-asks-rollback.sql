-- 롤백: 1조각-B 물어보기 원장 제거
-- ⚠️ book_asks 데이터 삭제됨(해소 이력). 운영 데이터 있으면 신중히.
DROP TABLE IF EXISTS public.book_asks;
