-- data-2026-10-27-discussion-meeting.sql 되돌리기
--
-- 🔴 신청이 한 건이라도 붙은 뒤에는 DELETE 하지 않는다. 결제·환불 이력이 매달린 행이다.
--    그때는 운영자 화면의 모임 삭제(status='deleting' → 일괄 환불 → 'deleted')를 쓴다.
--    아래 DELETE는 **신청 0건**일 때만 안전하다.

-- 1) 신청이 정말 0건인지 먼저 센다
SELECT count(*) AS registrations
FROM public.registrations r
JOIN public.meetings m ON m.id = r.meeting_id
WHERE m.date = '2026-10-27' AND m.meeting_type = 'discussion';

-- 2) 0건이면 모임 삭제
DELETE FROM public.meetings
WHERE date = '2026-10-27'
  AND meeting_type = 'discussion'
  AND NOT EXISTS (
    SELECT 1 FROM public.registrations r WHERE r.meeting_id = public.meetings.id
  );

-- 3) 책은 다른 모임·서재가 공유할 수 있다. 아무도 안 쓸 때만 지운다.
--    library_entries.book_id 가 ON DELETE CASCADE 라 이 가드가 없으면
--    회원 서재 항목이 조용히 함께 지워진다 (migration-library.sql:33).
--    book_asks 에는 book_id 가 없다(모임 단위 테이블) — 그래서 여기서 보지 않는다.
DELETE FROM public.books b
WHERE b.isbn13 = '9791173322341'
  AND NOT EXISTS (SELECT 1 FROM public.meetings m WHERE m.book_id = b.id)
  AND NOT EXISTS (SELECT 1 FROM public.library_entries e WHERE e.book_id = b.id);
