/**
 * Stop 훅 — 오늘 main에 합친 것이 있는데 결정 기록이 그 뒤로 안 바뀌었으면 **한 번만** 붙잡는다.
 *
 * 왜 필요한가 (2026-10-13 대표님 지시)
 *   합치고 배포한 날 결정 기록의 상태(🔨 → ✅)를 안 고치고 세션을 닫는 일이 반복됐다.
 *   `🔨 미적용`이 배포 뒤에도 남으면 다음 세션이 「아직 안 만든 일」로 읽고 다시 만든다.
 *
 * 동작 — https://code.claude.com/docs/en/hooks 「Stop」
 *   - `stop_hook_active`가 true면(이미 이 훅 때문에 이어 가는 중) **절대 다시 막지 않는다**
 *   - 서브에이전트(`agent_id`가 있는 입력)는 건드리지 않는다
 *   - 같은 세션 · 같은 「마지막 합치기」에는 한 번만 막는다 — 표시 파일을 남긴다
 *   - 막을 때는 `{"decision":"block","reason":…}` — reason이 Claude에게 이어 갈 이유로 간다
 *   - 무엇이든 실패하면 조용히 통과(exit 0). 이 훅이 세션을 가두면 안 된다
 *
 * 「오늘」 = 한국시간 자정부터. 「합친 것」 = origin/main의 첫 부모 줄에 있는 병합 커밋.
 * 「결정 기록이 바뀐 시각」 = decisions-source.mjs의 decisionsLastChanged
 *   (문서 작업 공간 가지·온라인 판에 저장된 시각, 본 폴더의 저장 전 수정 시각 중 가장 늦은 것)
 */

import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { decisionsLastChanged, git } from './decisions-source.mjs'

const FETCH_EVERY_SEC = 10 * 60

function readStdin() {
  return new Promise((done) => {
    let s = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (d) => (s += d))
    process.stdin.on('end', () => done(s))
    process.stdin.on('error', () => done(''))
  })
}

function kstMidnightEpoch(nowMs = Date.now()) {
  const KST = 9 * 3600 * 1000
  const d = new Date(nowMs + KST)
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - KST) / 1000)
}

function hhmmKST(epochSec) {
  const d = new Date(epochSec * 1000 + 9 * 3600 * 1000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

async function main() {
  let input = {}
  try {
    input = JSON.parse((await readStdin()) || '{}')
  } catch {}
  if (input.stop_hook_active === true) return // 루프 금지
  if (input.agent_id) return // 서브에이전트
  if (!input.session_id) return // 「세션당 한 번」을 지킬 수 없으면 막지 않는다

  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
  const common = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
  if (!common) return
  const stateDir = join(resolve(common.trim()), 'claude-wrapup')
  mkdirSync(stateDir, { recursive: true })

  // origin/main을 가끔만 새로 받는다 — 매 응답마다 네트워크를 타지 않게
  const fetchMark = join(stateDir, 'last-fetch')
  const now = Math.floor(Date.now() / 1000)
  let lastFetch = 0
  try {
    lastFetch = Math.floor(statSync(fetchMark).mtimeMs / 1000)
  } catch {}
  if (now - lastFetch > FETCH_EVERY_SEC) {
    git(root, ['fetch', '-q', 'origin', 'main'])
    writeFileSync(fetchMark, String(now))
  }

  const since = kstMidnightEpoch()
  const log = git(root, ['log', 'origin/main', '--first-parent', '--merges', `--since=@${since}`, '--format=%ct\t%s'])
  if (!log || !log.trim()) return
  const merges = log.trim().split('\n').map((l) => {
    const [t, ...rest] = l.split('\t')
    return { t: Number(t), subject: rest.join('\t') }
  })
  const lastMerge = Math.max(...merges.map((m) => m.t))

  // 시험용: WRAPUP_TEST_DECISIONS_AT(초)로 「결정 기록이 바뀐 시각」을 덮어쓸 수 있다
  const changed = process.env.WRAPUP_TEST_DECISIONS_AT ? Number(process.env.WRAPUP_TEST_DECISIONS_AT) : decisionsLastChanged(root)
  if (changed !== null && changed >= lastMerge) return

  const sessionKey = String(input.session_id).replace(/[^A-Za-z0-9_-]/g, '')
  const mark = join(stateDir, `nagged-${sessionKey}-${lastMerge}`)
  if (existsSync(mark)) return // 이 세션에서 이 합치기로는 이미 한 번 알렸다
  writeFileSync(mark, String(now))

  const latest = merges.find((m) => m.t === lastMerge)
  const reason = [
    `오늘 main에 합친 것이 ${merges.length}건 있다(마지막 ${hhmmKST(lastMerge)} — ${latest.subject}).`,
    '그런데 결정 기록(검토문서/DECISIONS.md, 문서 작업 공간 feat/agent-team)이 그 뒤로 바뀌지 않았다.',
    '이 세션이 합친 것이면: 관련 행의 상태(🔨 → ✅/🌑, DB 작업 대기면 🔨 유지 + 「SQL 실행 대기」)와 빠진 결정을 갱신하고 저장하라 — 「마무리」 스킬 ②단계.',
    '이 세션과 무관한 합치기면: 대표님께 「오늘 합친 것의 결정 기록 갱신이 아직이다」 한 줄만 알리고 끝내라.',
    '이 알림은 이 세션에서 한 번만 나온다.',
  ].join('\n')
  process.stdout.write(JSON.stringify({ decision: 'block', reason }))
}

main().catch(() => {})
