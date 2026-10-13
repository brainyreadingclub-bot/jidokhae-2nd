-- ============================================================
-- 발제 「공개하기 버튼」으로 바꾸기 (2026-10-12 대표님) — 10분 자동 알림 끄기 + 옛 화면 발제 살리기 + 작성 중 감추기
-- ============================================================
--
-- 바뀐 방식
--   등록하면 「작성 중」(published_at = null, 회원에게 안 보임) → 「발제 공개하기」 한 번 →
--   작성 중 전부 공개 + 신청자 알림 한 번(앱이 보낸다 — api/admin/topics/publish).
--   그래서 1분마다 돌던 10분 묶음 예약 작업(migration-topics-notify.sql ③④)은 필요 없다.
--
-- 🔴 세 덩어리를 **때를 나눠** 실행한다. 한 번에 돌리지 않는다.
--
--   | 덩어리 | 언제                     | 무엇                                         |
--   |--------|--------------------------|----------------------------------------------|
--   | A      | 지금 (아무 때나)          | 10분 예약 작업 끄기 + 함수 지우기              |
--   | C      | 지금 (아무 때나)          | 작성 중 발제를 회원 키로 못 읽게 (RLS)         |
--   | B      | 새 코드 배포가 끝난 직후   | 옛 화면으로 등록한 발제를 「공개됨」으로 채우기 |
--
-- 왜 이 순서인가 (2026-10-12 23시 KST 운영 DB 읽기 + 코드 확인)
--   - 지금 운영 중인 main 코드는 published_at을 **모른다** — 저장할 때 비워 두고, 등록 즉시 회원에게
--     보이며 1건마다 알림을 보낸다. 예약 작업은 published_at이 채워진 발제만 보므로 main 발제는
--     건드리지 않는다 → A를 지금 끄면 **아무것도 달라지지 않는다**.
--   - 새 코드는 회원 화면에서 published_at이 비어 있는 발제를 **숨긴다**. 그래서 새 코드가 올라가기
--     전에 main으로 등록한 발제는 배포 순간 회원에게서 사라진다 → B가 그걸 「공개됨」으로 되돌린다.
--     B는 배포가 **끝난 뒤** 돌려야 그 사이 등록분까지 잡는다(먼저 돌리면 그 뒤 등록분이 남는다).
--   - C(RLS)는 앱 동작을 바꾸지 않는다 — 앱은 main·새 코드 모두 discussion_topics를
--     **service_role로만** 읽는다(RLS를 안 탄다). 2026-10-12 `git grep discussion_topics`로
--     origin/main·feat/topics-publish 전부 확인: 읽는 자리 전부 createServiceClient, 브라우저·anon 클라이언트 0곳.
--     C는 「누가 anon 키로 REST를 직접 두드려도 작성 중이 안 새게」 막는 것뿐이라 언제 돌려도 된다.
--
-- ⚠️ 머지 전까지 지킬 것 하나
--   미리보기(feat/topics-publish)는 운영 DB에 그대로 붙는다. 미리보기에서 **진짜 모임**에 발제를
--   등록하면 그 발제는 「작성 중」으로 남고, B가 배포 전 등록분으로 보고 「공개됨」으로 바꿔 버린다.
--   미리보기에서는 시험 모임(7d3c3c6a-78ba-4303-b75c-95ab437a4593)에만 쓴다. B-1 확인 결과를 눈으로 보고 돌린다.
--
-- 🔴 시험 발제 29540d12-cc45-4b45-b550-f1d0d5766bd1 은 건드리지 않는다(대표님 지시).
--   이미 공개·알림 상태라(2026-10-12 읽기: published_at·notified_at 둘 다 채워짐) B의 조건에 안 걸리지만,
--   만일을 위해 B에서 id로도 뺀다.
--
-- 실행: Supabase SQL Editor. 덩어리마다 따로.
-- 롤백: migration-topics-publish-button-rollback.sql
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- A. 10분 예약 작업 끄기  (지금)
-- ────────────────────────────────────────────────────────────

-- A-1 끄기 전 확인 — 한 줄(topic-notify-flush, active = true)이 보여야 한다
SELECT jobid, jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'topic-notify-flush';

-- A-2 끄기 (작업이 없으면 오류가 난다 — 그때는 이미 꺼진 것이니 A-3으로)
SELECT cron.unschedule('topic-notify-flush');

-- A-3 함수 지우기 (예약 작업이 먼저 꺼져 있어야 1분마다 실패하는 일이 없다)
DROP FUNCTION IF EXISTS public.flush_topic_notifications();

-- A-4 확인 — 둘 다 0이어야 한다
SELECT
  (SELECT count(*) FROM cron.job WHERE jobname = 'topic-notify-flush') AS cron_jobs,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'flush_topic_notifications') AS functions;

-- 남겨 두는 것: notified_at 칸과 idx_discussion_topics_unnotified 인덱스.
--   새 코드의 「발제 공개하기」가 notified_at을 함께 채운다(언제 알렸는지 기록). 지우지 않는다.
-- pg_cron 확장도 끄지 않는다 — 다른 예약 작업이 생겼을 수 있다.


-- ────────────────────────────────────────────────────────────
-- C. 작성 중 발제는 큐레이터만 읽기 (RLS)  (지금 — A와 같이 돌려도 된다)
-- ────────────────────────────────────────────────────────────
-- 지금 운영 정책: qual = true (로그인 회원이면 전부 읽힘). 이것을 좁힌다.
-- migration-topics-publish.sql ③, migration-topics-presenter-link.sql ③과 같은 내용 — 여러 번 돌려도 같다.

DROP POLICY IF EXISTS "topics readable by authenticated" ON public.discussion_topics;
CREATE POLICY "topics readable by authenticated"
  ON public.discussion_topics FOR SELECT TO authenticated
  USING (published_at IS NOT NULL OR public.is_curator());

-- C 확인 — discussion_topics의 SELECT 정책이 **정확히 한 줄**이고 qual이 위 조건이어야 한다
--   (다른 SELECT 정책이 남아 있으면 OR로 합쳐져 작성 중이 샌다)
SELECT policyname, cmd, roles, qual
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'discussion_topics';


-- ────────────────────────────────────────────────────────────
-- B. 옛 화면으로 등록한 발제 살리기  (새 코드 배포가 「Ready」가 된 직후)
-- ────────────────────────────────────────────────────────────
-- 아래 두 군데의 '배포완료시각을-여기에' 를 운영 배포가 끝난 한국시간으로 바꾼다.
--   예: '2026-10-14 21:05:00+09'
--   그대로 실행하면 시각 형식 오류로 멈춘다 — 일부러 그렇게 뒀다(잘못된 시각으로 도는 것을 막는다).
-- 배포 완료 시각은 Vercel Deployments의 Production 배포 「Ready」 시각이다.

-- B-1 먼저 확인 — 나온 줄이 「배포 전에 옛 화면으로 등록해 회원에게 이미 보였던 발제」인지 눈으로 본다.
--   0행이면 B-2는 건너뛴다.
SELECT t.id,
       m.title                                AS meeting_title,
       m.status                               AS meeting_status,
       t.topic_no,
       t.title,
       t.created_at AT TIME ZONE 'Asia/Seoul' AS created_kst,
       t.notified_at
  FROM public.discussion_topics t
  JOIN public.meetings m ON m.id = t.meeting_id
 WHERE t.published_at IS NULL
   AND t.created_at < '배포완료시각을-여기에'::timestamptz
   AND t.id <> '29540d12-cc45-4b45-b550-f1d0d5766bd1'
 ORDER BY t.created_at;

-- B-2 채우기 — 옛 화면은 등록 즉시 공개·알림했으므로 공개 시각 = 등록 시각, 알림도 그때 간 것으로.
--   조건에 published_at IS NULL을 건다 — 그새 「발제 공개하기」로 공개된 것은 0행으로 빠진다.
UPDATE public.discussion_topics
   SET published_at = created_at,
       notified_at  = COALESCE(notified_at, created_at)
 WHERE published_at IS NULL
   AND created_at < '배포완료시각을-여기에'::timestamptz
   AND id <> '29540d12-cc45-4b45-b550-f1d0d5766bd1'
RETURNING id, meeting_id, topic_no, title;

-- B-3 확인 — 남은 작성 중은 전부 배포 뒤에 새 화면으로 쓴 것이어야 한다
--   SELECT id, meeting_id, topic_no, title, created_at AT TIME ZONE 'Asia/Seoul' AS created_kst
--     FROM public.discussion_topics WHERE published_at IS NULL ORDER BY created_at;
