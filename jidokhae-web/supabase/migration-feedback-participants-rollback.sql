-- ============================================================
-- migration-feedback-participants.sql 롤백
-- 함수 단독 존재는 호출 코드가 없으면 무해하므로 일반적으로 롤백 불필요.
-- 정말로 제거가 필요한 경우에만 실행.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_meeting_participant_nicknames(UUID);
