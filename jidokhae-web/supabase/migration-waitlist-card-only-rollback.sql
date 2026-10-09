-- ============================================================
-- 롤백 — migration-waitlist-card-only.sql 되돌리기
-- ============================================================
--
-- 되돌아가는 곳
--   register_transfer       → migration-staff-discount-discussion-guard.sql 정의
--                             (계좌이체 대기 다시 전부 허용 — 0원·is_free 예외 구분도 사라진다)
--   promote_next_waitlisted → migration-bank-transfer-functions.sql 정의
--                             (반환 2컬럼, payment_method만 보고 분기)
--
-- ⚠️ 코드를 먼저 되돌릴 필요는 없다.
--   `src/lib/waitlist.ts`가 promoted_confirmed가 없을 때 옛 판정
--   (payment_method <> 'transfer')으로 떨어지게 써 있다(`resolvePromotedConfirmed`).
--   새 코드 + 옛 SQL이면 화면은 계좌이체 대기를 감춘 채이고, 딥링크로만 대기가 들어온다.
--
-- ⚠️ 이 파일도 **전체를 한 번에** 돌린다 (DROP + CREATE가 한 트랜잭션).
--
-- 🔴 데이터는 되돌리지 않는다.
--   이 변경으로 `confirmed`가 된 0원 계좌이체 건은 그대로 둔다 —
--   되돌리면 정원을 차지한 사람이 다시 입금 대기로 떨어진다.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. register_transfer — 가드 없는 정의로 복원
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_transfer(
  p_user_id UUID,
  p_meeting_id UUID,
  p_paid_amount INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_capacity INTEGER;
  v_status TEXT;
  v_fee INTEGER;
  v_meeting_type TEXT;
  v_count INTEGER;
  v_duplicate_count INTEGER;
  v_is_discount BOOLEAN;
  v_user_role TEXT;
  v_user_is_staff BOOLEAN;
  v_slot_count INTEGER;
  v_max_slots INTEGER;
BEGIN
  SELECT capacity, status, fee, meeting_type
    INTO v_capacity, v_status, v_fee, v_meeting_type
  FROM public.meetings WHERE id = p_meeting_id FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_status <> 'active' THEN RETURN 'not_active'; END IF;

  SELECT COUNT(*) INTO v_duplicate_count
  FROM public.registrations
  WHERE user_id = p_user_id
    AND meeting_id = p_meeting_id
    AND status IN ('confirmed', 'waitlisted', 'pending_transfer');

  IF v_duplicate_count > 0 THEN RETURN 'already_registered'; END IF;

  v_is_discount := (p_paid_amount < v_fee);

  IF v_is_discount THEN
    IF v_meeting_type <> 'regular' THEN
      RETURN 'discount_not_eligible';
    END IF;

    SELECT role, is_staff INTO v_user_role, v_user_is_staff
    FROM public.profiles WHERE id = p_user_id;

    IF v_user_role NOT IN ('admin', 'editor') AND NOT COALESCE(v_user_is_staff, false) THEN
      RETURN 'discount_not_eligible';
    END IF;

    SELECT public.staff_discount_max_per_meeting() INTO v_max_slots;

    SELECT COUNT(*) INTO v_slot_count
    FROM public.registrations
    WHERE meeting_id = p_meeting_id
      AND is_staff_discount = true
      AND status IN ('confirmed', 'pending_transfer', 'waitlisted');

    IF v_slot_count >= v_max_slots THEN
      RETURN 'staff_slot_full';
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND status IN ('confirmed', 'pending_transfer');

  IF v_count < v_capacity THEN
    INSERT INTO public.registrations (user_id, meeting_id, status, payment_method, paid_amount, is_staff_discount)
    VALUES (p_user_id, p_meeting_id, 'pending_transfer', 'transfer', p_paid_amount, v_is_discount);
    RETURN 'pending_transfer';
  ELSE
    INSERT INTO public.registrations (user_id, meeting_id, status, payment_method, paid_amount, is_staff_discount)
    VALUES (p_user_id, p_meeting_id, 'waitlisted', 'transfer', p_paid_amount, v_is_discount);
    RETURN 'waitlisted';
  END IF;
END;
$$;

-- ============================================================
-- 2. promote_next_waitlisted — 반환 2컬럼 정의로 복원
-- ============================================================
DROP FUNCTION IF EXISTS public.promote_next_waitlisted(UUID);

CREATE FUNCTION public.promote_next_waitlisted(
  p_meeting_id UUID
)
RETURNS TABLE(promoted_id UUID, promoted_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_capacity INTEGER;
  v_confirmed_count INTEGER;
  v_next_id UUID;
  v_next_user_id UUID;
  v_payment_method TEXT;
BEGIN
  SELECT capacity INTO v_capacity
  FROM public.meetings WHERE id = p_meeting_id FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND status IN ('confirmed', 'pending_transfer');

  IF v_confirmed_count >= v_capacity THEN RETURN; END IF;

  SELECT id, user_id, payment_method INTO v_next_id, v_next_user_id, v_payment_method
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND status = 'waitlisted'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_next_id IS NULL THEN RETURN; END IF;

  IF v_payment_method = 'transfer' THEN
    UPDATE public.registrations
    SET status = 'pending_transfer'
    WHERE id = v_next_id AND status = 'waitlisted';
  ELSE
    UPDATE public.registrations
    SET status = 'confirmed'
    WHERE id = v_next_id AND status = 'waitlisted';
  END IF;

  promoted_id := v_next_id;
  promoted_user_id := v_next_user_id;
  RETURN NEXT;
END;
$$;

-- DROP으로 사라진 권한을 다시 준다 (위 머리말 「권한」). 앱은 service_role로만 부른다.
GRANT EXECUTE ON FUNCTION public.promote_next_waitlisted(UUID) TO service_role;
-- 🔴 DROP+CREATE는 Supabase 기본 권한(PUBLIC·anon·authenticated)으로 다시 연다 — 이 파일을 다시 돌리면
--    2026-10-09 잠금(migration-lock-definer-rpcs.sql)이 풀린다. 그래서 아래 REVOKE를 반드시 같이 돈다.
REVOKE EXECUTE ON FUNCTION public.promote_next_waitlisted(UUID) FROM PUBLIC, anon, authenticated;

COMMIT;
