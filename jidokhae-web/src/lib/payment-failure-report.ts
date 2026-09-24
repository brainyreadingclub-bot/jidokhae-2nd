/**
 * `payment_failures` 원장을 **사람이 읽는 형태로 바꾸는 순수 함수들.**
 *
 * 왜 따로 두나 (2026-09-11)
 * ------------------------------------------------
 * 표를 만든 것만으로는 2026-09-10 사고가 반복된다. 그 사고의 원인은
 * "서버가 몇 달간 기록했는데 **아무도 안 봤다**"는 것이었고, 기록처를 console에서
 * 우리 표로 옮기기만 하면 **저장 위치만 바뀐 같은 사고**가 된다.
 *
 * 그래서 이미 돌리고 있는 도구(`scripts/reconcile-payments.ts`)가 이 표도 같이
 * 출력하게 한다. 새 화면을 만들면 그 화면도 누가 열어야 한다 — 이미 여는 자리에
 * 붙이는 쪽이 확실하다.
 *
 * 출력 규칙(=이 파일이 지키는 것)
 * 1. **0건도 말한다.** 아무 말이 없으면 "안 봤다"와 "없다"가 구분되지 않는다
 * 2. **조용히 자르지 않는다.** 줄 수를 줄였으면 몇 건 중 몇 건인지 같이 말한다
 * 3. **개인정보 금지.** payment_id·UUID까지만. 전화·이메일·실명은 애초에 표에 없다
 *
 * 스크립트 본문이 아니라 여기 두는 이유는 단위 테스트 때문이다
 * (선례: `asks-pure.ts`, `profile-update.ts`).
 */

/** 표시에 필요한 최소 필드. `payment_failures` 행의 부분집합 */
export type PaymentFailureRow = {
  created_at: string
  source: string
  stage: string
  payment_id: string
  detail: string | null
}

/** `detail` 한 줄 상한. 웹훅 원문 에러가 길어 표가 읽히지 않는 것을 막는다 */
export const DETAIL_MAX = 160

/**
 * 표가 아직 없는 환경(마이그레이션 미실행)인지 판정한다.
 *
 * 🔴 이 판정이 필요한 이유 — 표가 없다고 대사 스크립트 전체가 죽으면,
 * 마이그레이션을 아직 안 돌린 환경에서는 **돈 대사 자체를 못 하게 된다.**
 * 부가 기능(실패 원장)이 본 기능(대사)을 막으면 안 된다.
 *
 * 두 코드를 모두 본다 — 경로에 따라 다른 값이 온다.
 * - `42P01` : Postgres `undefined_table`
 * - `PGRST205` : PostgREST 스키마 캐시에 테이블이 없음
 * 코드가 비어 오는 경우를 대비해 메시지도 함께 본다 (코드 쪽이 우선).
 */
export function isMissingTableError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false
  const code = error.code ?? ''
  if (code === '42P01' || code === 'PGRST205') return true
  const message = (error.message ?? '').toLowerCase()
  if (!message) return false
  return (
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('schema cache')
  )
}

/**
 * `stage`별 건수 요약. 많은 것부터, 같으면 이름순(출력이 실행마다 흔들리지 않게).
 *
 * 개별 줄보다 이 요약이 먼저 읽힌다 — 한 종류가 몰려 있으면 그 자체가 신호다
 * (예: `id_lookup_failed`가 쌓여 있으면 웹훅 조회가 또 깨진 것이다).
 */
export function summarizeStages(
  rows: readonly { stage: string }[],
): { stage: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    counts.set(row.stage, (counts.get(row.stage) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage))
}

/**
 * `detail` 줄임. **잘랐으면 잘랐다고 표시한다** — 조용히 자르면 원문이 더 있는지
 * 없는지 읽는 사람이 알 수 없다.
 */
export function truncateDetail(detail: string | null | undefined, max: number = DETAIL_MAX): string {
  if (!detail) return '-'
  const flat = detail.replace(/\s+/g, ' ').trim()
  if (flat.length === 0) return '-'
  if (flat.length <= max) return flat
  return `${flat.slice(0, max)}…(원문 ${flat.length}자 중 ${max}자만 표시)`
}

/**
 * `created_at`(UTC ISO)을 KST 문자열로. 운영자는 KST로만 생각한다.
 *
 * `src/lib/kst.ts`를 쓰지 않는 이유: 이 모듈은 `scripts/`에서 `tsx`로 직접 로드되는
 * 경로에 있어 앱 런타임 의존을 늘리지 않는다. 계산은 +9시간 한 줄이라 여기서 끝낸다.
 * 파싱 불가한 값이 오면 **버리지 않고 원문을 그대로 돌려준다** (기록을 잃지 않는다).
 */
export function formatKstStamp(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  return `${new Date(ms + 9 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ')} KST`
}

/**
 * 몇 건 중 몇 건을 보여주는지 한 줄로. **조용한 절단 금지**의 단일 진입점.
 *
 * @param total   구간 내 전체 건수 (DB가 센 값)
 * @param fetched 실제로 받아온 건수 (집계 대상)
 * @param shown   화면에 출력할 건수
 */
export function describeCoverage(total: number, fetched: number, shown: number): string[] {
  const notes: string[] = []
  if (fetched < total) {
    notes.push(`⚠️ 구간 내 ${total}건 중 최근 ${fetched}건만 받아왔다 — 아래 요약·목록은 그 ${fetched}건 기준이다`)
  }
  if (shown < fetched) {
    notes.push(`⚠️ ${fetched}건 중 최근 ${shown}건만 표시했다 (나머지는 위 stage 요약에만 반영)`)
  }
  return notes
}
