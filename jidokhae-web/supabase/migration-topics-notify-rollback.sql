-- ============================================================
-- 롤백 — migration-topics-notify.sql 되돌리기
-- ============================================================
--
-- 🔴 예약 작업부터 끈다. 그다음 함수, 마지막에 칸.
--   칸을 먼저 지우면 1분마다 도는 함수가 매번 실패한다.
--
-- ⚠️ 코드(1차)를 그대로 두고 이것만 되돌리면 발제를 등록해도 **알림이 아예 안 간다**
--   (1차 코드는 등록 라우트에서 알림을 보내지 않는다). 코드도 같이 되돌릴 때만 쓴다.
--
-- pg_cron 확장 자체는 끄지 않는다 — 다른 예약 작업이 생겼을 수 있다.
-- ============================================================

SELECT cron.unschedule('topic-notify-flush');

DROP FUNCTION IF EXISTS public.flush_topic_notifications();

DROP INDEX IF EXISTS public.idx_discussion_topics_unnotified;

ALTER TABLE public.discussion_topics DROP COLUMN IF EXISTS notified_at;
