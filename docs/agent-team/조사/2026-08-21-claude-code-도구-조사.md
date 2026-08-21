# Claude Code 시각화·대시보드 도구 조사

- 조사일: 2026-08-21
- 목적: 우리가 직접 만들기 전에 **가져다 쓸 것이 있는지** 확인
- 방법: GitHub API(`gh api`)로 저장소 실존·별·최근 푸시·라이선스를 **직접 조회**, 공식 문서 원문 확인, 로컬 로그 구조 직접 확인
- 설치·실행은 하지 않음 (문서 조사만)

---

## 0. 한 줄 결론

**우리가 원하는 것 — 도구 호출 타임라인 + 서브에이전트 병렬 동시성 — 을 전사 로그에서 그려주는, 관리되고 있고 Windows에서 도는 도구는 없다.**
가장 근접한 것(`anaypaul/claude-session-visualizer`)은 별 1개이고, 가장 성숙한 것들(`patoles/agent-flow`, `simple10/agents-observe`)은 훅 기반 + POSIX 셸 전제라 Windows에서 그대로 쓰기 어렵다.
**다만 우리 기계의 로그에는 필요한 데이터가 이미 전부 있다** (§4). 만들 값어치가 있는 부분은 §6.

---

## 1. 후보 표

숫자는 2026-08-21 `gh api`로 조회한 실제 값이다. "쓸모"는 *도구 호출 타임라인 + 서브에이전트 병렬 시각화* 기준.

### 1-A. 서브에이전트/에이전트 실행을 다루는 것 (핵심군)

| 이름 | 링크 | 무엇을 보여주나 | 별 / 최근 푸시 | 데이터 출처 | Windows | 라이선스 | 우리에게 쓸모 |
|---|---|---|---|---|---|---|---|
| **agent-flow** | [patoles/agent-flow](https://github.com/patoles/agent-flow) | 라이브 에이전트 노드 그래프(도구 호출·분기·반환), 타임라인/전사 패널 | **1593** / 2026-07-11 | Claude는 **훅**(HTTP 훅 서버). JSONL 직독은 Codex 경로만 | 명시 없음 | Apache-2.0 | 이 분야 최다 별. 그러나 Claude 경로가 훅 기반 → 사후 재생 불가, 우리 과거 로그 못 읽음 |
| **claude-code-hooks-multi-agent-observability** | [disler/…](https://github.com/disler/claude-code-hooks-multi-agent-observability) | 다중 에이전트 훅 이벤트 관측 | 1523 / **2026-02-08** | 훅 | 명시 없음 | **없음** | 6개월 정체 + **라이선스 없음 → 재사용 근거 없음**. 제외 |
| **Claude-Code-Agent-Monitor** | [hoangsonww/…](https://github.com/hoangsonww/Claude-Code-Agent-Monitor) | 에이전트 모니터 | 933 / **2026-08-20** | 확인 필요 | 확인 필요 | MIT | 활발히 관리 중. **세부 미확인 — 후속 확인 대상** |
| **agents-observe** | [simple10/agents-observe](https://github.com/simple10/agents-observe) | 라이브 이벤트 스트림, **에이전트 계층(누가 누구를 낳았나)**, 에이전트별 레인 타임라인(`agent-lane.tsx`), 세션 토큰·비용 | 652 / 2026-07-22 | **훅 9종(SubagentStop 포함) + 전사 JSONL 병행**. `isSidechain`·`subagents/agent-*.jsonl` 파싱 | **언급 없음.** Docker+Node+**Bash 필수**, 훅이 `hook.sh`, `brew install just` | MIT | 설계는 우리가 원하는 것에 가장 가깝다. **Windows 전제가 안 맞음** → 참고용 |
| **repowire** | [prassanna-ravishankar/repowire](https://github.com/prassanna-ravishankar/repowire) | 크로스런타임 에이전트 메시 + 라이브 트리 | 253 / 2026-08-19 | 확인 필요 | 확인 필요 | **없음** | 저자 본인이 이슈 #24537에서 "에이전트별 토큰·비용 계량과 과거 재생이 없다"고 인정. 라이선스 없음 |
| **claude-session-dashboard** | [dlupiak/…](https://github.com/dlupiak/claude-session-dashboard) | **에이전트 위임 타임라인(간트풍)** — 어떤 서브에이전트가 순서대로 얼마나 걸렸나 + 토큰, 컨텍스트 창 시각화, 잔디 히트맵, 토큰 차트 | 65 / 2026-08-11 | **`~/.claude/projects/*.jsonl` 직독. 훅 불필요, 읽기 전용** | **언급 없음** (Node 18+, `npx claude-session-dashboard`) | MIT | **가장 현실적인 즉시 후보.** 단 타임라인이 "in sequence" — **병렬 동시성은 안 그림**. 도구 호출 단위 없음("tool call"이라는 말이 README에 없음) |
| **claude-workflow-viz** | [democra-ai/…](https://github.com/democra-ai/claude-workflow-viz) | **간트 타임라인 + 동시성 곡선 + 배리어 + fan-out→reduce DAG**, 리플레이 스크러버 | 10 / 2026-06-03 | `~/.claude/projects/<slug>/<session>/**workflows/wf_*.json**` | **"macOS, Linux, Windows에서 동작" 명시** | MIT | 그림은 정확히 우리가 원하는 것. **그러나 우리 기계에 `workflows/` 디렉토리가 없다(§4) → 읽을 게 없음** |
| **claude-session-visualizer** | [anaypaul/…](https://github.com/anaypaul/claude-session-visualizer) | React Flow 그래프 — **에이전트 노드(메인+모든 서브에이전트) + 도구 호출 노드(모든 도구 호출이 색상별 자식 노드)**, 대화 타임라인 | **1** / 2026-03-31 | **`<session>.jsonl` + `<session>/subagents/agent-*.jsonl` 직독** | 확인 필요 | MIT | **구조상 가장 정확한 접근.** 별 1개·5개월 정체 → 그대로 의존 불가, **참고 설계로는 최상** |
| **context-analyzer** | [manavgup/context-analyzer](https://github.com/manavgup/context-analyzer) | 컨텍스트 포렌식 | 13 / 2026-07-21 | 훅+SQLite (SubagentStart/Stop) | 확인 필요 | MIT | 목적이 다름 |

### 1-B. 전사 뷰어 (에이전트 시각화 아님)

| 이름 | 링크 | 무엇을 보여주나 | 별 / 최근 푸시 | Windows | 라이선스 | 우리에게 쓸모 |
|---|---|---|---|---|---|---|
| **claude-code-log** | [daaain/…](https://github.com/daaain/claude-code-log) | JSONL → HTML/Markdown, TUI, 메시지 타입 필터, **"확대 가능한 메시지 시각 타임라인"**, 세션별 토큰 | 1198 / 2026-07-31 | 프로젝트 자체는 명시 없음 | MIT | 읽기 좋은 전사. **`isSidechain`·서브에이전트 렌더링 언급 없음.** 간트·도구 단위 타임라인 없음 |
| **claude-code-viewer** | [d-kimuson/…](https://github.com/d-kimuson/claude-code-viewer) | 전체 웹 클라이언트 | 1274 / 2026-08-18 | 확인 필요 | MIT | 타임라인 분석기가 아님 |
| **claude-code-transcripts** | [simonw/…](https://github.com/simonw/claude-code-transcripts) | 세션 → 모바일 친화 HTML, 페이지네이션 | 1670 / **2026-02-12** | 확인 필요 | Apache-2.0 | 전사 공개용. 시각화 없음 |
| **tail-claude** | [kylesnowschwartz/tail-claude](https://github.com/kylesnowschwartz/tail-claude) | Go/Bubble Tea TUI, 파서에 `isSidechain` 필드 존재 | 153 / 2026-08-18 | 확인 필요 | MIT | Go 단일 바이너리 → Windows 가능성 높음. **파싱 참고 가치** |
| **claude-notes** | [vtemian/claude-notes](https://github.com/vtemian/claude-notes) | 전사 → 터미널/HTML | 105 / 2026-02-10 | 확인 필요 | MIT | 시각화 없음 |
| **claude-code-ui** | [KyleAMathews/…](https://github.com/KyleAMathews/claude-code-ui) | 세션 추적 UI | 413 / **2026-01-09** | 확인 필요 | **없음** | 7개월 정체 + 라이선스 없음 |
| claude-log-viewer | [InDate/…](https://github.com/InDate/claude-log-viewer) | 로컬 웹 앱 | 7 / 2025-12-09 | 확인 필요 | MIT | 정체 |
| claude-transcript-viewer | [varunr89/…](https://github.com/varunr89/claude-transcript-viewer) | 전문 검색 뷰어 | 1 / 2026-01-25 | 확인 필요 | 없음 | 정체 |
| claude-code-viewer(업로드) | [philipp-spiess/…](https://github.com/philipp-spiess/claude-code-viewer) | 전사를 **웹에 업로드** | 20 / 2025-05-26 | 확인 필요 | 없음 | 외부 업로드 → 부적합 |

### 1-C. 토큰·비용 전용 (우리 목적과 직교)

| 이름 | 링크 | 무엇을 | 별 / 최근 푸시 | 라이선스 | 우리에게 쓸모 |
|---|---|---|---|---|---|
| **ccusage** | [ccusage/ccusage](https://github.com/ccusage/ccusage) | 일/주/월/세션 토큰·비용 리포트, 5시간 블록, statusline. 16개 에이전트 CLI 지원 | **18084** / 2026-08-21 | MIT | 이 분야 표준. **서브에이전트·도구·타임라인 차원이 전혀 없음** — 비용만 볼 때 쓰면 됨 |
| claude-code-metrics-stack | [acreeger/…](https://github.com/acreeger/claude-code-metrics-stack) | OTel→Prometheus/Loki/**Grafana** 로컬 스택 | 11 / **2025-12-12** | **없음** | 8개월 정체 + 라이선스 없음. 다만 "OTel→Grafana" 조립법 참고 |
| claude-code-usage-analyzer | [aarora79/…](https://github.com/aarora79/claude-code-usage-analyzer) | ccusage+LiteLLM 비용 분석 | 5 / 2026-08-02 | MIT | 비용 전용 |
| tokenking | [dreamiurg/tokenking](https://github.com/dreamiurg/tokenking) | 프로젝트별 토큰 | 0 / 2025-11-07 | MIT | 정체 |
| cctrace | [thevibeworks/cctrace](https://github.com/thevibeworks/cctrace) | **TLS 가로채기** 와이어 캡처, 세션 리플레이, 턴별 비용·캐시·지연 | 8 / 2026-08-19 | MIT | 접근법이 과함(TLS MITM). 참고만 |

---

## 2. 공식 기능 — OpenTelemetry (있다, 그리고 서브에이전트 단위가 나온다)

출처: [code.claude.com/docs/en/monitoring-usage](https://code.claude.com/docs/en/monitoring-usage) (원문 확인)

### 켜는 법
```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp      # otlp | prometheus | console | none
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

### 분산 추적(스팬) — **베타로 존재한다**
```bash
export CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1
export OTEL_TRACES_EXPORTER=otlp
```

스팬 계층:
```
claude_code.interaction (루트)
├── claude_code.llm_request
├── claude_code.hook          (ENABLE_BETA_TRACING_DETAILED=1 필요)
└── claude_code.tool
    ├── claude_code.tool.blocked_on_user
    └── claude_code.tool.execution
```

### 서브에이전트 단위가 나오는가 — **나온다**
- 이벤트 속성: `agent_id`, `parent_agent_id`, `workflow.run_id`, `workflow.name`
- `query_source`: `"main"` / `"subagent"` / `"auxiliary"`
- `agent.name`, `skill.name`, `plugin.name` (`claude_code.api_request`)
- 트레이스에서 서브에이전트 스팬이 부모 밑에 중첩됨
- 모든 이벤트가 `prompt.id`를 공유 → 한 프롬프트에서 파생된 전체 작업을 묶을 수 있음

### 주요 지표·이벤트 (이름 그대로)
- 지표: `claude_code.session.count`, `claude_code.token.usage`, `claude_code.cost.usage`, `claude_code.lines_of_code.count`, `claude_code.active_time.total`, `claude_code.code_edit_tool.decision`, `claude_code.commit.count`, `claude_code.pull_request.count`
- 이벤트: `claude_code.tool_result`(`tool_name`, `tool_use_id`, `success`, `duration_ms`, `error_type`), `claude_code.tool_decision`, `claude_code.api_request`, `claude_code.user_prompt`, `claude_code.assistant_response`, `claude_code.api_error`, `claude_code.mcp_server_connection` 외

### 판단
OTel 경로는 **공식이고, 도구 지속시간과 서브에이전트 부모-자식을 모두 준다.** 다만 (1) 베타 플래그가 필요하고, (2) OTLP 수집기 + Grafana/Jaeger 같은 백엔드를 세워야 하고, (3) **켠 이후의 세션만** 잡힌다 — **이미 쌓인 과거 로그는 못 본다**. 즉 "지난 세션에서 부서들이 어떻게 돌았나"는 OTel로 답할 수 없다.

---

## 3. 서브에이전트 시각화 — 무엇이 있고 무엇이 함정인가

- **`claude-workflow-viz`** 만이 "간트 + 동시성 곡선 + 배리어"를 명시적으로 그린다. **함정: 데이터 출처가 전사 JSONL이 아니라 `workflows/wf_*.json`이다.** 우리 기계에는 이 디렉토리가 **없다**(§4 확인). Claude Code의 동적 워크플로(`parallel()`) 기능을 쓴 세션에만 생기는 것으로 보이며, 없을 때 어떻게 되는지는 README에 안 적혀 있다.
- **`claude-session-dashboard`** 는 전사 JSONL을 직독하고 "위임 타임라인(간트풍)"을 그리지만 README가 **"in sequence"** 라고 쓴다. "parallel"·"concurrency"라는 단어가 없다. **병렬 동시성은 안 그린다.**
- **`agents-observe`** 는 에이전트별 레인 타임라인(코드에 `agent-lane.tsx` 존재)과 부모→자식 계층을 실제로 다루는 유일한 성숙 도구지만, **Docker + Bash + `brew install just`** 전제이고 Windows 언급이 전혀 없다.
- **`claude-session-visualizer`** 는 `subagents/agent-*.jsonl`까지 직독해 **도구 호출 하나하나를 에이전트 노드의 자식 노드로** 그린다. 구조가 정확하다. 별 1개.

### 함정: mcpmarket의 "Visualizing Subagents 스킬"은 도구가 아니다
[mcpmarket 페이지](https://mcpmarket.com/tools/skills/visualizing-subagents)로 검색에 잡히지만, 실체는
[warrenzhu050413/warren-claude-code-plugin-marketplace](https://github.com/warrenzhu050413/warren-claude-code-plugin-marketplace) 안의
`claude-context-orchestrator/snippets/local/output-formats/visualizing-subagents/SKILL.md` — **약 3KB짜리 Markdown 한 장, 코드·파서 없음.**
모델이 *자기 계획을 보고* ASCII 트리를 그리고, 끝나면 *자기 컨텍스트를 보고* HTML을 만든다. **전사 JSONL을 읽지 않으므로 실제 타임스탬프가 없고, 진짜 병렬성·측정된 소요시간을 낼 수 없다.**
별 7개, 라이선스 없음, 해당 파일은 2025-12-03 이후 실질 갱신 없음. **가져다 쓸 것 아님.**

### Anthropic이 직접 만들 것인가 — 현재로선 아니다
[anthropics/claude-code#24537](https://github.com/anthropics/claude-code/issues/24537) "Agent Hierarchy Dashboard" — `gh api`로 직접 확인:

- 상태 **open**, 생성 2026-02-09, 최종 갱신 2026-08-15
- 👍 **17**, 댓글 **16**
- **댓글 16개 전원 `author_association: NONE`** → **Anthropic 직원 응답 0건**

요청 내용: 에이전트 트리(누가 누구를 낳았나), 에이전트별 토큰·비용·컨텍스트, 실시간 진행, **과거 재생**. 20여 개 파편 이슈를 통합한 것(#7881 "SubagentStop이 어느 서브에이전트인지 식별 못 함" 19표, #14859, #22625 등).
6개월 넘게 공식 반응이 없다. **네이티브로 나오길 기다릴 근거가 없다.**

---

## 4. 우리 기계에서 직접 확인한 사실 (중요)

`C:\Users\ytyt8\.claude\projects\C--jidokhae-2nd\` 실측:

```
<세션UUID>.jsonl                       ← 메인 전사 (9개)
<세션UUID>/subagents/
    agent-<agentId>.jsonl              ← 서브에이전트별 전사
    agent-<agentId>.meta.json          ← 메타
workflows/                             ← 없음 ❌
```

**`.meta.json` 실제 내용** (이번 세션 것, 원문):
```json
{"agentType":"general-purpose","description":"디자인 — VOICE·토큰 정합","name":"design",
 "toolUseId":"toolu_01FetDoJth45mUupT5v1kpsc","spawnDepth":1}
{"agentType":"general-purpose","description":"Read agents-observe + claude-watch",
 "toolUseId":"toolu_014o4FX3WNLUS2661gyma5ui","parentAgentId":"a8945225b999ed2d8","spawnDepth":2}
```

**`agent-*.jsonl` 한 줄의 키:**
```
agentId, parentUuid, promptId, sessionId, timestamp, type, uuid,
isSidechain, cwd, gitBranch, entrypoint, message, userType, version
```

### 이게 왜 결정적인가

1. **이슈 #24537이 지목한 상류 병목("훅 페이로드에 안정적인 `agent_id`가 없다")이 전사 파일 경로에는 적용되지 않는다.** `meta.json`에 `parentAgentId` + `spawnDepth`가 그대로 있다 — 부모→자식 트리를 **추정이 아니라 그대로** 복원할 수 있다.
2. **우리 부서 이름이 `name` 필드에 그대로 박혀 있다** (`design`, `librarian`, `engineering2`…). 부서 단위 집계가 공짜다.
3. 이번 세션 한 디렉토리에만 서브에이전트 **14개**(파일 28개)가 쌓여 있다.
4. `timestamp` + `agentId`만 있으면 **동시성 곡선을 계산할 수 있다.** 데이터는 이미 있고, 아무도 그려주지 않을 뿐이다.
5. **`workflows/`가 없으므로 `claude-workflow-viz`는 우리 로그로는 아무것도 못 그린다.** 별 10개짜리를 시험해 보기 전에 이걸 알아둘 것.

---

## 5. 결론 — 세 칸

### 🟢 그대로 쓸 수 있는 것

| 도구 | 무엇에 | 조건 |
|---|---|---|
| **[ccusage](https://github.com/ccusage/ccusage)** (18k★, MIT, 어제 푸시) | 토큰·비용만 즉시 확인. `npx ccusage@latest` | 서브에이전트·도구 차원 없음. 목적이 다르다는 걸 알고 쓸 것 |
| **[claude-session-dashboard](https://github.com/dlupiak/claude-session-dashboard)** (65★, MIT) | 서브에이전트 위임 순서·소요·토큰을 **당장** 보고 싶을 때. `npx claude-session-dashboard`, 전사 직독, 훅 불필요, 읽기 전용·로컬 전용 | **Windows 명시 없음 → 실제로 도는지 확인 필요.** Node 18+. 병렬 동시성·도구 단위는 안 나옴 |
| **[claude-code-log](https://github.com/daaain/claude-code-log)** (1198★, MIT) | 세션 전사를 사람이 읽는 HTML로. `uvx claude-code-log@latest` | 시각화 아님. 서브에이전트 렌더링 미보장 |
| **공식 OTel** | 앞으로의 세션을 제대로 계측하려면 | 베타 플래그 + 수집기 구축 필요, **과거 로그 불가** |

### 🟡 참고만 할 것 (설계를 베끼되 의존하지 않는다)

| 도구 | 배울 점 |
|---|---|
| **[claude-session-visualizer](https://github.com/anaypaul/claude-session-visualizer)** (1★, MIT) | **데이터 모델이 정답에 가장 가깝다** — 메인 JSONL + `subagents/agent-*.jsonl`을 읽어 에이전트 노드 + 도구 호출 자식 노드로 그림. 별 1개라 의존 불가, 구조는 그대로 참고 |
| **[agents-observe](https://github.com/simple10/agents-observe)** (652★, MIT) | 에이전트별 레인 타임라인(`agent-lane.tsx`), `isSidechain` 파싱, 훅 9종 목록(SubagentStop 포함) |
| **[claude-workflow-viz](https://github.com/democra-ai/claude-workflow-viz)** (10★, MIT) | **그림의 목표치** — 간트 + 동시성 곡선 + 배리어 마커 + 리플레이 스크러버. 우리 데이터로는 못 돌지만 "무엇을 그릴 것인가"의 기준 |
| **[agent-flow](https://github.com/patoles/agent-flow)** (1593★, Apache-2.0) | 노드 그래프 + 타임라인 패널 UI 관례 |
| **[tail-claude](https://github.com/kylesnowschwartz/tail-claude)** (153★, MIT, Go) | JSONL 파서 구현(`isSidechain` 포함). Go라 Windows 이식성 참고 |
| 블로그 — [Inside Claude Code: The Session File Format](https://databunny.medium.com/inside-claude-code-the-session-file-format-and-how-to-inspect-it-b9998e66d56b), [What I Learned Parsing Claude Code's JSONL Session Logs](https://medium.com/@ywian/what-i-learned-parsing-claude-codes-jsonl-session-logs-268248be0a2c) | **파싱 함정**: Claude Code는 응답을 스트리밍하며 줄을 쓰므로 `stop_reason` 없는 부분 엔트리가 여러 줄로 남는다 → 연속 assistant 엔트리를 하나로 병합하는 "chunk builder"가 필요하고, **토큰 스냅샷은 `stop_reason`이 있는 엔트리만 신뢰**할 것 |
| [Claude Cookbook — Building a session browser](https://platform.claude.com/cookbook/claude-agent-sdk-05-building-a-session-browser) | 공식 예제. **미확인 — 후속 확인 대상** |

### 🔴 없는 것 / 쓰지 말 것

- **전사 로그에서 "도구 호출 타임라인 + 서브에이전트 병렬 동시성"을 함께 그리는, 관리되고 Windows에서 도는 도구 — 없다.** 셋 중 둘까지만 만족하는 것들만 있다.
- **mcpmarket "Visualizing Subagents 스킬"** — 도구가 아니라 3KB 프롬프트. 타임스탬프 없음. 라이선스 없음. 사용 금지.
- **`claude-workflow-viz`를 우리 로그에 시도하는 것** — `workflows/` 디렉토리가 우리에겐 없다.
- **라이선스 없는 저장소** — `disler/…`(1523★), `KyleAMathews/claude-code-ui`(413★), `repowire`(253★), `claude-code-metrics-stack`. 별이 많아도 재사용 권리가 없다.
- **`philipp-spiess/claude-code-viewer`** — 전사를 외부 웹에 업로드. 우리 전사에는 prod 키·회원 정보 맥락이 섞이므로 부적합.
- **Anthropic 네이티브 대시보드** — 이슈 #24537 6개월째 무응답. 기다릴 근거 없음.

---

## 6. 아무도 안 만든 것 — 우리가 만들 값어치가 있는 부분

1. **부서 이름이 붙은 동시성 타임라인.**
   `meta.json`의 `name`(우리 부서명) + `agent-*.jsonl`의 `timestamp`를 합치면 "8월 21일 15:02에 design·librarian·engineering 셋이 동시에 돌았다"를 **측정값으로** 그릴 수 있다. 어떤 도구도 `meta.json`의 `name`을 라벨로 쓰지 않는다.

2. **도구 호출 단위 × 에이전트 레인의 결합.**
   `claude-session-dashboard`는 에이전트 단위까지만, `claude-code-log`는 도구를 보여주지만 레인이 없다. **레인(에이전트) × 시간축 위에 도구 호출 점을 찍은 것**은 `claude-session-visualizer`(1★)와 `agents-observe`(Windows 불가)뿐이다.

3. **`spawnDepth`를 쓴 깊이별 시각화.**
   우리 로그에 `spawnDepth: 1` / `2`가 실제로 들어 있다(관리자→부서→부서의 하청). 조사한 어떤 도구도 이 필드를 언급하지 않는다.

4. **사후 재생(post-hoc replay) + Windows + 훅 불필요, 셋 다 만족.**
   성숙한 것들은 전부 훅 기반(라이브 전용, 과거 못 봄)이거나 POSIX 전제다. 우리는 **이미 쌓인 9개 세션**을 지금 열어보고 싶은 것이고, 그건 전사 직독으로만 된다.

5. **부서 체계 자체의 지표.**
   "이번 주 어느 부서가 몇 번 소환됐고, 평균 몇 분 걸렸고, 몇 개가 병렬로 겹쳤나" — 이건 범용 도구가 만들 이유가 없는, 우리 `.claude/agents/` 구조에 특화된 질문이다.

### 만들지 말아야 할 것
토큰·비용 집계(ccusage가 18k★로 이미 표준), 전사 → 읽기 좋은 HTML(claude-code-log), 라이브 훅 스트리밍 인프라(agent-flow·agents-observe). **가져다 쓰거나 두고 오면 된다.**

---

## 7. 후속 확인 대상 (이번에 못 끝낸 것)

- `claude-session-dashboard`가 **Windows에서 실제로 도는지** — 즉시 후보 1순위인데 OS 명시가 없다
- `hoangsonww/Claude-Code-Agent-Monitor` (933★, MIT, 2026-08-20 푸시) 세부 — 활발한데 이번에 내용 미확인
- `anaypaul/claude-session-visualizer`의 Windows 지원 여부
- [Claude Cookbook — Building a session browser](https://platform.claude.com/cookbook/claude-agent-sdk-05-building-a-session-browser) 원문 — 공식 예제라 참고 가치 높음
- `workflows/` 디렉토리가 어떤 조건에서 생기는지 (동적 워크플로 기능을 우리가 쓰면 `claude-workflow-viz`가 쓸모 있어질 수도)

---

## 8. 출처

**공식**
- https://code.claude.com/docs/en/monitoring-usage (OTel 원문 확인)
- https://code.claude.com/docs/en/agents
- https://github.com/anthropics/claude-code/issues/24537 (`gh api`로 상태·반응·댓글 author_association 직접 확인)
- https://platform.claude.com/cookbook/claude-agent-sdk-05-building-a-session-browser (미확인)

**저장소** (전부 `gh api repos/…`로 실존·별·푸시·라이선스 직접 조회, 2026-08-21)
- https://github.com/ccusage/ccusage
- https://github.com/patoles/agent-flow
- https://github.com/disler/claude-code-hooks-multi-agent-observability
- https://github.com/hoangsonww/Claude-Code-Agent-Monitor
- https://github.com/d-kimuson/claude-code-viewer
- https://github.com/daaain/claude-code-log
- https://github.com/simonw/claude-code-transcripts
- https://github.com/simple10/agents-observe
- https://github.com/KyleAMathews/claude-code-ui
- https://github.com/prassanna-ravishankar/repowire
- https://github.com/kylesnowschwartz/tail-claude
- https://github.com/vtemian/claude-notes
- https://github.com/dlupiak/claude-session-dashboard
- https://github.com/NirDiamant/claude-watch
- https://github.com/manavgup/context-analyzer
- https://github.com/acreeger/claude-code-metrics-stack
- https://github.com/democra-ai/claude-workflow-viz
- https://github.com/anaypaul/claude-session-visualizer
- https://github.com/thevibeworks/cctrace
- https://github.com/InDate/claude-log-viewer
- https://github.com/varunr89/claude-transcript-viewer
- https://github.com/philipp-spiess/claude-code-viewer
- https://github.com/aarora79/claude-code-usage-analyzer
- https://github.com/dreamiurg/tokenking
- https://github.com/warrenzhu050413/warren-claude-code-plugin-marketplace (Visualizing Subagents 스킬 실소재)

**글**
- https://databunny.medium.com/inside-claude-code-the-session-file-format-and-how-to-inspect-it-b9998e66d56b
- https://medium.com/@ywian/what-i-learned-parsing-claude-codes-jsonl-session-logs-268248be0a2c
- https://kevinjmagnan.com/2026/01/21/83-days-with-claude-code.html
- https://www.augmentcode.com/guides/debug-parallel-ai-agents
- https://mcpmarket.com/tools/skills/visualizing-subagents (HTTP 429 — 직접 열지 못함, GitHub 원본으로 대조 확인)

**로컬 실측**
- `C:\Users\ytyt8\.claude\projects\C--jidokhae-2nd\` 디렉토리 구조 및 `subagents/*.meta.json` 원문 (2026-08-21)
