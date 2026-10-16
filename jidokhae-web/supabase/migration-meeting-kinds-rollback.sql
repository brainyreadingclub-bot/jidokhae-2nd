-- migration-meeting-kinds.sql 되돌리기
-- 작업실·별책부록 모임이 0건일 때만 성공한다 — 있으면 CHECK가 막아 준다(그게 맞다).
-- 먼저 세기: SELECT meeting_type, count(*) FROM public.meetings WHERE meeting_type IN ('workshop','event') GROUP BY 1;
ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_meeting_type_check;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_meeting_type_check
  CHECK (meeting_type IN ('regular', 'discussion'));
