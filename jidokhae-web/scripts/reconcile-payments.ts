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
 * 🔴 안전 규칙 — 이 스크립트는 조회만 한다.
 * - Supabase는 `.select()`만, PortOne은 `getPayments`/`getPayment`만 부른다
 * - `cancelPayment`(환불) 등 부작용 API를 **여기에 추가하지 말 것.** 환불은 사람이 판단한다
 * - 개인정보(전화·이메일·실명)는 출력하지 않는다. 닉네임과 user_id 앞 8자까지만
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

import { createClient } from '@supabase/supabase-js'
import { PortOneClient } from '@portone/server-sdk'
import { config } from 'dotenv'
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

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

/** paymentId `jdkh-{meetingId8}-{userId8}-{ts}` 에서 user 앞 8자 추출 */
function userPrefixOf(paymentId: string): string | null {
  const parts = paymentId.split('-')
  if (parts.length < 4 || parts[0] !== 'jdkh') return null
  return /^[0-9a-f]{8}$/.test(parts[2]) ? parts[2] : null
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

  console.log(
    '\n대사 끝. 🔴 이 스크립트는 아무것도 고치지 않는다 — 환불 실행은 사람이 판단한다.\n',
  )
}

main()
