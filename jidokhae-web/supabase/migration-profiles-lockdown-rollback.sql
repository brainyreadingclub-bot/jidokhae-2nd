-- migration-profiles-lockdown-rollback.sql
-- ⚠️ 되돌리면 구멍이 다시 열린다. 기능이 42501로 깨졌을 때의 임시 복구용
-- 실행 전 권한(2026-10-12 기록): anon·authenticated = DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
begin;
grant insert, update, delete, truncate, references, trigger
  on table public.profiles to anon, authenticated;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
commit;
