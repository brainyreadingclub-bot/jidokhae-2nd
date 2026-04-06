-- ============================================================
-- 계좌이체 브릿지 마이그레이션
-- 실행 시점: 코드 배포 후 Supabase SQL Editor에서 실행
-- ============================================================

-- 1. payment_method 컬럼 추가
ALTER TABLE public.registrations
ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'card';

ALTER TABLE public.registrations
ADD CONSTRAINT registrations_payment_method_check
CHECK (payment_method IN ('card', 'transfer'));

-- 2. status CHECK 제약 교체 (pending_transfer 추가)
ALTER TABLE public.registrations
DROP CONSTRAINT IF EXISTS registrations_status_check;

ALTER TABLE public.registrations
ADD CONSTRAINT registrations_status_check
CHECK (status IN ('confirmed', 'cancelled', 'waitlisted', 'waitlist_cancelled', 'waitlist_refunded', 'pending_transfer'));

-- 3. cancel_type CHECK 제약 교체 (기존 값 유지)
ALTER TABLE public.registrations
DROP CONSTRAINT IF EXISTS registrations_cancel_type_check;

ALTER TABLE public.registrations
ADD CONSTRAINT registrations_cancel_type_check
CHECK (cancel_type IN (NULL, 'user_cancelled', 'meeting_deleted', 'waitlist_user_cancelled', 'waitlist_auto_refunded'));

-- 4. pending_transfer 인덱스
CREATE INDEX IF NOT EXISTS idx_registrations_pending_transfer
ON public.registrations(meeting_id, created_at)
WHERE status = 'pending_transfer';
