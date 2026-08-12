-- 롤백 — migration-book-ask.sql 되돌리기
-- ⚠️ 실행 전 book_ask 이력이 있으면 먼저 지워야 CHECK 축소가 통과한다.

DELETE FROM public.notifications WHERE type = 'book_ask';

DROP INDEX IF EXISTS idx_notifications_book_ask_unique;

ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'meeting_remind', 'registration_confirm',
    'waitlist_confirm', 'waitlist_promoted', 'waitlist_refunded'
  ));
