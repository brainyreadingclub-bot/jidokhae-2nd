// ============================================================
// migration-free-transfer-confirmed.sql 가드 시험 — PGlite(로컬 WASM Postgres). **prod에 붙지 않는다.**
// 바탕 = 저장소 현행 정의(migration-waitlist-card-only.sql) → 그 위에 새 파일을 돌린다.
//
// 돌리는 법 (migration-discussion-presenter.pglite.mjs 머리말과 같다):
//   mkdir <빈 폴더> && cd <빈 폴더> && npm i @electric-sql/pglite
//   cp <저장소>/jidokhae-web/supabase/tests/migration-free-transfer-confirmed.pglite.mjs ./test.mjs
//   node test.mjs <저장소>/jidokhae-web/supabase/migration-waitlist-card-only.sql \
//                 <저장소>/jidokhae-web/supabase/migration-free-transfer-confirmed.sql
// 기대: 마지막 줄 「… pass / 0 fail」
// ============================================================
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const [basePath, newPath] = process.argv.slice(2)
const db = new PGlite()
let pass = 0, fail = 0
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log('  PASS', name) } else { fail++; console.log('  FAIL', name, extra) }
}
const q = async (sql, params) => (await db.query(sql, params)).rows

await db.exec(`
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, role text NOT NULL DEFAULT 'member', is_staff boolean DEFAULT false, is_free boolean DEFAULT false);
CREATE TABLE public.meetings (id uuid PRIMARY KEY, capacity int NOT NULL, status text NOT NULL DEFAULT 'active',
  meeting_type text NOT NULL DEFAULT 'regular', date date NOT NULL DEFAULT '2099-12-01', fee int NOT NULL);
CREATE TABLE public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id), meeting_id uuid NOT NULL REFERENCES public.meetings(id),
  status text NOT NULL, payment_method text NOT NULL DEFAULT 'card', payment_id text,
  paid_amount integer, refunded_amount integer, created_at timestamptz NOT NULL DEFAULT now(),
  is_staff_discount boolean NOT NULL DEFAULT false);
CREATE FUNCTION public.staff_discount_max_per_meeting() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 2 $$;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
`)
await db.exec(fs.readFileSync(basePath, 'utf8'))
// prod 잠금(migration-lock-definer-rpcs.sql) 흉내
await db.exec(`REVOKE EXECUTE ON FUNCTION public.register_transfer(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_transfer(uuid, uuid, integer) TO service_role;`)

const P = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const M = (n) => `11111111-0000-0000-0000-${String(n).padStart(12, '0')}`
for (let i = 1; i <= 12; i++) await db.query(`insert into profiles (id, role) values ($1, $2)`, [P(i), i === 9 ? 'admin' : 'member'])
await db.exec(`insert into meetings (id, capacity, fee, meeting_type) values
  ('${M(1)}', 3, 0, 'regular'),       -- 0원 정기 (대구)
  ('${M(2)}', 3, 10000, 'regular'),   -- 유료 정기
  ('${M(3)}', 1, 0, 'regular'),       -- 0원, 정원 1
  ('${M(4)}', 3, 0, 'regular')`)
const R = (u, m, amt) => q(`select public.register_transfer($1, $2, $3) as r`, [u, m, amt]).then((x) => x[0].r)
const row = (u, m) => q(`select status, payment_method, paid_amount from registrations where user_id=$1 and meeting_id=$2`, [u, m]).then((x) => x[0])

console.log('[바탕 — 지금 prod 동작 재현]')
ok('옛 정의: 0원 모임 여석 → pending_transfer (고칠 결함)', (await R(P(1), M(4), 0)) === 'pending_transfer')

console.log('[새 정의 실행]')
await db.exec(fs.readFileSync(newPath, 'utf8'))
ok('파일 전체가 오류 없이 돈다', true)

console.log('[0원]')
ok('0원 모임 · 0원 · 여석 → confirmed', (await R(P(1), M(1), 0)) === 'confirmed')
let r = await row(P(1), M(1))
ok('  → 행 = confirmed · transfer · 0', r.status === 'confirmed' && r.payment_method === 'transfer' && r.paid_amount === 0)
ok('같은 회원 다시 → already_registered', (await R(P(1), M(1), 0)) === 'already_registered')
ok('0원 모임 · 정원 참 → 0원 대기는 그대로 waitlisted', (await R(P(2), M(3), 0)) === 'confirmed' && (await R(P(3), M(3), 0)) === 'waitlisted')

console.log('[유료 — 그대로]')
ok('유료 정가 → pending_transfer', (await R(P(4), M(2), 10000)) === 'pending_transfer')
ok('스텝 50% → pending_transfer', (await R(P(9), M(2), 5000)) === 'pending_transfer')
// 🔴 유료 모임에 0을 넘긴 호출 — 금액만 보면 확정돼 버린다. 참가비도 같이 본다
const zeroOnPaid = await R(P(5), M(2), 0)
ok('🔴 유료 모임에 0원 호출(일반 회원) → confirmed 아님 (할인 자격 없음으로 거절)', zeroOnPaid === 'discount_not_eligible', zeroOnPaid)
await db.exec(`insert into meetings (id, capacity, fee, meeting_type) values ('${M(5)}', 3, 10000, 'regular')`)
const zeroOnPaidStaff = await R(P(9), M(5), 0)
ok('🔴 유료 모임에 0원 호출(스텝 자격자) → confirmed 아님', zeroOnPaidStaff !== 'confirmed', zeroOnPaidStaff)
ok('유료 정원 참 + 계좌 대기 → waitlist_card_only (그대로)', await (async () => {
  await db.exec(`insert into meetings (id, capacity, fee) values ('${M(6)}', 1, 10000)`)
  await R(P(6), M(6), 10000)
  return (await R(P(7), M(6), 10000)) === 'waitlist_card_only'
})())

console.log('[권한 — 잠금 유지]')
for (const role of ['anon', 'authenticated']) {
  await db.exec(`SET ROLE ${role}`)
  try { await R(P(10), M(1), 0); ok(`${role} 호출 → 거절`, false) }
  catch (e) { ok(`${role} 호출 → 거절`, /permission denied/.test(e.message), e.message) }
  await db.exec('RESET ROLE')
}

console.log(`\n${pass} pass / ${fail} fail`)
process.exit(fail ? 1 : 0)
