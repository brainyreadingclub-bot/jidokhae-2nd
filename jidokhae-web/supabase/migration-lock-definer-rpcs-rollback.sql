-- ============================================================
-- 롤백 — migration-lock-definer-rpcs.sql 되돌리기
-- ============================================================
--
-- 🔴 이것은 **잠금을 다시 여는** 파일이다. anon 키만으로 결제 없는 신청 INSERT·
--    입금 확인 위조가 다시 가능해진다. 앱 호출부는 전부 service_role이라 잠금 때문에
--    앱이 깨질 일은 없다 — 쓰기 전에 정말 권한 때문인지 먼저 확인한다
--    (service_role로 부르는데 42501이면 이 파일이 아니라 service_role GRANT를 본다).
--
-- 원래 상태: PUBLIC·anon·authenticated·service_role 전부 EXECUTE (2026-10-09 이전)
-- service_role 권한은 잠금 전에도 있었으므로 건드리지 않는다.
-- ============================================================

BEGIN;
GRANT EXECUTE ON FUNCTION public.confirm_registration(uuid, uuid, text, integer) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_transfer(uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_transfer(uuid, uuid, integer) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_next_waitlisted(uuid) TO PUBLIC, anon, authenticated;
COMMIT;
