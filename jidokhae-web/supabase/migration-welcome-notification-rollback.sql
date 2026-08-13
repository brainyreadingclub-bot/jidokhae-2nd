-- 롤백 — migration-welcome-notification.sql 되돌리기
-- ⚠️ 실행 전 new_member_welcome 이력이 있으면 먼저 지워야 CHECK 축소가 통과한다.

DELETE FROM public.notifications WHERE type = 'new_member_welcome';

DROP INDEX IF EXISTS idx_notifications_welcome_unique;

ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'meeting_remind', 'registration_confirm',
    'waitlist_confirm', 'waitlist_promoted', 'waitlist_refunded',
    'book_ask'
  ));
