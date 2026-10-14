-- migration-app-events.sql 되돌리기
-- 🔴 기록이 통째로 사라진다. 지우기 전에 SELECT로 떠 둘 것.
-- 코드는 표가 없어도 동작한다(recordAppEvent가 실패를 삼킨다) — 코드를 먼저 되돌릴 필요 없다.

DROP INDEX IF EXISTS public.idx_app_events_user;
DROP INDEX IF EXISTS public.idx_app_events_event_created;

DROP TABLE IF EXISTS public.app_events;
