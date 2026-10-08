-- 2026-10-27(화) 토론모임 1건 생성 + 책 연결
--
-- 왜 SQL인가 — 이 세션에서는 prod 쓰기가 권한 분류기에 막혀 실행할 수 없었다.
-- 운영자 폼(MeetingForm + BookPicker)이 거치는 경로를 **같은 컬럼 구성으로** 옮겨 적은 것이다.
--   1) BookPicker → /api/books/search(카카오 v3/search/book) → /api/admin/books → lib/library.ts upsertBook
--   2) MeetingForm → meetings insert (title/description/date/time/location/venue_id/
--      capacity/fee/region/is_featured/meeting_type/book_id/selection_reason + status='active')
--   폼이 보내지 않는 컬럼(chat_link·reading_link·detail_address)은 여기서도 건드리지 않는다.
--
-- 책 값은 2026-10-08에 카카오 도서 API를 **실제로 호출해** 받은 값이다(지어낸 값 아님).
--   query='실연당한 사람들을 위한 일곱 시 조찬모임' · sort=accuracy · 첫 행(제목 정확 일치, 2025 개정판)
--   mapKakaoDocument 정규화: isbn13 = normalizeIsbn13('1173322345 9791173322341') = '9791173322341'
--
-- 🔴 토론모임 스위치는 건드리지 않는다 — site_settings.discussion_meeting_enabled 는 'off' 그대로.
--    OFF인 동안 회원 노출은 0이다(home·meet·talk·상세가 전부 isDiscussionMeetingEnabled()를 본다).
--    비로그인 공개 목록(/policy/meetings)은 플래그와 무관하게 토론모임을 항상 제외한다.
-- 🔴 신청자는 넣지 않는다. 발제자도 신청자로 넣지 않는다(2026-10-08 확정).
--
-- 실행 후 확인 쿼리는 파일 맨 아래. 되돌리기는 data-2026-10-27-discussion-meeting-rollback.sql

-- 같은 날짜 토론모임이 이미 있으면 아무것도 하지 않는다(중복 생성 방지).
WITH guard AS (
  SELECT NOT EXISTS (
    SELECT 1 FROM public.meetings
    WHERE date = '2026-10-27' AND meeting_type = 'discussion'
  ) AS ok
),
-- upsertBook: isbn13이 같은 책이 있으면 재사용, 없으면 insert
existing_book AS (
  SELECT id FROM public.books WHERE isbn13 = '9791173322341'
),
new_book AS (
  INSERT INTO public.books (isbn13, title, authors, publisher, thumbnail, description)
  SELECT
    '9791173322341',
    '실연당한 사람들을 위한 일곱 시 조찬모임',
    '백영옥',
    '김영사',
    'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F6935892%3Ftimestamp%3D20260701151218',
    '책의 만듦새에 감성을 불어넣었다. 임선애 감독이 연출하고 수지·이진욱 배우가 주연을 맡은 영화화로 그 의미를 더한다.  보통의 하루가 막 시작되는 오전 일곱 시에 특별한 모임이 열린다. 이름하여 ‘실연당한 사람들을 위한 일곱 시 조찬모임.’ 실연당한 사람들이 모여 아침 식사를 하고, 실연을 다룬 영화를 보고, 각자가 가지고 온 실연 기념품을 교환하며 주인공들의 인연이 얽히기 시작한다. 피처럼 격렬한 만남이 물처럼 담담한 상실이 되기까지 상처를 보듬고 마침내'
  WHERE NOT EXISTS (SELECT 1 FROM existing_book)
    AND (SELECT ok FROM guard)
  RETURNING id
),
book AS (
  SELECT id FROM existing_book
  UNION ALL
  SELECT id FROM new_book
)
INSERT INTO public.meetings (
  title, description, date, time, location, venue_id,
  capacity, fee, region, is_featured, meeting_type, book_id, selection_reason, status
)
SELECT
  '실연당한 사람들을 위한 일곱 시 조찬모임',
  '19:00에 시작해 21:30에 마쳐요.',
  '2026-10-27',
  '19:00',
  '공간 지그시',
  'c30c04f3-3323-46d0-a9e6-2ce0a084046f',  -- venues: 공간 지그시
  10,
  25000,
  '포항',
  false,
  'discussion',
  book.id,
  NULL,
  'active'
FROM book
WHERE (SELECT ok FROM guard);

-- ── 확인 ──
-- SELECT m.*, b.title AS book_title, b.authors, b.publisher, b.thumbnail, b.description
-- FROM public.meetings m LEFT JOIN public.books b ON b.id = m.book_id
-- WHERE m.date = '2026-10-27' AND m.meeting_type = 'discussion';
--
-- SELECT count(*) FROM public.registrations r
-- JOIN public.meetings m ON m.id = r.meeting_id
-- WHERE m.date = '2026-10-27' AND m.meeting_type = 'discussion';   -- 0 이어야 한다
--
-- SELECT key, value FROM public.site_settings WHERE key = 'discussion_meeting_enabled';  -- 'off' 그대로
