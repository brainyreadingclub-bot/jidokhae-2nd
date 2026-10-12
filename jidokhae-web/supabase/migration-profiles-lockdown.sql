-- migration-profiles-lockdown.sql
-- 2026-10-12 prod 적용 완료 (대표님이 SQL Editor에서 직접 실행, 사후 확인: anon·authenticated SELECT만, 정책 select 두 개)
-- 회원이 anon 키로 자기 profiles 행(role·is_staff·is_free 등)을 고치던 길을 닫는다.
-- 앱의 profiles 쓰기는 전부 service_role(API Route)이라 기능 영향 0.
-- 근거: docs/agent-team/조사/2026-10-12-회원권한구멍-고치기계획.md
begin;
drop policy if exists "profiles_update_own" on public.profiles;
revoke insert, update, delete, truncate, references, trigger
  on table public.profiles from anon, authenticated;
revoke insert, update, references
  on table public.profiles from public;
commit;
