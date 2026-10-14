-- migration-home-upcoming-clicks.sql
-- 홈 「다가오는 정기모임」 클릭 기록. 2026-10-13 대표님 결정.
--   target = 'meeting' : 모임 카드(「신청하기」 포함 — 같은 클릭) → meeting_id 필수, position = 1~3
--   target = 'more'    : 「다른 일정도 보기」 → meeting_id 없음
-- 쓰기는 서버(service_role)만 — /meet/[id]?from=home_upcoming, /meet?from=home_upcoming_more 에서 after()로.
-- 회원용 읽기·쓰기 규칙은 두지 않는다 (RLS ON + 정책 0개 = 회원 접근 불가).
-- 배포 순서를 타지 않는다 — 표가 없으면 기록 insert만 실패하고 화면은 그대로다
-- (src/lib/home-upcoming-click.ts가 에러를 삼킨다).

create table if not exists public.home_upcoming_clicks (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  target text not null check (target in ('meeting', 'more')),
  meeting_id uuid references public.meetings(id) on delete cascade,
  position smallint,
  clicked_at timestamptz not null default now(),
  constraint home_upcoming_clicks_target_meeting
    check ((target = 'meeting') = (meeting_id is not null))
);
alter table public.home_upcoming_clicks enable row level security;
create index if not exists idx_home_upcoming_clicks_user_meeting
  on public.home_upcoming_clicks (user_id, meeting_id, clicked_at);

-- 세는 법 ① 카드를 누른 뒤 그 모임을 신청한 회원 수 (나중에 취소한 사람 포함)
--   select count(distinct c.user_id)
--     from public.home_upcoming_clicks c
--     join public.registrations r
--       on r.user_id = c.user_id and r.meeting_id = c.meeting_id and r.created_at >= c.clicked_at
--    where c.target = 'meeting';
--
-- 세는 법 ② 「다른 일정도 보기」를 누른 뒤 24시간 안에 정기모임을 신청한 회원 수 (나중에 취소한 사람 포함)
--   select count(distinct c.user_id)
--     from public.home_upcoming_clicks c
--     join public.registrations r
--       on r.user_id = c.user_id
--      and r.created_at between c.clicked_at and c.clicked_at + interval '24 hours'
--     join public.meetings m on m.id = r.meeting_id and m.meeting_type = 'regular'
--    where c.target = 'more';
