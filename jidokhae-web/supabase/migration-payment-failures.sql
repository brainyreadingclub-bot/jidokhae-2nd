-- ============================================================
-- 결제 실패 원장 payment_failures — Schema Migration
-- ============================================================
--
-- 배경 (2026-09-10 고아 결제 사고)
--   회원 한 명이 12,000을 정상 결제했는데 registrations에 행이 아예 안 생겼다.
--   브라우저 redirect가 끊겼고, 백업인 PortOne 웹훅은 M4 최초 구현부터
--   uuid 컬럼에 LIKE를 걸어 항상 실패하고 있었다(42883).
--
--   진짜 원인은 "못 본 것"이다. 서버는 `[portone-webhook] ID 조회 실패`를
--   몇 달간 console에 찍고 있었지만 아무도 못 봤다.
--   2026-09-11 실측: Vercel 런타임 로그 보관은 약 1시간이다
--   (`--since 7d`를 줘도 38건·최고령 51분, 4일 전 요청은 400).
--   결제 사고는 며칠 뒤에 발견되므로 console만으로는 구조적으로 항상 늦는다.
--
--   그래서 돈에 닿는 경로의 실패를 우리 표에 남긴다. 보관 기간이 우리 것이 된다.
--   선례는 notifications 테이블 — 시도를 행으로 남기고 성공/실패를 기록하는 모양.
--
-- 변경 내용
--   - public.payment_failures 테이블 신설
--   - 조회 인덱스 2개 (최근순 / payment_id)
--   - RLS ON + admin SELECT 정책 (쓰기는 service_role이 RLS를 우회한다)
--
-- 적용 순서 — 이 마이그레이션은 코드 배포와 순서를 가리지 않는다
--   recordPaymentFailure()가 INSERT 실패를 삼키고 console.error만 남기도록
--   작성돼 있어, 테이블이 없어도 결제/웹훅 흐름은 그대로 돈다.
--   따라서 "코드 먼저 / SQL 먼저" 어느 쪽이든 안전하다.
--   다만 기록을 실제로 남기려면 이 파일이 실행돼 있어야 한다.
--
-- 롤백
--   migration-payment-failures-rollback.sql 사용 (기록이 통째로 사라지므로
--   지우기 전에 SELECT로 내용을 떠 둘 것)
--
-- 개인정보
--   이 테이블에는 전화·이메일·실명을 넣지 않는다. payment_id와 UUID까지만.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 어느 경로에서 실패했나: 'webhook'(PortOne 백업) | 'confirm'(브라우저 redirect)
  source TEXT NOT NULL,

  -- 무엇이 실패했나: 'payment_id_malformed' | 'id_lookup_failed' | 'id_lookup_empty' |
  --                  'id_lookup_ambiguous' | 'confirm_rejected' | 'unhandled_exception'
  --
  -- 🔴 CHECK 제약을 일부러 두지 않았다.
  --    이 표의 목적은 행을 절대 잃지 않는 것인데, CHECK는 새 단계가 생긴 순간
  --    INSERT를 거절해서 기록 자체를 지워 버린다. 그러면 "못 보는 사고"가
  --    한 겹 더 생긴다. 오타 방어는 src/lib/payment-failure.ts의 TypeScript
  --    유니온이 컴파일 시점에 한다. (notifications의 CHECK 관례와 다른 선택)
  stage TEXT NOT NULL,

  -- PortOne 결제 식별자. 형식: jdkh-{meetingId8}-{userId8}-{timestamp}
  payment_id TEXT NOT NULL,

  -- 알아냈을 때만 채운다. 못 알아낸 것이 실패 원인인 경우가 많다.
  --
  -- 🔴 FK(REFERENCES)를 일부러 걸지 않았다.
  --    실패 기록에는 "존재하지 않는 모임 id로 요청이 들어왔다" 같은 건이 들어온다.
  --    FK를 걸면 그런 행이 23503으로 거절돼 **가장 중요한 기록이 사라진다.**
  --    이 표의 제1원칙은 참조 무결성이 아니라 "행을 잃지 않는 것"이다.
  --    조회는 LEFT JOIN으로 한다 (UUID 타입은 유지했으므로 join은 그대로 된다).
  --    포맷이 깨진 값은 코드(recordPaymentFailure)가 null로 돌리고 detail에 원문을 붙인다.
  meeting_id UUID,
  user_id UUID,

  -- 원문 에러 / 판정 근거 (예: '42883 operator does not exist: uuid ~~ unknown')
  detail TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 최근 실패부터 보기 (운영 점검의 기본 조회)
CREATE INDEX IF NOT EXISTS idx_payment_failures_created
  ON public.payment_failures(created_at DESC);

-- 한 결제의 시도 이력 추적 (웹훅 재시도는 같은 payment_id로 여러 행을 만든다 —
-- 중복 차단용 UNIQUE를 두지 않았다. 재시도 횟수 자체가 신호이기 때문이다)
CREATE INDEX IF NOT EXISTS idx_payment_failures_payment_id
  ON public.payment_failures(payment_id);

COMMENT ON TABLE public.payment_failures IS
  '돈에 닿는 경로(웹훅/redirect confirm)의 실패 원장. 2026-09-10 고아 결제 사고 후 신설. Vercel 런타임 로그는 약 1시간이면 사라진다.';
COMMENT ON COLUMN public.payment_failures.source IS 'webhook | confirm';
COMMENT ON COLUMN public.payment_failures.stage IS 'payment_id_malformed | id_lookup_failed | id_lookup_empty | id_lookup_ambiguous | confirm_rejected | unhandled_exception (CHECK 없음 — 이유는 마이그레이션 주석 참조)';
COMMENT ON COLUMN public.payment_failures.detail IS '원문 에러/판정 근거. 개인정보 금지.';

-- ============================================================
-- RLS — notifications와 동일한 모양
--   쓰기는 API Route가 service_role로 하므로 RLS를 우회한다.
--   읽기는 admin만. (editor 제외 — 결제 식별자가 보이는 표다)
-- ============================================================

ALTER TABLE public.payment_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_failures_select_admin" ON public.payment_failures;
CREATE POLICY "payment_failures_select_admin"
  ON public.payment_failures FOR SELECT
  USING (public.is_admin());

-- ============================================================
-- 검증 쿼리 (참고용 — 마이그레이션 후 수동 실행 가능)
-- ============================================================
-- 1) 테이블이 생겼는가
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'payment_failures'
-- ORDER BY ordinal_position;
--   기대: id, source, stage, payment_id, meeting_id, user_id, detail, created_at (8행)
--
-- 2) 최근 실패 보기 (운영 점검 시 이 한 줄이면 된다)
-- SELECT created_at, source, stage, payment_id, detail
-- FROM public.payment_failures
-- ORDER BY created_at DESC
-- LIMIT 50;
--
-- 3) 웹훅 수정이 실제로 먹었는지 확인하는 방법
--    수정 전에는 모든 Transaction.Paid가 id_lookup_failed로 쌓였을 것이다.
--    수정 후 결제가 몇 건 지나갔는데 이 표가 비어 있으면 정상이다.
-- SELECT stage, count(*) FROM public.payment_failures GROUP BY stage;
--
-- 4) 🔴 uuid prefix 조회가 실제로 행을 찾는지 prod에서 직접 확인 (읽기 전용)
--    아래는 옛 코드가 42883으로 죽던 자리를 새 방식으로 대체한 것이다.
-- SELECT id FROM public.meetings
-- WHERE id >= '20425c26-0000-0000-0000-000000000000'::uuid
--   AND id <= '20425c26-ffff-ffff-ffff-ffffffffffff'::uuid
-- LIMIT 1;
--   기대: 2026-09-07 사고 모임 1행. (옛 방식 `id LIKE '20425c26%'`는 42883으로 실패)
