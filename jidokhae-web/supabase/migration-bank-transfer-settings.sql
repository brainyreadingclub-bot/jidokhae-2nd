-- ============================================================
-- 계좌이체 브릿지 — site_settings 초기 데이터
-- 실행 시점: 함수 마이그레이션 후 실행
-- ============================================================

INSERT INTO public.site_settings (key, value) VALUES
  ('payment_mode', 'transfer_only'),
  ('bank_name', '카카오뱅크'),
  ('bank_account', '3333270661539'),
  ('bank_holder', '임재윤(지독해)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
