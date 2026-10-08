-- ============================================================
-- 토론모임 격리 플래그 (A-3) — site_settings 행 생성
--
-- 배경: prod site_settings에는 키가 12개뿐이고 next_ui·library_enabled 행도 없다
--       (2026-08-22 실측). 코드는 "행이 없으면 OFF"로 동작하므로 이 파일을 실행하지
--       않아도 기능은 꺼진 상태로 안전하다 — forward-compatible.
--
-- 🔴 그래도 켜는 날에 **값과 무관하게 행은 만든다.**
--    사고가 났을 때 `UPDATE` 한 줄로 끌 수 있어야 한다. 행이 없으면 끄는 것도 켜는 것도
--    그 자리에서 SQL을 새로 써야 하는데, 사고 시간에 SQL을 쓰게 두면 안 된다.
--
-- 실행 시점: A-2·A-3 코드가 배포된 **뒤**. 순서가 뒤집혀도 무해하다(코드가 기본 OFF).
-- 실행 방법: Supabase SQL Editor
--
-- ⚠️ 기본값을 'off'로 넣는다. 첫 토론모임 준비가 끝나면 아래 한 줄로 켠다:
--      UPDATE public.site_settings SET value = 'on', updated_at = now()
--       WHERE key = 'discussion_meeting_enabled';
-- ============================================================

INSERT INTO public.site_settings (key, value) VALUES
  ('discussion_meeting_enabled', 'off')
ON CONFLICT (key) DO NOTHING;

-- 확인
--   SELECT key, value FROM public.site_settings WHERE key = 'discussion_meeting_enabled';
