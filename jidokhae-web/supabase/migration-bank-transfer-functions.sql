-- ============================================================
-- 계좌이체 브릿지 — RPC 함수 업데이트
-- 실행 시점: migration-bank-transfer.sql 실행 후 별도 실행
-- ============================================================

-- 1. get_confirmed_counts: pending_transfer도 카운트에 포함
CREATE OR REPLACE FUNCTION public.get_confirmed_counts(meeting_ids UUID[])
RETURNS TABLE(meeting_id UUID, confirmed_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.meeting_id,
    COUNT(*)::BIGINT AS confirmed_count
  FROM public.registrations r
  WHERE r.meeting_id = ANY(meeting_ids)
    AND r.status IN ('confirmed', 'pending_transfer')
  GROUP BY r.meeting_id;
END;
$$;

-- 2. confirm_registration: 중복 체크 + 정원 카운트에 pending_transfer 포함
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
  v_confirmed_count INTEGER;
  v_duplicate_count INTEGER;
BEGIN
  -- 1. Lock the meeting row
  SELECT capacity, status INTO v_capacity, v_status
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

  -- 3. 정원 체크 (confirmed + pending_transfer)
  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND status IN ('confirmed', 'pending_transfer');

  -- 4. 정원 미달 → confirmed, 초과 → waitlisted
  IF v_confirmed_count < v_capacity THEN
    INSERT INTO public.registrations (user_id, meeting_id, status, payment_id, paid_amount)
    VALUES (p_user_id, p_meeting_id, 'confirmed', p_payment_id, p_paid_amount);
    RETURN 'success';
  ELSE
    INSERT INTO public.registrations (user_id, meeting_id, status, payment_id, paid_amount)
    VALUES (p_user_id, p_meeting_id, 'waitlisted', p_payment_id, p_paid_amount);
    RETURN 'waitlisted';
  END IF;
END;
$$;

-- 3. promote_next_waitlisted: payment_method 분기 (transfer → pending_transfer)
CREATE OR REPLACE FUNCTION public.promote_next_waitlisted(
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
  -- 1. Lock the meeting row
  SELECT capacity INTO v_capacity
  FROM public.meetings WHERE id = p_meeting_id FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  -- 2. 현재 confirmed + pending_transfer 수
  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND status IN ('confirmed', 'pending_transfer');

  -- 3. 정원 충분이면 종료
  IF v_confirmed_count >= v_capacity THEN RETURN; END IF;

  -- 4. 가장 오래된 waitlisted 찾기
  SELECT id, user_id, payment_method INTO v_next_id, v_next_user_id, v_payment_method
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND status = 'waitlisted'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_next_id IS NULL THEN RETURN; END IF;

  -- 5. 승격: payment_method에 따라 분기
  IF v_payment_method = 'transfer' THEN
    UPDATE public.registrations
    SET status = 'pending_transfer'
    WHERE id = v_next_id AND status = 'waitlisted';
  ELSE
    UPDATE public.registrations
    SET status = 'confirmed'
    WHERE id = v_next_id AND status = 'waitlisted';
  END IF;

  -- 6. 결과 반환
  promoted_id := v_next_id;
  promoted_user_id := v_next_user_id;
  RETURN NEXT;
END;
$$;

-- 4. 새 RPC: register_transfer (계좌이체 신청 전용)
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
  v_count INTEGER;
  v_duplicate_count INTEGER;
BEGIN
  -- 1. Lock the meeting row
  SELECT capacity, status INTO v_capacity, v_status
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

  -- 3. 정원 체크 (confirmed + pending_transfer)
  SELECT COUNT(*) INTO v_count
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND status IN ('confirmed', 'pending_transfer');

  -- 4. 여석 → pending_transfer, 초과 → waitlisted
  IF v_count < v_capacity THEN
    INSERT INTO public.registrations (user_id, meeting_id, status, payment_method, paid_amount)
    VALUES (p_user_id, p_meeting_id, 'pending_transfer', 'transfer', p_paid_amount);
    RETURN 'pending_transfer';
  ELSE
    INSERT INTO public.registrations (user_id, meeting_id, status, payment_method, paid_amount)
    VALUES (p_user_id, p_meeting_id, 'waitlisted', 'transfer', p_paid_amount);
    RETURN 'waitlisted';
  END IF;
END;
$$;
