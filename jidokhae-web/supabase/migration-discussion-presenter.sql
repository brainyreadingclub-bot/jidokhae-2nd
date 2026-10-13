-- ============================================================
-- 토론모임 「발제자 지정」 — 0원 「신청 완료」 발제자 행 + 지정/빼기 RPC
-- 결정: 검토문서/DECISIONS.md 2026-10-13 「발제자 지정」 + 같은 날 대표님 확정 11건
-- 설계: docs/agent-team/조사/2026-10-13-발제자지정-설계.md §2·§3·§5
-- 코드 동기: src/lib/presenter-rules.ts (planMoney ↔ 아래 CASE) · src/lib/presenter.ts
--            src/app/api/admin/meetings/[id]/presenter/route.ts · src/lib/cancel.ts
-- ============================================================
--
-- 🔴 실행은 대표님이 SQL Editor에서 한다. **덩어리를 하나씩, 위에서부터** 돌린다.
--    0 확인(읽기) → 1 DDL → 2 함수 assign → 3 함수 unassign → 4 권한 확인 → 5 실행 후 확인
--    6 되돌리기는 **주석으로 막아 뒀다** — 파일을 통째로 돌려도 되돌리기는 실행되지 않는다.
--
-- 🔴 덩어리 0의 결과가 「기대」와 다르면 **멈추고 알려 주세요.** 특히 제약 이름이 다르면
--    1의 DROP IF EXISTS가 옛 제약을 못 지워 새 제약과 둘이 같이 남는다.
--
-- ▶ 왜 CREATE FUNCTION을 DDL과 나눴나 — 한 덩어리에서 함수 본문 오류가 나면 DDL까지 같이
--    되돌아가 어디서 막혔는지 가리기 어렵다(메모리 feedback_sql_migration_split).
-- ▶ 왜 함수 덩어리 안에 REVOKE를 같이 넣었나 — Supabase는 public 스키마에 새로 만든 함수에
--    anon·authenticated 실행 권한을 **자동으로** 준다. 함수 만들기와 권한 잠그기를 따로 돌리면
--    그 사이 몇 분 동안 **아무나 anon 키로 자기를 0원 발제자로 넣을 수 있다**
--    (migration-lock-definer-rpcs.sql이 막은 confirm_registration 구멍과 같은 모양).
--    그래서 한 트랜잭션 안에서 만들고 바로 잠근다. 덩어리 4는 잠금이 맞는지 확인만 한다.
--
-- ▶ 코드와의 순서 — **어느 쪽이 먼저여도 깨지지 않는다** (forward-compatible).
--    · SQL 먼저: 옛 코드는 is_presenter를 모르고(기본값 false), 'none'·새 cancel_type을 쓰지 않으며,
--      새 함수를 부르지 않는다. 새 CHECK는 옛 코드가 쓰는 값(card/transfer, 기존 4종)을 모두 통과시킨다.
--    · 코드 먼저: 코드는 is_presenter 칸을 **읽지 않는다**(발제자는 payment_method='none'으로 가린다).
--      지정 라우트는 PortOne보다 먼저 `assign_presenter`를 시험 호출(없는 모임 id → 'not_found')해서
--      함수가 없으면 「준비 중」으로 멈춘다 → **카드 환불만 나가고 전환이 안 되는 상태가 생기지 않는다.**
--      다른 화면·돈 경로는 그대로 돈다.
-- ============================================================


-- ============================================================
-- 덩어리 0. 실행 전 확인 (읽기만 — 몇 번 돌려도 된다)
-- ============================================================

-- (a) registrations 제약 — 이름·정의가 저장소와 같은지
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.registrations'::regclass and contype = 'c'
order by conname;
-- 기대(이 둘이 이 이름으로 있어야 한다):
--   registrations_payment_method_check = CHECK ((payment_method = ANY (ARRAY['card'::text, 'transfer'::text])))
--   registrations_cancel_type_check    = CHECK ((cancel_type = ANY (ARRAY[NULL::text, 'user_cancelled'::text, …])))
--   그리고 registrations_presenter_no_money_check · registrations_none_only_presenter_check 는 **없어야** 한다

-- (b) 지금 값이 새 CHECK를 통과하는지 — 둘 다 0이어야 한다
select count(*) as bad_payment_method from public.registrations
where payment_method not in ('card', 'transfer');
select count(*) as bad_cancel_type from public.registrations
where cancel_type is not null
  and cancel_type not in ('user_cancelled', 'meeting_deleted', 'waitlist_user_cancelled', 'waitlist_auto_refunded');

-- (c) 칸·인덱스·함수가 아직 없는지 — 셋 다 0행
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'registrations' and column_name = 'is_presenter';
select indexname from pg_indexes
where schemaname = 'public' and indexname = 'idx_registrations_one_presenter';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('assign_presenter', 'unassign_presenter');

-- (d) is_staff_discount가 NOT NULL인지 (아래 CHECK가 기대는 전제) — is_nullable = 'NO'
select column_name, is_nullable, column_default from information_schema.columns
where table_schema = 'public' and table_name = 'registrations'
  and column_name in ('is_staff_discount', 'payment_method', 'paid_amount', 'refunded_amount');


-- ============================================================
-- 덩어리 1. DDL (한 트랜잭션)
-- ============================================================
BEGIN;

-- 발제자 행 표시. 기존 행은 전부 false
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS is_presenter BOOLEAN NOT NULL DEFAULT false;

-- 결제수단 'none'(결제 없음) — 발제자 행 전용 (아래 CHECK가 다른 행에는 막는다)
ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_payment_method_check;
ALTER TABLE public.registrations ADD CONSTRAINT registrations_payment_method_check
  CHECK (payment_method IN ('card', 'transfer', 'none'));

-- cancel_type — 옛 `IN (NULL, …)` 패턴은 아무 값도 거절하지 못한다('x' IN (NULL,'a')는 NULL → CHECK 통과).
-- 바로잡고 두 값을 더한다
ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_cancel_type_check;
ALTER TABLE public.registrations ADD CONSTRAINT registrations_cancel_type_check
  CHECK (cancel_type IS NULL OR cancel_type IN (
    'user_cancelled', 'meeting_deleted', 'waitlist_user_cancelled', 'waitlist_auto_refunded',
    'presenter_swap',      -- 돈 낸 회원을 발제자로 바꾸며 닫은 옛 신청
    'presenter_removed'    -- 발제자를 빼며 닫은 0원 발제자 신청
  ));

-- 🔴 발제자 행은 돈을 가질 수 없다. 앞으로 누가 실수로 결제를 붙이면 INSERT/UPDATE가 거절된다.
--    `paid_amount = 0`이 아니라 `IS NOT DISTINCT FROM 0` — paid_amount가 NULL이면 `= 0`은 NULL이 되고
--    CHECK는 NULL을 통과로 본다. NULL도 막는다.
ALTER TABLE public.registrations ADD CONSTRAINT registrations_presenter_no_money_check
  CHECK (
    NOT is_presenter OR (
      paid_amount IS NOT DISTINCT FROM 0
      AND payment_id IS NULL
      AND payment_method = 'none'
      AND (refunded_amount IS NULL OR refunded_amount = 0)
      AND is_staff_discount IS NOT TRUE
    )
  );

-- 'none'은 발제자 행에만. 이 둘이 묶여 있어서 코드는 is_presenter 대신 payment_method='none'으로 가린다
ALTER TABLE public.registrations ADD CONSTRAINT registrations_none_only_presenter_check
  CHECK (payment_method <> 'none' OR is_presenter);

-- 모임당 살아 있는 발제자 1명. 🔴 INSERT 상태와 WHERE가 같다 — 발제자 행은 항상
-- status='confirmed' · is_presenter=true로 들어간다. 빼면 'cancelled'가 되어 인덱스에서 빠진다(이력은 남는다)
CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_one_presenter
  ON public.registrations (meeting_id)
  WHERE is_presenter = true AND status = 'confirmed';

COMMIT;


-- ============================================================
-- 덩어리 2. 함수 assign_presenter (따로 실행 — 만들고 바로 잠근다)
-- ============================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.assign_presenter(
  p_meeting_id        UUID,
  p_user_id           UUID,
  p_expected_reg_id   UUID,     -- 확인 창에서 본 후보의 살아 있는 신청 id (없으면 NULL)
  p_card_refunded     BOOLEAN,  -- 카드 유료 건: PortOne 전액 취소가 끝났음을 라우트가 확인했는가
  p_pending_deposited BOOLEAN   -- 입금 대기 건: 「통장에 입금이 들어왔나요?」의 답 (대표님 확정 ⑦)
)
RETURNS TABLE(result TEXT, new_registration_id UUID, closed_registration_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_capacity INTEGER; v_mstatus TEXT; v_type TEXT; v_date DATE;
  v_today DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_old_pid UUID; v_old_puser UUID;
  v_live_n INTEGER; v_live_id UUID; v_live_status TEXT; v_live_method TEXT; v_live_paid INTEGER;
  v_live_refunded INTEGER;
  v_count INTEGER; v_new_id UUID; v_rows INTEGER;
BEGIN
  -- 1. 모임 잠금 — 정원을 바꾸는 다른 RPC(confirm_registration · register_transfer ·
  --    promote_next_waitlisted · admin_confirm_transfer)와 같은 행을 잠가 순서를 세운다.
  --    ⚠️ 코드가 「함수가 있나」 시험할 때 없는 모임 id로 부른다 → 여기서 not_found로 끝나 아무것도 안 쓴다
  SELECT capacity, status, meeting_type, date INTO v_capacity, v_mstatus, v_type, v_date
  FROM public.meetings WHERE id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::uuid; RETURN; END IF;
  IF v_mstatus <> 'active' THEN RETURN QUERY SELECT 'not_active'::text, NULL::uuid, NULL::uuid; RETURN; END IF;
  IF v_type IS DISTINCT FROM 'discussion' THEN RETURN QUERY SELECT 'not_discussion'::text, NULL::uuid, NULL::uuid; RETURN; END IF;
  IF v_date < v_today THEN RETURN QUERY SELECT 'meeting_passed'::text, NULL::uuid, NULL::uuid; RETURN; END IF;

  -- 2. 현재 발제자 — 있으면 막는다. 교체는 「빼기 → 지정」 (시안에 교체 버튼이 없다)
  SELECT id, user_id INTO v_old_pid, v_old_puser
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND is_presenter AND status = 'confirmed'
  FOR UPDATE;
  IF v_old_pid IS NOT NULL THEN
    IF v_old_puser = p_user_id THEN RETURN QUERY SELECT 'already_presenter'::text, NULL::uuid, NULL::uuid; RETURN; END IF;
    RETURN QUERY SELECT 'presenter_exists'::text, NULL::uuid, NULL::uuid; RETURN;
  END IF;

  -- 3. 후보의 살아 있는 신청
  SELECT count(*) INTO v_live_n FROM public.registrations
  WHERE meeting_id = p_meeting_id AND user_id = p_user_id
    AND status IN ('confirmed', 'pending_transfer', 'waitlisted');
  IF v_live_n > 1 THEN RETURN QUERY SELECT 'ambiguous'::text, NULL::uuid, NULL::uuid; RETURN; END IF;

  SELECT id, status, payment_method, paid_amount, refunded_amount
    INTO v_live_id, v_live_status, v_live_method, v_live_paid, v_live_refunded
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND user_id = p_user_id
    AND status IN ('confirmed', 'pending_transfer', 'waitlisted')
  FOR UPDATE;

  -- 확인 창 이후 상태가 바뀌었으면 아무것도 하지 않는다
  IF v_live_id IS DISTINCT FROM p_expected_reg_id THEN
    RETURN QUERY SELECT 'state_changed'::text, NULL::uuid, NULL::uuid; RETURN;
  END IF;

  IF v_live_id IS NOT NULL THEN
    -- 살아 있는 행에 환불액이 이미 있으면 장부가 평소와 다르다 — 추측해서 덮지 않는다
    IF v_live_refunded IS NOT NULL THEN
      RETURN QUERY SELECT 'ledger_irregular'::text, NULL::uuid, NULL::uuid; RETURN;
    END IF;
    -- 카드 유료 건은 환불이 먼저 끝나 있어야 한다 (RPC는 PortOne을 못 부른다).
    -- 계좌이체 대기는 입금 단계가 없어 여기 해당 없다
    IF v_live_method <> 'transfer' AND COALESCE(v_live_paid, 0) > 0
       AND v_live_status IN ('confirmed', 'waitlisted')
       AND NOT COALESCE(p_card_refunded, false) THEN
      RETURN QUERY SELECT 'refund_required'::text, NULL::uuid, NULL::uuid; RETURN;
    END IF;
    -- 입금 대기 유료 건은 운영자가 입금 여부를 골라야 한다 (0과 NULL을 추측하지 않는다)
    IF v_live_status = 'pending_transfer' AND COALESCE(v_live_paid, 0) > 0 AND p_pending_deposited IS NULL THEN
      RETURN QUERY SELECT 'deposit_answer_required'::text, NULL::uuid, NULL::uuid; RETURN;
    END IF;
  END IF;

  -- 4. 자리 셈 — 다른 RPC와 같이 confirmed + pending_transfer.
  --    이미 자리를 가진 회원이면 제 자리를 옮기는 것이라 −1 (정원이 차 있어도 허용, 대표님 확정 ⑧)
  SELECT count(*) INTO v_count FROM public.registrations
  WHERE meeting_id = p_meeting_id AND status IN ('confirmed', 'pending_transfer');
  IF v_live_status IN ('confirmed', 'pending_transfer') THEN v_count := v_count - 1; END IF;

  IF v_count >= v_capacity THEN
    -- 🔴 카드 대기 건인데 환불이 이미 나갔으면 대기 행을 닫는다.
    --    돈을 돌려받은 채 waitlisted로 남으면 나중에 **돈 없이 승격**된다.
    IF v_live_status = 'waitlisted' AND COALESCE(p_card_refunded, false) THEN
      UPDATE public.registrations
      SET status = 'waitlist_cancelled', cancel_type = 'presenter_swap',
          refunded_amount = COALESCE(v_live_paid, 0), cancelled_at = now()
      WHERE id = v_live_id AND status = 'waitlisted' AND refunded_amount IS NULL;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows <> 1 THEN RAISE EXCEPTION 'assign_presenter: waitlist close guard (%)', v_live_id; END IF;
      RETURN QUERY SELECT 'capacity_full_refunded'::text, NULL::uuid, v_live_id; RETURN;
    END IF;
    RETURN QUERY SELECT 'capacity_full'::text, NULL::uuid, NULL::uuid; RETURN;
  END IF;

  -- 5. 후보의 옛 신청 닫기 — 지우지 않고 취소로 닫는다(대표님 확정 ④).
  --    모든 UPDATE에 「원래 상태」를 WHERE로 건다. 0행이면 RAISE → 함수 전체가 되돌아간다.
  --    🔴 아래 CASE는 lib/presenter-rules.ts planMoney의 closeRefundedAmount와 같은 표다.
  --       0 = 받은 돈 없음 / NULL = 운영자 손 환불 대기(정산 「환불 대기」에 뜬다)
  IF v_live_id IS NOT NULL THEN
    IF v_live_status = 'waitlisted' THEN
      UPDATE public.registrations
      SET status = 'waitlist_cancelled', cancel_type = 'presenter_swap',
          -- 계좌이체 대기 = 입금 단계 없음(0원·is_free만) → 0 (waitlist.ts 대기 취소와 같다) / 카드 = 방금 전액 취소
          refunded_amount = CASE WHEN v_live_method = 'transfer' THEN 0 ELSE COALESCE(v_live_paid, 0) END,
          cancelled_at = now()
      WHERE id = v_live_id AND status = 'waitlisted' AND refunded_amount IS NULL;
    ELSIF v_live_status = 'pending_transfer' THEN
      UPDATE public.registrations
      SET status = 'cancelled', cancel_type = 'presenter_swap',
          -- 「입금 들어왔다」 = NULL(환불 대기) / 「안 들어왔다」·0원 = 0
          refunded_amount = CASE
            WHEN COALESCE(v_live_paid, 0) > 0 AND p_pending_deposited IS TRUE THEN NULL
            ELSE 0 END,
          cancelled_at = now()
      WHERE id = v_live_id AND status = 'pending_transfer' AND refunded_amount IS NULL;
    ELSE -- confirmed
      UPDATE public.registrations
      SET status = 'cancelled', cancel_type = 'presenter_swap',
          -- 계좌이체 유료 = NULL(운영자 손 환불 대기) / 카드 = 방금 전액 취소한 금액 / 0원 = 0
          refunded_amount = CASE
            WHEN v_live_method = 'transfer' AND COALESCE(v_live_paid, 0) > 0 THEN NULL
            ELSE COALESCE(v_live_paid, 0) END,
          cancelled_at = now()
      WHERE id = v_live_id AND status = 'confirmed' AND refunded_amount IS NULL;
    END IF;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'assign_presenter: candidate close guard (%)', v_live_id; END IF;
  END IF;

  -- 6. 발제자 행 — 0원 「신청 완료」. 돈 칸은 CHECK(registrations_presenter_no_money_check)가 지킨다
  INSERT INTO public.registrations
    (user_id, meeting_id, status, payment_method, payment_id, paid_amount, is_staff_discount, is_presenter)
  VALUES (p_user_id, p_meeting_id, 'confirmed', 'none', NULL, 0, false, true)
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT 'success'::text, v_new_id, v_live_id;
END;
$$;

-- 만들자마자 잠근다 (머리말 「왜 함수 덩어리 안에 REVOKE를」)
REVOKE EXECUTE ON FUNCTION public.assign_presenter(uuid, uuid, uuid, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.assign_presenter(uuid, uuid, uuid, boolean, boolean) TO service_role;

COMMIT;


-- ============================================================
-- 덩어리 3. 함수 unassign_presenter (따로 실행 — 만들고 바로 잠근다)
-- ============================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.unassign_presenter(
  p_meeting_id      UUID,
  p_registration_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_mstatus TEXT; v_date DATE; v_rows INTEGER;
  v_today DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  -- 모임 잠금 — 빼고 나서 라우트가 부르는 promote_next_waitlisted와 같은 행
  SELECT status, date INTO v_mstatus, v_date FROM public.meetings WHERE id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_mstatus <> 'active' THEN RETURN 'not_active'; END IF;
  -- 지난 모임의 발제자 행은 「참석」 기록이다 — 빼지 않는다
  IF v_date < v_today THEN RETURN 'meeting_passed'; END IF;

  -- 0원 발제자 신청을 취소로 닫는다. 돌려줄 돈이 없으므로 0 (NULL이면 「환불 대기」로 잘못 세어진다)
  UPDATE public.registrations
  SET status = 'cancelled', cancel_type = 'presenter_removed', refunded_amount = 0, cancelled_at = now()
  WHERE id = p_registration_id AND meeting_id = p_meeting_id
    AND is_presenter AND status = 'confirmed' AND refunded_amount IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN 'not_presenter'; END IF;

  RETURN 'success';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unassign_presenter(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.unassign_presenter(uuid, uuid) TO service_role;

COMMIT;


-- ============================================================
-- 덩어리 4. 권한 확인 (읽기만)
-- ============================================================
select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.proacl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('assign_presenter', 'unassign_presenter');
-- 기대: 두 행 모두 {postgres=X/postgres,service_role=X/postgres} 형태 (부여자 표기는 다를 수 있다)
--       🔴 anon= 이나 authenticated= 나 맨 앞 =X(PUBLIC)가 보이면 아래를 다시 돌린다:
-- REVOKE EXECUTE ON FUNCTION public.assign_presenter(uuid, uuid, uuid, boolean, boolean) FROM PUBLIC, anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.unassign_presenter(uuid, uuid) FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 덩어리 5. 실행 후 확인 (읽기만)
-- ============================================================
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.registrations'::regclass
  and conname in ('registrations_payment_method_check', 'registrations_cancel_type_check',
                  'registrations_presenter_no_money_check', 'registrations_none_only_presenter_check');
-- 기대: 4행

select indexdef from pg_indexes where schemaname = 'public' and indexname = 'idx_registrations_one_presenter';
-- 기대: 1행, WHERE ((is_presenter = true) AND (status = 'confirmed'::text))

select count(*) as presenter_rows from public.registrations where is_presenter;
-- 기대: 0 (지정 전)

-- 함수가 부를 수 있는 상태인지 — 없는 모임 id라 아무것도 쓰지 않고 'not_found'만 돌려준다.
-- (SQL Editor는 postgres 권한이라 권한 확인은 덩어리 4로 한다. 이건 함수 본문이 도는지만 본다)
select * from public.assign_presenter(
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', NULL, false, NULL);
-- 기대: result = not_found, 나머지 NULL


-- ============================================================
-- 덩어리 6. 되돌리기 — 🔴 주석으로 막아 뒀다. 필요할 때만 /* */ 를 풀고 돌린다
-- ============================================================
-- 기본 롤백은 **코드만** 되돌리는 것(git revert)이다. 스키마는 남겨도 무해하다 —
-- 옛 코드는 새 칸·새 값·새 함수를 쓰지 않는다(머리말 「코드와의 순서」).
--
-- 먼저 발제자 행이 있는지 센다. 0이 아니면 **멈춘다** — 그 회원들의 자리가 걸려 있다.
--   select count(*) from public.registrations where is_presenter and status = 'confirmed';
-- 이력(cancelled · presenter_*)이 남아 있으면 마지막 cancel_type CHECK가 실패한다 →
-- 그때는 cancel_type CHECK에 두 값을 남긴 채(아래 마지막 두 문장을 빼고) 돌린다.
/*
BEGIN;
DROP FUNCTION IF EXISTS public.assign_presenter(uuid, uuid, uuid, boolean, boolean);
DROP FUNCTION IF EXISTS public.unassign_presenter(uuid, uuid);
DROP INDEX IF EXISTS public.idx_registrations_one_presenter;
ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_none_only_presenter_check;
ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_presenter_no_money_check;
ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_payment_method_check;
ALTER TABLE public.registrations ADD CONSTRAINT registrations_payment_method_check
  CHECK (payment_method IN ('card', 'transfer'));
ALTER TABLE public.registrations DROP COLUMN IF EXISTS is_presenter;
-- cancel_type CHECK는 바로잡은 형태를 남기고 두 값만 뺀다 (옛 IN(NULL,…)으로 되돌리지 않는다)
ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_cancel_type_check;
ALTER TABLE public.registrations ADD CONSTRAINT registrations_cancel_type_check
  CHECK (cancel_type IS NULL OR cancel_type IN (
    'user_cancelled', 'meeting_deleted', 'waitlist_user_cancelled', 'waitlist_auto_refunded'));
COMMIT;
*/

-- ============================================================
-- 반환값
-- ============================================================
-- assign_presenter → (result, new_registration_id, closed_registration_id)
--   success                 : 발제자 행 INSERT (+ 후보의 옛 신청을 취소로 닫음)
--   not_found / not_active / not_discussion / meeting_passed : 모임이 지정을 받을 수 없음
--   already_presenter / presenter_exists : 이미 발제자가 있음 (교체는 빼기 → 지정)
--   ambiguous               : 후보의 살아 있는 신청이 2건 이상
--   state_changed           : 확인 창 이후 후보의 신청이 바뀜 — 아무것도 안 함
--   ledger_irregular        : 살아 있는 행에 환불액이 이미 있음 — 아무것도 안 함
--   refund_required         : 카드 유료 건인데 환불 완료 표시 없이 불림 — 아무것도 안 함
--   deposit_answer_required : 입금 대기 유료 건인데 입금 여부 답이 없음 — 아무것도 안 함
--   capacity_full           : 정원 참 — 아무것도 안 함
--   capacity_full_refunded  : 카드 대기 건 환불 뒤 자리가 참 → 대기 행만 닫음(돈 없이 승격되지 않게)
--   (예외)                  : 원래 상태 가드 위반 — 함수 전체가 되돌아간다
-- unassign_presenter → 'success' | 'not_found' | 'not_active' | 'meeting_passed' | 'not_presenter'
-- ============================================================
