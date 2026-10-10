-- ============================================================
-- 발제 알림 묶기 — 마지막 등록 후 10분 조용하면 신청자에게 한 번 (2026-10-10, 1차)
-- ============================================================
--
-- 배경
--   1차부터 운영자가 발제를 하나씩 쓰고 **등록하면 바로 공개**된다(published_at = now()).
--   등록마다 알림을 보내면 5개면 5번 간다. 그래서 묶는다 —
--   그 모임에 마지막으로 발제가 올라온 뒤 10분 동안 추가 등록이 없으면,
--   아직 알리지 않은 공개 발제 수 N을 **그때 다시 세서** 신청자에게 「발제 N개가 올라왔어요」 한 번.
--   그새 지운 발제는 세지 않는다(행이 없으니까). 0개면 보내지 않는다. 고치기(PATCH)는
--   published_at을 바꾸지 않아 알림이 다시 가지 않는다.
--
-- 왜 DB 예약 작업인가
--   Vercel 함수는 응답 뒤 10분을 기다릴 수 없다. Vercel Cron은 요금제에 따라 주기가 다르고
--   (요금제 확인 안 함), 앱을 거치면 인증·실패 처리가 하나 더 생긴다. 알림은 app_notifications에
--   행을 넣는 것뿐이라 DB 안에서 끝난다 — pg_cron이 1분마다 함수를 부른다.
--   실제 지연: 마지막 등록 후 **10분 이상 ~ 11분 남짓**(1분 주기 + 실행 시간).
--
-- 변경 내용
--   ① discussion_topics.notified_at timestamptz null 추가 (null = 아직 안 알림)
--   ② 기존 발제는 전부 「이미 알림」으로 채운다 — 옛 코드가 발제 1건마다 알림을 보냈다.
--      안 채우면 첫 실행 때 옛 발제를 다시 알린다
--   ③ flush_topic_notifications() — SECURITY DEFINER, 실행 권한은 아무에게도 주지 않는다
--      (pg_cron은 postgres로 돈다. 회원·익명이 RPC로 부르면 알림을 쏠 수 있으니 잠근다 —
--       migration-lock-definer-rpcs.sql과 같은 원칙)
--   ④ pg_cron 확장 + 1분 예약 작업 'topic-notify-flush'
--
-- 받는 사람: 그 모임 confirmed·pending_transfer 신청자, 한 사람당 한 건
--   (옛 등록 API의 알림 대상과 같다)
-- payload: { meeting_id, meeting_title, count, more } — 앱 src/lib/topic-notification.ts가 읽는다.
--   more = 그 모임에 이미 알린 발제가 있었는가 → 「발제 N개가 더 올라왔어요」
--
-- 🔴 적용 순서 — SQL 먼저, 코드 나중
--   ②가 「지금 있는 발제 = 이미 알림」으로 채운다. 새 코드가 먼저 올라가 발제를 등록한 뒤에
--   이 파일을 돌리면 그 발제도 「이미 알림」으로 채워져 **알림이 영영 안 간다.**
--   반대로 이 파일이 먼저면 옛 코드(지금 main)는 published_at을 안 채우므로 함수가 건드리지 않는다
--   (옛 코드는 자기 방식대로 1건마다 알림을 보낸다). 2026-10-10 실조회: 운영 발제 0건.
--
-- 실행 방법: Supabase SQL Editor. ①②, ③, ④를 **세 번에 나눠** 실행한다
--   (CREATE FUNCTION은 DDL과 따로 — 기존 교훈). ④가 실패하면(pg_cron을 SQL로 못 켜는 경우)
--   대시보드 Database → Extensions에서 pg_cron을 켠 뒤 ④의 schedule 줄만 다시 실행한다.
-- 롤백: migration-topics-notify-rollback.sql
-- ============================================================

-- ① 칸 추가
ALTER TABLE public.discussion_topics
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

-- ② 기존 발제 = 이미 알림
UPDATE public.discussion_topics
   SET notified_at = COALESCE(published_at, created_at)
 WHERE notified_at IS NULL;

-- 함수가 「아직 안 알린 공개 발제」만 빠르게 찾게
CREATE INDEX IF NOT EXISTS idx_discussion_topics_unnotified
  ON public.discussion_topics (meeting_id, published_at)
  WHERE notified_at IS NULL;


-- ③ 묶음 알림 함수 (여기부터 따로 실행)
CREATE OR REPLACE FUNCTION public.flush_topic_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  m record;
  v_title text;
  v_status text;
  v_more boolean;
  v_count integer;
  v_sent integer := 0;
BEGIN
  FOR m IN
    SELECT t.meeting_id
      FROM public.discussion_topics t
     WHERE t.published_at IS NOT NULL
       AND t.notified_at IS NULL
     GROUP BY t.meeting_id
    HAVING max(t.published_at) <= now() - interval '10 minutes'
  LOOP
    -- 이 모임에 이미 알린 발제가 있었나 (「더 올라왔어요」)
    SELECT EXISTS (
      SELECT 1 FROM public.discussion_topics
       WHERE meeting_id = m.meeting_id AND notified_at IS NOT NULL
    ) INTO v_more;

    -- 지금 남아 있는 미알림 공개 발제를 「알림」으로 표시하면서 센다.
    -- UPDATE의 행 잠금 덕에 두 실행이 겹쳐도 두 번째는 0행 → 중복 알림 없음
    WITH claimed AS (
      UPDATE public.discussion_topics
         SET notified_at = now()
       WHERE meeting_id = m.meeting_id
         AND published_at IS NOT NULL
         AND notified_at IS NULL
      RETURNING id
    )
    SELECT count(*) INTO v_count FROM claimed;

    IF v_count = 0 THEN
      CONTINUE;
    END IF;

    SELECT title, status INTO v_title, v_status
      FROM public.meetings WHERE id = m.meeting_id;
    -- 삭제 중·삭제된 모임은 표시만 하고 보내지 않는다
    IF v_status IS DISTINCT FROM 'active' THEN
      CONTINUE;
    END IF;

    INSERT INTO public.app_notifications (user_id, type, payload)
    SELECT r.user_id,
           'topic_posted',
           jsonb_build_object(
             'meeting_id', m.meeting_id,
             'meeting_title', v_title,
             'count', v_count,
             'more', v_more
           )
      FROM public.registrations r
     WHERE r.meeting_id = m.meeting_id
       AND r.status IN ('confirmed', 'pending_transfer')
     GROUP BY r.user_id;

    v_sent := v_sent + 1;
  END LOOP;

  RETURN v_sent;  -- 알림을 보낸 모임 수
END;
$$;

-- 회원·익명이 RPC로 부르지 못하게 (pg_cron은 postgres로 돈다)
REVOKE ALL ON FUNCTION public.flush_topic_notifications() FROM PUBLIC, anon, authenticated;


-- ④ 1분 예약 작업 (여기부터 따로 실행)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule(
  'topic-notify-flush',
  '* * * * *',
  $$SELECT public.flush_topic_notifications()$$
);

-- 확인
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'discussion_topics' AND column_name = 'notified_at';
--   SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'topic-notify-flush';
--   -- 최근 실행 기록 (돌았는지 / 실패했는지)
--   SELECT status, return_message, start_time FROM cron.job_run_details
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'topic-notify-flush')
--    ORDER BY start_time DESC LIMIT 5;
--   -- 실행 권한이 잠겼는지 (false·false여야 한다)
--   SELECT has_function_privilege('anon', 'public.flush_topic_notifications()', 'EXECUTE'),
--          has_function_privilege('authenticated', 'public.flush_topic_notifications()', 'EXECUTE');
