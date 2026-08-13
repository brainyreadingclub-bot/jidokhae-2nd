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
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

try {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const body = readFileSync(join(root, '검토문서', 'DECISIONS.md'), 'utf8')

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: HEADER + body,
      },
      suppressOutput: true,
    }),
  )
} catch {
  // 파일이 없거나 못 읽으면 조용히 넘어간다. 세션 시작을 막지 않는다.
}
