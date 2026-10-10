-- ============================================================
-- 발제자 링크 (2026-10-10, 2차) — 로그인 없이 발제를 「작성 중」으로 받는다
-- ============================================================
--
-- 배경 (대표님 확정)
--   토론모임마다 링크 하나. 받은 사람은 로그인 없이 발제를 쓰고, 쓴 글은 「작성 중」
--   (published_at = null)으로만 저장된다. 공개는 운영자만 한다 — 공개하면 published_at = now()가
--   되어 1차의 10분 묶음 알림(flush_topic_notifications)이 그대로 한 번 간다. 새 알림 경로는 없다.
--   닫히는 시각은 저장하지 않는다 — 앱이 매번 「모임 날짜 다음날 0시(KST)」로 계산하고,
--   모임이 삭제·취소되면 바로 닫는다(src/lib/presenter-link.ts isLinkOpen).
--
-- 변경 내용
--   ① topic_presenter_links 표 — 모임당 한 줄(meeting_id PK). token = 추측 불가 32자.
--      RLS ON + 정책 없음 → anon·로그인 회원 키로는 읽지도 쓰지도 못한다. 서버(service_role)만
--   ② discussion_topics에 두 칸
--      - source: 'admin'(운영자가 씀) | 'link'(링크로 받음) — 운영자 목록의 「링크로 받음」 표시·링크당 개수 상한
--      - presenter_device_hash: 링크로 쓴 기기의 표시(원문이 아니라 sha256). 「고치기는 그 기기에서 쓴 발제만」
--   ③ RLS select를 「published_at IS NOT NULL OR is_curator()」로 (다시) 좁힌다
--      — 작성 중 발제가 회원 키로 절대 안 읽히게. migration-topics-publish.sql ③과 같은 내용이고
--        이미 적용돼 있으면 같은 정책으로 다시 만들 뿐이다(멱등)
--
-- 🔴 적용 순서 — migration-topics-notify.sql(1차) 다음에, 2차 코드 배포 **전에**
--   2차 코드는 topic_presenter_links와 source·presenter_device_hash를 읽고 쓴다. 이 파일 전에
--   코드가 나가면 운영자 화면의 「발제자 링크」와 링크 쓰기 화면이 오류를 낸다
--   (운영자 발제 목록·회원 화면은 이 칸들 없이도 동작하게 짰다 — 확인 필요하면 보고서 참조).
--   반대로 이 파일만 먼저 돌아도 1차·옛 코드는 영향이 없다(새 칸은 기본값이 있고 새 표는 안 읽는다).
--
-- 실행 방법: Supabase SQL Editor. ①, ②, ③을 세 번에 나눠 실행한다(②의 DO 블록은 따로).
-- 롤백: migration-topics-presenter-link-rollback.sql
-- ============================================================

-- ① 발제자 링크 표
CREATE TABLE IF NOT EXISTS public.topic_presenter_links (
  meeting_id uuid PRIMARY KEY REFERENCES public.meetings(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  closed_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.topic_presenter_links ENABLE ROW LEVEL SECURITY;
-- 정책을 일부러 만들지 않는다 = anon·authenticated는 아무것도 못 한다


-- ② discussion_topics 두 칸 (여기부터 따로 실행)
ALTER TABLE public.discussion_topics
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS presenter_device_hash text;

DO $$
BEGIN
  ALTER TABLE public.discussion_topics
    ADD CONSTRAINT discussion_topics_source_check CHECK (source IN ('admin', 'link'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;


-- ③ 작성 중은 큐레이터만 (여기부터 따로 실행)
DROP POLICY IF EXISTS "topics readable by authenticated" ON public.discussion_topics;
CREATE POLICY "topics readable by authenticated"
  ON public.discussion_topics FOR SELECT TO authenticated
  USING (published_at IS NOT NULL OR public.is_curator());

-- 확인
--   -- 표가 있고 정책이 0개여야 한다
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'topic_presenter_links';   -- true
--   SELECT count(*) FROM pg_policies WHERE tablename = 'topic_presenter_links';     -- 0
--   -- 발제 읽기 정책이 좁혀졌는지
--   SELECT policyname, roles, qual FROM pg_policies WHERE tablename = 'discussion_topics';
--   -- 다른 select 정책이 남아 있으면 OR로 합쳐져 작성 중이 샌다 — 위 결과가 정확히 한 줄이어야 한다
--   -- 새 칸
--   SELECT column_name, column_default FROM information_schema.columns
--    WHERE table_name = 'discussion_topics' AND column_name IN ('source', 'presenter_device_hash');
