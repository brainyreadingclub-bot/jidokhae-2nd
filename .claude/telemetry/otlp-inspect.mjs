/**
 * OTLP 수집기(최소판) — Claude Code가 정말로 무엇을 보내는지 눈으로 확인하는 도구.
 *
 * 왜 이걸 먼저 만드나
 *   조사 결과 Claude Code에 OpenTelemetry가 내장돼 있고, 문서상 **서브에이전트 span이
 *   부모 span 밑에 중첩**된다. 사실이라면 우리가 만들려던 "부서 관제 화면"의 절반이
 *   설정 세 줄로 끝난다.
 *
 *   다만 켜기 전에 확인해야 할 것이 둘이다.
 *     1. 우리 부서 이름(engineering·design·product·librarian)이 span에 실리는가?
 *        문서에 사용자 정의 에이전트는 "custom"으로 뭉개진다는 서술이 있다.
 *        뭉개지면 간트가 이름 없는 막대 더미가 되어 쓸모가 없다.
 *     2. 대화형 CLI에서도 트레이스가 나오는가? (우리는 `claude -p`를 안 쓴다)
 *
 *   Jaeger를 띄워도 알 수 있지만 도커가 필요하다. 이건 의존성 0으로 **원본 그대로**
 *   본다. 판단이 끝나면 이 파일은 지워도 된다.
 *
 * 쓰는 법
 *   1) node .claude/telemetry/otlp-inspect.mjs        ← 이 창은 켜둔 채로
 *   2) .claude/settings.local.json 에 env 추가 (README 참조)
 *   3) Claude Code를 완전히 껐다 켠다  ← 재시작해야 env가 먹는다
 *   4) 부서를 2~3개 소환한다
 *   5) 이 창의 출력과 .claude/telemetry/spans.jsonl 을 본다
 *
 * 주의
 *   받은 것을 그대로 파일에 적는다. 프롬프트 본문이 속성에 실려 있으면 그것도 적힌다.
 *   확인이 끝나면 spans.jsonl 을 지운다(.gitignore 처리돼 있다).
 */

import { createServer } from 'node:http'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'spans.jsonl')
const PORT = Number(process.env.PORT || 4318)

mkdirSync(HERE, { recursive: true })

/** 우리가 답을 찾고 있는 속성들 — 보이면 강조해서 출력한다 */
const WATCH = [
  'agent.name', 'agent.type', 'agent_id', 'parent_agent_id',
  'query_source', 'tool_name', 'session.id', 'duration_ms', 'success',
]

const seenSpanNames = new Map()
const seenAgentNames = new Map()
let spanCount = 0

/** OTLP/JSON 한 덩어리에서 span을 평평하게 꺼낸다 */
function flattenSpans(body) {
  const out = []
  for (const rs of body.resourceSpans || []) {
    const resAttrs = kv(rs.resource?.attributes)
    for (const ss of rs.scopeSpans || []) {
      for (const span of ss.spans || []) {
        out.push({
          name: span.name,
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId || null,
          startTimeUnixNano: span.startTimeUnixNano,
          endTimeUnixNano: span.endTimeUnixNano,
          attributes: { ...resAttrs, ...kv(span.attributes) },
        })
      }
    }
  }
  return out
}

/** OTLP 속성 배열 → 평범한 객체 */
function kv(attrs) {
  const o = {}
  for (const a of attrs || []) {
    const v = a.value || {}
    o[a.key] =
      v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue ??
      (v.arrayValue ? (v.arrayValue.values || []).map((x) => x.stringValue ?? x.intValue) : undefined)
  }
  return o
}

function report(spans) {
  for (const s of spans) {
    spanCount++
    seenSpanNames.set(s.name, (seenSpanNames.get(s.name) || 0) + 1)

    const a = s.attributes
    const agentName = a['agent.name'] ?? a['agent_type'] ?? a['agent.type']
    if (agentName !== undefined) {
      seenAgentNames.set(String(agentName), (seenAgentNames.get(String(agentName)) || 0) + 1)
    }

    const watched = WATCH.filter((k) => a[k] !== undefined).map((k) => `${k}=${a[k]}`)
    const dur =
      s.endTimeUnixNano && s.startTimeUnixNano
        ? `${Math.round((Number(s.endTimeUnixNano) - Number(s.startTimeUnixNano)) / 1e6)}ms`
        : '진행중'
    const nest = s.parentSpanId ? '  └─ ' : '● '
    console.log(`${nest}${s.name}  [${dur}]  ${watched.join('  ')}`)
  }
  appendFileSync(OUT, spans.map((s) => JSON.stringify(s)).join('\n') + '\n', 'utf8')
}

function summary() {
  console.log('\n────────── 지금까지 받은 것 ──────────')
  console.log(`span ${spanCount}개`)
  console.log('span 이름별:', [...seenSpanNames].map(([k, v]) => `${k}×${v}`).join(', ') || '(없음)')
  console.log(
    '에이전트 이름별:',
    [...seenAgentNames].map(([k, v]) => `${k}×${v}`).join(', ') || '(없음 — 이게 문제의 핵심이다)',
  )
  console.log(`전문: ${OUT}`)
  console.log('──────────────────────────────────────\n')
}

createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    return res.end('OTLP inspect 살아 있음. POST /v1/traces 를 기다린다.\n')
  }
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8')
    try {
      const body = JSON.parse(raw)
      const spans = flattenSpans(body)
      if (spans.length) report(spans)
      else console.log(`(span 없는 payload: ${req.url})`)
    } catch {
      // protobuf로 오면 JSON 파싱이 깨진다 — 그것도 정보다
      console.log(
        `⚠️  JSON이 아닌 payload ${raw.length}바이트 (${req.url}).\n` +
          `    settings.local.json 에 OTEL_EXPORTER_OTLP_PROTOCOL="http/json" 이 들어갔는지 확인하세요.`,
      )
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
  })
}).listen(PORT, () => {
  console.log(`OTLP 수집기 http://localhost:${PORT} 대기 중`)
  console.log('찾고 있는 것 — 부서 이름이 span에 실리는가, 서브에이전트 span이 중첩되는가\n')
})

process.on('SIGINT', () => {
  summary()
  process.exit(0)
})
setInterval(summary, 30_000).unref?.()
