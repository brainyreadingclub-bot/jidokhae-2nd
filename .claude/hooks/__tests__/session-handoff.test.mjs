// node --test .claude/hooks/__tests__/session-handoff.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildBlock, extractBlock, goalsSummary, pickNextAndQuestions, scanTranscript, upsertBlock, clean } from '../session-handoff.mjs'
import { buildCompactContext, buildDigest } from '../inject-decisions.mjs'

const STATUS = [
  '# 현황',
  '',
  '## 목표',
  '',
  '### 1. 다시 오게',
  '',
  '- **예정일**: 2026-10-30',
  '- **단계**: 설계',
  '- **일정 상태**: 주의',
  '- **다음 행동**: 시안 → 확인',
  '',
  '---',
  '',
  '## 아이디어 보관함',
  '',
  '| 번호 | 내용 |',
  '|---|---|',
  '| I-001 | 남의 칸 |',
  '',
].join('\n')

const block = (id, title, doing = '일') =>
  buildBlock({ sessionId: id, title, trigger: 'auto', when: '2026-10-15 17:00', doing, next: '다음', questions: '' })

test('덩어리는 5줄이다', () => {
  assert.equal(block('aaa', '빌드1').split('\n').length, 5)
})

test('칸이 없으면 끝에 만들고, 남의 칸은 그대로 둔다', () => {
  const out = upsertBlock(STATUS, block('aaa', '빌드1'), 'aaa', '빌드1')
  assert.ok(out.startsWith(STATUS.trimEnd()))
  assert.ok(out.includes('## 세션 인계'))
  assert.ok(out.includes('| I-001 | 남의 칸 |'))
})

test('같은 세션은 덮어쓰고 다른 세션은 남긴다', () => {
  let out = upsertBlock(STATUS, block('aaa', '빌드1', '첫'), 'aaa', '빌드1')
  out = upsertBlock(out, block('bbb', '빌드2', '둘'), 'bbb', '빌드2')
  out = upsertBlock(out, block('aaa', '빌드1', '셋'), 'aaa', '빌드1')
  assert.equal(out.match(/### 빌드1/g).length, 1)
  assert.ok(out.includes('하던 일: 셋'))
  assert.ok(!out.includes('하던 일: 첫'))
  assert.ok(out.includes('하던 일: 둘'))
  // 이름이 같으면 새 세션(id 다름)도 그 칸을 덮어쓴다
  out = upsertBlock(out, block('ccc', '빌드1', '넷'), 'ccc', '빌드1')
  assert.equal(out.match(/### 빌드1/g).length, 1)
  assert.equal(extractBlock(out, 'ccc', '빌드1').includes('넷'), true)
})

test('세션 인계 칸 뒤에 다른 칸이 있어도 그 칸은 안 건드린다', () => {
  const withAfter = upsertBlock(STATUS, block('aaa', '빌드1'), 'aaa', '빌드1') + '\n---\n\n## 나중 칸\n\n내용\n'
  const out = upsertBlock(withAfter, block('bbb', null), 'bbb', null)
  assert.ok(out.endsWith('## 나중 칸\n\n내용\n'))
  assert.ok(out.includes('### 이름 없음 (bbb)'))
})

test('최근 12개만 남는다', () => {
  let out = STATUS
  for (let i = 0; i < 15; i++) out = upsertBlock(out, block(`s${i}`, null), `s${i}`, null)
  assert.equal(out.match(/<!-- session:/g).length, 12)
  assert.ok(out.includes('session:s14'))
  assert.ok(!out.includes('session:s0 '))
})

test('CRLF 파일은 CRLF로 남는다', () => {
  const out = upsertBlock(STATUS.replace(/\n/g, '\r\n'), block('aaa', '빌드1'), 'aaa', '빌드1')
  assert.ok(!/[^\r]\n/.test(out))
})

test('전화번호처럼 보이는 숫자는 가린다', () => {
  assert.equal(clean('010-1234-5678 회원'), '*** 회원')
})

test('대화 기록에서 마지막 요청·답·할 일 목록을 뽑는다', () => {
  const raw = [
    JSON.stringify({ type: 'user', message: { role: 'user', content: '첫 요청' } }),
    JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'x' }] } }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'TodoWrite', input: { todos: [{ content: 'A', status: 'completed' }, { content: 'B', status: 'pending' }] } }] } }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: '정리\n다음은 시험입니다\n이대로 갈까요?' }] } }),
    '깨진 줄',
  ].join('\n')
  const s = scanTranscript(raw)
  assert.equal(s.lastUser, '첫 요청')
  assert.deepEqual(s.todos, ['B'])
  const p = pickNextAndQuestions(s.lastAssistant, s.todos)
  assert.equal(p.next, 'B')
  assert.equal(p.questions, '이대로 갈까요?')
  assert.equal(pickNextAndQuestions(s.lastAssistant, []).next, '다음은 시험입니다')
})

test('목표 요약은 목표마다 한 줄', () => {
  assert.equal(goalsSummary(STATUS), '- 1. 다시 오게 | 예정 2026-10-30 · 설계 · 주의 | 다음: 시안 → 확인')
})

test('압축 직후 글 + 결정 요약은 합쳐서 9,500자를 넘지 않는다', () => {
  const rows = Array.from({ length: 400 }, (_, i) => `| 2026-10-${String((i % 28) + 1).padStart(2, '0')} | **결정 ${i} ${'가'.repeat(120)}** | 🔨 미적용 |`).join('\n')
  const prefix = buildCompactContext(STATUS, block('aaa', '빌드1'))
  const digest = buildDigest(rows, 'x', 'y', '2026-10-01', 9500 - prefix.length)
  assert.ok((prefix + digest).length <= 9500)
  assert.ok(prefix.includes('### 빌드1'))
})
