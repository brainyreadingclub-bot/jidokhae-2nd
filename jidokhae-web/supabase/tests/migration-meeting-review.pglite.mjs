// ============================================================
// migration-meeting-review.sql 가드 시험 — PGlite(로컬 WASM Postgres). **prod에 붙지 않는다.**
//
// 왜 있나 — 계획서 §4-5: 「운영자가 내린 소감에 공개 UPDATE → 23514」 같은 DB 가드는 단위 테스트가 못 잡고,
// Preview도 prod DB라 시험 행을 만들 수 없다. 같은 표 모양을 만들어 CHECK · 중복 차단 · 공개 소감 함수를 돌린다.
//
// 돌리는 법 (프로젝트 의존성에 pglite를 넣지 않았다 — ESM은 스크립트 위치 기준으로 모듈을 찾는다):
//   mkdir <빈 폴더> && cd <빈 폴더> && npm i @electric-sql/pglite
//   cp <저장소>/jidokhae-web/supabase/tests/migration-meeting-review.pglite.mjs ./test.mjs
//   node test.mjs <저장소>/jidokhae-web/supabase/migration-meeting-review.sql
// 기대: 마지막 줄 「47 pass / 0 fail」 (2026-10-16 개발운영 실행 결과)
// ============================================================
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const migration = fs.readFileSync(process.argv[2], 'utf8')
const db = new PGlite()
let pass = 0, fail = 0
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log('  PASS', name) } else { fail++; console.log('  FAIL', name, extra) }
}
async function q(sql, params) { return (await db.query(sql, params)).rows }
async function expectError(name, sql, re) {
  try { await db.exec(sql); ok(name, false, '(오류가 안 났다)') }
  catch (e) { ok(name, re.test(e.message), e.message) }
}
async function expectOk(name, sql) {
  try { await db.exec(sql); ok(name, true) } catch (e) { ok(name, false, e.message) }
}

// ── 바탕 스키마: 저장소 migration.sql · migration-book-ask.sql · migration-welcome-notification.sql 모양 ──
await db.exec(`
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.update_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, nickname text NOT NULL DEFAULT '', real_name text);
CREATE TABLE public.meetings (id uuid PRIMARY KEY, date date NOT NULL, region text,
  meeting_type text, status text NOT NULL DEFAULT 'active');
CREATE TABLE public.book_asks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, meeting_id uuid NOT NULL, status text NOT NULL, UNIQUE (user_id, meeting_id));
CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, recipient_id uuid NOT NULL, meeting_id uuid);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'meeting_remind','registration_confirm','waitlist_confirm','waitlist_promoted','waitlist_refunded',
  'book_ask','new_member_welcome'));
`)

const P = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const M = (n) => `11111111-0000-0000-0000-${String(n).padStart(12, '0')}`

console.log('── 마이그레이션 두 번 돌려도 된다 (prod에 1단계가 이미 있다)')
await expectOk('1회차 실행', migration)
await expectOk('2회차 실행 (멱등)', migration)
ok('meeting_reviews CHECK 10개', (await q(`select count(*)::int n from pg_constraint
  where conrelid = 'public.meeting_reviews'::regclass and contype = 'c'`))[0].n === 10)
ok('RLS 켜짐', (await q(`select relrowsecurity r from pg_class where oid = 'public.meeting_reviews'::regclass`))[0].r === true)
const pols = (await q(`select polname, pg_get_expr(polqual, polrelid) e from pg_policy
  where polrelid = 'public.meeting_reviews'::regclass order by polname`))
ok('정책 2개 (admin · own)', pols.map((p) => p.polname).join(',') === 'meeting_reviews_select_admin,meeting_reviews_select_own')
ok('🔴 editor 정책 없음', !pols.some((p) => /editor/.test(p.e)))
ok('칭찬 표는 이 파일이 만들지 않는다', (await q(`select to_regclass('public.meeting_praises') t`))[0].t === null)

// 사람·모임
await db.exec(`
INSERT INTO public.profiles (id, nickname) VALUES
  ('${P(1)}','초록고래'), ('${P(2)}','밤산책'), ('${P(3)}','여름귤'), ('${P(4)}',''), ('${P(5)}','오후세시'),
  ('${P(6)}','파란연필'), ('${P(7)}','고요한숲'), ('${P(8)}','문장수집가'), ('${P(9)}','새벽서재');
INSERT INTO public.meetings (id, date, region, meeting_type, status) VALUES
  ('${M(1)}', (now() at time zone 'Asia/Seoul')::date + 5,  '경주', 'regular', 'active'),   -- 대상(다음 모임)
  ('${M(2)}', (now() at time zone 'Asia/Seoul')::date - 2,  '경주', 'regular', 'active'),   -- 지난 모임
  ('${M(3)}', (now() at time zone 'Asia/Seoul')::date - 9,  '경주', 'regular', 'active'),
  ('${M(4)}', (now() at time zone 'Asia/Seoul')::date - 2,  '포항', 'regular', 'active'),   -- 다른 지역
  ('${M(5)}', (now() at time zone 'Asia/Seoul')::date - 3,  '경주', 'discussion', 'active'),-- 토론
  ('${M(6)}', (now() at time zone 'Asia/Seoul')::date - 4,  '경주', 'regular', 'deleted'),  -- 삭제
  ('${M(7)}', (now() at time zone 'Asia/Seoul')::date - 200,'경주', 'regular', 'active'),   -- 180일 밖
  ('${M(8)}', (now() at time zone 'Asia/Seoul')::date + 6,  '경주', 'discussion', 'active');
`)

console.log('── CHECK — 회원이 남기는 값')
const ins = (u, m, cols) => `INSERT INTO public.meeting_reviews (user_id, meeting_id, ${Object.keys(cols).join(',')})
  VALUES ('${P(u)}','${M(m)}', ${Object.values(cols).join(',')})`
await expectOk('표정만 남김', ins(1, 2, { mood: 5 }))
await expectError('같은 회원·모임 두 번 → UNIQUE', ins(1, 2, { mood: 3 }), /unique|duplicate/i)
await expectError('표정도 못 갔어요도 없음', ins(2, 3, { did_not_attend: 'false' }), /mood_xor_absent/)
await expectError('못 갔어요 + 표정', ins(2, 3, { did_not_attend: 'true', mood: 3 }), /mood_xor_absent/)
await expectError('표정 6', ins(2, 3, { mood: 6 }), /mood_range/)
await expectError('🔴 무난(3) + 아쉬운 점', ins(2, 3, { mood: 3, regret_codes: `'{space}'` }), /regret_low_mood_only/)
await expectError('🔴 못 갔어요(mood NULL) + 아쉬운 점 — NULL이 통과하지 않는다', ins(2, 3, { did_not_attend: 'true', regret_codes: `'{space}'` }), /regret_low_mood_only|absent_no_extras/)
await expectError('모르는 아쉬운 점 코드', ins(2, 3, { mood: 1, regret_codes: `'{hack}'` }), /regret_codes_valid/)
await expectError('기타 글인데 기타를 안 고름', ins(2, 3, { mood: 1, regret_codes: `'{space}'`, regret_other: `'덥다'` }), /regret_other_valid/)
await expectError('기타 글 51자', ins(2, 3, { mood: 1, regret_codes: `'{other}'`, regret_other: `'${'가'.repeat(51)}'` }), /regret_other_valid/)
await expectOk('낮은 표정 + 아쉬운 점 + 기타 글', ins(2, 3, { mood: 2, regret_codes: `'{short_time,other}'`, regret_other: `'덥다'` }))
await expectError('못 갔어요 + 소감', ins(3, 3, { did_not_attend: 'true', comment: `'좋았다'` }), /absent_no_extras/)
await expectError('소감 101자', ins(3, 3, { mood: 4, comment: `'${'가'.repeat(101)}'` }), /comment_len/)
await expectOk('소감 100자 (한글)', ins(3, 3, { mood: 4, comment: `'${'가'.repeat(100)}'` }))
await expectError('공개인데 소감 없음', ins(4, 3, { mood: 4, comment_public: 'true' }), /public_needs_comment/)

console.log('── 🔴 표정을 올릴 때 아쉬운 점을 같이 비워야 한다 (코드 normalizeMoodInput의 근거)')
await expectError('2→4 아쉬운 점 그대로 → 거절', `UPDATE public.meeting_reviews SET mood = 4 WHERE user_id = '${P(2)}' AND meeting_id = '${M(3)}'`, /regret_low_mood_only/)
await expectOk('2→4 아쉬운 점 비우고 → 됨', `UPDATE public.meeting_reviews SET mood = 4, regret_codes = '{}', regret_other = NULL WHERE user_id = '${P(2)}' AND meeting_id = '${M(3)}'`)

console.log('── 🔴 운영자 내림 — 회원이 다시 공개할 수 없다')
await expectOk('공개 소감', ins(5, 2, { mood: 4, comment: `'같은 문장을 읽고도 다들 다른 데서 멈췄다'`, comment_public: 'true', comment_published_at: 'now()' }))
await expectOk('운영자 내림 (한 UPDATE)', `UPDATE public.meeting_reviews SET comment_public = false, comment_hidden_at = now(), comment_hidden_by = '${P(9)}' WHERE user_id = '${P(5)}' AND meeting_id = '${M(2)}'`)
await expectError('내린 소감을 다시 공개 → 23514', `UPDATE public.meeting_reviews SET comment_public = true WHERE user_id = '${P(5)}' AND meeting_id = '${M(2)}'`, /hidden_not_public/)
await expectError('내린 사람만 있고 내린 시각 없음', `UPDATE public.meeting_reviews SET comment_hidden_at = NULL WHERE user_id = '${P(5)}' AND meeting_id = '${M(2)}'`, /hidden_by_needs_at/)
await expectOk('내림 풀기 (둘 다 비움) — 공개로는 안 돌아간다', `UPDATE public.meeting_reviews SET comment_hidden_at = NULL, comment_hidden_by = NULL WHERE user_id = '${P(5)}' AND meeting_id = '${M(2)}'`)
ok('풀어도 비공개 그대로', (await q(`select comment_public p from public.meeting_reviews where user_id = '${P(5)}' and meeting_id = '${M(2)}'`))[0].p === false)
// 다시 내려 둔다 (공개 소감 함수 시험용)
await db.exec(`UPDATE public.meeting_reviews SET comment_hidden_at = now(), comment_hidden_by = '${P(9)}' WHERE user_id = '${P(5)}' AND meeting_id = '${M(2)}'`)

console.log('── notifications · book_asks')
await expectOk('meeting_review 알림', `INSERT INTO public.notifications (type, recipient_id, meeting_id) VALUES ('meeting_review','${P(1)}','${M(2)}')`)
await expectError('같은 회원·모임 두 번째 → 23505', `INSERT INTO public.notifications (type, recipient_id, meeting_id) VALUES ('meeting_review','${P(1)}','${M(2)}')`, /unique|duplicate/i)
await expectOk('기존 book_ask 그대로', `INSERT INTO public.notifications (type, recipient_id, meeting_id) VALUES ('book_ask','${P(1)}','${M(2)}')`)
await expectOk('기존 new_member_welcome 그대로', `INSERT INTO public.notifications (type, recipient_id) VALUES ('new_member_welcome','${P(1)}')`)
await expectError('모르는 종류', `INSERT INTO public.notifications (type, recipient_id) VALUES ('praise_received','${P(1)}')`, /notifications_type_check/)
await expectOk('answered_surface review', `INSERT INTO public.book_asks (user_id, meeting_id, status, answered_surface) VALUES ('${P(1)}','${M(2)}','answered','review')`)
await expectOk('answered_surface NULL', `INSERT INTO public.book_asks (user_id, meeting_id, status) VALUES ('${P(2)}','${M(2)}','viewed')`)
await expectError('answered_surface 모르는 값', `INSERT INTO public.book_asks (user_id, meeting_id, status, answered_surface) VALUES ('${P(3)}','${M(2)}','answered','x')`, /answered_surface_check/)

console.log('── 공개 소감 함수')
await db.exec(`
INSERT INTO public.meeting_reviews (user_id, meeting_id, mood, comment, comment_public, comment_published_at) VALUES
  ('${P(6)}','${M(2)}', 4, '처음 왔는데 편했어요', true, now() - interval '1 hour'),         -- ✅
  ('${P(7)}','${M(3)}', 5, '두 시간이 금방 갔어요', true, now()),                              -- ✅ (더 이전 모임)
  ('${P(8)}','${M(2)}', 3, '운영자만 보는 소감', false, null),                                 -- ✗ 비공개
  ('${P(4)}','${M(3)}', 4, '닉네임 빈 사람', true, now()),                                     -- ✗ 닉네임 없음
  ('${P(1)}','${M(4)}', 4, '포항 소감', true, now()),                                          -- ✗ 다른 지역
  ('${P(1)}','${M(5)}', 4, '토론 소감', true, now()),                                          -- ✗ 토론
  ('${P(1)}','${M(6)}', 4, '삭제 모임 소감', true, now()),                                     -- ✗ 삭제
  ('${P(1)}','${M(7)}', 4, '오래된 소감', true, now());                                        -- ✗ 180일 밖
INSERT INTO public.meeting_reviews (user_id, meeting_id, mood, comment, comment_public, comment_unpublished_at) VALUES
  ('${P(9)}','${M(2)}', 4, '회원이 내린 소감', false, now());                                  -- ✗ 회원이 내림
`)
const rows = await q(`select * from public.get_region_public_comments('${M(1)}', 20)`)
ok('공개 소감 2개만 (내림·비공개·다른 지역·토론·삭제·180일 밖·닉네임 없음 제외)', rows.length === 2, JSON.stringify(rows))
ok('최근 모임 먼저', rows[0]?.comment === '처음 왔는데 편했어요' && rows[1]?.comment === '두 시간이 금방 갔어요', JSON.stringify(rows))
ok('돌려주는 칸은 닉네임·소감·모임일 셋', Object.keys(rows[0] ?? {}).sort().join(',') === 'comment,meeting_date,nickname')
ok('limit 1', (await q(`select * from public.get_region_public_comments('${M(1)}', 1)`)).length === 1)
ok('limit 0 → 최소 1', (await q(`select * from public.get_region_public_comments('${M(1)}', 0)`)).length === 1)
ok('대상이 토론모임이면 0행', (await q(`select * from public.get_region_public_comments('${M(8)}', 20)`)).length === 0)
ok('없는 모임이면 0행 (에러 아님)', (await q(`select * from public.get_region_public_comments('${M(99)}', 20)`)).length === 0)
ok('anon 실행 가능', (await q(`select has_function_privilege('anon', 'public.get_region_public_comments(uuid, integer)', 'execute') x`))[0].x === true)
ok('authenticated 실행 가능', (await q(`select has_function_privilege('authenticated', 'public.get_region_public_comments(uuid, integer)', 'execute') x`))[0].x === true)

console.log(`\n${pass} pass / ${fail} fail`)
process.exit(fail === 0 ? 0 : 1)
