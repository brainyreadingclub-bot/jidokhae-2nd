-- ============================================================
-- 마이페이지 프로필 수정 — 닉네임 1회 변경 추적
-- Supabase SQL Editor에서 아래 1줄을 수동 실행할 것
-- 기존 회원 전원 nickname_changed_at = NULL (= 아직 변경 안 함 = 1회 기회)
-- 가입 시 최초 입력은 "변경"이 아니므로 별도 UPDATE 불필요
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname_changed_at TIMESTAMPTZ DEFAULT NULL;
