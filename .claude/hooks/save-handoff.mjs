/**
 * PreCompact 훅(manual·auto) — 압축 직전에 현황.md 「세션 인계」 칸에 이 세션 덩어리를 적는다.
 *
 * 🔴 압축을 막지 않는다. 공식 문서상 exit 2나 {"decision":"block"}이면 막히므로
 *    어떤 경우에도 아무것도 출력하지 않고 exit 0으로 끝낸다.
 *    (https://code.claude.com/docs/en/hooks — PreCompact)
 * 결정 기록(DECISIONS.md)은 건드리지 않는다. 세부는 `session-handoff.mjs` 머리말.
 */

import {
  buildBlock,
  kstStamp,
  pickNextAndQuestions,
  readState,
  readStdinJson,
  readTranscriptTail,
  scanTranscript,
  upsertBlock,
  writableStatusPath,
  writeFresh,
  writeState,
} from './session-handoff.mjs'

try {
  const input = readStdinJson()
  const sessionId = input.session_id
  if (sessionId) {
    const state = readState(sessionId)
    const scan = scanTranscript(readTranscriptTail(input.transcript_path))
    const { next, questions } = pickNextAndQuestions(scan.lastAssistant, scan.todos)
    const doing = state.prompt || scan.lastUser
    const block = buildBlock({
      sessionId,
      title: state.title,
      trigger: input.trigger,
      when: kstStamp(),
      doing: doing ? `마지막 요청 — ${doing}` : '',
      next,
      questions,
    })
    writeState(sessionId, { handoff: block })
    const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
    const path = writableStatusPath(root)
    if (path) writeFresh(path, (text) => upsertBlock(text, block, sessionId, state.title))
  }
} catch {
  // 무슨 일이 있어도 압축을 막지 않는다
}
process.exit(0)
