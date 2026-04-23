-- ============================================================
-- Phase 3 M7 Step 2.5: admin_confirm_transfer DB Function
-- ============================================================
--
-- 배경
--   운영자의 "입금 확인" 버튼(/api/admin/registrations/confirm-transfer
--   action='confirm')은 현재 COUNT 쿼리 후 UPDATE 쿼리로 분리되어 있어
--   두 쿼리 사이에 다른 트랜잭션이 끼어들면 정원 초과가 발생할 수 있다.
--
--   현재 운영자 1명일 때는 무해하지만 editor 역할이 추가되면 동시
--   확인이 발생할 수 있어 예방 차원에서 원자화가 필요하다.
--
--   기존 register_transfer (계좌이체 신청 접수 시 원자성 확보) 패턴을
--   그대로 준거하여 입금 확인 단계의 원자성을 확보한다.
--
-- 의존
--   public.registrations (id, meeting_id, status 컬럼)
--   public.meetings (id, capacity, status 컬럼)
--
-- 적용 순서
--   1) 이 파일(marigration-phase3-m7-step2-5.sql)을 Supabase SQL Editor에서 실행
--   2) 배포 후 /api/admin/registrations/confirm-transfer 가 이 함수를 호출
--   3) 이상 시 migration-phase3-m7-step2-5-rollback.sql 실행
--
-- Forward-compatibility
--   - 이 함수의 존재는 기존 코드에 영향을 주지 않음 (호출하지 않으면 잠재 상태)
--   - 코드 revert 시 함수를 남겨도 되며, 수동 DROP은 rollback 스크립트 사용
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_confirm_transfer(
  p_registration_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_meeting_id UUID;
  v_reg_status TEXT;
  v_capacity INTEGER;
  v_meeting_status TEXT;
  v_confirmed_count INTEGER;
BEGIN
  -- 1. Lock the registration row + fetch meeting reference
  SELECT meeting_id, status INTO v_meeting_id, v_reg_status
  FROM public.registrations
  WHERE id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_reg_status <> 'pending_transfer' THEN
    RETURN 'not_pending';
  END IF;

  -- 2. Lock the meeting row + capacity/status check
  SELECT capacity, status INTO v_capacity, v_meeting_status
  FROM public.meetings
  WHERE id = v_meeting_id
  FOR UPDATE;

  IF v_meeting_status <> 'active' THEN
    RETURN 'not_active';
  END IF;

  -- 3. Count confirmed registrations under the meeting lock
  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.registrations
  WHERE meeting_id = v_meeting_id
    AND status = 'confirmed';

  IF v_confirmed_count >= v_capacity THEN
    RETURN 'capacity_full';
  END IF;

  -- 4. Atomic status transition: pending_transfer -> confirmed
  UPDATE public.registrations
  SET status = 'confirmed'
  WHERE id = p_registration_id
    AND status = 'pending_transfer';

  RETURN 'success';
END;
$$;

-- Authenticated users can invoke via PostgREST RPC
-- (API Route uses service_role Supabase client, but GRANT is required for SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.admin_confirm_transfer(UUID) TO authenticated;

-- ============================================================
-- 반환값 정의
-- ============================================================
-- 'success'         : status가 pending_transfer → confirmed로 전환됨
-- 'not_found'       : 해당 id의 registration이 없음
-- 'not_pending'     : registration status가 pending_transfer가 아님
-- 'not_active'      : meeting이 active 상태가 아님 (deleting/deleted)
-- 'capacity_full'   : confirmed 건수가 정원에 도달
-- ============================================================

-- ============================================================
-- 주의 사항 (다음 세션이 오판하지 않도록)
-- ============================================================
-- ❌ 금지: 이 함수 호출 성공 후 sendRegistrationConfirmNotification
--    (카카오톡 알림) 호출 추가 금지.
--    이유: 운영자가 월말 정산일에 하루 몰아서 입금 확인 처리 →
--    동시다발 알림은 회원 혼란을 유발.
--    카드결제 플로우만 즉시 알림 유지. 계좌이체는 홈/내 신청
--    페이지의 상태 표시로 대체.
--    (검토문서/2026-04-23-풀스캔-후속-의사결정.md §2.6 참조)
-- ============================================================
