/**
 * 카톡 발제문 붙여넣기 → 발제 여러 개로 나누기 (순수 함수, 2026-10-09 시안 B).
 *
 * 규칙 (시안 `B-발제문관리.html`의 안내 문구와 같은 말이다 — 하나를 고치면 둘 다 고친다)
 *   - 번호로 시작하는 줄에서 발제가 나뉜다 — `1.` · `1)` · `①` · `발제 1`
 *   - 번호 뒤 글은 제목. 번호 줄이 번호뿐이면 다음 일반 줄이 제목
 *   - 따옴표(" “ ” ' ‘ ’) · 「 」 · 『 』로 감싼 줄은 인용문
 *   - p.289 · 289쪽 · 289p는 쪽수로 옮긴다 (인용문 뒤에 붙었거나, 그 줄에 쪽수만 있을 때)
 *   - 나머지는 모두 질문 — 버리는 줄은 없다.
 *     「마지막 물음표 문장 = 질문」으로 자르면 실제 발제문이 깨진다: 물음표 문장이 두 개인 발제,
 *     물음표 뒤에 「…나눠봐요.」가 이어지는 발제가 실제로 있다 (2026-08-14 원문)
 *   - 첫 번호 줄보다 앞의 줄(「📚 10/27 토론모임 발제문」 같은 머리말)은 발제에 넣지 않고
 *     `ignored`로 돌려준다 — 화면이 「넣지 않았어요」라고 알려준다
 *
 * 번호는 여기서 매기지 않는다. 붙여넣은 글의 번호는 순서로만 쓰고,
 * 실제 번호는 서버가 그 모임의 기존 발제 뒤로 이어 붙인다 (api/admin/topics POST).
 */

export type ParsedTopic = {
  title: string
  quote: string | null
  quote_page: string | null
  question: string
}

export type PasteResult = {
  topics: ParsedTopic[]
  /** 첫 번호 줄 앞에 있어 발제에 넣지 않은 줄 (빈 줄 제외) */
  ignored: string[]
}

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'

/** 번호 줄이면 번호 뒤 글(제목 후보)을, 아니면 null */
export function matchNumberLine(line: string): string | null {
  const t = line.trim()
  // 발제 1 · 발제1. · 발제 1:
  const m1 = t.match(/^발제\s*\d{1,2}\s*[.):]?\s*(.*)$/)
  if (m1) return m1[1].trim()
  // 1. · 1) — 뒤에 숫자가 바로 오면(1.5배) 번호가 아니다
  const m2 = t.match(/^\d{1,2}\s*[.)](?!\d)\s*(.*)$/)
  if (m2) return m2[1].trim()
  // ① ~ ⑳
  if (t.length > 0 && CIRCLED.includes(t[0])) return t.slice(1).trim()
  return null
}

const PAGE_RE =
  /^\(?\s*(?:pp?\.?\s*(\d{1,4}(?:\s*[-~]\s*\d{1,4})?)|(\d{1,4}(?:\s*[-~]\s*\d{1,4})?)\s*(?:쪽|페이지|p\.?))\s*\)?$/i

/** 문자열 전체가 쪽수 표기면 숫자 부분(「289」·「12-13」)을, 아니면 null */
export function matchPage(s: string): string | null {
  const m = s.trim().match(PAGE_RE)
  if (!m) return null
  return (m[1] ?? m[2]).replace(/\s+/g, '')
}

const QUOTE_PAIRS: Record<string, string[]> = {
  '"': ['"', '”'],
  '“': ['”', '"'],
  '”': ['”', '"'],
  "'": ["'", '’'],
  '‘': ['’', "'"],
  '「': ['」'],
  '『': ['』'],
}

/**
 * 인용문 줄이면 { text, page }. 따옴표로 시작해 닫히고, 닫힌 뒤에는 쪽수만 있거나 아무것도 없어야 한다.
 * 닫힌 뒤에 다른 글이 있으면(「"…"라는 문장, 어떻게 보셨나요?」) 인용문 줄이 아니라 질문이다.
 */
export function matchQuoteLine(line: string): { text: string; page: string | null } | null {
  const t = line.trim()
  const closers = QUOTE_PAIRS[t[0]]
  if (!closers) return null
  let close = -1
  for (const c of closers) close = Math.max(close, t.lastIndexOf(c))
  if (close <= 0) return null
  const text = t.slice(1, close).trim()
  if (!text) return null
  const rest = t.slice(close + 1).trim()
  if (rest === '') return { text, page: null }
  const page = matchPage(rest)
  return page ? { text, page } : null
}

export function splitPastedTopics(raw: string): PasteResult {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  const ignored: string[] = []
  const topics: ParsedTopic[] = []

  type Draft = { title: string; quotes: string[]; page: string | null; questions: string[] }
  let cur: Draft | null = null

  const flush = () => {
    if (!cur) return
    topics.push({
      title: cur.title,
      quote: cur.quotes.length > 0 ? cur.quotes.join(' ') : null,
      quote_page: cur.page,
      question: cur.questions.join(' '),
    })
  }

  for (const line of lines) {
    const t = line.trim()
    if (!t) continue

    const titleAfterNo = matchNumberLine(t)
    if (titleAfterNo !== null) {
      flush()
      cur = { title: titleAfterNo, quotes: [], page: null, questions: [] }
      continue
    }
    if (!cur) {
      ignored.push(t)
      continue
    }

    const q = matchQuoteLine(t)
    if (q) {
      cur.quotes.push(q.text)
      if (q.page && !cur.page) cur.page = q.page
      continue
    }
    const pageOnly = matchPage(t)
    if (pageOnly && !cur.page) {
      cur.page = pageOnly
      continue
    }
    if (!cur.title) {
      cur.title = t
      continue
    }
    cur.questions.push(t)
  }
  flush()

  return { topics, ignored }
}

/** 공개하려면 채워야 하는 칸이 비었나 — 제목·질문 (인용문·쪽수는 선택) */
export function isTopicIncomplete(t: { title: string; question: string }): boolean {
  return t.title.trim() === '' || t.question.trim() === ''
}
