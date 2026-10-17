-- 모임 종류 넓히기 — 작업실(workshop) · 별책부록(event)  (2026-10-16 결정 「모임은 두 갈래」)
-- ⚠️ 초안 — 대표님이 Supabase SQL Editor에서 실행한다. 실행 전 아래 [0]으로 현재 정의를 먼저 읽어 대조한다.
-- 설계: docs/설계/specs/2026-10-14-기타모임-틀-설계.md §3
-- 순서: 이 SQL을 먼저 실행해도 안전하다(모임 폼에 선택지가 생기기 전까지 아무도 새 종류를 못 만든다).
--       이 SQL 없이 코드가 먼저 나가면 운영자가 작업실·별책부록을 고를 때 저장이 실패한다(돈·회원 영향 없음).
-- DB 함수(confirm_registration · register_transfer · promote_next_waitlisted · admin_confirm_transfer)는 고치지 않는다 —
-- 스텝 할인 가드가 이미 `meeting_type <> 'regular'`라 새 종류에 할인이 붙지 않는다.

-- [0] 현재 정의 확인 (읽기만)
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'meetings_meeting_type_check';
--   기대값: CHECK ((meeting_type = ANY (ARRAY['regular'::text, 'discussion'::text])))

-- [1] 넓히기
ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_meeting_type_check;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_meeting_type_check
  CHECK (meeting_type IN ('regular', 'discussion', 'workshop', 'event'));

-- [2] 확인
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'meetings_meeting_type_check';
