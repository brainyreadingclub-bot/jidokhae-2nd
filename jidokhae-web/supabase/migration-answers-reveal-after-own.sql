-- migration-answers-reveal-after-own.sql
-- 발제 답변 「응답 후 공개(써야 보인다)」 — 2026-10-15 대표님 결정.
--
-- 바뀌는 것
--   신청자는 어떤 발제에 자기 답을 남겨야 그 발제의 다른 답(답글·공감 포함)을 읽는다. 안 쓴 발제는 잠김.
--   운영진(is_curator)과 그 모임 발제자는 지금처럼 다 읽는다. 자기 답은 언제나 읽는다.
--   켜고 끄는 값은 모임 단위 칸 meetings.answers_reveal_after_own —
--     NULL(기본) = 모임 종류를 따른다(토론모임만 켜짐) / true = 켜짐 / false = 꺼짐.
--   잠겨 있어도 「n명이 답했어요」 숫자는 보인다 — 숫자만 돌려주는 함수를 따로 둔다(내용·이름 없음).
--
-- 코드 쪽 기준: src/lib/answer-access-rules.ts (isRevealAfterOwnOn · topicAnswerView) — 둘이 같아야 한다.
-- 앞선 규칙: migration-answers-private.sql (신청자 + 운영진). 이 파일은 그 판정 함수만 바꾼다 —
--   읽기 규칙(정책) 3개는 이미 can_read_topic_answers / can_read_answer를 부르므로 그대로 둔다.
--
-- 순서 — 코드 배포와 순서를 가리지 않는다
--   · SQL 먼저: 옛 코드는 답변을 서버 권한으로 읽어 화면은 지금 그대로(신청자 전부 열람). DB 직접 조회만 좁아진다
--   · 코드 먼저: 새 코드는 칸이 없으면 모임 종류로 판정하고, 숫자 함수가 없으면 작성자 칸만 읽어 센다
-- 실행: Supabase SQL Editor에서 ① → ② → ③ 따로따로. 실행 전 대상 프로젝트가 ycqqzzvyixvtdorjxkrn인지 확인

-- ① 모임 단위 설정 칸 (기존 모임은 전부 NULL = 종류 기본값 — 데이터를 바꾸지 않는다)
alter table public.meetings
  add column if not exists answers_reveal_after_own boolean;

comment on column public.meetings.answers_reveal_after_own is
  '발제 답변 응답 후 공개. NULL=모임 종류 기본(discussion만 켜짐), true=켜짐, false=꺼짐. 2026-10-15';


-- ② 판정 함수 교체 (CREATE FUNCTION은 따로 실행)
create or replace function public.can_read_topic_answers(p_topic_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.is_curator() or exists (
    select 1
      from public.discussion_topics t
      join public.meetings m on m.id = t.meeting_id
      join public.registrations r on r.meeting_id = t.meeting_id
     where t.id = p_topic_id
       and r.user_id = auth.uid()
       and (
         -- 그 모임 발제자 — 다 읽는다
         (r.is_presenter and r.status = 'confirmed')
         or (
           r.status in ('confirmed', 'pending_transfer')
           and (
             -- 응답 후 공개가 꺼진 모임이면 신청자는 다 읽는다
             not coalesce(m.answers_reveal_after_own, m.meeting_type = 'discussion')
             -- 켜진 모임이면 이 발제에 자기 답이 있어야 읽는다
             or exists (
               select 1 from public.topic_answers a
                where a.topic_id = t.id
                  and a.user_id = auth.uid()
             )
           )
         )
       )
  );
$$;


-- ③ 「n명이 답했어요」 숫자 함수 — 발제별 답한 사람 수만 돌려준다(본문·이름·누가 답했는지 없음).
--    공개된 발제만 센다. 신청 여부와 상관없이 숫자는 보인다(2026-10-13 결정: 미신청자도 수는 본다)
create or replace function public.get_topic_answerer_counts(p_topic_ids uuid[])
returns table (topic_id uuid, answerer_count integer)
language sql
security definer
set search_path = ''
stable
as $$
  select t.id, count(distinct a.user_id)::integer
    from public.discussion_topics t
    left join public.topic_answers a on a.topic_id = t.id
   where t.id = any (p_topic_ids)
     and t.published_at is not null
   group by t.id;
$$;

revoke all on function public.get_topic_answerer_counts(uuid[]) from public, anon;
grant execute on function public.get_topic_answerer_counts(uuid[]) to authenticated, service_role;


-- 확인 (읽기만)
--   select column_name, data_type from information_schema.columns
--    where table_schema = 'public' and table_name = 'meetings' and column_name = 'answers_reveal_after_own';
--   -- 기대: 1행, boolean
--   select proname from pg_proc where proname in ('can_read_topic_answers', 'get_topic_answerer_counts');
--   -- 기대: 2행
--   select * from public.get_topic_answerer_counts(array(select id from public.discussion_topics where published_at is not null));
--   -- 기대: 공개된 발제마다 한 줄, 숫자만
--
-- 모임 하나만 끄기 / 켜기 (필요할 때만)
--   update public.meetings set answers_reveal_after_own = false where id = '<모임 id>';
--   update public.meetings set answers_reveal_after_own = null  where id = '<모임 id>';  -- 종류 기본으로
--
-- 되돌리기 (2026-10-13 규칙 = 신청자 + 운영진으로)
--   ②를 migration-answers-private.sql ①의 can_read_topic_answers 본문으로 다시 실행
--   drop function if exists public.get_topic_answerer_counts(uuid[]);
--   alter table public.meetings drop column if exists answers_reveal_after_own;   -- 칸은 남겨 둬도 해가 없다
