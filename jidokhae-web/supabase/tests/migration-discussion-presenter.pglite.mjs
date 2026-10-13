// ============================================================
// migration-discussion-presenter.sql 가드 시험 — PGlite(로컬 WASM Postgres). **prod에 붙지 않는다.**
//
// 왜 있나 — 설계서 §6-1: RPC 가드(원래 상태 WHERE · CHECK · 권한)는 단위 테스트가 못 잡고,
// Preview도 prod DB라 시험 행을 만들 수 없다. Docker(supabase start)가 없는 자리에서도
// 같은 표 모양(옛 IN(NULL,…) CHECK · Supabase 기본 함수 권한 포함)을 만들어 돌린다.
//
// 돌리는 법 (프로젝트 의존성에 pglite를 넣지 않았다 — ESM은 스크립트 위치 기준으로 모듈을 찾는다):
//   mkdir <빈 폴더> && cd <빈 폴더> && npm i @electric-sql/pglite
//   cp <저장소>/jidokhae-web/supabase/tests/migration-discussion-presenter.pglite.mjs ./test.mjs
//   node test.mjs <저장소>/jidokhae-web/supabase/migration-discussion-presenter.sql
// 기대: 마지막 줄 「51 pass / 0 fail」 (2026-10-13 개발운영 실행 결과)
// ============================================================
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const sqlPath = process.argv[2]
const migration = fs.readFileSync(sqlPath, 'utf8')
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

// ── 바탕 스키마: 저장소 migration.sql + bank-transfer + staff-discount 의 registrations 모양 ──
await db.exec(`
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
-- Supabase 기본 권한 흉내: public에 새 함수를 만들면 anon·authenticated·service_role이 실행 권한을 받는다
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, nickname text, is_free boolean DEFAULT false);
CREATE TABLE public.meetings (id uuid PRIMARY KEY, capacity int NOT NULL, status text NOT NULL DEFAULT 'active',
  meeting_type text, date date NOT NULL, fee int NOT NULL DEFAULT 25000);
CREATE TABLE public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id),
  status text NOT NULL DEFAULT 'confirmed',
  cancel_type text, payment_id text, paid_amount integer, refunded_amount integer,
  attended boolean, created_at timestamptz NOT NULL DEFAULT now(), cancelled_at timestamptz,
  payment_method text NOT NULL DEFAULT 'card',
  is_staff_discount boolean NOT NULL DEFAULT false,
  settlement_excluded boolean NOT NULL DEFAULT false
);
ALTER TABLE public.registrations ADD CONSTRAINT registrations_payment_method_check CHECK (payment_method IN ('card','transfer'));
ALTER TABLE public.registrations ADD CONSTRAINT registrations_status_check
  CHECK (status IN ('confirmed','cancelled','waitlisted','waitlist_cancelled','waitlist_refunded','pending_transfer'));
ALTER TABLE public.registrations ADD CONSTRAINT registrations_cancel_type_check
  CHECK (cancel_type IN (NULL, 'user_cancelled', 'meeting_deleted', 'waitlist_user_cancelled', 'waitlist_auto_refunded'));
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
`)

// 옛 제약이 아무 값도 못 막는다는 설계서 §8-3 확인 (마이그레이션 전)
const P = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const M = (n) => `11111111-0000-0000-0000-${String(n).padStart(12, '0')}`
for (let i = 1; i <= 20; i++) await db.query(`insert into profiles values ($1, $2)`, [P(i), 'u' + i])
const future = '2099-12-01'
await db.exec(`insert into meetings (id, capacity, meeting_type, date) values
  ('${M(1)}', 3, 'discussion', '${future}'),
  ('${M(2)}', 3, 'discussion', '${future}'),
  ('${M(3)}', 3, 'discussion', '${future}'),
  ('${M(4)}', 2, 'discussion', '${future}'),
  ('${M(5)}', 3, 'regular', '${future}'),
  ('${M(6)}', 3, 'discussion', '2000-01-01'),
  ('${M(7)}', 2, 'discussion', '${future}')`)

console.log('[마이그레이션 전]')
await db.exec(`insert into registrations (user_id, meeting_id, status, cancel_type) values ('${P(20)}', '${M(5)}', 'cancelled', 'bogus_before')`)
ok('옛 cancel_type CHECK는 bogus를 못 막는다 (IN(NULL,…) 결함 재현)', true)
await db.exec(`delete from registrations`)
// 기존 정상 행 — 새 CHECK를 통과해야 한다
await db.exec(`insert into registrations (user_id, meeting_id, status, payment_method, paid_amount, cancel_type, refunded_amount) values
  ('${P(19)}', '${M(5)}', 'cancelled', 'transfer', 10000, 'user_cancelled', null),
  ('${P(18)}', '${M(5)}', 'confirmed', 'card', 0, null, 12000)`)

console.log('[마이그레이션 실행 — 파일 통째로]')
const res = await db.exec(migration)
ok('파일 전체가 오류 없이 돈다', Array.isArray(res))
const rb = await q(`select count(*)::int n from pg_proc where proname in ('assign_presenter','unassign_presenter')`)
ok('되돌리기 덩어리는 실행되지 않았다 (함수 2개 남아 있음)', rb[0].n === 2)
const col = await q(`select count(*)::int n from information_schema.columns where table_name='registrations' and column_name='is_presenter'`)
ok('is_presenter 칸 생김', col[0].n === 1)

const A = (m, u, exp, card, dep) =>
  q(`select * from assign_presenter($1, $2, $3, $4, $5)`, [m, u, exp, card, dep])
const U = (m, r) => q(`select unassign_presenter($1, $2) as r`, [m, r])
const live = (m, u) => q(`select * from registrations where meeting_id=$1 and user_id=$2 order by created_at`, [m, u])

console.log('[지정 — 신청 없음]')
let r = await A(M(1), P(1), null, false, null)
ok('신청 없는 회원 지정 → success', r[0].result === 'success', JSON.stringify(r))
let rows = await live(M(1), P(1))
ok('발제자 행 = confirmed · none · 0 · payment_id null · is_presenter', rows.length === 1 && rows[0].status === 'confirmed' && rows[0].payment_method === 'none' && rows[0].paid_amount === 0 && rows[0].payment_id === null && rows[0].is_presenter === true)
r = await A(M(1), P(1), null, false, null)
ok('같은 회원 다시 → already_presenter', r[0].result === 'already_presenter')
r = await A(M(1), P(2), null, false, null)
ok('다른 회원 → presenter_exists', r[0].result === 'presenter_exists')

console.log('[돈 가드 CHECK]')
const pid = rows[0].id
await expectError('발제자 행 paid_amount=1 → 거절', `update registrations set paid_amount=1 where id='${pid}'`, /presenter_no_money/)
await expectError('발제자 행 paid_amount=NULL → 거절 (IS NOT DISTINCT FROM)', `update registrations set paid_amount=null where id='${pid}'`, /presenter_no_money/)
await expectError('발제자 행 payment_id 붙이기 → 거절', `update registrations set payment_id='jdkh-x' where id='${pid}'`, /presenter_no_money/)
await expectError('발제자 행 refunded_amount=5000 → 거절', `update registrations set refunded_amount=5000 where id='${pid}'`, /presenter_no_money/)
await expectError('발제자 행 스텝 할인 → 거절', `update registrations set is_staff_discount=true where id='${pid}'`, /presenter_no_money/)
await expectError("'none'을 일반 행에 → 거절", `insert into registrations (user_id, meeting_id, payment_method, paid_amount) values ('${P(3)}', '${M(5)}', 'none', 0)`, /none_only_presenter/)
await expectError('같은 모임 발제자 둘 → 유니크 위반', `insert into registrations (user_id, meeting_id, status, payment_method, paid_amount, is_presenter) values ('${P(3)}', '${M(1)}', 'confirmed', 'none', 0, true)`, /idx_registrations_one_presenter|duplicate key/)
await expectError('cancel_type 엉뚱한 값 → 이제 거절', `update registrations set cancel_type='bogus' where user_id='${P(19)}'`, /cancel_type_check/)

console.log('[빼기]')
r = await U(M(1), pid)
ok('빼기 → success', r[0].r === 'success')
rows = await live(M(1), P(1))
ok('빠진 행 = cancelled · presenter_removed · refunded 0 (NULL 아님)', rows[0].status === 'cancelled' && rows[0].cancel_type === 'presenter_removed' && rows[0].refunded_amount === 0)
r = await U(M(1), pid)
ok('두 번 빼기 → not_presenter', r[0].r === 'not_presenter')
r = await A(M(1), P(2), null, false, null)
ok('빼고 나면 다른 회원 지정 가능 (인덱스에서 빠짐)', r[0].result === 'success')

console.log('[카드 유료 confirmed]')
await db.exec(`insert into registrations (user_id, meeting_id, status, payment_method, paid_amount, payment_id) values ('${P(4)}', '${M(2)}', 'confirmed', 'card', 25000, 'jdkh-card-4')`)
let cand = (await live(M(2), P(4)))[0]
r = await A(M(2), P(4), cand.id, false, null)
ok('환불 표시 없이 → refund_required (아무것도 안 함)', r[0].result === 'refund_required')
ok('  → 옛 행 그대로 confirmed', (await live(M(2), P(4)))[0].status === 'confirmed')
r = await A(M(2), P(4), null, true, null)
ok('expected id 다르면 → state_changed', r[0].result === 'state_changed')
r = await A(M(2), P(4), cand.id, true, null)
ok('환불 끝남 표시 → success', r[0].result === 'success')
rows = await live(M(2), P(4))
ok('옛 카드 행 = cancelled · presenter_swap · refunded 25000', rows[0].status === 'cancelled' && rows[0].cancel_type === 'presenter_swap' && rows[0].refunded_amount === 25000)
ok('새 발제자 행 따로 생김', rows.length === 2 && rows[1].is_presenter === true)

console.log('[계좌이체 유료 confirmed]')
await U(M(2), rows[1].id)
await db.exec(`insert into registrations (user_id, meeting_id, status, payment_method, paid_amount) values ('${P(5)}', '${M(2)}', 'confirmed', 'transfer', 25000)`)
cand = (await live(M(2), P(5)))[0]
r = await A(M(2), P(5), cand.id, false, null)
ok('계좌이체 → success (PortOne 불필요)', r[0].result === 'success')
rows = await live(M(2), P(5))
ok('🔴 옛 계좌 행 refunded_amount = NULL (환불 대기)', rows[0].status === 'cancelled' && rows[0].refunded_amount === null && rows[0].cancel_type === 'presenter_swap')

console.log('[입금 대기 pending_transfer]')
await U(M(2), rows[1].id)
await db.exec(`insert into registrations (user_id, meeting_id, status, payment_method, paid_amount) values ('${P(6)}', '${M(2)}', 'pending_transfer', 'transfer', 25000), ('${P(7)}', '${M(3)}', 'pending_transfer', 'transfer', 25000)`)
cand = (await live(M(2), P(6)))[0]
r = await A(M(2), P(6), cand.id, false, null)
ok('답 없이 → deposit_answer_required', r[0].result === 'deposit_answer_required')
r = await A(M(2), P(6), cand.id, false, true)
ok('「들어왔다」 → success', r[0].result === 'success')
ok('🔴 「들어왔다」 = refunded NULL', (await live(M(2), P(6)))[0].refunded_amount === null)
const cand7 = (await live(M(3), P(7)))[0]
r = await A(M(3), P(7), cand7.id, false, false)
ok('「안 들어왔다」 → success', r[0].result === 'success')
ok('🔴 「안 들어왔다」 = refunded 0', (await live(M(3), P(7)))[0].refunded_amount === 0)

console.log('[정원]')
// M(4): 정원 2, 둘 다 찬 상태
await db.exec(`insert into registrations (user_id, meeting_id, status, payment_method, paid_amount, payment_id) values
  ('${P(8)}', '${M(4)}', 'confirmed', 'card', 25000, 'jdkh-8'), ('${P(9)}', '${M(4)}', 'confirmed', 'transfer', 25000, null),
  ('${P(10)}', '${M(4)}', 'waitlisted', 'card', 25000, 'jdkh-10')`)
r = await A(M(4), P(11), null, false, null)
ok('정원 참 + 새 회원 → capacity_full', r[0].result === 'capacity_full')
const cand9 = (await live(M(4), P(9)))[0]
r = await A(M(4), P(9), cand9.id, false, null)
ok('정원 참 + 이미 자리 가진 회원 → success (제 자리 옮김)', r[0].result === 'success')
const seated = await q(`select count(*)::int n from registrations where meeting_id=$1 and status in ('confirmed','pending_transfer')`, [M(4)])
ok('  → 자리 수 그대로 2', seated[0].n === 2)
const cand10 = (await live(M(4), P(10)))[0]
r = await A(M(4), P(10), cand10.id, true, null)
ok('발제자 있는 모임에 또 지정 → presenter_exists (대기 행 안 건드림)', r[0].result === 'presenter_exists' && (await live(M(4), P(10)))[0].status === 'waitlisted', r[0].result)

// 발제자 없는 모임에서 대기 카드 환불 뒤 정원 참
await db.exec(`insert into registrations (user_id, meeting_id, status, payment_method, paid_amount, payment_id) values
  ('${P(12)}', '${M(7)}', 'confirmed', 'card', 25000, 'jdkh-12'), ('${P(13)}', '${M(7)}', 'confirmed', 'card', 25000, 'jdkh-13'),
  ('${P(14)}', '${M(7)}', 'waitlisted', 'card', 25000, 'jdkh-14')`)
const cand14 = (await live(M(7), P(14)))[0]
r = await A(M(7), P(14), cand14.id, false, null)
ok('대기 카드 + 환불 표시 없음 → refund_required', r[0].result === 'refund_required')
r = await A(M(7), P(14), cand14.id, true, null)
ok('🔴 대기 카드 환불 뒤 정원 참 → capacity_full_refunded', r[0].result === 'capacity_full_refunded', r[0].result)
const w = (await live(M(7), P(14)))[0]
ok('🔴  → 대기 행이 닫혔다 (돈 없이 승격 안 되게): waitlist_cancelled · refunded 25000', w.status === 'waitlist_cancelled' && w.refunded_amount === 25000)

console.log('[장부 이상 · 모임 상태]')
await db.exec(`insert into registrations (user_id, meeting_id, status, payment_method, paid_amount, refunded_amount, payment_id) values ('${P(15)}', '${M(3)}', 'confirmed', 'card', 0, 12000, 'jdkh-15')`)
const cand15 = (await live(M(3), P(15)))[0]
await U(M(3), (await q(`select id from registrations where meeting_id=$1 and is_presenter and status='confirmed'`, [M(3)]))[0].id)
r = await A(M(3), P(15), cand15.id, true, null)
ok('살아 있는 행에 환불액 있음 → ledger_irregular', r[0].result === 'ledger_irregular')
r = await A(M(5), P(16), null, false, null)
ok('정기모임 → not_discussion', r[0].result === 'not_discussion')
r = await A(M(6), P(16), null, false, null)
ok('지난 모임 → meeting_passed', r[0].result === 'meeting_passed')
r = await A('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', null, false, null)
ok('준비 확인 호출(없는 모임) → not_found, 쓰기 없음', r[0].result === 'not_found')

console.log('[권한]')
for (const role of ['anon', 'authenticated']) {
  await db.exec(`SET ROLE ${role}`)
  try { await A(M(3), P(16), null, false, null); ok(`${role} 호출 → 거절`, false, '(호출됐다)') }
  catch (e) { ok(`${role} 호출 → 거절`, /permission denied/.test(e.message), e.message) }
  try { await U(M(3), P(16)); ok(`${role} unassign → 거절`, false) }
  catch (e) { ok(`${role} unassign → 거절`, /permission denied/.test(e.message), e.message) }
  await db.exec(`RESET ROLE`)
}
await db.exec(`SET ROLE service_role`)
r = await A(M(3), P(16), null, false, null)
ok('service_role 호출 → 된다', r[0].result === 'success', JSON.stringify(r))
await db.exec(`RESET ROLE`)

console.log('[되돌리기 덩어리 — 주석을 풀어 따로 시험]')
const rbBody = migration.split('/*\nBEGIN;')[1].split('*/')[0]
await db.exec(`delete from registrations where is_presenter or cancel_type like 'presenter_%'`)
await db.exec('BEGIN;' + rbBody)
const after = await q(`select count(*)::int n from information_schema.columns where table_name='registrations' and column_name='is_presenter'`)
ok('되돌리기 → is_presenter 칸 사라짐', after[0].n === 0)
await expectError('되돌린 뒤 none 거절', `insert into registrations (user_id, meeting_id, payment_method, paid_amount) values ('${P(17)}', '${M(5)}', 'none', 0)`, /payment_method_check/)

console.log(`\n${pass} pass / ${fail} fail`)
process.exit(fail ? 1 : 0)
