-- ============================================================
-- 롤백 — migration-topics-publish.sql 되돌리기
-- ============================================================
--
-- 🔴 코드를 먼저 되돌린다. 그다음 이 파일.
--   새 코드는 published_at을 읽는다. 칸을 먼저 지우면 회원 쪽 발제 조회가 에러로
--   비고, 공개하기 API가 실패한다. 옛 코드로 돌아간 뒤에는 칸이 있어도 없어도 무해하다.
--
-- 🔴 작성 중이던 발제가 회원에게 보이게 된다.
--   칸을 지우면 「작성 중」 구분이 사라지고, 옛 코드는 전부 보여준다.
--   지우기 전에 아래 쿼리로 작성 중인 발제를 확인하고, 보여서는 안 되는 것은
--   먼저 삭제하거나 내용을 채워둔다.
--     SELECT id, meeting_id, topic_no, title FROM public.discussion_topics
--      WHERE published_at IS NULL;
-- ============================================================

DROP POLICY IF EXISTS "topics readable by authenticated" ON public.discussion_topics;
CREATE POLICY "topics readable by authenticated"
  ON public.discussion_topics FOR SELECT TO authenticated USING (true);

DROP INDEX IF EXISTS public.idx_discussion_topics_meeting_published;

ALTER TABLE public.discussion_topics DROP COLUMN IF EXISTS published_at;
