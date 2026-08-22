-- ============================================================
-- 가입 환영 알림톡 (NEW_MEMBER_WELCOME) — notifications 확장
-- Supabase SQL Editor에서 수동 실행
--
-- 목적
--   프로필 설정을 처음 마친 회원에게 환영 알림톡을 1회 보내기 위해
--   notifications 테이블이 'new_member_welcome' 타입을 받도록 확장한다.
--
-- 안전성
--   - CHECK 확장 + 인덱스 추가만. 기존 6종에 영향 없음
--   - forward-compatible: 이 SQL을 먼저 실행해도 코드가 발송하지 않으면
--     아무 일도 안 일어난다
--   - 롤백: migration-welcome-notification-rollback.sql
--
-- ⚠️ 실행 순서
--   이 SQL을 코드 배포보다 먼저 실행할 것.
--   코드가 먼저 나가면 INSERT가 CHECK 위반(23514)으로 실패한다.
--
-- ⚠️ 선행 조건
--   migration-book-ask.sql이 이미 실행돼 있어야 한다(2026-08-13 실행 완료).
--   아래 CHECK 목록에 'book_ask'가 포함돼 있기 때문이다.
-- ============================================================

-- 1. notifications.type CHECK에 'new_member_welcome' 추가
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'meeting_remind', 'registration_confirm',
    'waitlist_confirm', 'waitlist_promoted', 'waitlist_refunded',
    'book_ask',
    'new_member_welcome'
  ));

-- 2. 중복 발송 차단 — 회원 1명당 평생 1회
--
--    다른 알림과 달리 모임도 신청 건도 걸려 있지 않다. 가입은 한 번뿐이라
--    사람(recipient_id) 하나가 단위다. meeting_id는 NULL로 들어간다.
--
--    INSERT(pending) 단계에서 23505로 걸리므로 Solapi 발송 전에 차단된다.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_welcome_unique
  ON public.notifications(recipient_id)
  WHERE type = 'new_member_welcome';

-- 검증
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conname = 'notifications_type_check';
--
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'notifications' AND indexname = 'idx_notifications_welcome_unique';
