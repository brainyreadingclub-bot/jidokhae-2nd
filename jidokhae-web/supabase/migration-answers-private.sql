-- migration-answers-private.sql
-- 발제 답변 읽기 범위를 「그 모임 신청자(confirmed·pending_transfer) + 운영진(is_curator)」으로 좁힌다.
-- 2026-10-13 대표님 결정. 코드 쪽 기준: src/lib/answer-access-rules.ts canReadAnswers — 둘이 같아야 한다.
--
-- 왜 DB도 좁히나: 앱 화면은 전부 서버(service_role)로 읽어서 이미 코드에서 걸러진다.
-- 하지만 기존 규칙(qual true)이면 로그인한 회원 누구나 공개 키로 표를 직접 조회해 본문을 읽을 수 있다.
-- 순서: 앱이 이 표들을 회원 권한으로 읽지 않으므로 **코드 배포 전·후 어느 쪽에 실행해도 화면이 안 바뀐다.**
-- 실행: Supabase SQL Editor에서 ①을 먼저, 그다음 ②.

-- ① 판정 함수 (CREATE FUNCTION은 따로 실행)
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
      join public.registrations r on r.meeting_id = t.meeting_id
     where t.id = p_topic_id
       and r.user_id = auth.uid()
       and r.status in ('confirmed', 'pending_transfer')
  );
$$;

create or replace function public.can_read_answer(p_answer_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.topic_answers a
     where a.id = p_answer_id
       and (a.user_id = auth.uid() or public.can_read_topic_answers(a.topic_id))
  );
$$;

-- ② 읽기 규칙 교체 — 자기 글은 언제나 본다(취소해도 자기 답변이 사라진 것처럼 보이면 안 된다)
drop policy if exists "answers readable by authenticated" on public.topic_answers;
create policy "answers readable by applicants and curators"
  on public.topic_answers for select to authenticated
  using (user_id = auth.uid() or public.can_read_topic_answers(topic_id));

drop policy if exists "replies readable by authenticated" on public.answer_replies;
create policy "replies readable by applicants and curators"
  on public.answer_replies for select to authenticated
  using (user_id = auth.uid() or public.can_read_answer(answer_id));

drop policy if exists "reactions readable by authenticated" on public.answer_reactions;
create policy "reactions readable by applicants and curators"
  on public.answer_reactions for select to authenticated
  using (user_id = auth.uid() or public.can_read_answer(answer_id));

-- 확인 (정책 3개가 바뀌었는지)
--   select tablename, policyname, qual from pg_policies
--    where tablename in ('topic_answers', 'answer_replies', 'answer_reactions');
--
-- 되돌리기
--   drop policy "answers readable by applicants and curators" on public.topic_answers;
--   create policy "answers readable by authenticated" on public.topic_answers for select to authenticated using (true);
--   (replies·reactions도 같은 모양으로)
