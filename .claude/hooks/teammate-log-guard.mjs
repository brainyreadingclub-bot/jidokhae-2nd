/**
 * TeammateIdle 훅 — 로그를 안 쓴 팀원을 되돌려보낸다.
 *
 * 왜 필요한가
 *   에이전트 팀은 세션이 끝나면 팀원도 메일함도 사라진다. 재개해도 in-process
 *   팀원은 복원되지 않는다. 그래서 파일에 남지 않은 작업은 존재하지 않은 것과
 *   같다. 공통규약은 "로그를 안 쓰면 미완료"라고 정해뒀지만, 규칙은 글자일 뿐이다.
 *
 *   TeammateIdle 훅이 exit 2를 반환하면 팀원이 유휴 상태로 못 들어가고 계속
 *   일하게 된다. 규칙을 장치로 바꾸는 유일한 지점이다.
 *
 * 동작
 *   1. stdin으로 들어온 JSON에서 teammate_type을 읽어 부서를 식별한다.
 *   2. 그 부서의 로그 파일이 최근에 갱신됐는지 본다.
 *   3. 안 됐으면 exit 2 + stderr로 무엇을 써야 하는지 알려준다.
 *
 * 무한 루프 방지 (중요)
 *   팀원이 로그를 쓸 수 없는 상황(권한, 경로 오류)이면 영원히 되돌려보내진다.
 *   그래서 **teammate_id당 한 번만 막는다.** 두 번째부터는 통과시키되 stderr에
 *   남긴다. 사람이 못 고치게 만드는 안전장치는 안전장치가 아니다.
 *
 * 실패 시 정책
 *   훅 자체가 깨지면 조용히 통과시킨다(exit 0). 검증 장치가 작업을 막으면 안 된다.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'

/** 로그가 이 시간 안에 갱신됐으면 "썼다"고 본다 */
const FRESH_MINUTES = 120

/** teammate_type → 로그 파일명. 정의 파일명(.claude/agents/<type>.md)과 맞춘다 */
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

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    return null
  }
}

/** 이미 한 번 막은 팀원인지 기록해 무한 루프를 막는다 */
function alreadyBlocked(stateDir, teammateId) {
  const marker = join(stateDir, `${teammateId.replace(/[^\w-]/g, '_')}.blocked`)
  if (existsSync(marker)) return true
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(marker, new Date().toISOString())
  return false
}

function minutesSinceModified(path) {
  try {
    return (Date.now() - statSync(path).mtimeMs) / 60000
  } catch {
    return Infinity
  }
}

function main() {
  const input = readStdin()
  if (!input) process.exit(0)

  const { teammate_type: type, teammate_id: id, cwd } = input
  if (!type || !id || !cwd) process.exit(0)

  const dept = DEPARTMENTS[type]
  // 우리 부서 체계가 아닌 팀원(임시 조사용 등)은 간섭하지 않는다
  if (!dept) process.exit(0)

  const logPath = join(cwd, 'docs', 'agent-team', 'logs', `${dept}.md`)
  const age = minutesSinceModified(logPath)
  if (age <= FRESH_MINUTES) process.exit(0)

  const stateDir = join(dirname(logPath), '.guard-state')
  if (alreadyBlocked(stateDir, id)) {
    process.stderr.write(
      `[로그 가드] ${dept} 로그가 여전히 갱신되지 않았습니다(${logPath}). ` +
        `무한 차단을 피하기 위해 이번에는 통과시킵니다. ` +
        `관리자는 이 부서가 로그를 쓸 수 있는 상태인지 확인하세요.\n`
    )
    process.exit(0)
  }

  process.stderr.write(
    `[로그 가드] 아직 작업 로그를 쓰지 않았습니다.\n\n` +
      `유휴로 들어가기 전에 다음 파일에 이번 작업을 기록하세요:\n` +
      `  ${logPath}\n\n` +
      `양식은 docs/agent-team/공통규약.md §4에 있습니다. ` +
      `한 일 / 왜 / 안 한 것과 이유 / 주고받은 메시지 / 다음 — 다섯 항목입니다.\n\n` +
      `세션이 끝나면 당신도 메일함도 사라집니다. ` +
      `파일에 남지 않은 작업은 존재하지 않은 것과 같습니다.\n`
  )
  process.exit(2)
}

main()
