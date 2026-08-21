# 텔레메트리 — 켜기 전에 확인할 두 가지

> 목적: **부서 관제 화면을 직접 만들 필요가 있는지 없는지**를 몇 분 안에 판정한다.
> 근거 조사: [`docs/agent-team/조사/2026-08-21-관측도구-벤치마킹.md`](../../docs/agent-team/조사/2026-08-21-관측도구-벤치마킹.md)

---

## 무엇을 확인하려는가

조사 결과 **Claude Code에 OpenTelemetry가 내장돼 있다.** 공식 문서에 이렇게 적혀 있다 — *"서브에이전트의 span은 부모 에이전트의 `claude_code.tool` span 밑에 중첩되어, 위임 체인 전체가 하나의 트레이스로 나타난다."*

사실이라면 우리가 만들려던 것의 절반(누가 언제 몇 개 동시에 돌았나)이 **설정 세 줄**로 끝난다. 파서를 짤 이유가 없다.

**다만 그 그림이 쓸모 있으려면 두 가지가 참이어야 한다.**

| # | 확인할 것 | 거짓이면 |
|:--:|---|---|
| 1 | **우리 부서 이름이 span에 실리는가** (`engineering`·`design`·`product`·`librarian`) | 문서에 사용자 정의 에이전트는 `"custom"`으로 뭉개진다는 서술이 있다. 뭉개지면 **간트가 이름 없는 막대 더미**가 되어 쓸모가 없다 |
| 2 | **대화형 CLI에서도 트레이스가 나오는가** | 우리는 `claude -p`가 아니라 대화형으로 쓴다. 안 나오면 이 길 자체가 막힌다 |

> ⚠️ **트레이스는 베타다.** span 이름과 속성이 바뀔 수 있다. 그래서 여기에 크게 투자하기 전에 재료부터 눈으로 본다.

---

## 확인 절차 (도커 필요 없음)

### 1) 수집기를 띄운다

```bash
node .claude/telemetry/otlp-inspect.mjs
```

이 창은 **켜둔 채로** 둔다. 받은 span을 그 자리에서 출력하고 `spans.jsonl`에도 적는다.

### 2) `.claude/settings.local.json`에 `env`를 넣는다

이 파일은 gitignore 대상이라 값이 저장소에 올라가지 않는다. `permissions` 같은 기존 키는 **그대로 두고** `env`만 더한다.

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "CLAUDE_CODE_ENHANCED_TELEMETRY_BETA": "1",
    "OTEL_TRACES_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4318",
    "OTEL_METRICS_EXPORTER": "none",
    "OTEL_LOGS_EXPORTER": "none"
  }
}
```

`http/json`을 쓰는 이유 — 기본값(protobuf)으로 오면 위 수집기가 못 읽는다. 그때는 수집기가 *"JSON이 아닌 payload"*라고 알려준다.

### 3) Claude Code를 **완전히 껐다 켠다**

`/clear`로는 안 된다. 환경변수도, `.claude/agents/` 정의도 **프로세스가 뜰 때만** 읽힌다.

> 이 재시작은 어차피 해야 한다. 부서 정의 4개(`librarian`·`engineering`·`design`·`product`)가 아직 등록되지 않아 로그 강제 훅이 부서를 못 알아보고 있다.

### 4) 부서를 2~3개 동시에 소환한다

`/부서`로 짧은 일을 시키면 된다. 기본 점호가 가장 싸다.

### 5) 수집기 출력을 본다

**보고 싶은 모양:**

```
● claude_code.interaction   [12300ms]  session.id=...
  └─ claude_code.tool       [8200ms]   tool_name=Agent  agent.name=engineering
  └─ claude_code.tool       [7900ms]   tool_name=Agent  agent.name=design
```

- **부서 이름이 보이면** → 이 길로 간다. Jaeger를 띄우고 간트로 본다
- **`custom`으로 뭉개져 보이면** → 이름표를 우리가 붙여야 한다. 그 층만 만든다
- **아무것도 안 오면** → 대화형에서 트레이스가 안 나오는 것. 전사(JSONL)를 읽는 원래 계획으로 돌아간다

30초마다, 그리고 `Ctrl+C`로 끌 때 요약이 나온다.

---

## 확인이 끝나면

- `spans.jsonl`은 지운다 (gitignore 대상). 속성에 프롬프트 본문이 실려 있을 수 있다
- 이 길로 안 가기로 하면 `.claude/telemetry/` 폴더째 지워도 된다
- 이 길로 가면 `docs/agent-team/`에 결과를 남기고 Jaeger 설정을 여기에 추가한다

## 되돌리기

`settings.local.json`의 `env` 블록을 지우고 재시작하면 끝이다. 코드는 아무것도 안 바뀌었다.
