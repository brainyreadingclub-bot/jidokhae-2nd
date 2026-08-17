-- migration-discussion-thread.sql
-- 발제 스레드 + 인앱 알림. 2026-08-17 전면개편 설계서 §7.
-- 실행: Supabase SQL Editor에서 수동. 문단(①~⑦)별로 나눠 실행할 것.

-- ① 큐레이터 판정: admin · editor · is_staff
--    src/lib/curator.ts isCurator()와 동기 필수
create or replace function public.is_curator()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role in ('admin', 'editor') or is_staff = true)
  );
$$;

-- ② 발제문
create table public.discussion_topics (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  topic_no int not null,
  title text not null,
  quote text,
  quote_page text,
  question text not null,
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, topic_no)
);

-- ③ 답변 (pinned = 운영자의 "모임에서 이어가요")
create table public.topic_answers (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.discussion_topics(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_topic_answers_topic on public.topic_answers(topic_id, created_at);

-- ④ 답글
create table public.answer_replies (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.topic_answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index idx_answer_replies_answer on public.answer_replies(answer_id, created_at);

-- ⑤ 공감 (1인 1회)
create table public.answer_reactions (
  answer_id uuid not null references public.topic_answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (answer_id, user_id)
);

-- ⑥ 인앱 알림
create table public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in
    ('answer_reply', 'answer_reaction', 'topic_posted', 'flash_opened',
     'flash_cancelled', 'registration_confirmed')),
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_app_notifications_user
  on public.app_notifications(user_id, created_at desc);
create index idx_app_notifications_unread
  on public.app_notifications(user_id) where read_at is null;

-- ⑦ RLS — 읽기는 회원 전체(발제·답변·답글·공감), 알림은 본인만.
--    쓰기는 전부 API Route(service_role) 경유라 정책 불요.
alter table public.discussion_topics enable row level security;
alter table public.topic_answers enable row level security;
alter table public.answer_replies enable row level security;
alter table public.answer_reactions enable row level security;
alter table public.app_notifications enable row level security;

create policy "topics readable by authenticated"
  on public.discussion_topics for select to authenticated using (true);
create policy "answers readable by authenticated"
  on public.topic_answers for select to authenticated using (true);
create policy "replies readable by authenticated"
  on public.answer_replies for select to authenticated using (true);
create policy "reactions readable by authenticated"
  on public.answer_reactions for select to authenticated using (true);
create policy "notifications readable by owner"
  on public.app_notifications for select to authenticated
  using (user_id = auth.uid());
