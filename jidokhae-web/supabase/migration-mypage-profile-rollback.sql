-- 롤백: nickname_changed_at 컬럼 제거
ALTER TABLE public.profiles DROP COLUMN IF EXISTS nickname_changed_at;
