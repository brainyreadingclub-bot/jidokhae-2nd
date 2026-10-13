-- ============================================================
-- 발제문 「작성 중 → 공개」 — discussion_topics.published_at
-- ============================================================
--
-- 배경 (2026-10-09 대표님 승인)
--   지금은 발제를 1건 등록할 때마다 신청자에게 앱 알림이 1건씩 간다(5개면 5번).
--   그리고 등록하는 순간 회원에게 보인다 — 다듬을 틈이 없다.
--   바꾼 흐름: 붙여넣기 → 「작성 중」으로 저장 → 「공개하기」 한 번 → 알림 한 번.
--
-- 변경 내용
--   ① discussion_topics.published_at timestamptz null 추가 (null = 작성 중)
--   ② 이미 있던 발제는 공개된 것으로 채운다 (이미 회원에게 보였던 것이므로)
--   ③ RLS select를 「published_at is not null OR is_curator()」로 좁힌다
--      (기존: using (true) — migration-discussion-thread.sql ⑦)
--      회원 화면은 전부 service_role로 읽어 RLS를 안 타지만(코드에서 거른다),
--      anon 키로 직접 select하면 작성 중이 새어 나가지 않도록 DB에서도 막는다.
--
-- 🔴 적용 순서 — SQL 먼저, 코드 나중
--   새 코드는 published_at을 읽고 쓴다. 칸이 없는 DB에 새 코드가 먼저 올라가면
--     - 회원 쪽 조회(.not('published_at','is',null))가 에러 → 발제가 안 보인다
--     - 공개하기 API가 실패한다
--   반대로 칸만 먼저 생기면 옛 코드는 아무 영향이 없다 — 옛 코드는 published_at을
--   모르고, 회원 쪽은 service_role로 읽어 ③의 RLS도 타지 않는다.
--   → 이 파일을 먼저 실행하고, 그다음 코드를 배포한다 (forward-compatible).
--
-- ⚠️ SQL 실행 ~ 코드 배포 사이에 옛 화면으로 발제를 등록하면
--   그 발제는 published_at = null(작성 중)로 남아, 새 코드가 올라간 뒤 회원에게서 사라진다.
--   그 사이에는 발제를 등록하지 않는다. 등록했다면 배포 후 아래 「확인」의 첫 쿼리로 찾아
--   발제문 관리 화면에서 「공개하기」를 누른다(알림이 한 번 더 간다는 점만 감안).
--
-- 실행 방법: Supabase SQL Editor. ①②를 먼저, ③을 그다음에 나눠 실행해도 되고 한 번에 돌려도 된다.
-- 롤백: migration-topics-publish-rollback.sql
-- ============================================================

-- ① 칸 추가
ALTER TABLE public.discussion_topics
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- ② 기존 발제 = 공개됨 (이미 회원에게 보였던 것)
UPDATE public.discussion_topics
   SET published_at = created_at
 WHERE published_at IS NULL;

-- 운영자 첫 화면·모임 상세가 모임별 작성 중/공개 개수를 센다
CREATE INDEX IF NOT EXISTS idx_discussion_topics_meeting_published
  ON public.discussion_topics (meeting_id, published_at);

-- ③ RLS — 작성 중은 큐레이터만
DROP POLICY IF EXISTS "topics readable by authenticated" ON public.discussion_topics;
CREATE POLICY "topics readable by authenticated"
  ON public.discussion_topics FOR SELECT TO authenticated
  USING (published_at IS NOT NULL OR public.is_curator());

-- 확인
--   -- 작성 중인 발제 (배포 직후에는 0행이어야 한다)
--   SELECT id, meeting_id, topic_no, title, created_at
--     FROM public.discussion_topics WHERE published_at IS NULL;
--   -- 정책
--   SELECT policyname, qual FROM pg_policies
--    WHERE tablename = 'discussion_topics';
