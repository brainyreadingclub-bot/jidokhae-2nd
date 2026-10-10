'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { topicStatusLabel } from '@/lib/topic-status'
import type { DiscussionTopic } from '@/types/discussion'

/**
 * 발제문 관리 — 1차 (2026-10-10 대표님 확정, 시안 `docs/설계/mockups/2026-10-10-발제문-새방식/`).
 * 운영자가 하나씩 직접 써서 **등록하면 바로 공개**된다. 신청자 알림은 이 화면이 보내지 않는다 —
 * 마지막 등록 후 10분 동안 추가 등록이 없으면 DB 예약 작업이 「발제 N개가 올라왔어요」를 한 번 보낸다
 * (`supabase/migration-topics-notify.sql`). 고쳐도 알림은 다시 가지 않는다.
 * 「작성 중」·공개하기·발제자 링크는 2차다 — 여기 넣지 않는다.
 *
 * 폰: 화면 아래 고정 바에 지금 할 일 하나(발제 쓰기 / 발제 추가 / 취소·등록). 목록 수정·삭제는 44px 「⋮」.
 *     확인 창은 아래에서 올라오는 시트. 큰 화면(lg~)은 제자리 버튼 + 가운데 창(ModalOverlay 문법).
 * 버튼은 운영자 규칙 — 모서리 12px(radius-md) · 14px 글씨 · 높이는 MeetingForm 주 버튼 기준(R2).
 * 권한은 서버(API)가 검사 — 큐레이터(admin·editor·is_staff).
 * 🔴 폰 360·390에서 가로 스크롤 0이 조건이다. 「⋮」에 좌우 음수 마진을 쓰지 않는다.
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

/** 'new' = 새로 쓰기, 그 밖의 문자열 = 고치는 발제 id */
type Editing = 'new' | string | null

const btnLine =
  'inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] border border-surface-300 bg-white px-4 text-sm font-bold text-primary-700 transition-colors hover:bg-surface-100 disabled:opacity-50'
const btnPrimary =
  'inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] bg-primary-600 px-4 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:bg-neutral-200 disabled:text-neutral-500'
/** 폰 고정 바·확인 창의 버튼 — MeetingForm 주 버튼(py-3.5 · 14px · radius-md)과 같은 크기 */
const btnBigLine =
  'inline-flex h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] border border-surface-300 bg-white px-5 text-sm font-bold text-primary-700 transition-colors hover:bg-surface-100 disabled:opacity-50'
const btnBigPrimary =
  'inline-flex h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] bg-primary-600 px-5 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:bg-neutral-200 disabled:text-neutral-500'
const btnBigDanger =
  'inline-flex h-12 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] bg-error px-5 text-sm font-bold text-white transition-colors hover:bg-error/90 disabled:opacity-50'

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export default function TopicsManager({
  meetingId,
  topics,
  answerCounts,
  applicantCount,
  lastPublishedLabel,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<Editing>(null)
  const [menuFor, setMenuFor] = useState<DiscussionTopic | null>(null)
  const [deleteFor, setDeleteFor] = useState<DiscussionTopic | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const published = topics.filter((t) => t.published_at !== null)
  const counts = { draft: 0, published: published.length }
  // 아직 신청자에게 안 알린 발제 — notified_at 칸이 생기기 전(SQL 실행 전)에는 undefined라 세지 않는다
  const pending = published.filter((t) => t.notified_at === null).length
  const nextNo = (topics.at(-1)?.topic_no ?? 0) + 1
  const noTopics = topics.length === 0
  const editTopic = editing && editing !== 'new' ? topics.find((t) => t.id === editing) : undefined

  async function confirmDelete() {
    if (!deleteFor || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/topics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteFor.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (json.status !== 'success') throw new Error(json.message ?? '잠시 후 다시 시도해 주세요')
      if (editing === deleteFor.id) setEditing(null)
      setDeleteFor(null)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
      setDeleteFor(null)
    } finally {
      setBusy(false)
    }
  }

  // ── 쓰기·고치기 화면 ──
  if (editing !== null && (editing === 'new' || editTopic)) {
    return (
      <TopicForm
        meetingId={meetingId}
        topic={editTopic}
        nextNo={nextNo}
        applicantCount={applicantCount}
        onDone={() => {
          setEditing(null)
          router.refresh()
        }}
        onCancel={() => setEditing(null)}
        onDelete={editTopic ? () => setDeleteFor(editTopic) : undefined}
        deleteSheet={
          deleteFor && (
            <DeleteSheet
              topic={deleteFor}
              answerCount={answerCounts[deleteFor.id] ?? 0}
              busy={busy}
              onCancel={() => setDeleteFor(null)}
              onConfirm={confirmDelete}
            />
          )
        }
      />
    )
  }

  // ── 목록 ──
  const pendingNote =
    pending > 0
      ? applicantCount > 0
        ? `알림 대기 ${pending}개 — 마지막 등록 10분 뒤 신청자 ${applicantCount}명에게 한 번에 가요`
        : `알림 대기 ${pending}개 — 아직 신청자가 없어 알림은 가지 않아요`
      : published.length > 0 && lastPublishedLabel
        ? `마지막 등록 ${lastPublishedLabel} · 고쳐도 알림은 다시 가지 않아요`
        : null

  return (
    <div className="pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-0">
      {/* 상태 + 미리보기 + (큰 화면) 발제 추가 */}
      <div className="my-4 flex min-h-14 items-center justify-between gap-3 border-y border-surface-300 py-3 lg:my-6 lg:gap-4 lg:py-3.5">
        <div className="min-w-0 text-sm text-neutral-700">
          <b className="font-extrabold text-neutral-900">{topicStatusLabel(counts)}</b>
          {pendingNote && (
            <span className="mt-0.5 hidden text-xs text-neutral-600 lg:block">{pendingNote}</span>
          )}
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
          {!noTopics && (
            <button type="button" onClick={() => setPreviewOpen(true)} className={`max-lg:hidden ${btnLine}`}>
              회원 화면 미리보기
            </button>
          )}
          <button type="button" onClick={() => setEditing('new')} className={`max-lg:hidden ${btnPrimary}`}>
            <PlusIcon />
            발제 추가
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-[10px] bg-accent-50 px-3.5 py-2.5 text-xs font-semibold text-accent-700">
          {error}
        </p>
      )}

      {noTopics ? (
        <p className="mt-7 text-center text-[13px] leading-relaxed text-neutral-600">
          직접 써서 등록하면 바로 회원에게 보여요
          <br />
          신청자 알림은 마지막 등록 10분 뒤 한 번에 가요
        </p>
      ) : (
        <ul className="max-w-3xl">
          {topics.map((t) => (
            <li key={t.id} className="border-t border-surface-300 first:border-t-0">
              <TopicRow
                topic={t}
                answerCount={answerCounts[t.id] ?? 0}
                onMenu={() => setMenuFor(t)}
                onEdit={() => setEditing(t.id)}
                onDelete={() => setDeleteFor(t)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* 폰 고정 바 — 지금 할 일 하나 */}
      <Dock>
        {noTopics ? (
          <button type="button" onClick={() => setEditing('new')} className={`flex-1 ${btnBigPrimary}`}>
            발제 쓰기
          </button>
        ) : (
          <>
            <div className="min-w-0 flex-1 text-[12.5px] leading-snug text-neutral-700">
              <b className="block truncate text-sm font-extrabold text-neutral-900">
                {topicStatusLabel(counts)}
              </b>
              <span className="block truncate">
                {pending > 0 ? `알림 대기 ${pending}개 · 10분 뒤 한 번에` : '고쳐도 알림은 다시 안 가요'}
              </span>
            </div>
            <button type="button" onClick={() => setEditing('new')} className={`flex-none ${btnBigPrimary}`}>
              <PlusIcon />
              발제 추가
            </button>
          </>
        )}
      </Dock>

      {/* ⋮ — 폰 목록의 수정·삭제 */}
      {menuFor && (
        <Sheet onClose={() => setMenuFor(null)}>
          <h3 className="truncate text-[17px] font-extrabold tracking-tight text-neutral-900">
            {menuFor.topic_no}번 발제 「{menuFor.title}」
          </h3>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(menuFor.id)
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

      {deleteFor && (
        <DeleteSheet
          topic={deleteFor}
          answerCount={answerCounts[deleteFor.id] ?? 0}
          busy={busy}
          onCancel={() => setDeleteFor(null)}
          onConfirm={confirmDelete}
        />
      )}

      {previewOpen && <TopicsPreview topics={topics} onClose={() => setPreviewOpen(false)} />}
    </div>
  )
}

/* ─────────────── 삭제 확인 — 한 번 더 ─────────────── */

/**
 * 답변 수는 실제 값. FK: 답변은 발제 삭제 시 cascade, 답글·공감은 답변 삭제 시 cascade
 * (migration-discussion-thread.sql ③④⑤)
 */
function DeleteSheet({
  topic,
  answerCount,
  busy,
  onCancel,
  onConfirm,
}: {
  topic: DiscussionTopic
  answerCount: number
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Sheet onClose={onCancel}>
      <h3 className="text-[17px] font-extrabold leading-snug tracking-tight text-neutral-900">
        {topic.topic_no}번 발제 「{topic.title}」을 삭제할까요?
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-700">
        {answerCount > 0 ? (
          <>
            회원 화면에서도 사라지고, 달린 <b className="text-neutral-900">답변 {answerCount}개</b>와 그
            답글·공감도 함께 지워져요. 되돌릴 수 없어요.
          </>
        ) : (
          '회원 화면에서도 사라져요. 아직 달린 답변은 없어요. 되돌릴 수 없어요.'
        )}
      </p>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onCancel} className={`flex-[0_0_34%] lg:flex-1 ${btnBigLine}`}>
          취소
        </button>
        <button type="button" onClick={onConfirm} disabled={busy} className={`flex-1 ${btnBigDanger}`}>
          {busy ? '삭제하는 중…' : '삭제'}
        </button>
      </div>
    </Sheet>
  )
}

/* ─────────────── 폰 고정 바 · 확인 창 ─────────────── */

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

/**
 * 확인 창 — 폰은 아래에서 올라오는 시트(엄지 자리), 큰 화면은 ModalOverlay와 같은 가운데 창
 * (max-w-sm · p-6 · radius-lg · shadow-elevated · 배경 black/40 + blur 2px)
 */
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
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:px-5"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40"
        style={{ WebkitBackdropFilter: 'blur(2px)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
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
  onMenu,
  onEdit,
  onDelete,
}: {
  topic: DiscussionTopic
  answerCount: number
  onMenu: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex gap-2.5 py-3.5 lg:gap-3 lg:py-4">
      <span className="mt-px flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-neutral-100 text-xs font-extrabold text-neutral-700">
        {t.topic_no}
      </span>
      <div className="min-w-0 flex-1">
        <b className="block break-keep text-[14.5px] font-extrabold tracking-tight text-neutral-900">{t.title}</b>
        {t.quote && (
          <p className="mt-1.5 break-keep text-[13px] leading-relaxed text-neutral-700">
            “{t.quote}”
            {t.quote_page && (
              <span className="ml-1 whitespace-nowrap text-neutral-600">{t.quote_page}쪽</span>
            )}
          </p>
        )}
        <p className="mt-1 line-clamp-2 break-keep text-[13px] leading-relaxed text-neutral-800 lg:line-clamp-none">
          {t.question}
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          답변 {answerCount}개
          {t.notified_at === null && ' · 알림 대기'}
        </p>
      </div>
      {/* 폰: ⋮ 하나 (44px, 좌우 음수 마진 없음 — 오른쪽 여백을 지킨다) */}
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
      {/* 큰 화면: 글자 버튼 둘 */}
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

/* ─────────────── 쓰기 / 고치기 ─────────────── */

function TopicForm({
  meetingId,
  topic,
  nextNo,
  applicantCount,
  onDone,
  onCancel,
  onDelete,
  deleteSheet,
}: {
  meetingId: string
  topic?: DiscussionTopic
  nextNo: number
  applicantCount: number
  onDone: () => void
  onCancel: () => void
  onDelete?: () => void
  deleteSheet: React.ReactNode
}) {
  const [form, setForm] = useState({
    topic_no: String(topic?.topic_no ?? nextNo),
    title: topic?.title ?? '',
    quote: topic?.quote ?? '',
    quote_page: topic?.quote_page ?? '',
    question: topic?.question ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = form.title.trim() !== '' && form.question.trim() !== ''

  async function save() {
    if (busy || !ready) return
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
            : { meeting_id: meetingId, ...body },
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
    'w-full rounded-[var(--radius-md)] border border-surface-300 bg-white px-3 py-2.5 text-base leading-relaxed text-neutral-900 focus:border-primary-500 focus:outline-none lg:text-sm'
  const labelCls = 'mb-1.5 block text-xs font-bold text-primary-700'
  const saveLabel = busy ? '저장 중…' : topic ? '저장' : '등록하기'
  const note = topic
    ? '고쳐도 알림은 다시 가지 않아요'
    : applicantCount > 0
      ? `등록하면 바로 회원에게 보여요. 신청자 ${applicantCount}명에게는 마지막 등록 10분 뒤 한 번에 알려요`
      : '등록하면 바로 회원에게 보여요'

  return (
    <div className="max-w-2xl pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="mt-5 mb-1 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-primary-500 hover:text-primary-700"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15 18 9 12 15 6" />
          </svg>
          발제 목록
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} className="flex min-h-11 items-center text-[13px] font-semibold text-error">
            삭제
          </button>
        )}
      </div>
      <h2 className="text-lg font-extrabold tracking-tight text-neutral-900">
        {topic ? `발제 ${topic.topic_no} 고치기` : '발제 쓰기'}
      </h2>
      <p className="mt-1 break-keep text-[13px] leading-relaxed text-neutral-600">{note}</p>

      <div className="mt-5 grid grid-cols-[64px_minmax(0,1fr)] gap-2.5 lg:gap-3">
        <div>
          <label className={labelCls}>번호</label>
          <input
            value={form.topic_no}
            onChange={(e) => setForm({ ...form, topic_no: e.target.value })}
            inputMode="numeric"
            readOnly={!topic}
            className={`${inputCls} text-center text-neutral-700 read-only:bg-surface-100`}
          />
        </div>
        <div>
          <label className={labelCls}>
            제목<span className="ml-0.5 text-accent-500">*</span>
          </label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="소제목 (예: 사랑과 관념)"
            className={inputCls}
          />
        </div>
      </div>
      {!topic && <p className="mt-1 text-xs text-neutral-600">번호는 차례대로 붙어요</p>}
      <div className="mt-4">
        <label className={labelCls}>
          인용문<span className="ml-1 font-medium text-neutral-600">선택</span>
        </label>
        <textarea
          value={form.quote}
          onChange={(e) => setForm({ ...form, quote: e.target.value })}
          rows={3}
          className={`${inputCls} resize-y`}
        />
      </div>
      <div className="mt-4">
        <label className={labelCls}>
          쪽수<span className="ml-1 font-medium text-neutral-600">선택</span>
        </label>
        <input
          value={form.quote_page}
          onChange={(e) => setForm({ ...form, quote_page: e.target.value })}
          placeholder="예: 289"
          inputMode="numeric"
          className={`${inputCls} !w-[120px]`}
        />
      </div>
      <div className="mt-4">
        <label className={labelCls}>
          질문<span className="ml-0.5 text-accent-500">*</span>
        </label>
        <textarea
          value={form.question}
          onChange={(e) => setForm({ ...form, question: e.target.value })}
          rows={4}
          placeholder="예: 사랑에 관해 나만의 관념이 있었나요?"
          className={`${inputCls} resize-y`}
        />
      </div>
      {error && <p className="mt-3 text-xs font-semibold text-accent-600">{error}</p>}

      {/* 큰 화면 — 폼 끝 제자리 버튼 (MeetingForm과 같은 자리) */}
      <div className="mt-6 hidden justify-end gap-2 lg:flex">
        <button type="button" onClick={onCancel} className={btnBigLine}>
          취소
        </button>
        <button type="button" onClick={save} disabled={!ready || busy} className={btnBigPrimary}>
          {saveLabel}
        </button>
      </div>

      {/* 폰 — 고정 바가 취소·등록 */}
      <Dock>
        <button type="button" onClick={onCancel} className={`flex-1 ${btnBigLine}`}>
          취소
        </button>
        <button type="button" onClick={save} disabled={!ready || busy} className={`flex-1 ${btnBigPrimary}`}>
          {saveLabel}
        </button>
      </Dock>

      {deleteSheet}
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
  onClose,
}: {
  topics: DiscussionTopic[]
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
            <p className="mt-1 text-[13px] text-neutral-600">신청자에게 이렇게 보여요.</p>
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
