/**
 * 세션 인계 — 압축(기억 정리) 직전에 적고, 압축 직후에 다시 읽힌다. 훅 공용.
 *
 * 왜 필요한가 (2026-10-15 대표님 지시)
 *   대화가 길어지면 Claude Code가 앞부분을 요약해 줄인다(압축). 요약에서 「하던 일·다음 할 일·
 *   미결 질문」이 빠지면 압축 뒤 세션이 엉뚱한 일을 하거나 이미 물은 걸 다시 묻는다.
 *   그래서 압축 직전(PreCompact)에 현황.md 「세션 인계」 칸에 세션별로 적어 두고,
 *   압축 직후(SessionStart, source=compact)에 목표 요약과 함께 다시 읽힌다.
 *
 * 공식 근거 — https://code.claude.com/docs/en/hooks
 *   - PreCompact 입력: 공통 필드(session_id·transcript_path·cwd) + trigger(manual|auto) + custom_instructions
 *   - PreCompact은 command 훅만 된다(prompt·agent 훅 불가) → **모델이 없다.** 그래서 이 칸은
 *     판단이 아니라 기록에서 기계적으로 뽑은 것이다. 못 뽑으면 「모름」이라고 쓴다.
 *   - 세션 이름(session_title)은 SessionStart·UserPromptSubmit 입력에만 온다(직접 붙인 이름일 때).
 *     그래서 그 두 훅이 이름·마지막 요청을 임시 상태 파일에 남기고, PreCompact이 그걸 읽는다.
 *   - transcript_path 파일의 줄 형식은 공식 문서에 없다. 「다음 할 일·미결 질문」은 거기서
 *     조심스럽게 뽑고, 형식이 달라 못 읽으면 「모름」으로 남긴다(훅은 절대 실패하지 않는다).
 *
 * 어디에 쓰나
 *   현황.md는 문서 작업 공간(`feat/agent-team`) 판만 살아 있다. 저장소 본 폴더가 그 가지에 있을
 *   때만 그 파일에 쓴다(`decisions-source.mjs`의 docCheckoutDir). 아니면 현황.md는 건드리지 않고
 *   임시 상태 파일에만 남긴다 — 압축 직후 다시 읽히는 것은 그쪽으로도 된다.
 *
 * 남의 칸은 건드리지 않는다
 *   쓰기 **직전에** 파일을 다시 읽고, 「## 세션 인계」 칸 안의 **이 세션 덩어리 하나만** 바꾼다.
 *   읽은 뒤 쓰기 전에 다른 세션이 파일을 바꿨으면(수정 시각이 달라지면) 다시 읽고 다시 한다.
 */

import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DOC_BRANCH, docCheckoutDir, git } from './decisions-source.mjs'

export const STATUS_PATH = '현황.md'
export const SECTION_HEADING = '## 세션 인계'
export const MAX_BLOCKS = 12
const FIELD_MAX = 120

export const SECTION_INTRO = [
  '압축(기억 정리) 직전에 훅이 자동으로 적는 칸. 세션마다 한 덩어리(5줄), 같은 세션은 덮어쓴다. 압축 직후 그 세션에 다시 읽힌다.',
  '- 사람이 고치지 않는다. 최근 ' + MAX_BLOCKS + '개만 남는다. 대화 기록에서 기계로 뽑은 것이라 「모름」이 있을 수 있다',
  '- 결정은 여기 적지 않는다(정본은 `검토문서/DECISIONS.md`). 회원 실명·전화번호·결제 정보는 쓰지 않는다',
  '- 만든 곳: `.claude/hooks/session-handoff.mjs`',
]

// ── 임시 상태 파일 (세션 이름·마지막 요청·마지막 인계) ─────────────────────────

function stateFile(sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '')
  return join(tmpdir(), 'jidokhae-session-handoff', `${safe || 'unknown'}.json`)
}

export function readState(sessionId) {
  try {
    return JSON.parse(readFileSync(stateFile(sessionId), 'utf8'))
  } catch {
    return {}
  }
}

export function writeState(sessionId, patch) {
  try {
    const file = stateFile(sessionId)
    mkdirSync(join(tmpdir(), 'jidokhae-session-handoff'), { recursive: true })
    writeFileSync(file, JSON.stringify({ ...readState(sessionId), ...patch }), 'utf8')
  } catch {}
}

/** SessionStart·UserPromptSubmit 입력에서 세션 이름과 마지막 요청을 남긴다 */
export function rememberSession(input) {
  if (!input || !input.session_id) return
  const patch = {}
  if (input.session_title) patch.title = String(input.session_title)
  if (typeof input.prompt === 'string' && input.prompt.trim()) {
    patch.prompt = input.prompt
    patch.promptAt = new Date().toISOString()
  }
  if (Object.keys(patch).length) writeState(input.session_id, patch)
}

// ── 글 다듬기 ──────────────────────────────────────────────────────────────

/** 한 줄로 만들고, 전화번호처럼 보이는 숫자는 가리고, 길이를 자른다 */
export function clean(text, max = FIELD_MAX) {
  const one = String(text || '')
    .replace(/<!--|-->/g, '')
    .replace(/[*`#>|]/g, '')
    .replace(/\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, '***')
    .replace(/\s+/g, ' ')
    .trim()
  return one.length > max ? one.slice(0, max - 1) + '…' : one
}

export function kstStamp(date = new Date()) {
  return new Date(date.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ')
}

// ── 대화 기록에서 뽑기 (형식이 공식 문서에 없어 방어적으로) ─────────────────────

function textOf(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((c) => c && c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text)
    .join('\n')
}

/** @returns {{ lastUser: string, lastAssistant: string, todos: string[] }} */
export function scanTranscript(raw) {
  const out = { lastUser: '', lastAssistant: '', todos: [] }
  for (const line of String(raw || '').split(/\r?\n/)) {
    if (!line.trim()) continue
    let o
    try {
      o = JSON.parse(line)
    } catch {
      continue
    }
    const msg = o && o.message
    if (!msg || o.isSidechain) continue
    if (o.type === 'user' && msg.role === 'user') {
      const t = textOf(msg.content)
      // 훅·도구 결과·명령 출력은 사람이 쓴 요청이 아니다
      if (t.trim() && !/^\s*</.test(t) && !o.isMeta) out.lastUser = t
    }
    if (o.type === 'assistant' && Array.isArray(msg.content)) {
      const t = textOf(msg.content)
      if (t.trim()) out.lastAssistant = t
      for (const c of msg.content) {
        if (c && c.type === 'tool_use' && c.name === 'TodoWrite' && Array.isArray(c.input?.todos)) {
          out.todos = c.input.todos
            .filter((td) => td && td.status !== 'completed')
            .map((td) => String(td.content || td.activeForm || ''))
            .filter(Boolean)
        }
      }
    }
  }
  return out
}

export function readTranscriptTail(path, bytes = 4 * 1024 * 1024) {
  try {
    const buf = readFileSync(path)
    const tail = buf.length > bytes ? buf.subarray(buf.length - bytes) : buf
    const text = tail.toString('utf8')
    return buf.length > bytes ? text.slice(text.indexOf('\n') + 1) : text
  } catch {
    return ''
  }
}

/** 마지막 답에서 「다음」이 들어간 줄과 물음표로 끝나는 줄을 찾는다 */
export function pickNextAndQuestions(lastAssistant, todos) {
  const lines = String(lastAssistant || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s>*\-•\d.)]+/, '').trim())
    .filter(Boolean)
  let next = todos.length ? todos.slice(0, 2).join(' / ') : ''
  if (!next) next = lines.find((l) => /다음|이어서|남은 일|next/i.test(l)) || ''
  // 「다음」이 안 보이면 마지막 답의 끝줄이라도 남긴다(라벨로 추측임을 밝힌다)
  if (!next && lines.length) next = `마지막 답 끝 — ${lines[lines.length - 1]}`
  const questions = lines.filter((l) => /[?？]\s*$/.test(l)).slice(-2)
  return { next, questions: questions.join(' / ') }
}

// ── 현황.md 칸 고치기 ──────────────────────────────────────────────────────────

export function marker(sessionId) {
  return `<!-- session:${String(sessionId || '').replace(/[^A-Za-z0-9_-]/g, '')} -->`
}

export function displayName(title, sessionId) {
  return title ? clean(title, 40) : `이름 없음 (${String(sessionId || '').slice(0, 8)})`
}

/** 5줄: 제목줄 + 갱신 + 하던 일 + 다음 할 일 + 미결 질문 */
export function buildBlock({ sessionId, title, trigger, when, doing, next, questions }) {
  return [
    `### ${displayName(title, sessionId)} ${marker(sessionId)}`,
    `- 갱신: ${when} (${trigger === 'manual' ? '/compact' : '자동 압축'})`,
    `- 하던 일: ${clean(doing) || '모름'}`,
    `- 다음 할 일: ${clean(next) || '모름'}`,
    `- 미결 질문: ${clean(questions) || '찾지 못함'}`,
  ].join('\n')
}

/** 칸의 범위 [시작 줄, 끝 줄) — 없으면 null */
function sectionRange(lines) {
  const start = lines.findIndex((l) => l.trim() === SECTION_HEADING)
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i
      break
    }
  }
  // 칸 끝의 구분선(---)은 칸 밖으로 남긴다
  while (end - 1 > start && /^(---|\s*)$/.test(lines[end - 1])) end--
  return [start, end]
}

function splitBlocks(sectionLines) {
  const intro = []
  const blocks = []
  for (const l of sectionLines) {
    if (/^### /.test(l)) blocks.push([l])
    else if (blocks.length) blocks[blocks.length - 1].push(l)
    else intro.push(l)
  }
  return { intro, blocks: blocks.map((b) => b.join('\n').replace(/\s+$/, '')) }
}

function blockMatches(block, sessionId, title) {
  const head = block.split('\n')[0]
  if (head.includes(marker(sessionId))) return true
  if (!title) return false
  const name = head.replace(/^###\s+/, '').replace(/<!--.*?-->/g, '').trim()
  return name === displayName(title, sessionId)
}

/** 이 세션 덩어리만 바꾸거나 맨 위에 더한다. 칸이 없으면 파일 끝에 만든다 */
export function upsertBlock(text, block, sessionId, title) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  let range = sectionRange(lines)
  if (!range) {
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
    lines.push('', '---', '', SECTION_HEADING, '', ...SECTION_INTRO, '')
    range = sectionRange(lines)
  }
  const [start, end] = range
  const { intro, blocks } = splitBlocks(lines.slice(start + 1, end))
  const kept = blocks.filter((b) => !blockMatches(b, sessionId, title))
  const next = [block, ...kept].slice(0, MAX_BLOCKS)
  const introTrim = intro.slice()
  while (introTrim.length && introTrim[introTrim.length - 1].trim() === '') introTrim.pop()
  const section = [SECTION_HEADING, ...introTrim, '', ...next.join('\n\n').split('\n'), '']
  const out = [...lines.slice(0, start), ...section, ...lines.slice(end)]
  let joined = out.join(eol)
  if (!joined.endsWith(eol)) joined += eol
  return joined
}

export function extractBlock(text, sessionId, title) {
  const lines = String(text || '').split(/\r?\n/)
  const range = sectionRange(lines)
  if (!range) return null
  const { blocks } = splitBlocks(lines.slice(range[0] + 1, range[1]))
  return (
    blocks.find((b) => b.split('\n')[0].includes(marker(sessionId))) ||
    blocks.find((b) => blockMatches(b, sessionId, title)) ||
    null
  )
}

/** 목표 칸에서 목표마다 한 줄: 이름 | 예정일 · 단계 · 일정 상태 | 다음 행동 */
export function goalsSummary(text, perGoalMax = 260) {
  const lines = String(text || '').split(/\r?\n/)
  const start = lines.findIndex((l) => l.trim() === '## 목표')
  if (start < 0) return ''
  const out = []
  let cur = null
  const field = (l, name) => {
    const m = l.match(new RegExp(`^- \\*\\*${name}\\*\\*:\\s*(.+)$`))
    return m ? clean(m[1], 90) : null
  }
  for (let i = start + 1; i < lines.length && !/^## /.test(lines[i]); i++) {
    const l = lines[i]
    if (/^### /.test(l)) {
      if (cur) out.push(cur)
      cur = { title: clean(l.replace(/^###\s+/, ''), 70), f: {} }
      continue
    }
    if (!cur) continue
    for (const name of ['예정일', '단계', '일정 상태', '다음 행동']) {
      const v = field(l, name)
      if (v) cur.f[name] = v
    }
  }
  if (cur) out.push(cur)
  return out
    .map((g) => {
      const meta = [g.f['예정일'] && `예정 ${g.f['예정일']}`, g.f['단계'], g.f['일정 상태']].filter(Boolean).join(' · ')
      const line = `- ${g.title} | ${meta}${g.f['다음 행동'] ? ` | 다음: ${g.f['다음 행동']}` : ''}`
      return line.length > perGoalMax ? line.slice(0, perGoalMax - 1) + '…' : line
    })
    .join('\n')
}

// ── 파일 찾기·읽기·쓰기 ────────────────────────────────────────────────────────

/** 쓸 수 있는 현황.md 경로(본 폴더가 문서 작업 공간 가지일 때만) */
export function writableStatusPath(root) {
  const doc = docCheckoutDir(root)
  return doc ? join(doc, STATUS_PATH) : null
}

/** 읽기용 — 본 폴더 파일 → 로컬 가지 → 온라인 저장소 가지 */
export function readStatusText(root) {
  const p = writableStatusPath(root)
  if (p) {
    try {
      return readFileSync(p, 'utf8')
    } catch {}
  }
  for (const ref of [DOC_BRANCH, `origin/${DOC_BRANCH}`]) {
    const body = git(root, ['show', `${ref}:${STATUS_PATH}`])
    if (body) return body
  }
  return ''
}

/** 쓰기 직전에 다시 읽고, 그 사이 바뀌었으면 다시 한다 */
export function writeFresh(path, mutate, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    let before
    let text
    try {
      before = statSync(path).mtimeMs
      text = readFileSync(path, 'utf8')
    } catch {
      return false
    }
    const next = mutate(text)
    if (next === text) return true
    try {
      if (statSync(path).mtimeMs !== before) continue
      const tmp = `${path}.${process.pid}.tmp`
      writeFileSync(tmp, next, 'utf8')
      try {
        renameSync(tmp, path)
      } catch {
        writeFileSync(path, next, 'utf8')
      }
      return true
    } catch {
      return false
    }
  }
  return false
}

export function readStdinJson() {
  try {
    if (process.stdin.isTTY) return {}
    const raw = readFileSync(0, 'utf8')
    return raw.trim() ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
