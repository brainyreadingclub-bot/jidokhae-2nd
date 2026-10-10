/**
 * 발제 입력 정리·저장 실패 분류 — 운영자 API(api/admin/topics)와 발제자 링크 API(api/presenter)가 함께 쓴다.
 */

export const MAX_TOPIC_TITLE = 200
export const MAX_TOPIC_TEXT = 2000

export type TopicInput = {
  title: string
  quote: string | null
  quote_page: string | null
  question: string
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function optStr(v: unknown): string | null {
  const s = str(v)
  return s === '' ? null : s
}

/** 입력 정리. 제목·질문은 필수. 길이를 넘으면 null */
export function normalizeTopicInput(raw: unknown): TopicInput | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const t: TopicInput = {
    title: str(r.title),
    quote: optStr(r.quote),
    quote_page: optStr(r.quote_page),
    question: str(r.question),
  }
  if (t.title === '' || t.question === '') return null
  if (
    t.title.length > MAX_TOPIC_TITLE ||
    t.question.length > MAX_TOPIC_TEXT ||
    (t.quote?.length ?? 0) > MAX_TOPIC_TEXT ||
    (t.quote_page?.length ?? 0) > 20
  ) {
    return null
  }
  return t
}

/**
 * 조건부 저장(UPDATE … WHERE updated_at = 연 시각)이 0행으로 끝났을 때 왜인지 가른다.
 * 덮어쓰지 않으려고 updated_at을 조건에 건다(대표님 6번) — 0행이면 아래 중 하나다.
 *   deleted   그새 지워짐
 *   published 그새 공개됨 (발제자 링크로는 공개된 발제를 고칠 수 없다 — 9번)
 *   not_mine  다른 기기가 쓴 발제 (발제자 링크 — 7번)
 *   conflict  그새 다른 곳에서 고침 → 「새로 불러올까요?」
 */
export type SaveFailure = 'deleted' | 'published' | 'not_mine' | 'conflict'

export function classifySaveFailure(
  row: { published_at: string | null; updated_at: string; mine?: boolean } | null,
  opts: { forbidPublished: boolean },
): SaveFailure {
  if (!row) return 'deleted'
  if (opts.forbidPublished && row.published_at !== null) return 'published'
  if (row.mine === false) return 'not_mine'
  return 'conflict'
}

/** 저장 실패 이유 한 줄 (발제자·운영자 화면 공용) */
export const SAVE_FAILURE_MESSAGE: Record<SaveFailure, string> = {
  deleted: '그새 이 발제가 지워졌어요',
  published: '그새 공개된 발제라 여기서는 고칠 수 없어요 — 운영자에게 말해 주세요',
  not_mine: '다른 기기에서 쓴 발제라 고칠 수 없어요 — 운영자에게 말해 주세요',
  conflict: '그새 다른 곳에서 고쳤어요',
}
