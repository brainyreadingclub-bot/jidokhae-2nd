-- ============================================================
-- 토론모임 개편 · 0조각 — meeting_type 선행 스키마
-- ============================================================
-- 변경 요약:
--   meetings 테이블에 meeting_type 컬럼 추가 (정기/토론 구분)
--
-- 배경:
--   물어보기(정기모임 전용)·투표적중할인(토론모임 전용)이 동작하려면
--   모임 유형이 데이터에 있어야 함. 현재 meetings엔 유형 컬럼이 없어
--   운영자가 title로만 구분해 옴.
--
-- 안전성:
--   - 회원 화면 영향 0 (데이터만 심음, 소비 로직은 이후 조각)
--   - forward-compatible: DEFAULT 'regular'라 기존 INSERT/코드 무영향
--   - 기존 행은 전부 'regular'. 과거 소급 불필요
--     (물어보기는 앞으로의 정기모임 참여자만 대상)
--   - 다가오는 토론모임은 운영자가 폼에서 유형 지정
--
-- ⚠️ 이 마이그레이션은 스텝 할인 게이팅을 건드리지 않음.
--    (스텝 할인=정기모임만 규칙을 코드로 강제하는 건 회원 결제금액
--     변경이라 별도 회원 배포에서 다룸)
--
-- 실행 환경: Supabase SQL Editor (prod: ycqqzzvyixvtdorjxkrn)
-- 멱등성: IF NOT EXISTS + DROP/ADD CONSTRAINT 패턴 → 재실행 안전
-- ============================================================

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS meeting_type TEXT NOT NULL DEFAULT 'regular';

-- CHECK 제약 (재실행 안전하게 DROP 후 ADD)
ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_meeting_type_check;
ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_meeting_type_check
  CHECK (meeting_type IN ('regular', 'discussion'));

-- 확인용 쿼리 (실행 후 주석 해제해서 검증)
-- SELECT meeting_type, count(*) FROM public.meetings GROUP BY meeting_type;
