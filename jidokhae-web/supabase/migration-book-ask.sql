-- ============================================================
-- 물어보기 알림톡 (BOOK_ASK) — notifications 확장
-- Supabase SQL Editor에서 수동 실행
--
-- 목적
--   모임 다음날 "읽으신 책 담아보세요" 알림톡을 보내기 위해
--   notifications 테이블이 'book_ask' 타입을 받도록 확장한다.
--
-- 안전성
--   - CHECK 확장 + 인덱스 추가만. 기존 5종에 영향 없음
--   - forward-compatible: 이 SQL을 먼저 실행해도 코드가 book_ask를
--     보내지 않으면 아무 일도 안 일어난다
--   - 롤백: migration-book-ask-rollback.sql
--
-- ⚠️ 실행 순서
--   이 SQL을 코드 배포보다 먼저 실행할 것.
--   코드가 먼저 나가면 INSERT가 CHECK 위반(23514)으로 실패한다.
-- ============================================================

-- 1. notifications.type CHECK에 'book_ask' 추가
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'meeting_remind', 'registration_confirm',
    'waitlist_confirm', 'waitlist_promoted', 'waitlist_refunded',
    'book_ask'
  ));

-- 2. 중복 발송 차단 — 회원 1명당 모임 1건에 1회
--
--    기존 5종은 registration_id 기준이지만 물어보기는 다르다.
--    "신청 건"이 아니라 "그 모임에 참여한 사람"에게 가는 알림이라
--    (회원, 모임)이 단위다. 재신청으로 registration_id가 새로 생겨도
--    같은 사람에게 두 번 가면 안 된다.
--
--    INSERT(pending) 단계에서 23505로 걸리므로 Solapi 발송 전에 차단된다.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_book_ask_unique
  ON public.notifications(recipient_id, meeting_id)
  WHERE type = 'book_ask';

-- 검증
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint WHERE conname = 'notifications_type_check';
--
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'notifications' AND indexname = 'idx_notifications_book_ask_unique';
