-- ============================================================
-- 결제 실패 원장 payment_failures — Rollback
-- ============================================================
--
-- 🔴 실행하면 기록이 통째로 사라진다.
--    지우기 전에 내용을 떠 두고, 정말 필요한지 한 번 더 볼 것.
--    이 표가 생긴 이유가 "몇 달간 아무도 못 본 실패"였다.
--
--    SELECT * FROM public.payment_failures ORDER BY created_at DESC;
--
-- 주의
--   코드를 먼저 revert할 필요는 없다. recordPaymentFailure()는 INSERT 실패를
--   삼키고 console.error만 남기므로, 표가 없어도 결제/웹훅 흐름은 그대로 돈다.
--   (다만 그 순간부터 다시 "못 보는 상태"로 돌아간다)
--
--   ⚠️ 웹훅의 uuid prefix 조회 수정은 이 표와 무관하다.
--      그건 코드만의 변경이라 롤백하려면 git revert를 써야 한다.
--      이 SQL을 돌려도 웹훅 수정은 그대로 살아 있다.
-- ============================================================

DROP POLICY IF EXISTS "payment_failures_select_admin" ON public.payment_failures;

DROP INDEX IF EXISTS public.idx_payment_failures_payment_id;
DROP INDEX IF EXISTS public.idx_payment_failures_created;

DROP TABLE IF EXISTS public.payment_failures;
