-- ============================================================
-- FIX: RLS infinite recursion on profiles table
-- profiles의 admin 확인 시 profiles 자체를 조회하면 무한 재귀 발생
-- → SECURITY DEFINER 함수로 우회
-- ============================================================

-- 1. Helper function: 현재 유저가 admin인지 확인
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

-- 2. Drop old policies that cause recursion
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "meetings_insert_admin" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update_admin" ON public.meetings;
DROP POLICY IF EXISTS "meetings_delete_admin" ON public.meetings;
DROP POLICY IF EXISTS "registrations_select_admin" ON public.registrations;

-- 3. Recreate policies using is_admin() function
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "meetings_insert_admin"
  ON public.meetings FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "meetings_update_admin"
  ON public.meetings FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "meetings_delete_admin"
  ON public.meetings FOR DELETE
  USING (public.is_admin());

CREATE POLICY "registrations_select_admin"
  ON public.registrations FOR SELECT
  USING (public.is_admin());
