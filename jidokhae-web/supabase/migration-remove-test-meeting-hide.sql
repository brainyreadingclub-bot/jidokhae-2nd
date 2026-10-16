-- ============================================================
-- 시험 모임 숨김 규칙 제거 (2026-10-17)
-- ============================================================
--
-- 무엇: 10/9 시험 토론모임 1건만 콕 집어 회원에게 숨기던 RESTRICTIVE 규칙
--   「hide test meeting from members」를 지운다. 이 규칙은 SQL Editor에서 손으로
--   만들어져 저장소에 원문이 없다 — 그래서 지우기 전에 원문을 뽑아 둔다(①).
--
-- 🔴 순서: 시험 모임·시험 발제를 먼저 지운 뒤에 이 파일을 실행한다.
--   거꾸로 하면 시험 모임이 회원 화면(홈·모임 탭)에 그대로 뜬다.
--   ②의 DO 블록이 이를 막는다 — 규칙이 가리키는 모임이 아직 살아 있으면
--   (행이 있고 status <> 'deleted') 아무것도 지우지 않고 에러로 멈춘다.
--
-- 코드 변경 없음 — 앱 코드는 이 규칙을 모른다(main에서 이름 검색 0건).
-- 롤백: migration-remove-test-meeting-hide-rollback.sql
-- ============================================================

-- ① 지우기 전에 원문을 뽑아 둔다 — 결과 한 줄을 복사해 보관한다(롤백에 그대로 쓴다)
SELECT format(
  'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s USING (%s)%s;',
  policyname, schemaname, tablename, permissive, cmd,
  array_to_string(roles, ', '), qual,
  CASE WHEN with_check IS NULL THEN '' ELSE format(' WITH CHECK (%s)', with_check) END
) AS rollback_sql
FROM pg_policies
WHERE policyname = 'hide test meeting from members';

-- ② 시험 모임이 남아 있으면 멈추고, 없으면 규칙을 지운다
DO $$
DECLARE
  p record;
  ids uuid[];
  alive int;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, qual FROM pg_policies
     WHERE policyname = 'hide test meeting from members'
  LOOP
    SELECT array_agg(m[1]::uuid) INTO ids
      FROM regexp_matches(coalesce(p.qual, ''),
        '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', 'g') AS m;

    IF ids IS NULL THEN
      RAISE EXCEPTION '규칙 안에서 모임 id를 찾지 못했다 — 원문(①)을 사람이 보고 판단할 것. 아무것도 지우지 않았다';
    END IF;

    SELECT count(*) INTO alive FROM public.meetings
     WHERE id = ANY(ids) AND status <> 'deleted';

    IF alive > 0 THEN
      RAISE EXCEPTION '시험 모임 %건이 아직 살아 있다(%) — 먼저 지운 뒤 다시 실행. 아무것도 지우지 않았다', alive, ids;
    END IF;

    EXECUTE format('DROP POLICY %I ON %I.%I', 'hide test meeting from members', p.schemaname, p.tablename);
    RAISE NOTICE '지움: %.% 의 hide test meeting from members', p.schemaname, p.tablename;
  END LOOP;
END $$;

-- ③ 확인 — 0행이어야 한다
SELECT schemaname, tablename, policyname
  FROM pg_policies
 WHERE policyname = 'hide test meeting from members';
