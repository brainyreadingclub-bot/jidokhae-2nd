-- 비로그인 로그인/웰컴 화면 회원수 카운트업용. 카운트만 반환(PII 0).
create or replace function public.get_member_count()
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::int from public.profiles;
$$;

grant execute on function public.get_member_count() to anon, authenticated;
