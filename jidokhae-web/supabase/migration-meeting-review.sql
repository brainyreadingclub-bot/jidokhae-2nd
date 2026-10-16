-- ============================================================
-- 모임 후기 (1단계 — 칭찬 없음) — 표 1개 · 칸 1개 · RLS · CHECK 넓히기 · 공개 소감 함수
--
-- 🔴 실행 안 함 · 대표님 승인 뒤 SQL Editor에서 (2026-10-16 초안, 개발·운영)
--    대상 프로젝트 ref: ycqqzzvyixvtdorjxkrn (jidokhae-web/.env.local의 NEXT_PUBLIC_SUPABASE_URL)
--
-- 정본: 검토문서/DECISIONS.md 2026-10-12 「모임 후기」 · 2026-10-16 「칭찬은 후기를 먼저 내고…」
-- 계획서: 공유 가지 docs/시안-공유/2026-10-12-모임후기-DB계획/계획서-전문.md (§2·§3·§4)
-- 되돌리기: migration-meeting-review-rollback.sql
--
-- ⚠️ prod 읽기 결과 (2026-10-16 21:00 KST, service_role REST로 읽기만):
--    - meeting_reviews 표 · meeting_praises 표 · book_asks.answered_surface 칸이 **이미 있다** (행 0개).
--      계획서 §4-1(1회차)이 누군가에 의해 이미 실행된 것으로 보인다 — **저장소에 그 SQL 파일이 없었다.**
--      그래서 아래 1회차는 전부 IF NOT EXISTS / DROP IF EXISTS로 멱등하게 써 두었다(이미 있으면 그대로 지나간다).
--      🔴 단 CREATE TABLE IF NOT EXISTS는 표가 있으면 **안의 CHECK도 건너뛴다** — 이미 있는 표에
--      CHECK·RLS가 계획서대로 붙어 있는지는 아래 0단계 (2)·(3)으로 **반드시** 확인한다.
--    - get_region_public_comments 함수는 **없다** (PGRST202).
--    - notifications.type CHECK가 지금 몇 종인지는 REST로 못 읽었다 → 0단계 (1)로 확인.
--
-- 실행 순서 (각 단계를 따로 붙여 넣어 돌린다 — CREATE FUNCTION은 DDL과 따로)
--    0단계  사전 점검 (읽기만)
--    1단계  표·칸·RLS (DDL)
--    2단계  notifications CHECK 넓히기 + 중복 차단 인덱스
--    3단계  공개 소감 함수 (따로 돌린다)
--    4단계  확인 (읽기만)
--    (켜는 날) 스위치 행 INSERT — 코드 배포 · 템플릿 승인 · env 등록 뒤, 별도 승인
--
-- 칭찬(meeting_praises · get_my_received_praises · 칭찬 고치기 차단 트리거 · app_notifications
-- 'praise_received')은 **이 파일에 없다 — 2단계에서 추가한다** (대표님 2026-10-16: 후기가 잘 돌아가는 것을
-- 확인한 뒤 붙인다). prod에 이미 있는 meeting_praises 표는 이 파일이 건드리지 않는다.
-- ============================================================


-- ============================================================
-- 0단계 — 사전 점검 (읽기만)
-- ============================================================

-- (1) notifications.type CHECK 지금 정의. 2단계 목록이 「이것 + 'meeting_review'」와 정확히 같아야 한다.
--     다른 작업이 그 사이 알림 종류를 넓혔으면 2단계를 그대로 돌리는 순간 그 종류 INSERT가 깨진다
--     → 다르면 돌리지 말고 2단계 목록을 prod 기준으로 고친다
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'notifications_type_check';
--   기대 (2026-10-12 관리자 확인 기준 7종): 'meeting_remind','registration_confirm','waitlist_confirm',
--         'waitlist_promoted','waitlist_refunded','book_ask','new_member_welcome'

-- (2) 이미 있는 meeting_reviews에 붙은 CHECK — 기대: 아래 1단계의 meeting_reviews_* CHECK 10개 전부
-- select conname, pg_get_constraintdef(oid) from pg_constraint
-- where conrelid = 'public.meeting_reviews'::regclass order by conname;

-- (3) 이미 있는 RLS 정책 — 기대: meeting_reviews_select_own · meeting_reviews_select_admin 2개.
--     🔴 is_editor_or_admin 정책이 있으면 editor가 표정을 본다 → 1단계를 돌려 바로잡는다(정책은 DROP 후 다시 만든다)
-- select polname, pg_get_expr(polqual, polrelid) from pg_policy
-- where polrelid = 'public.meeting_reviews'::regclass;
-- select relrowsecurity from pg_class where oid = 'public.meeting_reviews'::regclass;   -- 기대: true

-- (4) 재사용하는 함수 — 기대: 2행 (is_admin · update_updated_at)
-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and proname in ('is_admin', 'update_updated_at');

-- (5) 행이 정말 0개인가 — 기대: 0 · 0. 0이 아니면 누가 이미 쓰고 있다는 뜻이다. 멈추고 확인한다
-- select (select count(*) from public.meeting_reviews) as reviews,
--        (select count(*) from public.book_asks where answered_surface is not null) as surfaces;


-- ============================================================
-- 1단계 — 표·칸·RLS (DDL만, 함수 없음)
-- forward-compatible: 새 표·NULL 칸만. 지금 코드는 스위치가 꺼져 있으면 이 표를 읽지 않는다
-- ============================================================

-- ① 후기 (회원+모임당 1행). 표정·아쉬운 점은 총괄운영자(admin)만 본다
create table if not exists public.meeting_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  did_not_attend boolean not null default false,
  mood smallint,
  regret_codes text[] not null default '{}',
  regret_other text,
  comment text,
  comment_public boolean not null default false,
  comment_published_at timestamptz,
  comment_unpublished_at timestamptz,                        -- 회원이 내린 시각
  comment_hidden_at timestamptz,                             -- 운영자(admin)가 내린 시각 — 판정 칸
  comment_hidden_by uuid references public.profiles(id) on delete set null,  -- 내린 운영자(기록용)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, meeting_id),
  constraint meeting_reviews_mood_range
    check (mood is null or mood between 1 and 5),
  constraint meeting_reviews_mood_xor_absent
    check ((did_not_attend and mood is null) or (not did_not_attend and mood is not null)),
  -- 코드 목록은 src/lib/review-rules.ts REGRET_OPTIONS와 같아야 한다
  constraint meeting_reviews_regret_codes_valid
    check (regret_codes <@ array['short_time','long_talk','unsmooth','hard_to_join',
                                 'space','book_fit','info','other']::text[]),
  -- 🔴 mood <= 2만 쓰면 mood가 NULL일 때 CHECK가 통과해 버린다 — mood is not null을 같이 건다
  constraint meeting_reviews_regret_low_mood_only
    check (cardinality(regret_codes) = 0 or (mood is not null and mood <= 2)),
  constraint meeting_reviews_regret_other_valid
    check (regret_other is null
           or ('other' = any(regret_codes) and char_length(regret_other) between 1 and 50)),
  constraint meeting_reviews_comment_len
    check (comment is null or char_length(comment) between 1 and 100),
  constraint meeting_reviews_absent_no_extras
    check (not did_not_attend or (comment is null and cardinality(regret_codes) = 0)),
  constraint meeting_reviews_public_needs_comment
    check (not comment_public or comment is not null),
  -- 운영자가 내린 소감은 회원이 다시 공개할 수 없다 (service_role 코드 실수도 23514로 거절)
  constraint meeting_reviews_hidden_not_public
    check (comment_hidden_at is null or not comment_public),
  constraint meeting_reviews_hidden_by_needs_at
    check (comment_hidden_by is null or comment_hidden_at is not null)
);

create index if not exists idx_meeting_reviews_meeting
  on public.meeting_reviews(meeting_id);
create index if not exists idx_meeting_reviews_public
  on public.meeting_reviews(meeting_id, comment_published_at desc)
  where comment_public;

-- 기존 함수 재사용 (migration.sql) — 0단계 (4)로 존재 확인
drop trigger if exists meeting_reviews_updated_at on public.meeting_reviews;
create trigger meeting_reviews_updated_at
  before update on public.meeting_reviews
  for each row execute function public.update_updated_at();

-- ② 칭찬 — 🚫 2단계에서 추가 (meeting_praises 표·인덱스·RLS·고치기 차단 트리거)

-- ③ book_asks — 어디서 담았나 (NULL = 후기 이전·구분 없음)
--    🔴 CHECK (x IN ('a', NULL)) 패턴 금지 — IN 목록의 NULL은 어떤 값이든 통과시킨다
alter table public.book_asks add column if not exists answered_surface text;
alter table public.book_asks drop constraint if exists book_asks_answered_surface_check;
alter table public.book_asks add constraint book_asks_answered_surface_check
  check (answered_surface is null or answered_surface in ('strip', 'meeting_detail', 'review'));

-- ④ RLS — 읽기만 정책, 쓰기는 API Route(service_role)
alter table public.meeting_reviews enable row level security;

drop policy if exists "meeting_reviews_select_own" on public.meeting_reviews;
create policy "meeting_reviews_select_own"
  on public.meeting_reviews for select to authenticated
  using (user_id = auth.uid());

-- 총괄운영자(admin)만 — editor는 못 본다 (대표님 답, 2026-10-12)
drop policy if exists "meeting_reviews_select_admin" on public.meeting_reviews;
create policy "meeting_reviews_select_admin"
  on public.meeting_reviews for select to authenticated
  using (public.is_admin());


-- ============================================================
-- 2단계 — notifications CHECK 넓히기 + 중복 차단 인덱스
-- 🔴 0단계 (1)의 결과와 한 글자씩 대조하고, 다르면 돌리지 않고 목록을 prod 기준으로 고친다
-- 이 단계는 코드가 meeting_review를 보내기(스위치 + env) **전에** 돌아 있어야 한다 — 아니면 23514로 발송 0
-- ============================================================

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'meeting_remind', 'registration_confirm',
    'waitlist_confirm', 'waitlist_promoted', 'waitlist_refunded',
    'book_ask',
    'new_member_welcome',
    'meeting_review'
  ));

-- 회원+모임당 1회 (book_ask와 같은 단위 — 신청 건이 아니라 「그 모임에 참여한 사람」)
-- INSERT(pending) 단계에서 23505로 걸려 Solapi 발송 전에 차단된다
create unique index if not exists idx_notifications_meeting_review_unique
  on public.notifications(recipient_id, meeting_id)
  where type = 'meeting_review';

-- app_notifications 'praise_received' — 🚫 2단계(칭찬)에서 추가


-- ============================================================
-- 3단계 — 공개 소감 함수 (따로 돌린다)
-- ============================================================

-- 같은 지역 · 정기 · active · 그 모임보다 앞선 모임 · 최근 180일(KST 오늘 기준)의 공개 소감.
-- 비로그인도 읽는다(anon). 닉네임 · 소감 · 모임일 셋만 돌려준다 — 실명·user_id·표정·아쉬운 점 없음.
-- 운영자가 내린 것은 CHECK상 이미 비공개지만, 공개 경로는 두 겹으로 막는다(comment_hidden_at is null)
create or replace function public.get_region_public_comments(
  p_meeting_id uuid,
  p_limit integer default 3
)
returns table(nickname text, comment text, meeting_date date)
language sql
security definer
set search_path = ''
stable
as $$
  select p.nickname, r.comment, m.date
  from public.meetings t
  join public.meetings m
    on m.region = t.region
   and m.meeting_type = 'regular'
   and m.status = 'active'
   and m.date < t.date
   and m.date >= ((now() at time zone 'Asia/Seoul')::date - 180)
  join public.meeting_reviews r on r.meeting_id = m.id
  join public.profiles p on p.id = r.user_id
  where t.id = p_meeting_id
    and t.meeting_type = 'regular'
    and r.comment_public = true
    and r.comment_hidden_at is null
    and r.comment is not null
    and r.did_not_attend = false
    and coalesce(p.nickname, '') <> ''
  order by m.date desc, r.comment_published_at desc nulls last
  limit least(greatest(coalesce(p_limit, 3), 1), 20);
$$;

revoke execute on function public.get_region_public_comments(uuid, integer) from public;
grant execute on function public.get_region_public_comments(uuid, integer) to anon, authenticated;


-- ============================================================
-- 4단계 — 확인 (읽기만)
-- ============================================================
-- select relrowsecurity from pg_class where oid = 'public.meeting_reviews'::regclass;      -- true
-- select polname, pg_get_expr(polqual, polrelid) from pg_policy
-- where polrelid = 'public.meeting_reviews'::regclass;                                     -- own · admin(is_admin) 2개
-- select count(*) from pg_constraint where conrelid = 'public.meeting_reviews'::regclass
--   and contype = 'c';                                                                     -- 10
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'notifications_type_check';  -- 8종
-- select indexname from pg_indexes where indexname = 'idx_notifications_meeting_review_unique';    -- 1행
-- select p.proname, p.proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'get_region_public_comments';                 -- anon·authenticated
-- select * from public.get_region_public_comments('00000000-0000-0000-0000-000000000000');  -- 0행 (에러 아님)


-- ============================================================
-- (켜는 날) 스위치 — 🔴 이 파일을 돌릴 때 같이 돌리지 않는다. 별도 승인
--   전제: 코드 머지·배포 · 새 알림톡 템플릿 승인 · env SOLAPI_TEMPLATE_MEETING_REVIEW 등록 → 재배포
--   켜면: 다음 날 10:00부터 책 담기 대신 후기 알림톡, /my 후기 분기, 나 탭 「내가 남긴 후기」,
--         모임 상세 「지난 모임에서 남긴 한 줄」
--   끄기(1순위 되돌리기): update public.site_settings set value = 'off' where key = 'review_enabled';
-- ============================================================
-- insert into public.site_settings (key, value) values ('review_enabled', 'on')
--   on conflict (key) do update set value = excluded.value;
