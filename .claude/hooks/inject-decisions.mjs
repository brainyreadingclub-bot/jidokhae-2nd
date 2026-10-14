/**
 * SessionStart 훅 — 결정 기록을 세션 시작 시 컨텍스트에 주입한다.
 *
 * 왜 필요한가
 *   결정은 원래도 기록되고 있었다(docs/expert-panel, 검토문서, memory).
 *   문제는 작업할 때 아무도 그걸 다시 안 읽는다는 것이었다. 2026-08-13에
 *   "호칭을 닉네임으로 통일" 결정이 패널 문서 안에 묻혀 있다가, 3주 뒤
 *   "결정이 필요한 일"로 할 일 목록에 되살아나는 사고가 실제로 났다.
 *
 *   그래서 찾아 읽으라고 규칙을 적어두는 대신, 세션이 시작될 때 눈앞에
 *   올려둔다. 사람이든 모델이든 "기억해서 찾아보기"는 신뢰할 수 없다.
 *
 * 출력
 *   stdout에 JSON 한 덩어리. additionalContext가 모델 컨텍스트로 들어간다.
 *   파일이 없거나 읽기에 실패하면 아무것도 출력하지 않고 조용히 끝낸다 —
 *   훅이 세션 시작을 막으면 안 된다.
 *
 * 어느 판을 읽나 (2026-10-13 대표님 결정)
 *   늘 문서 작업 공간(`feat/agent-team`)의 최신판. 못 읽을 때만 세션을 연 폴더의 파일.
 *   찾는 순서는 `decisions-source.mjs` 머리말. 그전에는 세션을 연 폴더의 파일만 읽어서
 *   `main` 기반 작업 폴더에서 연 세션이 8/21판(결정 30개 빠짐)으로 시작했다.
 */

import { readLatestDecisions } from './decisions-source.mjs'

const SOURCE_LABEL = {
  'doc-checkout': '문서 작업 공간 최신판(저장 전 수정 포함)',
  'doc-branch': '문서 작업 공간 최신판(저장된 판)',
  'doc-remote': '문서 작업 공간 최신판(온라인 저장소 판)',
  'local-file': '⚠️ 이 폴더의 파일 — 문서 작업 공간 판을 못 읽었다. 옛 판일 수 있다',
}

const HEADER = [
  '[결정 기록 — 구현/기획 착수 전 확인]',
  '',
  '아래는 이 프로젝트에서 **이미 내려진 결정**이다.',
  '- 여기 있는 사안을 "새로 정해야 할 일"로 다시 올리지 말 것',
  '- 상태가 🔨 미적용이면 **정해졌지만 코드에 없다**는 뜻이다. 결정이 필요한 게 아니라 구현이 필요한 것',
  '- 🚫 안 함은 검토 후 하지 않기로 한 것이다. 다시 제안하지 말 것',
  '- 새 결정이 나오면 그 세션 안에 `검토문서/DECISIONS.md`에 추가할 것',
  '',
].join('\n')

// 🔴 세션 시작 글은 1만 자를 넘으면 앞 2,000자 미리보기 + 파일 경로로만 들어간다
//    (https://code.claude.com/docs/en/hooks — SessionStart additionalContext).
//    결정 기록 전문은 5만 자가 넘어서 2026-10-13까지 사실상 머리말만 보였다.
//    그래서 전문 대신 「미적용 결정 + 최근 2주 결정」 요약을 넣고, 전문은 여는 방법만 알린다.
const LIMIT = 9500
const RECENT_DAYS = 14
const TEXT_MAX = 150
const STATUS_MAX = 40

function kstDateDaysAgo(days) {
  const d = new Date(Date.now() + 9 * 3600 * 1000 - days * 86400 * 1000)
  return d.toISOString().slice(0, 10)
}

function plain(md) {
  return md
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|`|~~/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cut(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

/** 결정 행 하나를 한 줄 요약으로. 굵은 글씨 첫 덩어리가 있으면 그것이 결정의 요지다 */
export function summarizeRow(line) {
  const cells = line.split('|').slice(1, -1)
  if (cells.length < 3) return null
  const dateCell = cells[0].trim()
  if (dateCell.startsWith('~~')) return null // 뒤집힌 결정
  const date = dateCell.match(/\d{4}-\d{2}-\d{2}/)?.[0]
  if (!date) return null
  const raw = cells[1]
  const bold = raw.match(/\*\*(.+?)\*\*/)
  const gist = plain(bold ? bold[1] : raw).replace(/^🔴\s*/, '')
  const status = plain(cells[2])
  return { date, unapplied: status.includes('🔨'), text: cut(gist, TEXT_MAX), status: cut(status, STATUS_MAX) }
}

export function buildDigest(body, where, sourceLabel, recentFrom) {
  const rows = body
    .split(/\r?\n/)
    .filter((l) => /^\|\s*(~~)?\d{4}-\d{2}-\d{2}/.test(l))
    .map(summarizeRow)
    .filter(Boolean)
  const unapplied = rows.filter((r) => r.unapplied)
  const recent = rows.filter((r) => !r.unapplied && r.date >= recentFrom)
  const fmt = (r) => `- ${r.date} [${r.status}] ${r.text}`
  const head = [
    HEADER,
    `(읽은 판: ${sourceLabel})`,
    `전문(살아 있는 결정 ${rows.length}건 + 뒤집힌 결정 + 쓰는 법·상태 뜻): ${where} — 결정에 걸리는 일을 시작하기 전에 해당 행을 전문에서 읽는다.`,
    '아래는 요약이다. 줄마다 결정의 요지만 잘라 담았다.',
    '',
  ].join('\n')
  const parts = (u, r) =>
    [
      `## 🔨 미적용 결정 ${unapplied.length}건 — 정해졌지만 아직 코드에 없다`,
      ...u.map(fmt),
      ...(u.length < unapplied.length ? [`- …외 ${unapplied.length - u.length}건은 전문에서`] : []),
      '',
      `## 최근 ${RECENT_DAYS}일(${recentFrom}~) 결정 ${recent.length}건 — 미적용 제외`,
      ...r.map(fmt),
      ...(r.length < recent.length ? [`- …외 ${recent.length - r.length}건은 전문에서`] : []),
    ].join('\n')
  // 한도를 넘으면 최근 결정의 오래된 쪽부터, 그다음 미적용의 오래된 쪽부터 덜어낸다(파일이 최신순이다)
  let u = unapplied.slice()
  let r = recent.slice()
  let text = head + parts(u, r)
  while (text.length > LIMIT && (r.length || u.length)) {
    if (r.length) r = r.slice(0, -1)
    else u = u.slice(0, -1)
    text = head + parts(u, r)
  }
  return text
}

try {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const found = readLatestDecisions(root)
  if (!found) throw new Error('no decisions')
  const context = buildDigest(found.body, found.where, SOURCE_LABEL[found.source], kstDateDaysAgo(RECENT_DAYS))

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: context,
      },
      suppressOutput: true,
    }),
  )
} catch {
  // 파일이 없거나 못 읽으면 조용히 넘어간다. 세션 시작을 막지 않는다.
}
