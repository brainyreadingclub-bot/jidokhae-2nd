-- migration-announcement-type.sql
-- 인앱 알림에 공지(announcement) 타입 추가 (2026-08-17 시안 D).
-- 코드 동기: src/types/app-notification.ts AppNotificationType,
--            /api/admin/announcements (발송), NotificationList (렌더).
-- 롤백: 아래 DROP 후 announcement 없는 목록으로 재생성 (announcement 행 삭제 선행 필요).

ALTER TABLE public.app_notifications
  DROP CONSTRAINT app_notifications_type_check;

ALTER TABLE public.app_notifications
  ADD CONSTRAINT app_notifications_type_check CHECK (type IN
    ('answer_reply', 'answer_reaction', 'topic_posted', 'flash_opened',
     'flash_cancelled', 'registration_confirmed', 'announcement'));
