-- ============================================================
-- Staff Discount System — RPC Redefinitions (Phase 1)
-- ============================================================
--
-- 변경 RPC
--   1. confirm_registration — 할인 자격/슬롯 검증 + is_staff_discount 기록
--   2. register_transfer    — 동일 (계좌이체 흐름)
--
-- ⚠️ Signature 동일 유지 — in-flight 호환성 보존
--   기존 호출부(payment.ts, transfer API)는 코드 변경 없이도 동작 가능.
--   새 코드는 p_paid_amount < meeting.fee 인 경우에만 추가 검증 트리거.
--
-- 적용 순서
--   1) migration-staff-discount.sql 먼저 실행 (컬럼 추가)
--   2) 이 파일 실행
--   3) Vercel 코드 deploy
--
-- 핵심 로직 (양 RPC 공통)
--   IF p_paid_amount < meeting.fee:
--     자격 검증: role IN ('admin', 'editor') OR is_staff = true
--     슬롯 검증: COUNT(WHERE is_staff_discount=true AND status IN (...)) < 2
--     통과 시: is_staff_discount = true 로 INSERT
--   ELSE:
--     기존 흐름 유지 (is_staff_discount = false)
--
-- 새 반환값
--   - 'discount_not_eligible' : 자격 없는 사용자가 할인 가격 결제 시도
--   - 'staff_slot_full'       : 슬롯 2/2 마감 후 시도
-- ============================================================

-- ============================================================
-- 상수: 모임당 스텝 할인 슬롯 최대
-- ============================================================
-- SQL에 직접 상수를 둘 수 없으므로 함수로 캡슐화 (변경 빈도 낮음)
CREATE OR REPLACE FUNCTION public.staff_discount_max_per_meeting()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 2;
$$;

COMMENT ON FUNCTION public.staff_discount_max_per_meeting() IS
  '모임당 스텝 할인 슬롯 최대값. 변경 시 코드의 STAFF_DISCOUNT_MAX_PER_MEETING과 동시 갱신 필요.';

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
  v_confirmed_count INTEGER;
  v_duplicate_count INTEGER;
  v_is_discount BOOLEAN;
  v_user_role TEXT;
  v_user_is_staff BOOLEAN;
  v_slot_count INTEGER;
  v_max_slots INTEGER;
BEGIN
  -- 1. Lock the meeting row + fetch fee
  SELECT capacity, status, fee INTO v_capacity, v_status, v_fee
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
    -- 3a. 자격 확인
    SELECT role, is_staff INTO v_user_role, v_user_is_staff
    FROM public.profiles WHERE id = p_user_id;

    IF v_user_role NOT IN ('admin', 'editor') AND NOT COALESCE(v_user_is_staff, false) THEN
      RETURN 'discount_not_eligible';
    END IF;

    -- 3b. 슬롯 확인 (FOR UPDATE 락 안에서 카운트 — 원자적)
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
  v_count INTEGER;
  v_duplicate_count INTEGER;
  v_is_discount BOOLEAN;
  v_user_role TEXT;
  v_user_is_staff BOOLEAN;
  v_slot_count INTEGER;
  v_max_slots INTEGER;
BEGIN
  -- 1. Lock the meeting row + fetch fee
  SELECT capacity, status, fee INTO v_capacity, v_status, v_fee
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

-- ============================================================
-- 반환값 정의 (변경/신규)
-- ============================================================
-- confirm_registration:
--   'success'                : 정상 confirmed
--   'waitlisted'             : 정원 마감, 대기 INSERT
--   'not_found' / 'not_active' / 'already_registered' : 기존
--   'discount_not_eligible'  : (신규) 자격 없이 할인가 결제 시도
--   'staff_slot_full'        : (신규) 스텝 슬롯 마감
--
-- register_transfer:
--   'pending_transfer' / 'waitlisted' / 'not_found' / 'not_active' / 'already_registered' : 기존
--   'discount_not_eligible' / 'staff_slot_full' : (신규)
-- ============================================================
