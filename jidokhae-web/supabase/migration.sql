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
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS region TEXT[] DEFAULT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_region_check
  CHECK (region <@ ARRAY['경주', '포항', '울산', '부산', '대구', '창원', '대전', '광주', '전주', '수원', '인천', '서울', '제주']::TEXT[]);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- Phase 1-2: 운영진 권한 위임 — editor 역할 추가
-- Supabase SQL Editor에서 아래 SQL을 수동 실행할 것
-- ============================================================

-- 1a. role CHECK 확장 (member, admin → member, editor, admin)
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('member', 'editor', 'admin'));

-- 1b. is_editor_or_admin() 함수 추가 (is_admin()은 유지)
CREATE OR REPLACE FUNCTION public.is_editor_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('editor', 'admin')
  );
$$;

-- 1c. meetings INSERT/UPDATE RLS → editor도 허용
DROP POLICY "meetings_insert_admin" ON public.meetings;
CREATE POLICY "meetings_insert_editor_or_admin"
  ON public.meetings FOR INSERT
  WITH CHECK (public.is_editor_or_admin());

DROP POLICY "meetings_update_admin" ON public.meetings;
CREATE POLICY "meetings_update_editor_or_admin"
  ON public.meetings FOR UPDATE
  USING (public.is_editor_or_admin());
-- meetings_delete_admin은 유지 (admin만 삭제 가능)

-- 1d. registrations SELECT for editor (신청자 목록 조회용)
CREATE POLICY "registrations_select_editor_or_admin"
  ON public.registrations FOR SELECT
  USING (public.is_editor_or_admin());

-- 1e. 닉네임 partial unique index (빈 문자열 제외)
CREATE UNIQUE INDEX idx_profiles_nickname_unique
  ON public.profiles (nickname) WHERE nickname <> '';

-- ============================================================
-- 프로필 설정 — 실명 필드 추가
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS real_name TEXT DEFAULT NULL;

-- ============================================================
-- profiles SELECT RLS — editor도 전체 프로필 조회 허용
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_editor_or_admin"
  ON public.profiles FOR SELECT
  USING (public.is_editor_or_admin());

-- ============================================================
-- Phase 2-1: 알림톡 — notifications 테이블
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL
    CHECK (type IN ('meeting_remind', 'registration_confirm')),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id),
  recipient_phone TEXT NOT NULL,
  meeting_id UUID REFERENCES public.meetings(id),
  registration_id UUID REFERENCES public.registrations(id),
  template_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  solapi_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- 조건부 UNIQUE INDEX — 중복 발송 DB 수준 차단
-- INSERT(pending) 단계에서 UNIQUE 위반 → Solapi 발송 전에 중복 차단
-- meeting_remind: 한 사람에게 같은 모임 리마인드 1회만
CREATE UNIQUE INDEX idx_notifications_remind_unique
  ON public.notifications(recipient_id, meeting_id)
  WHERE type = 'meeting_remind';

-- registration_confirm: 같은 registration에 확인 알림 1회만 (재신청 시 새 registration → 새 알림 OK)
CREATE UNIQUE INDEX idx_notifications_confirm_unique
  ON public.notifications(registration_id)
  WHERE type = 'registration_confirm';

-- 조회용 인덱스
CREATE INDEX idx_notifications_meeting_type
  ON public.notifications(meeting_id, type);
CREATE INDEX idx_notifications_created
  ON public.notifications(created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_admin"
  ON public.notifications FOR SELECT
  USING (public.is_admin());

-- ============================================================
-- Phase 2-2: 대기 신청 + 자동 승격
-- ============================================================

-- registrations status CHECK 확장
ALTER TABLE public.registrations DROP CONSTRAINT registrations_status_check;
ALTER TABLE public.registrations ADD CONSTRAINT registrations_status_check
  CHECK (status IN ('confirmed', 'cancelled', 'waitlisted', 'waitlist_cancelled', 'waitlist_refunded'));

-- registrations cancel_type CHECK 확장
ALTER TABLE public.registrations DROP CONSTRAINT registrations_cancel_type_check;
ALTER TABLE public.registrations ADD CONSTRAINT registrations_cancel_type_check
  CHECK (cancel_type IN (NULL, 'user_cancelled', 'meeting_deleted', 'waitlist_user_cancelled', 'waitlist_auto_refunded'));

-- 대기자 순번 조회용 인덱스
CREATE INDEX idx_registrations_waitlist
  ON public.registrations(meeting_id, created_at)
  WHERE status = 'waitlisted';

-- confirm_registration() RPC 수정 — 정원 초과 시 waitlisted INSERT
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
  -- 1. Lock the meeting row
  SELECT capacity, status INTO v_capacity, v_status
  FROM public.meetings WHERE id = p_meeting_id FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_status <> 'active' THEN RETURN 'not_active'; END IF;

  -- 2. 중복 체크 (confirmed OR waitlisted)
  SELECT COUNT(*) INTO v_duplicate_count
  FROM public.registrations
  WHERE user_id = p_user_id
    AND meeting_id = p_meeting_id
    AND status IN ('confirmed', 'waitlisted');

  IF v_duplicate_count > 0 THEN RETURN 'already_registered'; END IF;

  -- 3. 정원 체크
  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND status = 'confirmed';

  -- 4. 정원 미달 → confirmed, 초과 → waitlisted
  IF v_confirmed_count < v_capacity THEN
    INSERT INTO public.registrations (user_id, meeting_id, status, payment_id, paid_amount)
    VALUES (p_user_id, p_meeting_id, 'confirmed', p_payment_id, p_paid_amount);
    RETURN 'success';
  ELSE
    INSERT INTO public.registrations (user_id, meeting_id, status, payment_id, paid_amount)
    VALUES (p_user_id, p_meeting_id, 'waitlisted', p_payment_id, p_paid_amount);
    RETURN 'waitlisted';
  END IF;
END;
$$;

-- promote_next_waitlisted() — 원자적 대기자 승격
CREATE OR REPLACE FUNCTION public.promote_next_waitlisted(
  p_meeting_id UUID
)
RETURNS TABLE(promoted_id UUID, promoted_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_capacity INTEGER;
  v_confirmed_count INTEGER;
  v_next_id UUID;
  v_next_user_id UUID;
BEGIN
  -- 1. Lock the meeting row
  SELECT capacity INTO v_capacity
  FROM public.meetings WHERE id = p_meeting_id FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  -- 2. 현재 confirmed 수
  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND status = 'confirmed';

  -- 3. 정원 충분이면 종료
  IF v_confirmed_count >= v_capacity THEN RETURN; END IF;

  -- 4. 가장 오래된 waitlisted 찾기
  SELECT id, user_id INTO v_next_id, v_next_user_id
  FROM public.registrations
  WHERE meeting_id = p_meeting_id AND status = 'waitlisted'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_next_id IS NULL THEN RETURN; END IF;

  -- 5. 승격: waitlisted → confirmed
  UPDATE public.registrations
  SET status = 'confirmed'
  WHERE id = v_next_id AND status = 'waitlisted';

  -- 6. 결과 반환
  promoted_id := v_next_id;
  promoted_user_id := v_next_user_id;
  RETURN NEXT;
END;
$$;

-- notifications type CHECK 확장
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'meeting_remind', 'registration_confirm',
    'waitlist_confirm', 'waitlist_promoted', 'waitlist_refunded'
  ));

-- 대기 알림 중복 방지 인덱스
CREATE UNIQUE INDEX idx_notifications_waitlist_confirm_unique
  ON public.notifications(registration_id)
  WHERE type = 'waitlist_confirm';

CREATE UNIQUE INDEX idx_notifications_waitlist_promoted_unique
  ON public.notifications(registration_id)
  WHERE type = 'waitlist_promoted';

CREATE UNIQUE INDEX idx_notifications_waitlist_refunded_unique
  ON public.notifications(registration_id)
  WHERE type = 'waitlist_refunded';

-- ============================================================
-- Phase 2-3: 백오피스 — site_settings + venues + venue_settlements
-- Supabase SQL Editor에서 아래 SQL을 수동 실행할 것
-- ============================================================

-- 1. site_settings 테이블
CREATE TABLE public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_settings_select_all"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "site_settings_insert_admin"
  ON public.site_settings FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "site_settings_update_admin"
  ON public.site_settings FOR UPDATE
  USING (public.is_admin());

-- 초기 데이터
INSERT INTO public.site_settings (key, value) VALUES
  ('member_count', '250'),
  ('active_regions_label', '경주 · 포항'),
  ('company_name', '지독해'),
  ('representative', '임재윤'),
  ('business_number', '494-42-01276'),
  ('address', '경상북도 경주시 태종로 801-11 (황오동) 208호'),
  ('phone', '0507-1396-7908'),
  ('support_contact', '카카오톡 ''단무지''에게 1:1 채팅으로 연락해 주세요.');

-- 2. venues 테이블
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  settlement_type TEXT NOT NULL DEFAULT 'percentage'
    CHECK (settlement_type IN ('percentage', 'fixed', 'none')),
  settlement_rate INTEGER DEFAULT 80
    CHECK (settlement_rate >= 0 AND settlement_rate <= 100),
  settlement_fixed INTEGER DEFAULT 0
    CHECK (settlement_fixed >= 0),
  contact_name TEXT,
  contact_info TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venues_select_all"
  ON public.venues FOR SELECT USING (true);
CREATE POLICY "venues_insert_admin"
  ON public.venues FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "venues_update_admin"
  ON public.venues FOR UPDATE USING (public.is_admin());

-- meetings에 venue_id 추가
ALTER TABLE public.meetings ADD COLUMN venue_id UUID REFERENCES public.venues(id);

-- 3. venue_settlements 테이블
CREATE TABLE public.venue_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id),
  month TEXT NOT NULL,
  total_paid INTEGER NOT NULL,
  settlement_amount INTEGER NOT NULL,
  settled_at TIMESTAMPTZ,
  settled_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (venue_id, month)
);

ALTER TABLE public.venue_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_settlements_select_admin"
  ON public.venue_settlements FOR SELECT
  USING (public.is_admin());
CREATE POLICY "venue_settlements_insert_admin"
  ON public.venue_settlements FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "venue_settlements_update_admin"
  ON public.venue_settlements FOR UPDATE
  USING (public.is_admin());

-- 초기 공간 데이터
INSERT INTO public.venues (name, settlement_type, settlement_rate, contact_name) VALUES
  ('우연히 책방', 'percentage', 80, '우연히 책방 담당자'),
  ('공간 지그시', 'percentage', 80, '공간 지그시 담당자');
