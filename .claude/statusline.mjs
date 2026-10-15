/**
 * 상태 표시줄 — 기억(컨텍스트) 사용량 %를 보인다.
 *
 * 공식 문서(https://code.claude.com/docs/en/statusline)에 있는 값만 쓴다.
 *   - context_window.used_percentage : 기억 사용량 %(미리 계산된 값). 세션 초반엔 null일 수 있다 → 「—」
 *   - session_name : /rename·--name으로 붙인 이름 또는 자동 제목. 없으면 안 보인다
 * 70% 이상이면 CLAUDE.md 규칙(『마무리 후 /clear 권장』)을 떠올리게 표시를 붙인다.
 */

import { readFileSync } from 'node:fs'

let data = {}
try {
  data = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {}

const raw = data?.context_window?.used_percentage
const pct = typeof raw === 'number' ? Math.round(raw) : null
const parts = []
if (data?.session_name) parts.push(`[${data.session_name}]`)
parts.push(pct === null ? '기억 —' : `기억 ${pct}%`)
if (pct !== null && pct >= 70) parts.push('· 마무리 후 /clear 권장')
process.stdout.write(parts.join(' '))
