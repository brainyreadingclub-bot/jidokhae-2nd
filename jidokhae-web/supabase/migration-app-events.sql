-- ============================================================
-- 공통 기록표 app_events — Schema Migration (2026-10-14)
-- ============================================================
--
-- 배경
--   홈 「다가오는 정기모임」 클릭을 세려고 전용 표(home_upcoming_clicks)를 만들려다
--   — 실행 전에 — 공통 표 하나로 바꿨다. 기록할 일이 생길 때마다 표를 늘리지 않는다.
--   이벤트 목록·이름 규칙·넣으면 안 되는 것의 정본:
--     docs/agent-team/기록표-이벤트-목록.md  +  src/lib/app-events.ts 의 APP_EVENTS
--
-- 변경 내용
--   - public.app_events 테이블 신설
--   - 색인 2개 (이벤트별 시간순 / 회원별)
--   - RLS ON + 정책 0개 + anon·authenticated 권한 회수 = 회원은 읽지도 쓰지도 못한다.
--     쓰기는 서버(service_role)만, 읽기는 SQL Editor에서 운영자가 센다
--
-- 적용 순서 — 코드 배포와 순서를 가리지 않는다
--   recordAppEvent()가 insert 실패를 삼키고 console.warn만 남긴다.
--   표가 없으면 기록만 안 남고 화면·신청은 그대로다. (payment_failures와 같은 방식)
--
-- 개인정보
--   props에 실명·전화·이메일·결제 식별자를 넣지 않는다. 코드(sanitizeEventProps)가 지운다.
--   이 표에 남는 회원 식별은 user_id(uuid)뿐이다.
--
-- 보관 기간 — 미정 (대표님 결정 대기). 정해지면 지우는 방법을 따로 붙인다
--
-- 롤백: migration-app-events-rollback.sql (기록이 통째로 사라진다 — 지우기 전에 SELECT로 떠 둘 것)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 「화면.행동」 — 영어 소문자·숫자·밑줄, 점 하나 (예: home_upcoming.meeting_click)
  -- CHECK는 **형식만** 본다. 목록(어떤 이름이 있나)은 코드의 APP_EVENTS가 지킨다 —
  -- 목록까지 CHECK에 넣으면 이벤트를 하나 더할 때마다 SQL을 다시 돌려야 하고,
  -- SQL보다 코드가 먼저 나가면 새 이벤트 기록이 전부 거절된다.
  event TEXT NOT NULL
    CHECK (char_length(event) <= 64 AND event ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),

  -- 누가. 지금 이벤트는 전부 로그인 화면에서 나서 늘 채워진다.
  -- NULL을 열어 둔 이유 — 공개 페이지(policy/*) 이벤트를 나중에 더할 자리. 회원 단위 세기에선 NULL을 뺀다.
  -- 회원이 탈퇴(profiles 삭제)하면 그 회원의 기록도 같이 지운다.
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- 어느 모임 (해당 없으면 NULL). 모임은 소프트 삭제(status='deleted')라 행이 실제로 지워질 일은 거의 없다.
  -- 그래도 지워지면 기록은 남기고 모임 칸만 비운다 — 클릭 수 자체는 사실이다.
  -- 코드가 넣는 모임은 상세가 정상으로 열린 뒤(=있는 모임)라 FK 거절로 기록을 잃을 일은 없다.
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,

  -- 덧붙이는 값 (문자열·숫자·참거짓만, 키 10개·문자열 100자 — 코드가 자른다). 여기선 크기만 한 번 더 막는다
  props JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(props) = 'object' AND octet_length(props::text) <= 2048),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 이벤트별 시간순 (아래 세는 SQL의 기본 경로)
CREATE INDEX IF NOT EXISTS idx_app_events_event_created
  ON public.app_events (event, created_at);

-- 회원별 (회원 단위 세기 · 탈퇴 시 CASCADE)
CREATE INDEX IF NOT EXISTS idx_app_events_user
  ON public.app_events (user_id);

COMMENT ON TABLE public.app_events IS
  '공통 기록표 (2026-10-14). 이벤트 목록은 src/lib/app-events.ts APP_EVENTS + docs/agent-team/기록표-이벤트-목록.md. 쓰기는 service_role만. 보관 기간 미정.';

-- ============================================================
-- RLS — 정책 0개 = anon·authenticated는 아무것도 못 한다 (service_role은 RLS를 우회)
-- 권한도 회수해 둔다 — Supabase는 public 표에 anon·authenticated 권한을 기본으로 준다
-- ============================================================

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_events FROM anon, authenticated;

-- ============================================================
-- 확인 (실행 후)
-- ============================================================
-- select column_name, data_type, is_nullable from information_schema.columns
--  where table_schema = 'public' and table_name = 'app_events' order by ordinal_position;
--   기대: id, event, user_id, meeting_id, props, created_at (6행)
-- select policyname from pg_policies where tablename = 'app_events';   -- 기대: 0행
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name = 'app_events' and grantee in ('anon', 'authenticated');   -- 기대: 0행

-- ============================================================
-- 세는 SQL (참고용 — 읽기만 한다)
-- ============================================================
--
-- ① 홈 「다가오는 정기모임」 카드를 누른 뒤 그 모임을 신청한 회원 수 (회원 단위)
--    · 누른 회원        = 카드를 한 번이라도 누른 회원
--    · 신청해 둔 회원   = 누른 뒤 그 모임 신청이 생겼고, 지금 confirmed·pending_transfer
--    · 신청했던 회원    = 누른 뒤 그 모임 신청이 생겼다 (나중에 취소·대기 포함 — 「신청은 했다」)
--   select count(distinct e.user_id)                                                      as clicked,
--          count(distinct e.user_id) filter (where r.status in ('confirmed', 'pending_transfer')) as signed_up_kept,
--          count(distinct e.user_id) filter (where r.id is not null)                       as signed_up_ever
--     from public.app_events e
--     left join public.registrations r
--       on r.user_id = e.user_id
--      and r.meeting_id = e.meeting_id
--      and r.created_at >= e.created_at
--    where e.event = 'home_upcoming.meeting_click'
--      and e.user_id is not null;
--
-- ② 「다른 일정도 보기」를 누른 뒤 24시간 안에 정기모임을 신청한 회원 수 (2026-10-13 대표님 결정, 회원 단위)
--   select count(distinct e.user_id)                                                      as clicked,
--          count(distinct e.user_id) filter (where r.status in ('confirmed', 'pending_transfer')) as signed_up_kept,
--          count(distinct e.user_id) filter (where r.id is not null)                       as signed_up_ever
--     from public.app_events e
--     left join (public.registrations r
--                join public.meetings m on m.id = r.meeting_id and m.meeting_type = 'regular')
--       on r.user_id = e.user_id
--      and r.created_at between e.created_at and e.created_at + interval '24 hours'
--    where e.event = 'home_upcoming.more_click'
--      and e.user_id is not null;
--
--   기간을 자르려면 두 쿼리 모두 where에
--     and e.created_at >= '2026-10-15 00:00+09'   (KST로 적는다 — +09를 빼면 UTC로 읽혀 9시간 밀린다)
