-- ============================================================
-- 회원 피드백 반영: 신청자 닉네임 명단 조회 RPC
-- ============================================================
-- 배경
--   회원 피드백: "참여 신청 후 누구누구 참여하는지 보고 싶다"
--   현 정책(PRD §6-2)은 신청자 명단을 운영자만 노출했으나,
--   본인이 confirmed로 신청한 모임에 한해 다른 신청자 닉네임 노출로 정책 확장.
--
-- 함수 동작
--   1) 비로그인(auth.uid() IS NULL) → 빈 결과
--   2) 운영자(admin/editor) → 본인 신청 여부 무관 명단 반환 (admin 페이지와 정합)
--   3) 호출자가 해당 모임에 confirmed 또는 pending_transfer 상태면 → 명단 반환
--      (운영자 입금 확인 지연 시 회원 입장에서 사실상 신청 완료 상태이므로 동등 취급)
--   4) 그 외 → 빈 결과 (오류 던지지 않음)
--
-- 반환 컬럼
--   nickname TEXT — confirmed + pending_transfer 신청자의 닉네임만
--   (waitlisted 제외, 정원에 차지 안 하므로)
--   created_at ASC 정렬 (먼저 신청한 순서)
--
-- 보안 패턴
--   SECURITY DEFINER + SET search_path = '' (search_path 하이재킹 방어)
--   모든 식별자는 public. 접두사 사용
--   anon/PUBLIC 권한 회수, authenticated만 EXECUTE 부여
--
-- 적용 순서
--   1) 이 파일을 Supabase SQL Editor에서 실행
--   2) 배포 후 MeetingDetailContent가 이 함수를 호출
--   3) 이상 시 migration-feedback-participants-rollback.sql 실행
--
-- Forward-compatibility
--   - 이 함수의 존재는 기존 코드에 영향을 주지 않음 (호출하지 않으면 잠재 상태)
--   - 코드 revert 시 함수를 남겨도 되며, 수동 DROP은 rollback 스크립트 사용
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_meeting_participant_nicknames(
  p_meeting_id UUID
)
RETURNS TABLE(nickname TEXT)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_privileged BOOLEAN;
  v_is_booked_self BOOLEAN;
BEGIN
  -- 1. 비로그인은 빈 결과
  IF v_caller IS NULL THEN
    RETURN;
  END IF;

  -- 2. 운영자(admin/editor)는 검증 우회
  SELECT public.is_editor_or_admin() INTO v_is_privileged;

  IF NOT v_is_privileged THEN
    -- 3. 본인이 해당 모임에 confirmed 또는 pending_transfer 상태인지 확인
    --    (정원에 차지한 신청자는 모두 명단을 볼 수 있음)
    SELECT EXISTS(
      SELECT 1 FROM public.registrations
      WHERE meeting_id = p_meeting_id
        AND user_id = v_caller
        AND status IN ('confirmed', 'pending_transfer')
    ) INTO v_is_booked_self;

    IF NOT v_is_booked_self THEN
      RETURN;  -- 권한 없음 = 빈 결과
    END IF;
  END IF;

  -- 4. confirmed + pending_transfer 신청자의 닉네임 반환
  RETURN QUERY
  SELECT p.nickname
  FROM public.registrations r
  JOIN public.profiles p ON p.id = r.user_id
  WHERE r.meeting_id = p_meeting_id
    AND r.status IN ('confirmed', 'pending_transfer')
    AND COALESCE(p.nickname, '') <> ''
  ORDER BY r.created_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_meeting_participant_nicknames(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meeting_participant_nicknames(UUID) TO authenticated;
