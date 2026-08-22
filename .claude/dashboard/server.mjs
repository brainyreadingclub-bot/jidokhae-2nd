/**
 * 지독해 관제 — 부서가 일하는 것과 남은 일을 한 화면에서 본다.
 *
 * 왜 만드나
 *   조사에서 확인된 것 — 우리가 원하는 것(부서 이름이 붙은 동시성 타임라인 +
 *   레인 위의 도구 호출 + 사후 재생 + Windows)을 다 하는 도구는 없다. 성숙한 것들은
 *   훅 기반이라 라이브 전용이거나, 병렬을 안 그리거나, POSIX 전제다.
 *
 *   그런데 재료는 이미 로컬에 다 있다.
 *     ~/.claude/projects/<프로젝트>/<세션>/subagents/agent-<id>.meta.json
 *       → name(우리 부서 이름!), agentType, description, spawnDepth, parentAgentId
 *     같은 폴더의 agent-<id>.jsonl → 타임스탬프 + 도구 호출
 *
 *   훅도, 계측도, 재시작도 필요 없다. 이미 쌓인 것까지 그대로 읽힌다.
 *
 * 무엇을 보여주나 — 화면이 답하는 질문 넷
 *   1. 지금 어느 부서가 돌고 있나        (레인 차트, 겹치면 병렬)
 *   2. 끝난 것의 판정이 뭔가              (부서 로그의 관리자 판정)
 *   3. 앞으로 뭐가 남았나                 (DECISIONS 상태 칸 + 켜는 날 게이트)
 *   4. 무엇이 낡았나                      ← 범용 관측 도구가 모르는 우리만의 축
 *
 *   4번이 이 화면의 존재 이유다. 오늘 하루 사고가 전부 "상태가 낡아서" 났다 —
 *   상태 칸 24행, 호칭 14일, 접근 금지 표시가 3시간 24분 낡음.
 *
 * 쓰는 법
 *   node .claude/dashboard/server.mjs      → http://localhost:4319
 *
 * 의존성 0. Node 내장 모듈만 쓴다.
 */

import { createServer } from 'node:http'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const PORT = Number(process.env.PORT || 4319)

/** 세션 전사가 쌓이는 곳. 프로젝트 경로가 폴더 이름으로 인코딩돼 있다 */
const PROJECTS_DIR = join(homedir(), '.claude', 'projects', 'C--jidokhae-2nd')

/** 부서 — 훅의 DEPARTMENTS와 같은 목록 (이름이 갈리면 안 된다) */
const DEPARTMENTS = {
  librarian: '문서총괄',
  product: '제품기획',
  design: '디자인',
  engineering: '개발운영',
  quality: '품질',
  data: '데이터',
  growth: '성장',
  'member-voice': '고객VOC',
}

// ─────────────────────────────────────────────────────────────
// 1. 부서 실행 기록 — subagents/*.meta.json + agent-*.jsonl
// ─────────────────────────────────────────────────────────────

/** name이 부서 이름의 변형이면 정규화한다 (engineering2 · design2 · librarian-first …) */
function normalizeDept(name, description) {
  if (!name) name = ''
  const base = String(name).toLowerCase().replace(/[-_]?\d+$/, '').replace(/-(first|new|2nd)$/, '')
  if (DEPARTMENTS[base]) return base
  for (const key of Object.keys(DEPARTMENTS)) if (base.startsWith(key)) return key
  // 이름이 없으면 설명을 본다. 단 **맨 앞에 부서명이 오는 경우만** —
  // `데이터`·`성장`·`품질`은 흔한 낱말이라 아무 데나 포함으로 찾으면 오탐이 난다.
  // 실제로 조사 에이전트 2건이 "데이터 부서"로 잘못 잡혔다.
  const desc = String(description || '').trim()
  for (const [key, ko] of Object.entries(DEPARTMENTS)) {
    if (new RegExp(`^${ko}\\s*[—\\-:·]`).test(desc)) return key
  }
  return null
}

function readAgentRuns() {
  const runs = []
  if (!existsSync(PROJECTS_DIR)) return runs

  for (const sessionDir of readdirSync(PROJECTS_DIR, { withFileTypes: true })) {
    if (!sessionDir.isDirectory()) continue
    const subDir = join(PROJECTS_DIR, sessionDir.name, 'subagents')
    if (!existsSync(subDir)) continue

    for (const file of readdirSync(subDir)) {
      if (!file.endsWith('.meta.json')) continue
      const id = file.replace('.meta.json', '')
      let meta
      try {
        meta = JSON.parse(readFileSync(join(subDir, file), 'utf8'))
      } catch {
        continue
      }

      const jsonl = join(subDir, `${id}.jsonl`)
      const stat = existsSync(jsonl) ? statSync(jsonl) : null
      const trace = stat ? readTrace(jsonl) : { start: null, end: null, tools: [], lines: 0 }

      runs.push({
        id,
        session: sessionDir.name,
        name: meta.name || null,
        dept: normalizeDept(meta.name, meta.description),
        agentType: meta.agentType || null,
        description: meta.description || '',
        depth: meta.spawnDepth ?? 1,
        parent: meta.parentAgentId || null,
        start: trace.start,
        end: trace.end,
        durationMs: trace.start && trace.end ? new Date(trace.end) - new Date(trace.start) : null,
        tools: trace.tools,
        toolCount: trace.tools.length,
        lines: trace.lines,
        mtime: stat ? stat.mtimeMs : null,
      })
    }
  }
  return runs.filter((r) => r.start).sort((a, b) => new Date(a.start) - new Date(b.start))
}

/** 에이전트 전사에서 시작·끝·도구 호출을 뽑는다. 스트리밍 중 깨진 줄은 건너뛴다 */
function readTrace(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return { start: null, end: null, tools: [], lines: 0 }
  }
  const lines = text.split('\n').filter(Boolean)
  let start = null
  let end = null
  const tools = []
  for (const line of lines) {
    let row
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }
    if (row.timestamp) {
      if (!start) start = row.timestamp
      end = row.timestamp
    }
    const content = row.message?.content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'tool_use') tools.push({ name: block.name, at: row.timestamp })
      }
    }
  }
  return { start, end, tools, lines: lines.length }
}

// ─────────────────────────────────────────────────────────────
// 2. 판정 — 부서 로그의 「관리자 판정」
// ─────────────────────────────────────────────────────────────

function readVerdicts() {
  const dir = join(REPO, 'docs', 'agent-team', 'logs')
  const out = []
  if (!existsSync(dir)) return out
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md') || file === '관리자.md') continue
    const dept = file.replace('.md', '')
    const text = readFileSync(join(dir, file), 'utf8')
    const entries = text.split(/^## /m).slice(1)
    for (const entry of entries) {
      const title = entry.split('\n')[0].trim()
      const m = entry.match(/\*\*관리자 판정\*\*\s*—?\s*(🟢|🟡|🔴)?\s*([^\n(]*)/)
      const dateM = title.match(/^(\d{4}-\d{2}-\d{2})/)
      out.push({
        dept,
        title,
        date: dateM ? dateM[1] : null,
        verdict: m && m[1] ? m[1] : null,
        verdictText: m && m[2] ? m[2].trim().slice(0, 30) : '',
      })
    }
  }
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

// ─────────────────────────────────────────────────────────────
// 3. 앞으로 할 일 — DECISIONS 상태 칸 + 켜는 날 게이트
// ─────────────────────────────────────────────────────────────

const STATUS_ICONS = ['✅', '🌑', '🔨', '⏸', '🚫']

function readBacklog() {
  const path = join(REPO, '검토문서', 'DECISIONS.md')
  if (!existsSync(path)) return { items: [], counts: {} }
  const text = readFileSync(path, 'utf8')
  const items = []

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line.startsWith('|') || !line.endsWith('|')) continue
    const cells = line.slice(1, -1).split('|')
    if (cells.length < 3) continue
    const date = cells[0].trim().replace(/~~/g, '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue

    const decision = cells[1].trim()
    const status = cells[2].trim()
    const icon = STATUS_ICONS.find((i) => status.startsWith(i)) || null
    if (!icon) continue

    // 결정문에서 굵게 표시된 첫 구절을 제목으로 쓴다
    const bold = decision.match(/\*\*(.+?)\*\*/)
    const title = (bold ? bold[1] : decision).replace(/[`~]/g, '').slice(0, 110)

    items.push({
      date,
      icon,
      // 60자에서 자르니 화면에서 "…심사)는 2026-08"처럼 문장 한가운데가 끊겼다.
      // 화면 쪽에서 2줄로 접으므로 여기서는 넉넉히 넘긴다
      status: status.replace(/\*\*/g, '').slice(0, 150),
      title,
      ageDays: Math.floor((Date.now() - new Date(`${date}T00:00:00+09:00`)) / 86400000),
      struck: cells[0].includes('~~'),
    })
  }

  const counts = {}
  for (const i of items) if (!i.struck) counts[i.icon] = (counts[i.icon] || 0) + 1
  return { items, counts }
}

/** 켜는 날 게이트 — CLAUDE.md의 표를 읽는다 */
function readGate() {
  const path = join(REPO, 'CLAUDE.md')
  if (!existsSync(path)) return []
  const text = readFileSync(path, 'utf8')
  const idx = text.indexOf('켜는 날 게이트')
  if (idx === -1) return []
  const section = text.slice(idx, idx + 2600)
  const rows = []
  for (const raw of section.split(/\r?\n/)) {
    const line = raw.trim()
    const m = line.match(/^\|\s*(\d)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/)
    if (m) rows.push({ n: Number(m[1]), what: strip(m[2]), risk: strip(m[3]) })
  }
  return rows
}

const strip = (s) => s.replace(/\*\*/g, '').replace(/`/g, '').trim()

/** 문서가 마지막으로 손질된 시각 — 낡음 판정에 쓴다 */
function readFreshness() {
  const targets = {
    'DECISIONS.md': join(REPO, '검토문서', 'DECISIONS.md'),
    'CLAUDE.md': join(REPO, 'CLAUDE.md'),
    'VOICE.md': join(REPO, 'jidokhae-web', 'VOICE.md'),
    'DESIGN_TOKENS.md': join(REPO, 'jidokhae-web', 'DESIGN_TOKENS.md'),
    검증프로필: join(REPO, 'verification-squad', 'profiles', 'jidokhae-profile.md'),
  }
  const out = []
  for (const [label, path] of Object.entries(targets)) {
    if (!existsSync(path)) continue
    const ageH = (Date.now() - statSync(path).mtimeMs) / 3600000
    out.push({ label, ageHours: Math.round(ageH), ageDays: Math.floor(ageH / 24) })
  }
  return out.sort((a, b) => b.ageHours - a.ageHours)
}

// ─────────────────────────────────────────────────────────────
// 4. 상태 조립
// ─────────────────────────────────────────────────────────────

function buildState() {
  const runs = readAgentRuns()
  const verdicts = readVerdicts()
  const backlog = readBacklog()

  // 전사 파일이 최근 3분 안에 갱신됐으면 "도는 중"으로 본다
  const LIVE_MS = 3 * 60 * 1000
  for (const r of runs) r.live = r.mtime != null && Date.now() - r.mtime < LIVE_MS

  const byDept = {}
  for (const key of Object.keys(DEPARTMENTS)) {
    byDept[key] = {
      key,
      ko: DEPARTMENTS[key],
      hasDefinition: existsSync(join(REPO, '.claude', 'agents', `${key}.md`)),
      runs: 0,
      lastRun: null,
      live: false,
      verdicts: { '🟢': 0, '🟡': 0, '🔴': 0 },
    }
  }
  for (const r of runs) {
    if (!r.dept || !byDept[r.dept]) continue
    byDept[r.dept].runs++
    byDept[r.dept].lastRun = r.start
    if (r.live) byDept[r.dept].live = true
  }
  for (const v of verdicts) {
    const key = Object.entries(DEPARTMENTS).find(([, ko]) => ko === v.dept)?.[0]
    if (key && v.verdict && byDept[key]) byDept[key].verdicts[v.verdict]++
  }

  return {
    now: new Date().toISOString(),
    repo: REPO,
    runs,
    departments: Object.values(byDept),
    verdicts: verdicts.slice(0, 40),
    backlog,
    gate: readGate(),
    freshness: readFreshness(),
  }
}

// ─────────────────────────────────────────────────────────────
// 5. 서버
// ─────────────────────────────────────────────────────────────

createServer((req, res) => {
  if (req.url.startsWith('/api/state')) {
    let body
    try {
      body = JSON.stringify(buildState())
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      return res.end(JSON.stringify({ error: String(err?.message || err) }))
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    return res.end(body)
  }
  const html = readFileSync(join(HERE, 'index.html'), 'utf8')
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  res.end(html)
}).listen(PORT, () => {
  console.log(`지독해 관제  →  http://localhost:${PORT}`)
  const s = buildState()
  console.log(
    `  부서 실행 ${s.runs.length}건 · 판정 ${s.verdicts.length}건 · ` +
      `결정 ${s.backlog.items.length}건 · 게이트 ${s.gate.length}건`,
  )
})
