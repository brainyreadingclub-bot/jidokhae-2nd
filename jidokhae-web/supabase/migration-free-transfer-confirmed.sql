-- ============================================================
-- 0원 모임 계좌이체 신청은 처음부터 「신청 완료」(confirmed)로 들어간다
-- 결정: 2026-10-13 대표님 확정 (관리자 전달)
-- 코드 동기: src/app/api/registrations/transfer/route.ts · src/components/meetings/MeetingActionButton.tsx
-- ============================================================
--
-- 왜
--   `register_transfer`는 여석이 있으면 **금액과 무관하게** `pending_transfer`로 넣었다.
--   2026-10-09 변경(migration-waitlist-card-only.sql)은 정원 초과 쪽만 0원 예외를 뒀다(승격 시 바로 확정).
--   그래서 0원 모임(대구) 신청이 「입금 대기」로 남고, 운영자가 받을 돈도 없는데 입금 확인을 눌러야 했다.
--   받을 돈이 없으면 확인할 입금도 없다 → 바로 `confirmed`.
--
-- 바꾸는 것 — `register_transfer` 5단계(여석 있음) 한 곳.
--   여석 있음 + **모임 참가비 0** + **신청 금액 0** → `status='confirmed'` INSERT, 반환값 **'confirmed'(신규)**
--   🔴 두 조건을 다 본다(`v_fee = 0 AND p_paid_amount = 0`). 금액만 보면 유료 모임에 0을 넘긴 호출이
--      (스텝 자격자라면 할인 검증을 지나) 돈 없이 확정된다. 라우트는 금액을 서버에서 계산하지만
--      마지막 방어선은 여기다.
--   유료·스텝할인 경로, 정원 초과 0원 대기(waitlisted)는 그대로다.
--
-- 🔴 배포 순서 — **코드 먼저, 그 다음 이 SQL.** (presenter SQL과 달리 순서를 탄다)
--   · 코드 먼저 + 옛 SQL: 새 코드는 'confirmed'와 옛 'pending_transfer'를 둘 다 처리한다 → 지금과 똑같이
--     0원도 입금 대기로 들어간다(새 결함 없음, 고쳐지지 않았을 뿐).
--   · SQL 먼저 + 옛 코드: 옛 라우트는 'confirmed'를 몰라 알림톡을 안 보내고 그대로 돌려준다.
--     옛 화면은 'pending_transfer'·'waitlisted'만 알아서 **신청은 됐는데 「신청 처리에 실패했습니다」**가 뜬다.
--     회원이 다시 누르면 「이미 신청한 모임입니다」. 돈은 안 움직이지만 회원이 헷갈린다 → 이 순서는 피한다.
--   ▶ 반환값을 옛 이름('pending_transfer')으로 속여 순서를 없애는 방법은 쓰지 않았다 — 그러면 옛·새 화면 모두
--     0원 회원에게 입금 안내를 띄우고, 알림톡 대상 조회(status='pending_transfer')도 빗나간다.
--
-- ⚠️ 권한 — CREATE OR REPLACE는 인자·반환형이 같으면 기존 권한(2026-10-09 잠금
--   {postgres=X, service_role=X})을 그대로 둔다. 덩어리 1 끝에서 같은 잠금을 다시 건다(멱등).
--
-- 이미 입금 대기로 들어가 있는 0원 건(10/25 대구 2건 등)은 **이 파일이 건드리지 않는다** — 대표님이 따로 정리.
-- ============================================================


-- ============================================================
-- 덩어리 0. 실행 전 확인 (읽기만)
-- ============================================================

-- (a) 지금 prod 정의가 저장소 기준(migration-waitlist-card-only.sql)과 같은지 — 아래 두 줄이 다 true여야 한다
select
  position('waitlist_card_only' in pg_get_functiondef(p.oid)) > 0 as has_card_only_guard,
  position('discount_not_eligible' in pg_get_functiondef(p.oid)) > 0 as has_discount_guard
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'register_transfer';
-- 🔴 false가 있거나 행이 2개 이상이면 멈추고 알려 주세요 — 아래 정의가 prod보다 낡았거나 오버로드가 있다

-- (b) 실행 전 권한 — 실행 후(덩어리 2)와 같아야 한다
select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.proacl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'register_transfer';
-- 기대: {postgres=X/postgres,service_role=X/postgres} 형태


-- ============================================================
-- 덩어리 1. register_transfer 교체 (따로 실행)
--    베이스 = migration-waitlist-card-only.sql (현행 정의). 바뀐 자리는 5단계 IF 안 한 곳뿐이다.
-- ============================================================
BEGIN;

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
  v_user_is_free BOOLEAN;
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

  -- 5. 여석 → (0원 모임 · 0원 신청이면) confirmed / 그 외 pending_transfer,
  --    초과 → (0원 또는 is_free만) waitlisted
  IF v_count < v_capacity THEN
    -- 🔴 (신규 2026-10-13) 받을 돈이 없으면 확인할 입금도 없다 — 바로 신청 완료.
    --    모임 참가비와 신청 금액을 **둘 다** 본다 (머리말 「바꾸는 것」)
    IF COALESCE(v_fee, 0) = 0 AND COALESCE(p_paid_amount, 0) = 0 THEN
      INSERT INTO public.registrations (user_id, meeting_id, status, payment_method, paid_amount, is_staff_discount)
      VALUES (p_user_id, p_meeting_id, 'confirmed', 'transfer', 0, false);
      RETURN 'confirmed';
    END IF;

    INSERT INTO public.registrations (user_id, meeting_id, status, payment_method, paid_amount, is_staff_discount)
    VALUES (p_user_id, p_meeting_id, 'pending_transfer', 'transfer', p_paid_amount, v_is_discount);
    RETURN 'pending_transfer';
  ELSE
    -- 🔴 대기 신청은 카드만 받는다 (2026-10-09 대표님 결정). 예외 둘 — 0원 · is_free (결정 A).
    SELECT is_free INTO v_user_is_free
    FROM public.profiles WHERE id = p_user_id;

    IF COALESCE(p_paid_amount, 0) <> 0 AND NOT COALESCE(v_user_is_free, false) THEN
      RETURN 'waitlist_card_only';
    END IF;

    INSERT INTO public.registrations (user_id, meeting_id, status, payment_method, paid_amount, is_staff_discount)
    VALUES (p_user_id, p_meeting_id, 'waitlisted', 'transfer', p_paid_amount, v_is_discount);
    RETURN 'waitlisted';
  END IF;
END;
$$;

-- 2026-10-09 잠금(migration-lock-definer-rpcs.sql) 유지 — 멱등
REVOKE EXECUTE ON FUNCTION public.register_transfer(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.register_transfer(uuid, uuid, integer) TO service_role;

COMMIT;


-- ============================================================
-- 덩어리 2. 실행 후 확인 (읽기만)
-- ============================================================
select p.proacl,
  position('RETURN ''confirmed''' in pg_get_functiondef(p.oid)) > 0 as has_free_confirmed
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'register_transfer';
-- 기대: proacl이 덩어리 0 (b)와 같고, has_free_confirmed = true


-- ============================================================
-- 덩어리 3. 되돌리기 — 🔴 주석으로 막아 뒀다
-- ============================================================
-- 되돌리기 = migration-waitlist-card-only.sql 의 「1. register_transfer」 덩어리를 그대로 다시 돌린다
-- (CREATE OR REPLACE — 인자·반환형이 같아 권한이 유지된다). 그 뒤 아래 REVOKE를 한 번 더 돌린다.
-- 🔴 되돌리기 전에 **코드를 먼저 되돌리지 않아도 된다** — 새 코드는 옛 반환값('pending_transfer')도 처리한다.
--    반대로 이 SQL을 남긴 채 코드만 되돌리면 머리말 「SQL 먼저 + 옛 코드」 상태가 된다 → 그때는 SQL도 같이 되돌린다.
/*
REVOKE EXECUTE ON FUNCTION public.register_transfer(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.register_transfer(uuid, uuid, integer) TO service_role;
*/

-- ============================================================
-- 반환값 (register_transfer)
--   'confirmed'        : (신규) 0원 모임 · 0원 신청 · 여석 있음 → 바로 신청 완료
--   'pending_transfer' / 'waitlisted' / 'not_found' / 'not_active' / 'already_registered'
--   / 'discount_not_eligible' / 'staff_slot_full' / 'waitlist_card_only' : 기존 그대로
-- ============================================================
