-- ============================================================
-- 돈을 움직이는 SECURITY DEFINER 함수 4개 — 실행 권한을 service_role로만 잠근다
-- ✅ prod 실행 완료: 2026-10-09 22시경 KST (관리자, 대표님 승인)
--    🔴 이 파일은 **기록**이다. prod에 다시 돌릴 필요 없다(돌려도 결과는 같다)
-- ============================================================
--
-- 왜
--   아래 네 함수는 SECURITY DEFINER(소유자 권한으로 돈다)인데 실행 권한이
--   PUBLIC·anon·authenticated에 열려 있었다. 즉 **anon 키만 있으면 PostgREST
--   `/rpc/...`로 직접 부를 수 있었다** — 결제 없이 `confirmed` 신청을 INSERT하거나
--   (`confirm_registration`), 입금 확인을 위조하는(`admin_confirm_transfer`) 구조였다.
--   앱 호출부는 전부 `createServiceClient()`(service_role)라 잠가도 앱 동작은 그대로다.
--
--   열려 있던 경위 — 저장소 마이그레이션은 이 함수들을 만들기만 하고 권한을 건드리지
--   않았다. Postgres 기본값(PUBLIC EXECUTE) + Supabase 기본 권한(anon·authenticated·
--   service_role)이 그대로 남았다. `migration-phase3-m7-step2-5.sql`은
--   `admin_confirm_transfer`를 authenticated에 **명시적으로** GRANT까지 했다.
--
-- 실행 결과 (2026-10-09, 관리자 확인)
--   - proacl = {postgres=X, service_role=X} (네 함수 모두)
--   - anon 키로 호출 → 401 / 42501(permission denied)
--   - service_role로 호출 → 정상 (가짜 id로 not_found / 빈 결과, 쓰기 0건)
--
-- 🔴 이 네 함수를 DROP 후 재생성하면 Supabase 기본 권한으로 **다시 열린다.**
--    재생성(DROP + CREATE) 마이그레이션 끝에는 아래 REVOKE를 **반드시** 붙일 것.
--    `CREATE OR REPLACE`는 기존 권한을 유지하지만, 시그니처·반환형이 바뀌면 DROP이
--    필요해지고 그 순간 잠금이 풀린다. 예: `migration-waitlist-card-only.sql`
--    (promote_next_waitlisted DROP+CREATE) — 그 파일에도 같은 REVOKE를 붙여 두었다.
--    `migration-phase3-m7-step2-5.sql`을 다시 돌려도 authenticated GRANT로 풀린다.
--
-- 확인 쿼리 (기대값: 네 행 모두 {postgres=X/postgres,service_role=X/postgres} 형태)
--   select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.proacl
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('confirm_registration','admin_confirm_transfer',
--                       'register_transfer','promote_next_waitlisted');
--
-- 롤백: migration-lock-definer-rpcs-rollback.sql (다시 여는 것이다 — 쓸 일이 없어야 한다)
-- ============================================================

BEGIN;
REVOKE EXECUTE ON FUNCTION public.confirm_registration(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_confirm_transfer(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_transfer(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_next_waitlisted(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_registration(uuid, uuid, text, integer), public.admin_confirm_transfer(uuid), public.register_transfer(uuid, uuid, integer), public.promote_next_waitlisted(uuid) TO service_role;
COMMIT;
