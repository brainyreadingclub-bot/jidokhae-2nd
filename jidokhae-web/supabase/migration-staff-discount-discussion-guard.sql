-- migration-staff-discount-discussion-guard.sql
-- 스텝 할인을 정기모임(meeting_type = 'regular')으로 한정 (2026-08-17 결정).
-- 배경: Preview 검증에서 토론모임(25,000)에도 50% 할인이 적용되는 것을 발견.
--       할인 결정문(PR #33~#35)은 "정기모임 참가비 50%"였다.
-- 변경: confirm_registration / register_transfer 두 RPC에서
--       할인 결제(paid_amount < fee) 시 meeting_type <> 'regular'면
--       'discount_not_eligible' 반환 (API가 자동 환불 처리).
-- 롤백: migration-staff-discount-rpcs.sql을 다시 실행 (가드 없는 이전 정의로 복원).
-- 코드 동기: src/lib/pricing.ts isStaffDiscountableMeetingType() / payment.ts 화이트리스트

-- ============================================================
-- 1. confirm_registration (카드결제 흐름) — REDEFINE
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_registration(
  p_user_id UUID,
  p_meeting_id UUID,
  p_payment_id TEXT,
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
  v_confirmed_count INTEGER;
  v_duplicate_count INTEGER;
  v_is_discount BOOLEAN;
  v_user_role TEXT;
  v_user_is_staff BOOLEAN;
  v_slot_count INTEGER;
  v_max_slots INTEGER;
BEGIN
  -- 1. Lock the meeting row + fetch fee/type
  SELECT capacity, status, fee, meeting_type
    INTO v_capacity, v_status, v_fee, v_meeting_type
  FROM public.meetings WHERE id = p_meeting_id FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_status <> 'active' THEN RETURN 'not_active'; END IF;

  -- 2. 중복 체크 (confirmed, waitlisted, pending_transfer 모두)
  SELECT COUNT(*) INTO v_duplicate_count
  FROM public.registrations
  WHERE user_id = p_user_id
    AND meeting_id = p_meeting_id
    AND status IN ('confirmed', 'waitlisted', 'pending_transfer');

  IF v_duplicate_count > 0 THEN RETURN 'already_registered'; END IF;

  -- 3. 스텝 할인 검증 (paid_amount < fee 인 경우에만)
  v_is_discount := (p_paid_amount < v_fee);

  IF v_is_discount THEN
    -- 3a. 스텝 할인은 정기모임 한정 (2026-08-17 결정)
    IF v_meeting_type <> 'regular' THEN
      RETURN 'discount_not_eligible';
    END IF;

    -- 3b. 자격 확인
    SELECT role, is_staff INTO v_user_role, v_user_is_staff
    FROM public.profiles WHERE id = p_user_id;

    IF v_user_role NOT IN ('admin', 'editor') AND NOT COALESCE(v_user_is_staff, false) THEN
      RETURN 'discount_not_eligible';
    END IF;

    -- 3c. 슬롯 확인 (FOR UPDATE 락 안에서 카운트 — 원자적)
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

  -- 4. 정원 체크 (confirmed + pending_transfer)
  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND status IN ('confirmed', 'pending_transfer');

  -- 5. 정원 미달 → confirmed, 초과 → waitlisted
  IF v_confirmed_count < v_capacity THEN
    INSERT INTO public.registrations (user_id, meeting_id, status, payment_id, paid_amount, is_staff_discount)
    VALUES (p_user_id, p_meeting_id, 'confirmed', p_payment_id, p_paid_amount, v_is_discount);
    RETURN 'success';
  ELSE
    INSERT INTO public.registrations (user_id, meeting_id, status, payment_id, paid_amount, is_staff_discount)
    VALUES (p_user_id, p_meeting_id, 'waitlisted', p_payment_id, p_paid_amount, v_is_discount);
    RETURN 'waitlisted';
  END IF;
END;
$$;

-- ============================================================
-- 2. register_transfer (계좌이체 흐름) — REDEFINE
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
  -- 1. Lock the meeting row + fetch fee/type
  SELECT capacity, status, fee, meeting_type
    INTO v_capacity, v_status, v_fee, v_meeting_type
  FROM public.meetings WHERE id = p_meeting_id FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_status <> 'active' THEN RETURN 'not_active'; END IF;

  -- 2. 중복 체크
  SELECT COUNT(*) INTO v_duplicate_count
  FROM public.registrations
  WHERE user_id = p_user_id
    AND meeting_id = p_meeting_id
    AND status IN ('confirmed', 'waitlisted', 'pending_transfer');

  IF v_duplicate_count > 0 THEN RETURN 'already_registered'; END IF;

  -- 3. 스텝 할인 검증
  v_is_discount := (p_paid_amount < v_fee);

  IF v_is_discount THEN
    -- 3a. 스텝 할인은 정기모임 한정 (2026-08-17 결정)
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

  -- 4. 정원 체크
  SELECT COUNT(*) INTO v_count
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND status IN ('confirmed', 'pending_transfer');

  -- 5. 여석 → pending_transfer, 초과 → waitlisted
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
