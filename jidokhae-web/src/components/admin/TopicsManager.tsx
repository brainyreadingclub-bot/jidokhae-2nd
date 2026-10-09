'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ModalOverlay from '@/components/ui/ModalOverlay'
import { splitPastedTopics, isTopicIncomplete } from '@/lib/topic-paste'
import { topicStatusLabel } from '@/lib/topic-status'
import { topicPostedTitle } from '@/lib/topic-notification'
import type { DiscussionTopic } from '@/types/discussion'

/**
 * 발제문 관리 (2026-10-09 시안 B — `docs/설계/mockups/2026-10-09-발제문-운영자상세/B-발제문관리.html`).
 * 왼쪽 붙여넣기 → 번호별로 나눠 「작성 중」으로 저장 / 오른쪽 목록(수정·삭제) /
 * 위 막대에 상태 + 회원 화면 미리보기 + 공개하기.
 * 현행 카톡 형식 그대로: 번호 · 소제목 · 인용(쪽수) · 질문.
 * 권한은 서버(API)가 검사 — 큐레이터(admin·editor·is_staff).
 */

type Props = {
  meetingId: string
  meetingTitle: string
  topics: DiscussionTopic[]
  applicantCount: number
  lastPublishedLabel: string | null
}

type SplitNotice = { count: number; ignored: string[]; ids: string[]; raw: string }


const btnLine =
  'inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] border border-surface-300 bg-white px-4 text-[13px] font-bold text-primary-700 transition-colors hover:bg-surface-100 disabled:opacity-50'
const btnPrimary =
  'inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] bg-primary-600 px-4 text-[13px] font-bold text-white transition-colors hover:bg-primary-700 disabled:bg-neutral-200 disabled:text-neutral-500'
const btnSmLine =
  'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[9px] border border-surface-300 bg-white px-3 text-xs font-bold text-primary-700 transition-colors hover:bg-surface-100 disabled:opacity-50'
const btnSmPrimary =
  'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[9px] bg-primary-600 px-3 text-xs font-bold text-white transition-colors hover:bg-primary-700 disabled:bg-neutral-200 disabled:text-neutral-500'

export default function TopicsManager({
  meetingId,
  meetingTitle,
  topics,
  applicantCount,
  lastPublishedLabel,
}: Props) {
  const router = useRouter()
  const [paste, setPaste] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<SplitNotice | null>(null)
  const [editing, setEditing] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const drafts = topics.filter((t) => t.published_at === null)
  const published = topics.filter((t) => t.published_at !== null)
  const incomplete = drafts.filter(isTopicIncomplete)
  const counts = { draft: drafts.length, published: published.length }
  const canPublish = drafts.length > 0 && incomplete.length === 0
  const nextNo = (topics.at(-1)?.topic_no ?? 0) + 1

  async function call(method: string, url: string, body: unknown) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (json.status !== 'success') throw new Error(json.message ?? '잠시 후 다시 시도해 주세요')
    return json
  }

  async function splitAndSave() {
    if (busy) return
    const { topics: parsed, ignored } = splitPastedTopics(paste)
    if (parsed.length === 0) {
      setError('번호로 시작하는 줄을 못 찾았어요 — 1. · 1) · ① · 발제 1 중 하나로 시작해 주세요')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const json = await call('POST', '/api/admin/topics', { meeting_id: meetingId, topics: parsed })
      const ids = ((json.data?.topics ?? []) as { id: string }[]).map((t) => t.id)
      setNotice({ count: ids.length, ignored, ids, raw: paste })
      setPaste('')
      setPasteOpen(false)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function undoSplit() {
    if (!notice || busy) return
    setBusy(true)
    setError(null)
    try {
      await call('DELETE', '/api/admin/topics', { ids: notice.ids })
      setPaste(notice.raw)
      setNotice(null)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteTopic(t: DiscussionTopic) {
    const msg =
      t.published_at !== null
        ? '이 발제를 삭제할까요? 회원에게 이미 보인 발제예요. 달린 답변도 함께 삭제돼요.'
        : '이 발제를 삭제할까요?'
    if (!confirm(msg)) return
    setError(null)
    try {
      await call('DELETE', '/api/admin/topics', { id: t.id })
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function publish() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await call('POST', '/api/admin/topics/publish', { meeting_id: meetingId })
      setPublishOpen(false)
      setNotice(null)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
      setPublishOpen(false)
    } finally {
      setBusy(false)
    }
  }

  function setOpen(id: string, open: boolean) {
    setEditing((prev) => {
      const next = new Set(prev)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })
  }

  // ── 상태 막대 문구 ──
  let statusNote: React.ReactNode = null
  if (incomplete.length > 0) {
    statusNote = (
      <span className="mt-0.5 block text-xs font-semibold text-accent-600">
        제목이나 질문이 빈 발제 {incomplete.length}개 — 채우면 공개할 수 있어요
      </span>
    )
  } else if (drafts.length > 0) {
    statusNote = (
      <span className="mt-0.5 block text-xs text-neutral-600">
        공개하기 전에는 회원에게 보이지 않아요
      </span>
    )
  } else if (published.length > 0 && lastPublishedLabel) {
    statusNote = (
      <span className="mt-0.5 block text-xs text-neutral-600">
        {lastPublishedLabel}에 공개했어요 · 신청자에게 알림을 보냈어요
      </span>
    )
  } else if (topics.length === 0) {
    statusNote = (
      <span className="mt-0.5 block text-xs text-neutral-600">
        붙여넣거나 하나씩 추가하면 「작성 중」으로 들어가요
      </span>
    )
  }

  const publishLabel =
    drafts.length === 0 && published.length > 0
      ? '모두 공개됨'
      : canPublish
        ? `발제 ${drafts.length}개 공개하기`
        : '공개하기'

  const pasteSection = (
    <div>
      <label htmlFor="topic-paste" className="mb-1.5 block text-xs font-bold text-neutral-800">
        카톡 발제문
      </label>
      <textarea
        id="topic-paste"
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        spellCheck={false}
        placeholder={'1. 소제목\n"인용문" (p.289)\n질문'}
        className="min-h-[220px] w-full resize-y rounded-[10px] border border-neutral-300 bg-white px-3 py-2.5 text-[13px] leading-[1.7] text-neutral-900 focus:border-primary-500 focus:outline-none lg:min-h-[420px]"
      />
      <button
        type="button"
        onClick={splitAndSave}
        disabled={busy || paste.trim() === ''}
        className={`mt-2.5 w-full ${topics.length === 0 ? btnPrimary : btnLine}`}
      >
        {busy ? '나누는 중…' : '번호별로 나누기'}
      </button>
      {/* 규칙 문구는 lib/topic-paste.ts 머리말과 같은 말이다 — 하나를 고치면 둘 다 고친다 */}
      <ul className="mt-3.5 space-y-0.5 text-xs leading-[1.75] text-neutral-700 [&>li]:relative [&>li]:pl-3 [&>li]:before:absolute [&>li]:before:left-0.5 [&>li]:before:text-neutral-500 [&>li]:before:content-['·']">
        <li>
          <b className="text-neutral-900">번호</b>로 시작하는 줄에서 발제가 나뉘어요 — 1. · 1) · ① · 발제 1
        </li>
        <li>
          번호 뒤 글은 <b className="text-neutral-900">제목</b>, 따옴표 · 「 」로 감싼 줄은{' '}
          <b className="text-neutral-900">인용문</b>
        </li>
        <li>
          p.289 · 289쪽 · 289p는 <b className="text-neutral-900">쪽수</b>로 옮겨요
        </li>
        <li>
          나머지는 모두 <b className="text-neutral-900">질문</b>에 들어가요 — 버리는 줄은 없어요
        </li>
        <li>번호는 이미 있는 발제 뒤로 이어 붙어요</li>
      </ul>
    </div>
  )

  return (
    <div>
      {/* 상태 + 공개 */}
      <div className="my-6 flex flex-col gap-3 border-y border-surface-300 py-3.5 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="min-w-0 text-sm text-neutral-700">
          <b className="font-extrabold text-neutral-900">{topicStatusLabel(counts)}</b>
          {statusNote}
        </div>
        <div className="flex flex-none gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            disabled={topics.length === 0}
            className={`flex-1 lg:flex-none ${btnLine}`}
          >
            회원 화면 미리보기
          </button>
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            disabled={!canPublish || busy}
            className={`flex-1 lg:flex-none ${btnPrimary}`}
          >
            {publishLabel}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-[10px] bg-accent-50 px-3.5 py-2.5 text-xs font-semibold text-accent-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-10">
        {/* 왼쪽: 붙여넣기 */}
        <section>
          <h2 className="mb-3 hidden text-[15px] font-extrabold tracking-tight text-neutral-900 lg:block">
            {published.length > 0 && drafts.length === 0 ? '발제 더 붙여넣기' : '한꺼번에 붙여넣기'}
          </h2>
          {/* 모바일: 발제가 있으면 접어 둔다 */}
          {topics.length > 0 && (
            <button
              type="button"
              onClick={() => setPasteOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-[var(--radius-md)] border border-surface-300 px-3.5 py-3 text-[13px] font-bold text-neutral-800 lg:hidden"
              aria-expanded={pasteOpen}
            >
              한꺼번에 붙여넣기
              <span className="text-xs font-medium text-neutral-600">
                {pasteOpen ? '닫기 ▴' : '열기 ▾'}
              </span>
            </button>
          )}
          <div
            className={`${topics.length > 0 && !pasteOpen ? 'hidden lg:block' : ''} ${
              topics.length > 0 ? 'mt-3 lg:mt-0' : ''
            }`}
          >
            {topics.length === 0 && (
              <h2 className="mb-3 text-[15px] font-extrabold tracking-tight text-neutral-900 lg:hidden">
                한꺼번에 붙여넣기
              </h2>
            )}
            {pasteSection}
          </div>
        </section>

        {/* 오른쪽: 발제 목록 */}
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-extrabold tracking-tight text-neutral-900">발제 목록</h2>
            {topics.length > 0 && (
              <small className="text-xs text-neutral-600">작성 중인 발제는 회원에게 안 보여요</small>
            )}
          </div>

          {notice && (
            <div className="mb-1.5 flex items-start justify-between gap-3 rounded-[10px] bg-surface-200 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-neutral-800">
              <span>
                붙여넣은 글을 발제 {notice.count}개로 나눴어요.
                {notice.ignored.length > 0 &&
                  ` 발제 밖의 줄(「${notice.ignored[0]}」${
                    notice.ignored.length > 1 ? ` 외 ${notice.ignored.length - 1}줄` : ''
                  })은 넣지 않았어요.`}
              </span>
              <button
                type="button"
                onClick={undoSplit}
                disabled={busy}
                className="flex-none font-bold text-primary-600"
              >
                되돌리기
              </button>
            </div>
          )}

          {topics.length === 0 && !adding ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-neutral-300 px-6 py-10 text-center">
              <b className="block text-[15px] font-extrabold text-neutral-800">아직 발제가 없어요</b>
              <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">
                카톡 발제문을 통째로 붙여넣으면
                <br />
                번호별로 나눠서 「작성 중」으로 넣어요
              </p>
              <button type="button" onClick={() => setAdding(true)} className={`mt-4 ${btnSmLine}`}>
                하나씩 직접 추가
              </button>
            </div>
          ) : (
            <ul>
              {topics.map((t) =>
                editing.has(t.id) || isTopicIncomplete(t) ? (
                  <li key={t.id} className="my-2">
                    <TopicEditor
                      topic={t}
                      onDone={() => {
                        setOpen(t.id, false)
                        router.refresh()
                      }}
                      onCancel={isTopicIncomplete(t) ? undefined : () => setOpen(t.id, false)}
                      onDelete={() => deleteTopic(t)}
                    />
                  </li>
                ) : (
                  <TopicRow
                    key={t.id}
                    topic={t}
                    onEdit={() => setOpen(t.id, true)}
                    onDelete={() => deleteTopic(t)}
                  />
                ),
              )}
              {adding && (
                <li className="my-2">
                  <TopicEditor
                    meetingId={meetingId}
                    nextNo={nextNo}
                    onDone={() => {
                      setAdding(false)
                      router.refresh()
                    }}
                    onCancel={() => setAdding(false)}
                  />
                </li>
              )}
            </ul>
          )}

          {topics.length > 0 && !adding && (
            <button type="button" onClick={() => setAdding(true)} className={`mt-3 ${btnSmLine}`}>
              ＋ 발제 하나 추가
            </button>
          )}
        </section>
      </div>

      {publishOpen && (
        <ModalOverlay onClose={() => setPublishOpen(false)}>
          <h3 className="text-[17px] font-extrabold tracking-tight text-neutral-900">
            발제 {drafts.length}개를 공개할까요?
          </h3>
          <p className="mt-2.5 text-sm leading-relaxed text-neutral-700">
            {applicantCount > 0 ? (
              <>
                신청자 <b className="text-neutral-900">{applicantCount}명</b>에게 앱 알림이{' '}
                <b className="text-neutral-900">한 번</b> 가요.
              </>
            ) : (
              '아직 신청자가 없어 알림은 가지 않아요.'
            )}{' '}
            공개한 뒤에도 고칠 수 있고, 고쳐도 알림은 다시 가지 않아요.
          </p>
          {applicantCount > 0 && (
            <>
              <p className="mt-3.5 text-[11px] font-bold tracking-wide text-neutral-500">
                회원 알림함에 이렇게 떠요
              </p>
              <div className="mt-1.5 flex gap-2.5 rounded-[12px] bg-surface-200 p-3">
                <span className="text-lg leading-none" aria-hidden>
                  📖
                </span>
                <div className="min-w-0">
                  <b className="block text-[13px] font-bold text-neutral-900">
                    {topicPostedTitle(drafts.length, published.length > 0)}
                  </b>
                  <span className="mt-0.5 block truncate text-xs text-neutral-600">{meetingTitle}</span>
                </div>
              </div>
            </>
          )}
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setPublishOpen(false)} className={`flex-1 !h-11 ${btnLine}`}>
              취소
            </button>
            <button type="button" onClick={publish} disabled={busy} className={`flex-1 !h-11 ${btnPrimary}`}>
              {busy ? '공개하는 중…' : '공개하기'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {previewOpen && (
        <TopicsPreview
          topics={topics}
          draftCount={drafts.length}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  )
}

/* ─────────────── 목록 한 줄 ─────────────── */

function TopicRow({
  topic: t,
  onEdit,
  onDelete,
}: {
  topic: DiscussionTopic
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <li className="flex flex-wrap gap-3 border-t border-surface-300 py-4 first:border-t-0 lg:flex-nowrap">
      <span className="mt-px flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-neutral-100 text-xs font-extrabold text-neutral-700">
        {t.topic_no}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <b className="min-w-0 text-[14.5px] font-extrabold tracking-tight text-neutral-900">{t.title}</b>
          {t.published_at === null ? (
            <span className="flex-none rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-bold text-neutral-700">
              작성 중
            </span>
          ) : (
            <span className="flex-none rounded-md bg-primary-50 px-1.5 py-0.5 text-[11px] font-bold text-primary-700">
              공개됨
            </span>
          )}
        </div>
        {t.quote && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-700">
            “{t.quote}”
            {/* 쪽수 없음은 오류가 아니다(선택 칸) — 작성 중에만 회색으로 알린다 */}
            {(t.quote_page || t.published_at === null) && (
              <span className="ml-1 whitespace-nowrap text-neutral-500">
                {t.quote_page ? `${t.quote_page}쪽` : '쪽수 없음'}
              </span>
            )}
          </p>
        )}
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-800">{t.question}</p>
      </div>
      <div className="flex flex-none basis-full gap-3 self-start pl-[38px] pt-0.5 text-xs font-semibold lg:basis-auto lg:pl-0 lg:pt-1">
        <button type="button" onClick={onEdit} className="text-neutral-600 hover:text-neutral-900">
          수정
        </button>
        <button type="button" onClick={onDelete} className="text-error">
          삭제
        </button>
      </div>
    </li>
  )
}

/* ─────────────── 수정 / 새로 추가 ─────────────── */

function TopicEditor({
  topic,
  meetingId,
  nextNo,
  onDone,
  onCancel,
  onDelete,
}: {
  topic?: DiscussionTopic
  meetingId?: string
  nextNo?: number
  onDone: () => void
  onCancel?: () => void
  onDelete?: () => void
}) {
  const [form, setForm] = useState({
    topic_no: String(topic?.topic_no ?? nextNo ?? ''),
    title: topic?.title ?? '',
    quote: topic?.quote ?? '',
    quote_page: topic?.quote_page ?? '',
    question: topic?.question ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleMissing = form.title.trim() === ''
  const questionMissing = form.question.trim() === ''
  const fromPaste = topic !== undefined && isTopicIncomplete(topic)

  async function save() {
    if (busy || titleMissing || questionMissing) return
    setBusy(true)
    setError(null)
    try {
      const body = {
        title: form.title.trim(),
        quote: form.quote.trim() || null,
        quote_page: form.quote_page.trim() || null,
        question: form.question.trim(),
      }
      const res = await fetch('/api/admin/topics', {
        method: topic ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          topic
            ? { id: topic.id, topic_no: Number(form.topic_no), ...body }
            : { meeting_id: meetingId, topics: [body] },
        ),
      })
      const json = await res.json().catch(() => ({}))
      if (json.status !== 'success') {
        setError(json.message ?? '잠시 후 다시 시도해 주세요')
        return
      }
      onDone()
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full rounded-[10px] border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-900 focus:border-primary-500 focus:outline-none'
  const missCls = '!border-accent-300 !bg-accent-50'

  return (
    <div className="rounded-[var(--radius-md)] bg-surface-100 p-4">
      <div className="grid grid-cols-[64px_1fr] gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-neutral-800">번호</label>
          <input
            value={form.topic_no}
            onChange={(e) => setForm({ ...form, topic_no: e.target.value })}
            inputMode="numeric"
            disabled={!topic}
            title={topic ? undefined : '저장하면 기존 발제 뒤 번호가 붙어요'}
            className={`${inputCls} text-center text-neutral-700 disabled:bg-surface-200`}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-neutral-800">
            제목<span className="ml-0.5 text-accent-500">*</span>
          </label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="소제목 (예: 사랑과 관념)"
            className={`${inputCls} ${fromPaste && titleMissing ? missCls : ''}`}
          />
        </div>
      </div>
      <div className="mt-3.5">
        <label className="mb-1.5 block text-xs font-bold text-neutral-800">
          인용문<span className="ml-1 font-medium text-neutral-500">선택</span>
        </label>
        <textarea
          value={form.quote}
          onChange={(e) => setForm({ ...form, quote: e.target.value })}
          rows={2}
          className={`${inputCls} resize-y`}
        />
      </div>
      <div className="mt-3.5">
        <label className="mb-1.5 block text-xs font-bold text-neutral-800">
          쪽수<span className="ml-1 font-medium text-neutral-500">선택</span>
        </label>
        <input
          value={form.quote_page}
          onChange={(e) => setForm({ ...form, quote_page: e.target.value })}
          placeholder="예: 289"
          className={`${inputCls} lg:!w-[120px]`}
        />
      </div>
      <div className="mt-3.5">
        <label className="mb-1.5 block text-xs font-bold text-neutral-800">
          질문<span className="ml-0.5 text-accent-500">*</span>
        </label>
        <textarea
          value={form.question}
          onChange={(e) => setForm({ ...form, question: e.target.value })}
          rows={3}
          placeholder="예: 사랑에 관해 나만의 관념이 있었나요?"
          className={`${inputCls} resize-y ${fromPaste && questionMissing ? missCls : ''}`}
        />
        {fromPaste && (titleMissing || questionMissing) && (
          <p className="mt-1.5 text-xs font-semibold text-accent-600">
            붙여넣은 글에서 {titleMissing && questionMissing ? '제목과 질문' : titleMissing ? '제목' : '질문'}을 못
            찾았어요 — 직접 써 주세요
          </p>
        )}
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-accent-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        {onDelete && !onCancel && (
          <button type="button" onClick={onDelete} className={btnSmLine}>
            삭제
          </button>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} className={btnSmLine}>
            취소
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={busy || titleMissing || questionMissing}
          className={btnSmPrimary}
        >
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}

/* ─────────────── 회원 화면 미리보기 ─────────────── */

/**
 * 회원 토론 탭(TalkView 발제문 목록)과 발제 상세(TopicThread 인용 박스)의 모양을 그대로 옮긴 정적 그림.
 * 실제 컴포넌트를 쓰지 않는 이유 — 답변 쓰기·공감 같은 동작이 붙어 있어 운영자 화면에서 눌리면 안 된다.
 * 답변 수는 그리지 않는다(작성 중 발제에는 답변이 있을 수 없고, 지어낸 숫자를 보여주지 않으려고).
 */
function TopicsPreview({
  topics,
  draftCount,
  onClose,
}: {
  topics: DiscussionTopic[]
  draftCount: number
  onClose: () => void
}) {
  const [selected, setSelected] = useState(topics[0]?.id ?? null)
  const sel = topics.find((t) => t.id === selected) ?? topics[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[calc(100vh-40px)] w-full max-w-[860px] overflow-y-auto rounded-[var(--radius-lg)] bg-white px-5 pb-6 pt-5 shadow-[var(--shadow-elevated)] lg:px-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[17px] font-extrabold tracking-tight text-neutral-900">회원 화면 미리보기</h3>
            <p className="mt-1 text-[13px] text-neutral-600">
              공개하면 신청자에게 이렇게 보여요.
              {draftCount > 0 && ` 작성 중인 ${draftCount}개도 넣어 그렸어요.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-surface-200 text-neutral-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mt-5 flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
          <div className="w-full max-w-[360px]">
            <p className="mb-2 text-xs font-bold text-neutral-600">토론 탭 — 발제문 목록</p>
            <div className="h-[480px] overflow-hidden rounded-[22px] bg-white px-5 text-tg-900 ring-1 ring-surface-300">
              <p className="flex h-12 items-center text-[17px] font-extrabold tracking-tight text-brand-deep">지독해</p>
              <p className="mt-2 text-[15px] font-extrabold tracking-tight">발제문</p>
              <div>
                {topics.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelected(t.id)}
                    className="flex min-h-[56px] w-full items-center gap-3 border-t border-tg-100 py-3 text-left first:border-t-0"
                  >
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px] bg-tg-100 text-xs font-extrabold text-tg-700">
                      {t.topic_no}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-bold tracking-tight">
                        {t.title || '(제목 없음)'}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-tg-600">
                        {t.question || '(질문 없음)'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {sel && (
            <div className="w-full max-w-[360px]">
              <p className="mb-2 text-xs font-bold text-neutral-600">발제 하나를 눌렀을 때</p>
              <div className="h-[480px] overflow-hidden rounded-[22px] bg-white px-5 text-tg-900 ring-1 ring-surface-300">
                <p className="flex h-12 items-center text-[17px] font-extrabold tracking-tight text-brand-deep">지독해</p>
                <p className="mt-4 text-[15px] font-extrabold tracking-tight">
                  발제 {sel.topic_no} · {sel.title}
                </p>
                <div className="mt-3 rounded-[16px] bg-tg-100 p-4">
                  {sel.quote && (
                    <>
                      <p className="text-[13.5px] font-bold leading-relaxed tracking-tight text-tg-900">
                        “{sel.quote}”
                      </p>
                      {sel.quote_page && (
                        <p className="mt-1 text-[11px] text-tg-600">{sel.quote_page}쪽</p>
                      )}
                    </>
                  )}
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-tg-700">{sel.question}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
