/**
 * UserPromptSubmit 훅 — 세션 이름(session_title)과 마지막 요청(prompt)을 임시 상태 파일에 남긴다.
 *
 * PreCompact 입력에는 세션 이름이 오지 않는다. 공식 문서상 session_title은 SessionStart와
 * UserPromptSubmit 입력에만 온다(https://code.claude.com/docs/en/hooks). 그래서 여기서 받아 두고
 * 압축 직전 훅(`save-handoff.mjs`)이 읽는다. 아무것도 출력하지 않는다 — 대화를 막지 않는다.
 */

import { readStdinJson, rememberSession } from './session-handoff.mjs'

try {
  rememberSession(readStdinJson())
} catch {}
process.exit(0)
