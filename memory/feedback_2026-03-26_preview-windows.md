# 교훈: Windows 환경에서 preview_start 도구 사용 시 cmd 래퍼 필요

**날짜:** 2026-03-26
**상황:** `.claude/launch.json`에서 `npx.cmd`로 직접 실행 시 `spawn EINVAL` 에러. `cmd /c npx next dev`로 래핑해야 동작.

**규칙:**
- Windows에서 preview_start 사용 시: `"runtimeExecutable": "cmd"`, `"runtimeArgs": ["/c", "npx", "next", "dev", "--port", "3001"]` 형태
- 포트 충돌 시: `netstat -ano | grep :PORT | grep LISTEN`으로 PID 찾고 `taskkill //PID N //F`
- preview 도구가 서버 유지에 실패할 수 있음 → 백업으로 `Bash` background 실행 + Chrome MCP 확인
