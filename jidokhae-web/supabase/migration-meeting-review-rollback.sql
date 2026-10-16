-- ============================================================
-- 모임 후기 되돌리기 — 🔴 실행 안 함 · 대표님 승인 뒤 SQL Editor에서
--
-- 1순위는 SQL이 아니다 — 스위치를 끈다(데이터는 남는다):
--   update public.site_settings set value = 'off' where key = 'review_enabled';
-- 코드 문제면 git revert -m 1 <merge-sha> (코드만, DB 그대로).
--
-- 표까지 걷어야 할 때만 아래. 전제: 스위치 off + 코드 revert 완료(코드가 아직 이 표를 읽으면 화면이 깨진다).
-- 🔴 지우기 전에 떠 둔다 — 회원이 쓴 후기는 되살릴 수 없다:
--   select * from public.meeting_reviews;
-- ============================================================

-- 3단계 되돌리기
drop function if exists public.get_region_public_comments(uuid, integer);

-- 1단계 되돌리기
drop table if exists public.meeting_reviews;
alter table public.book_asks drop constraint if exists book_asks_answered_surface_check;
alter table public.book_asks drop column if exists answered_surface;

-- ⚠️ meeting_praises(칭찬)는 이 파일이 만들지 않았으므로 지우지 않는다.
--    prod에는 2026-10-16 읽기 때 이미 있었다(행 0개) — 2단계(칭찬) 파일이 기록·되돌리기를 맡는다.

-- 2단계 — 🔴 되돌리지 않기를 권한다.
--   넓힌 CHECK는 지금 코드에 무해하다(상위집합). 좁히려면 meeting_review 행을 먼저 지워야 하는데,
--   notifications는 발송 이력이라 지우면 「무엇이 나갔는지」 기록이 사라진다.
--   꼭 좁혀야 하면 아래 순서 — 행 처리는 대표님 승인 뒤:
-- drop index if exists public.idx_notifications_meeting_review_unique;
-- (meeting_review 행 처리)
-- alter table public.notifications drop constraint notifications_type_check;
-- alter table public.notifications add constraint notifications_type_check check (type in (
--   'meeting_remind','registration_confirm','waitlist_confirm','waitlist_promoted',
--   'waitlist_refunded','book_ask','new_member_welcome'));
