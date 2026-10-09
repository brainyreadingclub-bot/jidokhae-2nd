'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { splitPastedTopics, isTopicIncomplete } from '@/lib/topic-paste'
import { topicStatusLabel } from '@/lib/topic-status'
import { topicPostedTitle } from '@/lib/topic-notification'
import type { DiscussionTopic } from '@/types/discussion'

/**
 * 발제문 관리 (2026-10-09 시안 B — `docs/설계/mockups/2026-10-09-발제문-운영자상세/`).
 * 데스크톱(`B-발제문관리.html`): 왼쪽 붙여넣기 / 오른쪽 목록 / 위 막대에 상태 + 미리보기 + 공개하기.
 * 폰(`B-발제문관리-폰.html`, P1~P6): 한 줄로 쌓고, **화면 아래 고정 바에 지금 할 일 하나만** —
 *   붙여넣은 직후 「번호별로 나누기」 / 목록 「공개하기」+막힌 이유 / 고치는 중 「취소·저장」.
 *   확인은 아래에서 올라오는 시트. 목록의 수정·삭제는 44px 「⋮」 하나.
 * 현행 카톡 형식 그대로: 번호 · 소제목 · 인용(쪽수) · 질문.
 * 권한은 서버(API)가 검사 — 큐레이터(admin·editor·is_staff).
 *
 * 🔴 폰 360·390에서 가로 스크롤 0이 조건이다(대표님 지시). 고정 바는 left/right 0 + 좌우 20px,
 *    「⋮」에 음수 마진을 쓰지 않는다(오른쪽 여백이 깨졌던 원인).
 */

type Props = {
  meetingId: string
  meetingTitle: string
  topics: DiscussionTopic[]
  /** 발제별 답변 수 — 삭제 확인에서 「답변 N개도 함께 지워져요」에 쓴다(실제 값) */
  answerCounts: Record<string, number>
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
/** 폰 고정 바·시트의 큰 버튼 (52px, 엄지 자리) */
const btnBigLine =
  'inline-flex h-[52px] items-center justify-center whitespace-nowrap rounded-[14px] border border-surface-300 bg-white px-5 text-[15px] font-bold text-primary-700 disabled:opacity-50 lg:h-11 lg:rounded-[var(--radius-md)] lg:text-sm'
const btnBigPrimary =
  'inline-flex h-[52px] items-center justify-center whitespace-nowrap rounded-[14px] bg-primary-600 px-5 text-[15px] font-bold text-white disabled:bg-neutral-200 disabled:text-neutral-500 lg:h-11 lg:rounded-[var(--radius-md)] lg:text-sm'
const btnBigDanger =
  'inline-flex h-[52px] items-center justify-center whitespace-nowrap rounded-[14px] bg-error px-5 text-[15px] font-bold text-white disabled:opacity-50 lg:h-11 lg:rounded-[var(--radius-md)] lg:text-sm'

export default function TopicsManager({
  meetingId,
  meetingTitle,
  topics,
  answerCounts,
  applicantCount,
  lastPublishedLabel,
}: Props) {
  const router = useRouter()
  const [paste, setPaste] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<SplitNotice | null>(null)
  /** 지금 고치는 발제 하나 ('new' = 새로 추가). 폰 고정 바가 이 편집기의 취소·저장이 된다 */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<DiscussionTopic | null>(null)
  const [deleteFor, setDeleteFor] = useState<DiscussionTopic | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const drafts = topics.filter((t) => t.published_at === null)
  const published = topics.filter((t) => t.published_at !== null)
  const incomplete = drafts.filter(isTopicIncomplete)
  const counts = { draft: drafts.length, published: published.length }
  const canPublish = drafts.length > 0 && incomplete.length === 0
  const nextNo = (topics.at(-1)?.topic_no ?? 0) + 1
  const noTopics = topics.length === 0
  const pasteVisible = noTopics || pasteOpen
  const foundCount = useMemo(() => splitPastedTopics(paste).topics.length, [paste])

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

  async function confirmDelete() {
    if (!deleteFor || busy) return
    setBusy(true)
    setError(null)
    try {
      await call('DELETE', '/api/admin/topics', { id: deleteFor.id })
      if (editingId === deleteFor.id) setEditingId(null)
      setDeleteFor(null)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
      setDeleteFor(null)
    } finally {
      setBusy(false)
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

  // ── 상태 문구 ──
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
  } else if (noTopics) {
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

  // ── 폰 고정 바: 지금 할 일 하나 (편집기가 열려 있으면 편집기가 자기 바를 그린다) ──
  let dock: React.ReactNode = null
  if (editingId === null) {
    if (pasteVisible && paste.trim() !== '') {
      dock = (
        <Dock>
          <DockText
            title={foundCount > 0 ? `발제 ${foundCount}개를 찾았어요` : '번호로 시작하는 줄이 없어요'}
            sub={foundCount > 0 ? '나누기 전에 확인할 수 있어요' : '1. · 1) · ① · 발제 1'}
            warn={foundCount === 0}
          />
          <button
            type="button"
            onClick={splitAndSave}
            disabled={busy || foundCount === 0}
            className={`flex-none ${btnBigPrimary}`}
          >
            {busy ? '나누는 중…' : '번호별로 나누기'}
          </button>
        </Dock>
      )
    } else if (!noTopics) {
      dock = (
        <Dock>
          <DockText
            title={topicStatusLabel(counts)}
            sub={
              incomplete.length > 0
                ? `제목이나 질문이 빈 발제 ${incomplete.length}개`
                : drafts.length > 0
                  ? applicantCount > 0
                    ? `신청자 ${applicantCount}명에게 알림 1번`
                    : '아직 신청자가 없어 알림은 안 가요'
                  : '신청자에게 알림을 보냈어요'
            }
            warn={incomplete.length > 0}
          />
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            disabled={!canPublish || busy}
            className={`flex-none ${btnBigPrimary}`}
          >
            {drafts.length === 0 ? '모두 공개됨' : '공개하기'}
          </button>
        </Dock>
      )
    }
  }
  const hasDock = dock !== null || editingId !== null

  const pasteSection = (
    <div>
      <label htmlFor="topic-paste" className="mb-1.5 block text-xs font-bold text-neutral-800">
        <span className="lg:hidden">발제문 전체</span>
        <span className="hidden lg:inline">카톡 발제문</span>
      </label>
      <textarea
        id="topic-paste"
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        spellCheck={false}
        placeholder={'1. 소제목\n"인용문" (p.289)\n질문'}
        className="min-h-[260px] w-full resize-y rounded-[10px] border border-neutral-300 bg-white px-3 py-2.5 text-base leading-[1.7] text-neutral-900 focus:border-primary-500 focus:outline-none lg:min-h-[420px] lg:text-[13px]"
      />
      {/* 데스크톱만 — 폰은 아래 고정 바가 이 버튼이다 */}
      <button
        type="button"
        onClick={splitAndSave}
        disabled={busy || paste.trim() === ''}
        className={`mt-2.5 w-full max-lg:hidden ${noTopics ? btnPrimary : btnLine}`}
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
      {noTopics && editingId === null && (
        <div className="mt-3.5 flex justify-center lg:hidden">
          <button
            type="button"
            onClick={() => setEditingId('new')}
            className="flex min-h-11 items-center text-[13px] font-bold text-primary-600"
          >
            하나씩 직접 쓰기
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className={hasDock ? 'pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-0' : ''}>
      {/* 상태 + (데스크톱) 공개 */}
      <div className="my-4 flex items-center justify-between gap-3 border-y border-surface-300 py-3 lg:my-6 lg:gap-4 lg:py-3.5">
        <div className="min-w-0 text-sm text-neutral-700">
          <b className="font-extrabold text-neutral-900">{topicStatusLabel(counts)}</b>
          {drafts.length > 0 && <span className="lg:hidden"> · 회원에게 안 보여요</span>}
          <span className="hidden lg:block">{statusNote}</span>
        </div>
        <div className="flex flex-none gap-2">
          {!noTopics && (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="flex min-h-11 items-center text-[13px] font-bold text-primary-600 lg:hidden"
            >
              회원 화면 미리보기
            </button>
          )}
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            disabled={noTopics}
            className={`max-lg:hidden ${btnLine}`}
          >
            회원 화면 미리보기
          </button>
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            disabled={!canPublish || busy}
            className={`max-lg:hidden ${btnPrimary}`}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-10">
        {/* 붙여넣기 — 발제가 없으면 펼쳐 두고(이 화면에 온 이유가 그것뿐), 생기면 폰에서는 접는다 */}
        <section>
          <h2 className={`mb-3 text-[15px] font-extrabold tracking-tight text-neutral-900 ${noTopics ? '' : 'hidden lg:block'}`}>
            <span className="lg:hidden">카톡 발제문 붙여넣기</span>
            <span className="hidden lg:inline">
              {published.length > 0 && drafts.length === 0 ? '발제 더 붙여넣기' : '한꺼번에 붙여넣기'}
            </span>
          </h2>
          {noTopics && (
            <p className="-mt-2 mb-3.5 text-xs text-neutral-600 lg:hidden">
              카톡에 쓴 발제문을 통째로 붙여넣으면 번호별로 나눠 드려요.
            </p>
          )}
          {!noTopics && (
            <button
              type="button"
              onClick={() => setPasteOpen((v) => !v)}
              className="flex min-h-12 w-full items-center justify-between rounded-[var(--radius-md)] border border-surface-300 px-3.5 text-[13px] font-bold text-neutral-800 lg:hidden"
              aria-expanded={pasteOpen}
            >
              카톡 발제문 더 붙여넣기
              <span className="text-xs font-medium text-neutral-600">
                {pasteOpen ? '닫기 ▴' : '열기 ▾'}
              </span>
            </button>
          )}
          <div className={`${pasteVisible ? '' : 'hidden lg:block'} ${noTopics ? '' : 'mt-3 lg:mt-0'}`}>
            {pasteSection}
          </div>
        </section>

        {/* 발제 목록 — 폰에서 발제가 하나도 없으면 감춘다(붙여넣기가 이 화면의 전부) */}
        <section className={noTopics && editingId !== 'new' ? 'hidden lg:block' : ''}>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-extrabold tracking-tight text-neutral-900">발제 목록</h2>
            {!noTopics && (
              <small className="hidden text-xs text-neutral-600 lg:inline">
                작성 중인 발제는 회원에게 안 보여요
              </small>
            )}
          </div>

          {notice && (
            <div className="mb-1.5 flex items-start justify-between gap-3 rounded-[10px] bg-surface-200 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-neutral-800">
              <span className="min-w-0">
                발제 {notice.count}개로 나눴어요.
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

          {noTopics && editingId !== 'new' ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-neutral-300 px-6 py-10 text-center">
              <b className="block text-[15px] font-extrabold text-neutral-800">아직 발제가 없어요</b>
              <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">
                카톡 발제문을 통째로 붙여넣으면
                <br />
                번호별로 나눠서 「작성 중」으로 넣어요
              </p>
              <button type="button" onClick={() => setEditingId('new')} className={`mt-4 ${btnSmLine}`}>
                하나씩 직접 추가
              </button>
            </div>
          ) : (
            <ul>
              {topics.map((t) => {
                const incompleteRow = isTopicIncomplete(t)
                if (editingId === t.id) {
                  return (
                    <li key={t.id} className="my-2">
                      <TopicEditor
                        topic={t}
                        withDock
                        onDone={() => {
                          setEditingId(null)
                          router.refresh()
                        }}
                        onCancel={() => setEditingId(null)}
                        onDelete={() => setDeleteFor(t)}
                      />
                    </li>
                  )
                }
                if (incompleteRow) {
                  // 데스크톱은 빈 칸 발제를 열어 둔다(B2) / 폰은 접은 채 빨간 한 줄 — 눌러서 연다(P3)
                  return (
                    <li key={t.id} className="first:border-t-0 max-lg:border-t max-lg:border-surface-300">
                      <div className="my-2 hidden lg:block">
                        <TopicEditor
                          topic={t}
                          onDone={() => router.refresh()}
                          onDelete={() => setDeleteFor(t)}
                        />
                      </div>
                      <div className="lg:hidden">
                        <TopicRow
                          topic={t}
                          answerCount={answerCounts[t.id] ?? 0}
                          onOpen={() => setEditingId(t.id)}
                          onMenu={() => setMenuFor(t)}
                          onEdit={() => setEditingId(t.id)}
                          onDelete={() => setDeleteFor(t)}
                        />
                      </div>
                    </li>
                  )
                }
                return (
                  <li key={t.id} className="border-t border-surface-300 first:border-t-0">
                    <TopicRow
                      topic={t}
                      answerCount={answerCounts[t.id] ?? 0}
                      onMenu={() => setMenuFor(t)}
                      onEdit={() => setEditingId(t.id)}
                      onDelete={() => setDeleteFor(t)}
                    />
                  </li>
                )
              })}
              {editingId === 'new' && (
                <li className="my-2">
                  <TopicEditor
                    meetingId={meetingId}
                    nextNo={nextNo}
                    withDock
                    onDone={() => {
                      setEditingId(null)
                      router.refresh()
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              )}
            </ul>
          )}

          {!noTopics && editingId === null && (
            <button
              type="button"
              onClick={() => setEditingId('new')}
              className={`mt-3 h-11 lg:h-8 ${btnSmLine}`}
            >
              ＋ 발제 하나 추가
            </button>
          )}
        </section>
      </div>

      {dock}

      {/* ⋮ — 폰 목록의 수정·삭제 */}
      {menuFor && (
        <Sheet onClose={() => setMenuFor(null)}>
          <h3 className="truncate text-[17px] font-extrabold tracking-tight text-neutral-900">
            {menuFor.topic_no}번 발제 「{menuFor.title || '제목 없음'}」
          </h3>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingId(menuFor.id)
                setMenuFor(null)
              }}
              className={btnBigLine}
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteFor(menuFor)
                setMenuFor(null)
              }}
              className={`${btnBigLine} !text-error`}
            >
              삭제
            </button>
            <button type="button" onClick={() => setMenuFor(null)} className="min-h-11 text-sm font-bold text-neutral-600">
              닫기
            </button>
          </div>
        </Sheet>
      )}

      {/* 발제 삭제 확인 — 한 단계 더 (P6). 답변 수는 실제 값. FK: 답변은 발제 삭제 시 cascade,
          답글·공감은 답변 삭제 시 cascade (migration-discussion-thread.sql ③④⑤) */}
      {deleteFor && (
        <Sheet onClose={() => setDeleteFor(null)}>
          <h3 className="text-[17px] font-extrabold tracking-tight text-neutral-900 lg:text-lg">
            {deleteFor.topic_no}번 발제 「{deleteFor.title || '제목 없음'}」을 삭제할까요?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700">
            {deleteFor.published_at !== null ? (
              (answerCounts[deleteFor.id] ?? 0) > 0 ? (
                <>
                  이미 공개된 발제예요. 회원 화면에서도 사라지고, 달린{' '}
                  <b className="text-neutral-900">답변 {answerCounts[deleteFor.id]}개</b>와 그 답글·공감도
                  함께 지워져요. 되돌릴 수 없어요.
                </>
              ) : (
                '이미 공개된 발제예요. 회원 화면에서도 사라져요. 아직 달린 답변은 없어요. 되돌릴 수 없어요.'
              )
            ) : (
              '작성 중이라 회원에게 보인 적 없는 발제예요. 되돌릴 수 없어요.'
            )}
          </p>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setDeleteFor(null)} className={`flex-[0_0_34%] lg:flex-1 ${btnBigLine}`}>
              취소
            </button>
            <button type="button" onClick={confirmDelete} disabled={busy} className={`flex-1 ${btnBigDanger}`}>
              {busy ? '삭제하는 중…' : '삭제'}
            </button>
          </div>
        </Sheet>
      )}

      {publishOpen && (
        <Sheet onClose={() => setPublishOpen(false)}>
          <h3 className="text-lg font-extrabold tracking-tight text-neutral-900">
            발제 {drafts.length}개를 공개할까요?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700">
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
              <p className="mt-4 text-[11px] font-bold tracking-wide text-neutral-500">
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
            <button type="button" onClick={() => setPublishOpen(false)} className={`flex-[0_0_34%] lg:flex-1 ${btnBigLine}`}>
              취소
            </button>
            <button type="button" onClick={publish} disabled={busy} className={`flex-1 ${btnBigPrimary}`}>
              {busy ? '공개하는 중…' : '공개하기'}
            </button>
          </div>
        </Sheet>
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

/* ─────────────── 폰 고정 바 · 시트 ─────────────── */

/**
 * 폰 화면 아래 고정 바. left/right 0 + 좌우 20px — 폭이 화면을 넘지 않는다.
 * z-30: 운영자 메뉴 서랍(오버레이 z-40 · 서랍 z-50)이 열리면 그 아래로 깔린다.
 * 조상에 transform이 없어야 화면 기준으로 붙는다 — (admin)/layout.tsx 주석 참조.
 */
function Dock({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-surface-300 bg-white px-5 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] lg:hidden">
      {children}
    </div>
  )
}

function DockText({ title, sub, warn }: { title: string; sub: string; warn?: boolean }) {
  return (
    <div className="min-w-0 flex-1 text-[12.5px] leading-snug text-neutral-700">
      <b className="block truncate text-sm font-extrabold text-neutral-900">{title}</b>
      <span className={`block truncate ${warn ? 'font-semibold text-accent-600' : ''}`}>{sub}</span>
    </div>
  )
}

/** 확인 창 — 폰은 아래에서 올라오는 시트(엄지 자리), 데스크톱은 가운데 창 */
function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-5"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full rounded-t-[20px] bg-white px-5 pt-[22px] pb-[calc(16px+env(safe-area-inset-bottom))] lg:max-w-sm lg:rounded-[var(--radius-lg)] lg:p-6 lg:shadow-[var(--shadow-elevated)]">
        <div className="mx-auto -mt-2 mb-4 h-1 w-9 rounded-full bg-neutral-300 lg:hidden" aria-hidden />
        {children}
      </div>
    </div>
  )
}

/* ─────────────── 목록 한 줄 ─────────────── */

function TopicRow({
  topic: t,
  answerCount,
  onOpen,
  onMenu,
  onEdit,
  onDelete,
}: {
  topic: DiscussionTopic
  answerCount: number
  /** 폰에서 빈 칸 발제 — 줄을 누르면 편집기를 연다 */
  onOpen?: () => void
  onMenu: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const missing = isTopicIncomplete(t)
  return (
    <div className="flex gap-2.5 py-3.5 lg:gap-3 lg:py-4">
      <span className="mt-px flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-neutral-100 text-xs font-extrabold text-neutral-700">
        {t.topic_no}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <b className="min-w-0 break-keep text-[14.5px] font-extrabold tracking-tight text-neutral-900">
            {t.title || '(제목 없음)'}
          </b>
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
          <p className="mt-1.5 break-keep text-[13px] leading-relaxed text-neutral-700">
            “{t.quote}”
            {/* 쪽수 없음은 오류가 아니다(선택 칸) — 작성 중에만 회색으로 알린다 */}
            {(t.quote_page || t.published_at === null) && (
              <span className="ml-1 whitespace-nowrap text-neutral-500">
                {t.quote_page ? `${t.quote_page}쪽` : '· 쪽수 없음'}
              </span>
            )}
          </p>
        )}
        {missing ? (
          <button
            type="button"
            onClick={onOpen}
            className="mt-1 text-left text-[13px] font-semibold text-accent-600"
          >
            {t.title.trim() === '' ? '제목' : '질문'}이 비어 있어요 — 눌러서 채우기
          </button>
        ) : (
          <p className="mt-1 line-clamp-2 break-keep text-[13px] leading-relaxed text-neutral-800 lg:line-clamp-none">
            {t.question}
          </p>
        )}
        {t.published_at !== null && answerCount > 0 && (
          <p className="mt-1 text-xs text-neutral-600">답변 {answerCount}개</p>
        )}
      </div>
      {/* 폰: ⋮ 하나 (44px, 음수 마진 없음 — 오른쪽 여백을 지킨다) */}
      <button
        type="button"
        onClick={onMenu}
        aria-label={`${t.topic_no}번 발제 수정·삭제`}
        className="-mt-2.5 flex h-11 w-11 flex-none items-center justify-center rounded-[10px] text-neutral-600 lg:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {/* 데스크톱: 글자 버튼 둘 */}
      <div className="hidden flex-none gap-3 self-start pt-1 text-xs font-semibold lg:flex">
        <button type="button" onClick={onEdit} className="text-neutral-600 hover:text-neutral-900">
          수정
        </button>
        <button type="button" onClick={onDelete} className="text-error">
          삭제
        </button>
      </div>
    </div>
  )
}

/* ─────────────── 수정 / 새로 추가 ─────────────── */

function TopicEditor({
  topic,
  meetingId,
  nextNo,
  withDock,
  onDone,
  onCancel,
  onDelete,
}: {
  topic?: DiscussionTopic
  meetingId?: string
  nextNo?: number
  /** 폰 고정 바를 「취소·저장」으로 쓴다 — 한 번에 하나만 열린 편집기만 true */
  withDock?: boolean
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

  // 폰에서 16px 미만이면 iOS가 입력할 때 화면을 확대한다
  const inputCls =
    'w-full rounded-[10px] border border-neutral-300 bg-white px-3 py-2 text-base leading-relaxed text-neutral-900 focus:border-primary-500 focus:outline-none lg:text-sm'
  const missCls = '!border-accent-300 !bg-accent-50'
  const saveDisabled = busy || titleMissing || questionMissing

  return (
    <div className="rounded-[var(--radius-md)] bg-surface-100 p-4">
      <div className="mb-3 flex min-h-11 items-center justify-between lg:hidden">
        <b className="text-[13px] font-extrabold text-neutral-800">
          {topic ? `발제 ${topic.topic_no} 고치는 중` : '새 발제'}
        </b>
        {topic && onDelete && (
          <button type="button" onClick={onDelete} className="flex min-h-11 items-center text-[13px] font-semibold text-error">
            삭제
          </button>
        )}
      </div>
      <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-2.5 lg:gap-3">
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
          inputMode="numeric"
          className={`${inputCls} !w-[120px]`}
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
      {/* 데스크톱 — 편집기 안의 작은 버튼 */}
      <div className={`mt-4 justify-end gap-2 ${withDock ? 'hidden lg:flex' : 'flex'}`}>
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
        <button type="button" onClick={save} disabled={saveDisabled} className={btnSmPrimary}>
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
      {/* 폰 — 고정 바가 취소·저장 */}
      {withDock && (
        <Dock>
          <button type="button" onClick={onCancel} className={`flex-1 ${btnBigLine}`}>
            취소
          </button>
          <button type="button" onClick={save} disabled={saveDisabled} className={`flex-1 ${btnBigPrimary}`}>
            {busy ? '저장 중…' : '저장'}
          </button>
        </Dock>
      )}
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
