-- ============================================================
-- JIDOKHAE MVP Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ============================================================
-- 1. Tables
-- ============================================================

-- 1-1. profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kakao_id TEXT,
  nickname TEXT NOT NULL DEFAULT '',
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1-2. meetings
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  location TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  fee INTEGER NOT NULL CHECK (fee >= 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deleting', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1-3. registrations
-- NOTE: user_id + meeting_id is NOT UNIQUE (re-registration creates new record)
CREATE TABLE public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled')),
  cancel_type TEXT
    CHECK (cancel_type IN (NULL, 'user_cancelled', 'meeting_deleted')),
  payment_id TEXT,
  paid_amount INTEGER,
  refunded_amount INTEGER,
  attended BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);

-- Index for common queries
CREATE INDEX idx_registrations_meeting_status
  ON public.registrations(meeting_id, status);
CREATE INDEX idx_registrations_user_meeting
  ON public.registrations(user_id, meeting_id);
CREATE INDEX idx_registrations_payment_id
  ON public.registrations(payment_id);
CREATE INDEX idx_meetings_date_status
  ON public.meetings(date, status);

-- ============================================================
-- 2. RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Helper function: admin 확인 (SECURITY DEFINER로 RLS 재귀 방지)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 2-1. profiles
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2-2. meetings
CREATE POLICY "meetings_select_all"
  ON public.meetings FOR SELECT
  USING (true);

CREATE POLICY "meetings_insert_admin"
  ON public.meetings FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "meetings_update_admin"
  ON public.meetings FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "meetings_delete_admin"
  ON public.meetings FOR DELETE
  USING (public.is_admin());

-- 2-3. registrations
CREATE POLICY "registrations_select_own"
  ON public.registrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "registrations_select_admin"
  ON public.registrations FOR SELECT
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies for registrations
-- (only accessible via service_role key in API Routes)

-- ============================================================
-- 3. DB Trigger: Auto-create profile on auth.users INSERT
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, kakao_id, nickname, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'provider_id', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'email', NULL)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 4. DB Function: confirm_registration (SECURITY DEFINER)
--    Atomic capacity check + INSERT with FOR UPDATE row lock
-- ============================================================

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
  -- 1. Lock the meeting row (serializes concurrent requests)
  SELECT capacity, status INTO v_capacity, v_status
  FROM public.meetings
  WHERE id = p_meeting_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_status <> 'active' THEN
    RETURN 'not_active';
  END IF;

  -- 1.5. Check for existing confirmed registration (duplicate prevention)
  SELECT COUNT(*) INTO v_duplicate_count
  FROM public.registrations
  WHERE user_id = p_user_id
    AND meeting_id = p_meeting_id
    AND status = 'confirmed';

  IF v_duplicate_count > 0 THEN
    RETURN 'already_registered';
  END IF;

  -- 2. Count current confirmed registrations
  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.registrations
  WHERE meeting_id = p_meeting_id
    AND status = 'confirmed';

  -- 3. Check capacity
  IF v_confirmed_count >= v_capacity THEN
    RETURN 'full';
  END IF;

  -- 4. Insert registration
  INSERT INTO public.registrations (user_id, meeting_id, status, payment_id, paid_amount)
  VALUES (p_user_id, p_meeting_id, 'confirmed', p_payment_id, p_paid_amount);

  RETURN 'success';
END;
$$;

-- ============================================================
-- 5. DB Function: Get confirmed count per meeting (SECURITY DEFINER)
--    Bypasses RLS to count all registrations
-- ============================================================

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
    AND r.status = 'confirmed'
  GROUP BY r.meeting_id;
END;
$$;

-- ============================================================
-- 6. Auto-update updated_at on meetings
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 2026-03-19: 웰컴 스크린 — 첫 방문 여부 추적
-- Supabase SQL Editor에서 아래 2줄을 수동 실행할 것
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcomed_at TIMESTAMPTZ DEFAULT NULL;

-- 기존 회원 전원에게 welcomed_at 채우기 (웰컴 스크린이 뜨지 않도록)
UPDATE public.profiles SET welcomed_at = now() WHERE welcomed_at IS NULL;

-- ============================================================
-- Phase 1-1: 프로필 설정 — 닉네임/전화번호/지역 수집
-- Supabase SQL Editor에서 아래 3줄을 수동 실행할 것
-- 기존 회원은 profile_completed_at = NULL → 프로필 설정 화면 표시 (의도된 동작)
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS region TEXT DEFAULT NULL CHECK (region IN ('경주', '포항', '울산', '부산', '대구', '창원', '대전', '광주', '전주', '수원', '인천', '서울', '제주'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ DEFAULT NULL;
