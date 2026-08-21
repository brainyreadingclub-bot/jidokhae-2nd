/** 관리자 쓰기 가드 회귀 시험 — 인라인 bash로 돌리면 가드가 시험문 자체를 막는다 */
import { spawnSync } from 'node:child_process'

const HOOK = 'C:/jidokhae-2nd/.claude/hooks/manager-write-guard.mjs'
const CWD = 'C:/jidokhae-2nd'

const cases = [
  // [기대 exit, 설명, 입력]
  [2, '관리자 → 검토문서/DECISIONS.md (오늘 4건 난 자리)', { tool_name: 'Edit', tool_input: { file_path: '검토문서/DECISIONS.md' } }],
  [2, '관리자 → jidokhae-web/VOICE.md (오늘 2건 난 자리)', { tool_name: 'Edit', tool_input: { file_path: 'jidokhae-web/VOICE.md' } }],
  [2, '관리자 → src/lib/refund.ts (개발·운영)', { tool_name: 'Write', tool_input: { file_path: 'jidokhae-web/src/lib/refund.ts' } }],
  [2, '관리자 → 문서지도/x.md (문서총괄)', { tool_name: 'Write', tool_input: { file_path: 'docs/agent-team/문서지도/x.md' } }],
  [2, '관리자 → mockups/a.html (디자인)', { tool_name: 'Write', tool_input: { file_path: 'docs/superpowers/mockups/a.html' } }],
  [2, '관리자 → roadmap/milestones.md (제품기획)', { tool_name: 'Edit', tool_input: { file_path: 'roadmap/milestones.md' } }],
  [2, '관리자 → supabase/m.sql (개발·운영)', { tool_name: 'Write', tool_input: { file_path: 'jidokhae-web/supabase/m.sql' } }],
  [2, 'BASH 우회 — python 히어독으로 소관 파일 쓰기', { tool_name: 'Bash', tool_input: { command: "python - <<PY\np='검토문서/DECISIONS.md'\nPY" } }],
  [2, 'BASH 우회 — 리다이렉트로 VOICE.md 덧쓰기', { tool_name: 'Bash', tool_input: { command: 'cat >> jidokhae-web/VOICE.md' } }],
  [2, 'BASH — git checkout으로 소관 파일 되돌리기 (안전목록 아님)', { tool_name: 'Bash', tool_input: { command: 'git checkout -- 검토문서/DECISIONS.md' } }],

  [0, '부서(agent_id 있음) → DECISIONS.md', { agent_id: 'a1', agent_type: 'product', tool_name: 'Edit', tool_input: { file_path: '검토문서/DECISIONS.md' } }],
  [0, '관리자 → CLAUDE.md (관리자 소관)', { tool_name: 'Edit', tool_input: { file_path: 'CLAUDE.md' } }],
  [0, '관리자 → jidokhae-web/CLAUDE.md (예외)', { tool_name: 'Edit', tool_input: { file_path: 'jidokhae-web/CLAUDE.md' } }],
  [0, '관리자 → logs/디자인.md (판정 칸)', { tool_name: 'Edit', tool_input: { file_path: 'docs/agent-team/logs/디자인.md' } }],
  [0, '관리자 → logs/문서총괄.md (판정 칸)', { tool_name: 'Edit', tool_input: { file_path: 'docs/agent-team/logs/문서총괄.md' } }],
  [0, '관리자 → 공통규약.md', { tool_name: 'Edit', tool_input: { file_path: 'docs/agent-team/공통규약.md' } }],
  [0, '관리자 → .claude/hooks/x.mjs', { tool_name: 'Write', tool_input: { file_path: '.claude/hooks/x.mjs' } }],
  [0, '관리자 → 저장소 밖(메모리)', { tool_name: 'Write', tool_input: { file_path: 'C:/Users/ytyt8/.claude/x.md' } }],
  [0, '오탐 회귀 — git commit 메시지에 경로+python 낱말', { tool_name: 'Bash', tool_input: { command: 'git commit -m "python 히어독으로 검토문서/DECISIONS.md 고친 전례"' } }],
  [0, '오탐 회귀 — git add -A', { tool_name: 'Bash', tool_input: { command: 'git add -A' } }],
  [0, '오탐 회귀 — git show로 소관 파일 읽기', { tool_name: 'Bash', tool_input: { command: 'git show main:검토문서/DECISIONS.md' } }],
  [0, '오탐 회귀 — grep으로 소관 파일 읽기', { tool_name: 'Bash', tool_input: { command: 'grep -n foo 검토문서/DECISIONS.md' } }],
  // 실전 오탐 2호: 읽기 전용 node -e 스크립트가 막혔다
  [0, '오탐 회귀 — node -e 로 소관 파일 읽기', { tool_name: 'Bash', tool_input: { command: 'node -e "const t=require(\'fs\').readFileSync(\'검토문서/DECISIONS.md\',\'utf8\'); console.log(t.length)"' } }],
  [0, '오탐 회귀 — python -c 로 소관 파일 읽기', { tool_name: 'Bash', tool_input: { command: 'python -c "print(len(open(0).read()))" < roadmap/milestones.md' } }],
  [2, '인터프리터 쓰기 — node 로 소관 파일 덮어쓰기', { tool_name: 'Bash', tool_input: { command: 'node -e "require(\'fs\').writeFileSync(\'검토문서/DECISIONS.md\',\'x\')"' } }],
  [2, '인터프리터 쓰기 — 히어독', { tool_name: 'Bash', tool_input: { command: "python - <<PY\nio.open('roadmap/milestones.md','w')\nPY" } }],
  // 실전 오탐 3호: 화살표 함수의 `>`를 리다이렉션으로 읽었다
  [0, '오탐 회귀 — 화살표 함수가 든 읽기 스크립트', { tool_name: 'Bash', tool_input: { command: 'node -e "const chk=(p,re)=>{const t=require(\'fs\').readFileSync(p);console.log(t.length)};chk(\'검토문서/DECISIONS.md\')"' } }],
  [0, '오탐 회귀 — 2>&1 은 파일을 만들지 않는다', { tool_name: 'Bash', tool_input: { command: 'grep -n x roadmap/milestones.md 2>&1' } }],
  [2, '리다이렉션 — 소관 파일로 덮어쓰기', { tool_name: 'Bash', tool_input: { command: 'echo x > roadmap/milestones.md' } }],
  [2, '리다이렉션 — 소관 파일에 덧쓰기', { tool_name: 'Bash', tool_input: { command: 'echo x >> 검토문서/DECISIONS.md' } }],
]

let pass = 0
for (const [want, desc, payload] of cases) {
  const r = spawnSync('node', [HOOK], { input: JSON.stringify({ cwd: CWD, ...payload }), encoding: 'utf8' })
  const ok = r.status === want
  if (ok) pass++
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] exit=${r.status} (기대 ${want})  ${desc}`)
}
console.log(`\n${pass}/${cases.length} 통과`)
process.exit(pass === cases.length ? 0 : 1)
