-- ============================================================
-- 계좌이체 브릿지 — site_settings 초기 데이터
-- 실행 시점: 함수 마이그레이션 후 실행
-- ⚠ bank_name, bank_account, bank_holder 값을 실제 계좌로 교체하세요!
-- ============================================================

INSERT INTO public.site_settings (key, value) VALUES
  ('payment_mode', 'transfer_only'),
  ('bank_name', '카카오뱅크'),
  ('bank_account', '3333-00-0000000'),
  ('bank_holder', '임재윤')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
