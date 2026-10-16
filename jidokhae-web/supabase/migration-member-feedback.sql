-- ============================================================
-- 🔴 실행 안 함 — 초안이다. 대표님이 확인하신 뒤 SQL Editor에서 실행한다.
-- ============================================================
--
-- 회원 의견 통로 member_feedback — Schema Migration (2026-10-16, 보관함 I-001)
--
-- 배경
--   「나」 탭과 오류 화면에 「불편한 점 알려 주기」를 둔다. 회원이 고른 분류 + 자유 글(500자)
--   + 어느 화면에서 왔는지(경로)를 남기고, 운영자는 /admin/feedback 에서 읽는다.
--
-- 왜 공통 기록표 app_events 에 넣지 않나 (2026-10-14 결정 「기능마다 표를 늘리지 않는다」의 예외)
--   1. app_events 는 「무엇을 눌렀나」를 세는 표다. props 문자열은 100자에서 잘리고,
--      이메일·전화처럼 생긴 값은 지운다 — 500자 자유 글은 담기지 않는다
--   2. app_events 는 1년 뒤 삭제 + 회원 번호를 뺀 건수 요약만 남긴다(2026-10-15). 의견 글은
--      건수가 아니라 내용이 남아야 한다
--   3. app_events 는 「운영자가 SQL Editor 에서 센다」가 전제다. 의견은 운영 화면에서 읽는다
--
-- 변경 내용
--   - public.member_feedback 테이블 신설 + 색인 1개 (최근 순)
--   - RLS ON + 정책 0개 + anon·authenticated 권한 회수 = 회원은 읽지도 쓰지도 못한다.
--     쓰기는 /api/feedback(로그인 확인 뒤 service_role), 읽기는 /admin/feedback(admin 전용, service_role)
--
-- 적용 순서 — 코드보다 먼저 실행하는 것이 좋다
--   표가 없어도 화면은 깨지지 않는다: 보내기는 「보내지 못했어요」로 끝나고, 운영 화면은
--   「표가 아직 없음」 안내만 띄운다. 다만 그 사이 회원이 쓴 글은 남지 않는다
--
-- 개인정보
--   화면에 「이름·연락처는 적지 말아 주세요」 한 줄을 둔다. 그래도 글에 들어올 수 있으므로
--   운영 화면은 admin 전용이다(역할 매트릭스 2026-04-23 — 회원 개인정보는 admin 만).
--   오류 화면에서 올 때는 경로만 붙인다. 오류 원문은 담지 않는다(2026-10-14 결정과 같은 결)
--
-- 보관 기간 — 정하지 않았다(대표님 결정 대기). 삭제 작업도 없다
--
-- 롤백: DROP TABLE IF EXISTS public.member_feedback;  (의견 글이 통째로 사라진다 — 지우기 전에 SELECT로 떠 둘 것)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.member_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 누가. 회원이 탈퇴(profiles 삭제)하면 그 회원의 글도 같이 지운다
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- 분류 — 코드 src/lib/member-feedback.ts 의 FEEDBACK_CATEGORIES 와 같아야 한다
  category TEXT NOT NULL
    CHECK (category IN ('apply', 'screen', 'notice', 'idea', 'etc')),

  -- 자유 글 — 1~500자 (코드도 같은 한도로 자른다)
  body TEXT NOT NULL
    CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),

  -- 어디서 들어왔나 — me(「나」 탭) / error(오류 화면)
  source TEXT NOT NULL
    CHECK (source IN ('me', 'error')),

  -- 어느 화면에서 왔나 — 경로만(쿼리 문자열 없음). 모르면 NULL
  page_path TEXT
    CHECK (page_path IS NULL OR (char_length(page_path) <= 200 AND page_path LIKE '/%')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 운영 화면 최근 순 목록
CREATE INDEX IF NOT EXISTS idx_member_feedback_created
  ON public.member_feedback (created_at DESC);

-- 하루 보내기 한도(코드가 셈) — 회원별 최근 글
CREATE INDEX IF NOT EXISTS idx_member_feedback_user_created
  ON public.member_feedback (user_id, created_at DESC);

COMMENT ON TABLE public.member_feedback IS
  '회원 의견 통로 (2026-10-16, I-001). 쓰기 /api/feedback, 읽기 /admin/feedback(admin). service_role 만.';

-- ============================================================
-- RLS — 정책 0개 = anon·authenticated 는 아무것도 못 한다 (service_role 은 RLS 를 우회)
-- ============================================================

ALTER TABLE public.member_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.member_feedback FROM anon, authenticated;

-- ============================================================
-- 확인 (실행 후)
-- ============================================================
-- select column_name, data_type, is_nullable from information_schema.columns
--  where table_schema = 'public' and table_name = 'member_feedback' order by ordinal_position;
--   기대: id, user_id, category, body, source, page_path, created_at (7행)
-- select policyname from pg_policies where tablename = 'member_feedback';   -- 기대: 0행
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name = 'member_feedback' and grantee in ('anon', 'authenticated');   -- 기대: 0행
