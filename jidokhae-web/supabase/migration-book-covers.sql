-- migration-book-covers.sql
-- 토론모임 ↔ 책 연결 + 표지 노출 (2026-08-18 표지 배치 확정).
-- 근거: 2026-08-13 신청 설계서 §5 (표지 전략), DECISIONS 2026-08-18.
-- 전부 additive — 기존 흐름 영향 없음. 롤백: 컬럼 3개 DROP.

-- ① 책 소개 (카카오 contents — 신청 상세에서 3줄 접기로 노출)
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS description TEXT;

-- ② 토론모임 ↔ 책 연결 + 선정 이유(운영자 한마디, 선택)
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES public.books(id),
  ADD COLUMN IF NOT EXISTS selection_reason TEXT;

-- ③ 조회 인덱스 (홈/이야기 탭이 book join)
CREATE INDEX IF NOT EXISTS idx_meetings_book ON public.meetings(book_id)
  WHERE book_id IS NOT NULL;
