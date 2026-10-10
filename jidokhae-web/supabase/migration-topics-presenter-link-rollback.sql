-- ============================================================
-- 롤백 — migration-topics-presenter-link.sql 되돌리기
-- ============================================================
--
-- 🔴 코드(2차)를 먼저 되돌린다. 그다음 이 파일.
--   2차 코드는 topic_presenter_links·source·presenter_device_hash를 읽고 쓴다.
--
-- 🔴 RLS(③)는 되돌리지 않는다. 「작성 중은 회원에게 안 보인다」는 1차부터의 원칙이고,
--   여기서 using(true)로 풀면 링크로 받은 작성 중 발제가 회원 키로 읽힌다.
--
-- ⚠️ 링크로 받아 아직 공개하지 않은 발제는 칸을 지워도 남는다(작성 중 그대로).
--   지우기 전에 확인한다:
--     SELECT id, meeting_id, topic_no, title FROM public.discussion_topics
--      WHERE source = 'link' AND published_at IS NULL;
-- ============================================================

DROP TABLE IF EXISTS public.topic_presenter_links;

ALTER TABLE public.discussion_topics DROP CONSTRAINT IF EXISTS discussion_topics_source_check;
ALTER TABLE public.discussion_topics DROP COLUMN IF EXISTS presenter_device_hash;
ALTER TABLE public.discussion_topics DROP COLUMN IF EXISTS source;
