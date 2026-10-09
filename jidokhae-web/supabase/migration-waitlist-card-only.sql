-- ============================================================
-- 대기 신청은 카드만 받는다 + 0원 건은 자리가 나면 바로 확정
-- 결정: 2026-10-09 (대표님)
-- ============================================================
--
-- 왜
--   계좌이체 대기자는 「돈을 안 낸 채 줄에 선 사람」이다. 자리가 나도
--   `pending_transfer`로 올라가 입금 확인을 또 기다려야 하고, 그 사이
--   정원 한 칸이 묶인다. 그래서 **대기는 카드만** 받는다.
--   단 **받을 돈이 없는 건(0원)은 예외** — 입금 확인 단계가 애초에 없으므로
--   계좌이체로도 줄을 설 수 있고, 자리가 나면 **바로 `confirmed`**로 올린다.
--
--   🔴 판정은 사람(`profiles.is_free`)이 아니라 **그 신청 건의 `paid_amount`**로 한다.
--   사람 속성은 나중에 바뀌지만 그 건에 돈이 걸렸는지는 그 건이 안다.
--
-- 바꾸는 것 둘
--   1. register_transfer      — 대기로 INSERT하려는 순간 0원이 아니면 거절
--                               (신규 반환값 'waitlist_card_only')
--   2. promote_next_waitlisted — transfer + paid_amount = 0 이면 confirmed로 승격
--                               + 반환에 promoted_confirmed BOOLEAN 추가
--
-- ⚠️ 실행 순서 — **이 파일 전체를 한 번에 돌린다.**
--   promote_next_waitlisted는 RETURNS TABLE이 바뀌므로 CREATE OR REPLACE가
--   안 되고 DROP이 선행돼야 한다. 아래 BEGIN/COMMIT으로 묶었으므로
--   함수가 없는 순간이 생기지 않는다(Postgres DDL은 트랜잭션 안에서 돈다).
--   조각으로 나눠 돌리면 그 사이 취소가 들어올 때 승격이 실패한다.
--
-- ⚠️ 코드와의 배포 순서 — **SQL 먼저, 그 다음 코드** (권장). 뒤집혀도 돈·알림은 안 깨진다.
--   SQL만 먼저 나간 사이(구 코드):
--     · 구 라우트는 'waitlist_card_only'를 모르므로 200 + {status:'waitlist_card_only'}로
--       돌려주고, 구 화면은 이를 「신청 처리에 실패했습니다」 토스트로 보여준다.
--       **INSERT가 없으니 돈·자리는 안 움직인다.** 문구만 거칠다.
--     · 구 `lib/waitlist.ts`는 늘어난 컬럼을 무시하고 payment_method로 가른다 —
--       0원 계좌이체 승격(이제 confirmed)만 알림톡이 안 나간다. 나머지는 종전과 같다.
--   코드만 먼저 나간 사이(구 SQL):
--     · `lib/waitlist.ts`는 promoted_confirmed가 없으면 옛 판정으로 떨어진다
--       (`resolvePromotedConfirmed`) — 카드 승격 알림은 멈추지 않는다.
--     · 화면은 계좌이체 대기를 감추지만, 딥링크로 오면 구 RPC가 대기를 받아 준다.
--   ▶ 그래서 둘 사이 간격을 짧게 두되, 순서는 SQL → 코드로 한다.
--
-- ⚠️ 권한 — DROP하면 그 함수에 걸린 GRANT도 같이 사라진다.
--   저장소 어떤 마이그레이션에도 이 두 함수의 GRANT/REVOKE가 없다(Supabase 기본 권한에
--   기대 왔다). 새로 만든 함수도 같은 기본 권한을 받지만, 앱이 실제로 부르는
--   service_role 실행 권한은 아래에서 **명시적으로** 다시 준다.
--   실행 전·후에 같은 조회로 권한이 같은지 대조한다:
--     select p.proname, p.proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname in ('register_transfer','promote_next_waitlisted');
--
-- 롤백: migration-waitlist-card-only-rollback.sql
-- 코드 동기: src/app/api/registrations/transfer/route.ts · src/lib/waitlist.ts
-- ============================================================

BEGIN;

-- ============================================================
-- 1. register_transfer — 계좌이체 대기 차단
--    베이스 = migration-staff-discount-discussion-guard.sql (현행 정의)
--    바뀐 자리는 5단계 ELSE 한 곳뿐이다.
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

  -- 5. 여석 → pending_transfer, 초과 → (0원만) waitlisted
  IF v_count < v_capacity THEN
    INSERT INTO public.registrations (user_id, meeting_id, status, payment_method, paid_amount, is_staff_discount)
    VALUES (p_user_id, p_meeting_id, 'pending_transfer', 'transfer', p_paid_amount, v_is_discount);
    RETURN 'pending_transfer';
  ELSE
    -- 🔴 대기 신청은 카드만 받는다 (2026-10-09 대표님 결정).
    -- 정원 판정이 FOR UPDATE 락 안에 있어야 동시 신청에 지지 않으므로
    -- 라우트에서 미리 세지 않고 **여기서** 거절한다. INSERT하지 않는다.
    IF COALESCE(p_paid_amount, 0) <> 0 THEN
      RETURN 'waitlist_card_only';
    END IF;

    INSERT INTO public.registrations (user_id, meeting_id, status, payment_method, paid_amount, is_staff_discount)
    VALUES (p_user_id, p_meeting_id, 'waitlisted', 'transfer', p_paid_amount, v_is_discount);
    RETURN 'waitlisted';
  END IF;
END;
$$;

-- ============================================================
-- 2. promote_next_waitlisted — 0원 계좌이체는 바로 confirmed
--    베이스 = migration-bank-transfer-functions.sql (현행 정의)
--    RETURNS TABLE이 바뀌므로 DROP이 선행돼야 한다.
-- ============================================================
DROP FUNCTION IF EXISTS public.promote_next_waitlisted(UUID);

CREATE FUNCTION public.promote_next_waitlisted(
  p_meeting_id UUID
)
RETURNS TABLE(promoted_id UUID, promoted_user_id UUID, promoted_confirmed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_capacity INTEGER;
  v_confirmed_count INTEGER;
  v_next_id UUID;
  v_next_user_id UUID;
  v_payment_method TEXT;
  v_paid_amount INTEGER;
  v_to_confirmed BOOLEAN;
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
  SELECT id, user_id, payment_method, paid_amount
    INTO v_next_id, v_next_user_id, v_payment_method, v_paid_amount
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND status = 'waitlisted'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_next_id IS NULL THEN RETURN; END IF;

  -- 5. 승격 분기
  --    카드               → confirmed (종전과 같다)
  --    계좌이체 + 0원      → confirmed (받을 돈이 없으니 확인할 입금도 없다, 2026-10-09)
  --    계좌이체 + 금액 있음 → pending_transfer (종전과 같다)
  --
  --    🔴 금액 판정은 `profiles.is_free`가 아니라 **이 건의 paid_amount**다.
  v_to_confirmed := (v_payment_method <> 'transfer')
                    OR (v_payment_method IS NULL)
                    OR (COALESCE(v_paid_amount, 0) = 0);

  IF v_to_confirmed THEN
    UPDATE public.registrations
    SET status = 'confirmed'
    WHERE id = v_next_id AND status = 'waitlisted';
  ELSE
    UPDATE public.registrations
    SET status = 'pending_transfer'
    WHERE id = v_next_id AND status = 'waitlisted';
  END IF;

  -- 6. 결과 반환 — 알림톡을 가를 수 있도록 「확정으로 올렸는가」를 함께 돌려준다.
  --    호출부(src/lib/waitlist.ts)가 payment_method를 다시 조회해 추측하던 자리다.
  promoted_id := v_next_id;
  promoted_user_id := v_next_user_id;
  promoted_confirmed := v_to_confirmed;
  RETURN NEXT;
END;
$$;

-- DROP으로 사라진 권한을 다시 준다 (위 머리말 「권한」). 앱은 service_role로만 부른다.
GRANT EXECUTE ON FUNCTION public.promote_next_waitlisted(UUID) TO service_role;

COMMIT;

-- ============================================================
-- 반환값 정의 (변경/신규)
-- ============================================================
-- register_transfer:
--   'pending_transfer' / 'waitlisted' / 'not_found' / 'not_active'
--   / 'already_registered' / 'discount_not_eligible' / 'staff_slot_full' : 기존
--   'waitlist_card_only' : (신규) 정원 마감 + 0원이 아닌 계좌이체 대기 시도 → INSERT 없음
--
-- promote_next_waitlisted:
--   (promoted_id, promoted_user_id, promoted_confirmed) 또는 0행
--   promoted_confirmed = true  → status 'confirmed'로 올렸다 (승격 알림톡 대상)
--   promoted_confirmed = false → status 'pending_transfer'로 올렸다 (알림톡 없음)
-- ============================================================
