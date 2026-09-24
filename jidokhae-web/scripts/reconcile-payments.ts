/**
 * 결제사 ↔ DB 대사(reconciliation) — **읽기 전용**
 * 실행: npx tsx scripts/reconcile-payments.ts [from] [until]
 *   예: npx tsx scripts/reconcile-payments.ts 2026-07-01 2026-09-11
 *   기본값: 최근 90일
 *
 * 🔴 왜 필요한가 (2026-09-10 사고)
 * 회원이 12,000을 결제했는데 `registrations`에 **행이 아예 안 생긴** 사고가 났다.
 * 행이 없는 것이 증상이라 DB만 훑는 점검으로는 **구조적으로 안 보인다** —
 * 2026-09-09 운영점검이 "대기자 미환불 0"이라고 결론낸 것도 DB 행을 셌기 때문이다.
 * 그래서 반대편(PortOne)에서 출발해 우리 DB에 짝이 있는지 대조한다.
 *
 * 🔴 결제 실패 원장도 같이 본다 (2026-09-11 추가)
 * 같은 사고의 **두 번째 원인**은 "서버가 몇 달간 기록했는데 아무도 안 봤다"는 것이었다.
 * `payment_failures` 표를 만든 것만으로는 **저장 위치만 바뀐 같은 사고**가 된다.
 * 새 화면을 만들어도 그 화면을 누군가 열어야 하는데, 돈 점검 때 실제로 돌리는 물건은
 * 이 스크립트다. 그래서 **이미 여는 자리에** 붙였다 — 아래 6번 절.
 *
 * 🔴 안전 규칙 — 이 스크립트는 조회만 한다.
 * - Supabase는 `.select()`만, PortOne은 `getPayments`/`getPayment`만 부른다
 * - `cancelPayment`(환불) 등 부작용 API를 **여기에 추가하지 말 것.** 환불은 사람이 판단한다
 * - 개인정보(전화·이메일·실명)는 출력하지 않는다. 닉네임과 user_id 앞 8자까지만
 *   (`payment_failures`에는 애초에 개인정보를 넣지 않는다 — 마이그레이션 주석 참조)
 *
 * 🔴🔴 기지(旣知) 고아 — 이미 처리된 건이다. **또 환불하지 마라.**
 *
 *   paymentId : jdkh-20425c26-c22d8636-1788764839332
 *   금액·일시 : 12,000 · 2026-09-07 (9/9 경주 정기모임)
 *   회원       : 「에드워드 책」 (c22d8636)
 *
 * 2026-09-10에 **대표님이 계좌이체로 12,000을 회원께 직접 보내 환불을 끝냈다.**
 * 회원 기준 정산은 이미 ±0이다 (카드 −12,000 / 이체 +12,000).
 *
 * 🔴 **이 결제를 PortOne에서 취소하면 회원이 12,000을 두 번 받는다.**
 *
 * 그런데 이 도구는 PortOne과 우리 DB만 본다 — **계좌로 나간 돈은 볼 수 없다.**
 * 카드 결제는 PortOne에 `PAID`로 그대로 살아 있고 `registrations`에는 여전히
 * 행이 없으므로, 이 건은 **대사를 돌릴 때마다 영원히 「고아 결제」로 뜬다.**
 * 목록에서 지우지 않는 이유도 같다 — 안 보이면 다음 사람이 존재 자체를 모른다.
 * 위험한 순간은 문서를 읽을 때가 아니라 **이 도구를 돌릴 때**라, 경고를 여기 둔다.
 *
 * 경위: `docs/agent-team/logs/관리자.md` 2026-09-10 2부
 *       `docs/agent-team/조사/2026-09-10-에드워드책-대기환불-누락.md`
 *
 * 필요한 env (`.env.local`):
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   PORTONE_API_SECRET / NEXT_PUBLIC_PORTONE_STORE_ID
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PortOneClient } from '@portone/server-sdk'
import { config } from 'dotenv'
// 출력 정리는 순수 함수로 빼서 단위 테스트를 붙였다 (`src/lib/__tests__/payment-failure-report.test.ts`).
// tsconfig paths(`@/`)는 tsx가 기본으로 읽지 않으므로 상대 경로로 부른다.
import {
  describeCoverage,
  formatKstStamp,
  isMissingTableError,
  summarizeStages,
  truncateDetail,
  type PaymentFailureRow,
} from '../src/lib/payment-failure-report'
config({ path: '.env.local' })

type PoPayment = {
  id: string
  status: string
  orderName?: string
  paidAt?: string
  requestedAt?: string
  amount?: { total?: number; cancelled?: number }
}

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PORTONE_API_SECRET',
  'NEXT_PUBLIC_PORTONE_STORE_ID',
]

/**
 * 계좌이체로 이미 환불이 끝난 고아 결제 (상단 「기지 고아」 절 참조).
 * 이 도구는 계좌 이체를 볼 수 없어 매번 고아로 잡힌다 — **목록에서 지우지 않고
 * 표시만 붙인다.** 판단은 사람이 한다.
 */
const KNOWN_ORPHANS: Record<string, string> = {
  'jdkh-20425c26-c22d8636-1788764839332':
    '2026-09-10 대표님이 계좌이체로 환불 완료 (정산 ±0). 🔴 PortOne에서 취소하면 이중 환불',
}

/**
 * `payment_failures` 출력 상한.
 *
 * FETCH: 집계(stage 요약)에 쓸 최대 행 수. 이 표는 사고가 나면 재시도마다 행이 쌓여
 *        수천 건이 될 수 있다. 무한정 받지 않되, **잘랐으면 잘랐다고 말한다.**
 * PRINT: 눈으로 읽을 줄 수. 나머지는 stage 요약에만 반영된다.
 */
const FAILURE_FETCH_MAX = 2000
const FAILURE_PRINT_MAX = 50

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

/** paymentId `jdkh-{meetingId8}-{userId8}-{ts}` 에서 user 앞 8자 추출 */
function userPrefixOf(paymentId: string): string | null {
  const parts = paymentId.split('-')
  if (parts.length < 4 || parts[0] !== 'jdkh') return null
  return /^[0-9a-f]{8}$/.test(parts[2]) ? parts[2] : null
}

/**
 * 6) 결제 실패 원장 `payment_failures` — 서버가 남긴 실패를 사람이 보는 자리.
 *
 * 🔴 이 절의 실패는 **대사 전체를 죽이지 않는다.** 표가 아직 없는 환경
 * (마이그레이션 미실행)에서도 위 1~5번 결과는 그대로 나와야 한다. 부가 기능이
 * 본 기능을 막으면, 표 하나 때문에 돈 대사를 못 하게 된다.
 *
 * 구간은 **위 대사와 같은 `from`/`until`을 그대로** 쓴다. 경계도 PortOne 조회와
 * 똑같이 `T00:00:00Z`로 맞췄다 — 한쪽만 KST(+09:00)로 잡으면 두 창이 9시간
 * 어긋나서 "같은 구간을 봤다"는 말이 거짓이 된다. (표시는 KST로 바꿔 보여준다)
 */
async function reportPaymentFailures(
  sb: SupabaseClient,
  from: string,
  until: string,
): Promise<void> {
  console.log(`\n===== 결제 실패 기록 payment_failures — ${from} ~ ${until} =====`)

  const { data, error, count } = await sb
    .from('payment_failures')
    .select('created_at, source, stage, payment_id, detail', { count: 'exact' })
    .gte('created_at', `${from}T00:00:00Z`)
    .lt('created_at', `${until}T00:00:00Z`)
    .order('created_at', { ascending: false })
    .range(0, FAILURE_FETCH_MAX - 1)

  if (error) {
    if (isMissingTableError(error)) {
      console.log('  표 없음(마이그레이션 미실행) — supabase/migration-payment-failures.sql 을 실행해야 기록이 쌓인다')
      console.log('  ⚠️ 지금 이 환경에서는 결제 실패가 **어디에도 남지 않는다.** 위 대사 결과는 그대로 유효하다')
    } else {
      console.log(`  ⚠️ 조회 실패 — ${error.code ?? '코드없음'}: ${error.message}`)
      console.log('  ⚠️ 실패 기록을 못 봤다는 뜻이다. "없음"이 아니다. 위 대사 결과는 그대로 유효하다')
    }
    return
  }

  const rows = (data ?? []) as unknown as PaymentFailureRow[]
  const total = count ?? rows.length

  // 🔴 0건도 반드시 말한다. 아무 말이 없으면 "안 봤다"와 "없다"가 구분되지 않는다 —
  //    이번 사고의 구조가 정확히 그것이었다.
  if (total === 0) {
    console.log('  결제 실패 기록 0건 ✅ — 이 구간에 돈에 닿는 경로의 실패가 없었다')
    return
  }

  console.log(`  🔴 ${total}건`)

  console.log('\n  [stage별 건수]')
  for (const { stage, count: n } of summarizeStages(rows)) {
    console.log(`    ${stage.padEnd(22)} ${n}`)
  }

  const shown = rows.slice(0, FAILURE_PRINT_MAX)
  console.log('\n  [최근 순]')
  for (const r of shown) {
    console.log(
      `    ${formatKstStamp(r.created_at)} · ${r.source}/${r.stage}` +
        `\n      ${r.payment_id}` +
        `\n      ${truncateDetail(r.detail)}`,
    )
  }

  for (const note of describeCoverage(total, rows.length, shown.length)) {
    console.log(`\n  ${note}`)
  }

  console.log(
    '\n  ⚠️ id_lookup_failed 가 쌓여 있으면 웹훅의 ID 조회가 또 깨진 것이다 (2026-09-10 사고 지점)' +
      '\n  ⚠️ 여기 남은 payment_id가 위 「결제됐는데 신청 행이 없음」에도 보이면 **돈만 받고 신청이 안 만들어진 건**이다',
  )
}

async function main() {
  const missing = REQUIRED.filter((k) => !process.env[k])
  if (missing.length > 0) {
    console.error(`❌ env 누락: ${missing.join(', ')}`)
    process.exit(1)
  }

  const from = process.argv[2] ?? daysAgoISO(90)
  const until = process.argv[3] ?? daysAgoISO(-1)

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const po = PortOneClient({
    secret: process.env.PORTONE_API_SECRET!,
    storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
  })

  console.log(`\n결제사 ↔ DB 대사 · 구간 ${from} ~ ${until} (읽기 전용)\n`)

  // 1) PortOne 결제 전수 수집
  const payments: PoPayment[] = []
  for (let page = 0; page < 50; page++) {
    const res = await po.payment.getPayments({
      page: { number: page, size: 100 },
      filter: {
        from: `${from}T00:00:00Z`,
        until: `${until}T00:00:00Z`,
        timestampType: 'CREATED_AT',
      },
    })
    payments.push(...((res.items ?? []) as unknown as PoPayment[]))
    const total = res.page?.totalCount ?? 0
    if (payments.length >= total || (res.items?.length ?? 0) === 0) break
  }

  const live = payments.filter(
    (p) => p.status === 'PAID' || p.status === 'PARTIAL_CANCELLED',
  )
  console.log(
    `PortOne 결제 ${payments.length}건 (돈이 남아 있는 건 ${live.length} · ` +
      `취소완료 ${payments.filter((p) => p.status === 'CANCELLED').length} · ` +
      `미완료 ${payments.filter((p) => !['PAID', 'PARTIAL_CANCELLED', 'CANCELLED'].includes(p.status)).length})`,
  )

  // 2) DB registrations.payment_id 전수
  const regByPaymentId = new Map<
    string,
    { user_id: string; status: string; paid_amount: number | null; refunded_amount: number | null; payment_method: string | null }
  >()
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb
      .from('registrations')
      .select('payment_id, user_id, status, paid_amount, refunded_amount, payment_method')
      .not('payment_id', 'is', null)
      .range(offset, offset + 999)
    if (error) {
      console.error('❌ registrations 조회 실패:', error.message)
      process.exit(1)
    }
    if (!data || data.length === 0) break
    data.forEach((r) => regByPaymentId.set(r.payment_id as string, r))
    if (data.length < 1000) break
  }
  console.log(`DB payment_id ${regByPaymentId.size}건\n`)

  // 3) 🔴 고아 결제 — 돈은 받았는데 신청 행이 없다
  const orphans = live.filter((p) => !regByPaymentId.has(p.id))

  // 닉네임 붙이기 (paymentId prefix → profiles). uuid 컬럼이라 LIKE 불가 → 전체 받아 앞 8자 비교
  const { data: profiles } = await sb.from('profiles').select('id, nickname')
  const byPrefix = new Map<string, string>()
  ;(profiles ?? []).forEach((p) => {
    byPrefix.set((p.id as string).replace(/-/g, '').slice(0, 8), (p.nickname as string) ?? '')
  })

  console.log(`===== 🔴 결제됐는데 신청 행이 없음 — ${orphans.length}건 =====`)
  if (orphans.length === 0) {
    console.log('  없음 ✅')
  } else {
    for (const p of orphans) {
      const prefix = userPrefixOf(p.id)
      const nickname = prefix ? (byPrefix.get(prefix) ?? '(프로필 없음)') : '(형식 밖)'
      const known = KNOWN_ORPHANS[p.id]
      console.log(
        `  ${p.id}\n    ${p.status} · ${p.amount?.total ?? 0} · ${p.paidAt ?? p.requestedAt ?? ''}` +
          `\n    회원 ${prefix ?? '?'} (${nickname}) · ${p.orderName ?? ''}` +
          (known ? `\n    ✅ 처리 완료(계좌이체) — ${known}` : ''),
      )
    }
    console.log(
      '\n  ⚠️ 개발 초기 테스트 결제(orderName에 Test 포함)가 섞일 수 있다. 눈으로 가릴 것' +
        '\n  ⚠️ ✅ 표시가 붙은 건은 **계좌이체로 이미 환불이 끝났다.** PortOne에서 취소하면 이중 환불이다',
    )
  }

  // 4) 취소했는데 돈이 한 푼도 안 돌아간 카드 건.
  //    부분환불(50%)은 정상이라 제외한다 — 매번 잡음이 되면 아무도 안 읽는다.
  //    0%도 D-0/D-1 취소면 정기 규칙대로라 정상이다. 모임일과 대조해 가릴 것.
  const cancelledStatuses = ['cancelled', 'waitlist_cancelled', 'waitlist_refunded']
  const notReturned = live.filter((p) => {
    const r = regByPaymentId.get(p.id)
    if (r == null || r.payment_method !== 'card') return false
    return cancelledStatuses.includes(r.status) && (p.amount?.cancelled ?? 0) === 0
  })
  console.log(`\n===== 취소 상태인데 돈이 한 푼도 안 돌아감 (카드) — ${notReturned.length}건 =====`)
  if (notReturned.length === 0) {
    console.log('  없음 ✅')
  } else {
    for (const p of notReturned) {
      const r = regByPaymentId.get(p.id)!
      console.log(
        `  ${p.id} · DB ${r.status} · 결제 ${r.paid_amount} · DB환불 ${r.refunded_amount} · PortOne취소 ${p.amount?.cancelled ?? 0}`,
      )
    }
    console.log(
      '\n  ⚠️ D-0/D-1 취소는 정기 규칙상 0% 환불이라 정상이다. 모임일과 대조해 가릴 것',
    )
  }

  // 5) DB 환불액 ↔ PortOne 취소액 불일치 (카드)
  const mismatched = [...regByPaymentId.entries()].filter(([pid, r]) => {
    if (r.payment_method !== 'card') return false
    const p = payments.find((x) => x.id === pid)
    if (!p) return false
    return (p.amount?.cancelled ?? 0) !== (r.refunded_amount ?? 0)
  })
  console.log(`\n===== DB refunded_amount ≠ PortOne 취소액 (카드) — ${mismatched.length}건 =====`)
  if (mismatched.length === 0) {
    console.log('  없음 ✅')
  } else {
    for (const [pid, r] of mismatched) {
      const p = payments.find((x) => x.id === pid)!
      console.log(`  ${pid} · DB ${r.refunded_amount ?? 0} vs PortOne ${p.amount?.cancelled ?? 0} · ${r.status}`)
    }
  }

  // 6) 결제 실패 원장 — 표가 없어도 여기서 죽지 않는다 (함수 안에서 다 처리한다)
  await reportPaymentFailures(sb, from, until)

  console.log(
    '\n대사 끝. 🔴 이 스크립트는 아무것도 고치지 않는다 — 환불 실행은 사람이 판단한다.\n',
  )
}

main()
