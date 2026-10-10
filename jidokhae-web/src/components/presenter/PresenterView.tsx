'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 발제자 링크 — 쓰기 화면 (로그인 없음, 2차 · 시안 F1·F2).
 * 회원(토스) 스킨. 14px 미만 보조 글씨는 tg-600 이상(R4).
 *
 * 🔴 저장이 실패해도 쓰던 글을 지우지 않는다(대표님 5번). 이유 한 줄 + 「쓴 내용 복사」.
 *    쓰는 중인 글은 이 기기에 계속 임시 저장해 두어 새로 고쳐도 남는다.
 * 🔴 그새 다른 곳에서 고쳤으면 덮어쓰지 않고 「새로 불러올까요?」(6번) — 쓰던 글은 그대로 둔다.
 * 고치기는 이 기기에서 쓴 발제만(7번) — 기기 표시는 이 브라우저가 기억하는 무작위 값.
 */

type ListTopic = {
  id: string
  topic_no: number
  title: string
  published: boolean
  mine: boolean
  quote?: string | null
  quote_page?: string | null
  question?: string
  updated_at?: string
}

type Form = { title: string; quote: string; quote_page: string; question: string }
const EMPTY: Form = { title: '', quote: '', quote_page: '', question: '' }

type Problem = { code: string; message: string } | null

const DEVICE_KEY = 'jdkh-presenter-device'

function getDeviceId(): string {
  try {
    const saved = localStorage.getItem(DEVICE_KEY)
    if (saved && /^[A-Za-z0-9_-]{22,64}$/.test(saved)) return saved
    const bytes = new Uint8Array(24)
    crypto.getRandomValues(bytes)
    const id = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    localStorage.setItem(DEVICE_KEY, id)
    return id
  } catch {
    // 저장소를 못 쓰는 브라우저(시크릿 모드 일부) — 이번 화면에서만 쓰는 값
    return 'nostore-' + Math.random().toString(36).slice(2).padEnd(24, 'x')
  }
}

function formToText(f: Form): string {
  const lines = [f.title.trim()]
  if (f.quote.trim()) lines.push(`"${f.quote.trim()}"${f.quote_page.trim() ? ` (${f.quote_page.trim()}쪽)` : ''}`)
  lines.push(f.question.trim())
  return lines.filter(Boolean).join('\n')
}

export default function PresenterView({
  token,
  meetingTitle,
  meetingWhen,
  closesLabel,
}: {
  token: string
  meetingTitle: string
  meetingWhen: string
  closesLabel: string
}) {
  const draftKey = `jdkh-presenter-draft:${token}`
  const deviceRef = useRef<string>('')
  const [topics, setTopics] = useState<ListTopic[]>([])
  const [nextNo, setNextNo] = useState<number | null>(null)
  const [capReached, setCapReached] = useState(false)
  const [editing, setEditing] = useState<ListTopic | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saved, setSaved] = useState<number | null>(null) // 방금 저장한 발제 번호 (F2)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Problem>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async (): Promise<ListTopic[] | null> => {
    try {
      const res = await fetch(`/api/presenter/${token}/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: deviceRef.current }),
      })
      const json = await res.json().catch(() => ({}))
      if (json.status !== 'success') {
        if (json.code === 'closed') setProblem({ code: 'closed', message: '이 링크는 닫혔어요' })
        return null
      }
      setTopics(json.data.topics)
      setNextNo(json.data.next_no)
      setCapReached(json.data.cap_reached)
      return json.data.topics as ListTopic[]
    } catch {
      return null
    }
  }, [token])

  // 처음: 기기 표시 + 이 기기에 남은 쓰던 글 되살리기 + 목록
  useEffect(() => {
    deviceRef.current = getDeviceId()
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const d = JSON.parse(raw) as { form?: Form; editing?: ListTopic | null }
        if (d.form) setForm({ ...EMPTY, ...d.form })
        if (d.editing) setEditing(d.editing)
      }
    } catch {
      /* 되살리기 실패는 무시 — 빈 화면으로 시작 */
    }
    load()
  }, [draftKey, load])

  // 쓰는 중인 글은 계속 이 기기에 임시 저장
  useEffect(() => {
    try {
      const empty = !form.title && !form.quote && !form.quote_page && !form.question
      if (empty && !editing) localStorage.removeItem(draftKey)
      else localStorage.setItem(draftKey, JSON.stringify({ form, editing }))
    } catch {
      /* 저장소를 못 쓰면 그냥 넘어간다 */
    }
  }, [form, editing, draftKey])

  const ready = form.title.trim() !== '' && form.question.trim() !== ''

  async function save() {
    if (busy || !ready) return
    setBusy(true)
    setProblem(null)
    setCopied(false)
    const body = {
      device: deviceRef.current,
      title: form.title,
      quote: form.quote,
      quote_page: form.quote_page,
      question: form.question,
      ...(editing ? { id: editing.id, expected_updated_at: editing.updated_at } : {}),
    }
    try {
      const res = await fetch(`/api/presenter/${token}/topics`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (json.status !== 'success') {
        // 실패 — 글은 그대로 둔다
        setProblem({
          code: json.code ?? 'server',
          message: json.message ?? '잠시 후 다시 저장해 주세요',
        })
        return
      }
      setSaved(json.data.topic_no)
      setForm(EMPTY)
      setEditing(null)
      try {
        localStorage.removeItem(draftKey)
      } catch {
        /* 무시 */
      }
      await load()
      window.scrollTo({ top: 0 })
    } catch {
      setProblem({ code: 'network', message: '인터넷 연결을 확인한 뒤 다시 저장해 주세요' })
    } finally {
      setBusy(false)
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(formToText(form))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  /** 6번 — 그새 다른 곳에서 고친 내용으로 새로 불러오기(쓰던 글은 이때 바뀐다. 먼저 복사할 수 있다) */
  async function reloadLatest() {
    if (!editing) return
    const list = await load()
    const latest = list?.find((t) => t.id === editing.id)
    if (latest && latest.mine && !latest.published) {
      setEditing(latest)
      setForm({
        title: latest.title,
        quote: latest.quote ?? '',
        quote_page: latest.quote_page ?? '',
        question: latest.question ?? '',
      })
      setProblem(null)
    } else {
      setProblem({
        code: latest?.published ? 'published' : 'deleted',
        message: latest?.published
          ? '그새 공개된 발제라 여기서는 고칠 수 없어요 — 운영자에게 말해 주세요'
          : '그새 이 발제가 지워졌어요',
      })
    }
  }

  function startEdit(t: ListTopic) {
    setSaved(null)
    setProblem(null)
    setEditing(t)
    setForm({
      title: t.title,
      quote: t.quote ?? '',
      quote_page: t.quote_page ?? '',
      question: t.question ?? '',
    })
    window.scrollTo({ top: 0 })
  }

  function startNew() {
    setSaved(null)
    setProblem(null)
    setEditing(null)
    setForm(EMPTY)
  }

  const inputCls =
    'w-full rounded-[12px] bg-tg-100 px-3.5 py-3 text-base leading-relaxed text-tg-900 outline-none focus:ring-2 focus:ring-brand resize-y'
  const labelCls = 'mb-1.5 block text-[13px] font-bold text-tg-800'
  const showForm = saved === null

  return (
    <main className="break-keep px-5 pt-1 pb-[calc(96px+env(safe-area-inset-bottom))]">
      <p className="text-xs font-bold text-brand-deep">발제 쓰기</p>
      <h1 className="mt-1 break-keep text-xl font-extrabold leading-snug tracking-tight">{meetingTitle}</h1>
      <p className="mt-1 text-[13px] text-tg-600">{meetingWhen}</p>

      {saved !== null ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-[18px] bg-brand-bg px-4 py-3.5 text-[13.5px] leading-relaxed text-tg-800">
          <span className="mt-px flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand text-xs font-extrabold text-white" aria-hidden>
            ✓
          </span>
          <span>
            <b className="text-brand-deep">발제 {saved}를 저장했어요.</b> 운영자가 확인한 뒤 공개해요. 공개 전까지는
            고칠 수 있어요.
          </span>
        </div>
      ) : (
        <div className="mt-4 rounded-[18px] bg-tg-100 px-4 py-3.5 text-[13px] leading-relaxed text-tg-700">
          로그인 없이 쓸 수 있어요. 저장한 발제는 <b className="text-tg-900">운영자가 확인한 뒤</b> 신청자에게
          공개돼요.
        </div>
      )}

      {/* 4번 — 이미 올라온 발제(공개된 것 + 이 기기에서 쓴 것) */}
      {topics.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[15px] font-extrabold tracking-tight">이 모임 발제</h2>
          <div className="mt-1.5">
            {topics.map((t) => (
              <div
                key={t.id}
                className="flex min-h-[60px] items-center gap-3 border-t border-tg-100 py-2.5 first:border-t-0"
              >
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px] bg-tg-100 text-xs font-extrabold text-tg-700">
                  {t.topic_no}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm font-bold">{t.title}</b>
                  <span className={`mt-0.5 block text-xs ${t.published ? 'font-bold text-brand-deep' : 'text-tg-600'}`}>
                    {t.published ? '공개됨' : editing?.id === t.id ? '공개 전 · 고치는 중' : '공개 전'}
                  </span>
                </span>
                {t.mine && !t.published && editing?.id !== t.id && (
                  <button
                    type="button"
                    onClick={() => startEdit(t)}
                    className="min-h-11 flex-none rounded-[10px] bg-tg-100 px-3.5 text-[13px] font-bold text-tg-800"
                  >
                    고치기
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {showForm && (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-extrabold tracking-tight">
              {editing ? `발제 ${editing.topic_no} 고치기` : '새 발제'}
            </h2>
            {editing && (
              <button type="button" onClick={startNew} className="min-h-11 text-[13px] font-bold text-tg-600">
                새 발제 쓰기
              </button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-[64px_minmax(0,1fr)] gap-2.5">
            <div>
              <label className={labelCls}>번호</label>
              <input
                value={editing ? editing.topic_no : (nextNo ?? '')}
                readOnly
                className={`${inputCls} text-center text-tg-600`}
              />
            </div>
            <div>
              <label className={labelCls}>
                제목<span className="ml-0.5 text-warnx">*</span>
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="예: 사랑과 관념"
                maxLength={200}
                className={inputCls}
              />
            </div>
          </div>
          {!editing && <p className="mt-1 text-xs text-tg-600">번호는 차례대로 붙어요</p>}
          <div className="mt-4">
            <label className={labelCls}>
              인용문<span className="ml-1 font-medium text-tg-600">선택</span>
            </label>
            <textarea
              value={form.quote}
              onChange={(e) => setForm({ ...form, quote: e.target.value })}
              rows={3}
              maxLength={2000}
              className={inputCls}
            />
          </div>
          <div className="mt-4">
            <label className={labelCls}>
              쪽수<span className="ml-1 font-medium text-tg-600">선택</span>
            </label>
            <input
              value={form.quote_page}
              onChange={(e) => setForm({ ...form, quote_page: e.target.value })}
              inputMode="numeric"
              maxLength={20}
              placeholder="예: 289"
              className={`${inputCls} !w-[120px]`}
            />
          </div>
          <div className="mt-4">
            <label className={labelCls}>
              질문<span className="ml-0.5 text-warnx">*</span>
            </label>
            <textarea
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              rows={4}
              maxLength={2000}
              placeholder="예: 사랑에 관해 나만의 관념이 있었나요?"
              className={inputCls}
            />
          </div>

          {/* 5번·6번 — 실패해도 글은 그대로. 이유 한 줄 + 복사 (+ 그새 고쳤으면 새로 불러오기) */}
          {problem && (
            <div role="alert" className="mt-4 rounded-[14px] bg-warnx-bg px-4 py-3 text-[13px] leading-relaxed text-tg-800">
              <p className="font-bold text-tg-900">
                {problem.code === 'conflict' ? '그새 다른 곳에서 고쳤어요. 새로 불러올까요?' : problem.message}
              </p>
              <p className="mt-0.5 text-xs text-tg-600">
                {problem.code === 'conflict'
                  ? '새로 불러오면 지금 쓴 글이 바뀌어요 — 먼저 복사해 두세요'
                  : '쓴 글은 지우지 않았어요. 복사해서 운영자에게 보낼 수 있어요'}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyText}
                  className="min-h-11 rounded-[10px] bg-white px-3.5 text-[13px] font-bold text-tg-800"
                >
                  {copied ? '복사했어요' : '쓴 내용 복사'}
                </button>
                {problem.code === 'conflict' && (
                  <button
                    type="button"
                    onClick={reloadLatest}
                    className="min-h-11 rounded-[10px] bg-white px-3.5 text-[13px] font-bold text-brand-deep"
                  >
                    새로 불러오기
                  </button>
                )}
              </div>
            </div>
          )}
          {capReached && !editing && !problem && (
            <p className="mt-4 rounded-[14px] bg-tg-100 px-4 py-3 text-[13px] text-tg-700">
              이 링크로 받을 수 있는 발제가 다 찼어요 — 운영자에게 말해 주세요
            </p>
          )}
        </section>
      )}

      <p className="mt-6 text-xs leading-relaxed text-tg-600">
        다른 폰이나 브라우저에서는 내가 쓴 발제를 고칠 수 없어요. 그땐 운영자에게 말해 주세요.
        <br />
        공개된 발제를 고치려면 운영자에게 말해 주세요.
        <br />이 링크는 {closesLabel}에 닫혀요.
      </p>

      {/* 아래 고정 버튼 — 회원 하단 버튼 규격(52px · 15px · 기존 그림자) */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-screen-sm bg-white px-5 pt-2.5 pb-[calc(12px+env(safe-area-inset-bottom))]"
        style={{ boxShadow: '0 -2px 10px rgba(25,31,40,.06)' }}
      >
        {showForm ? (
          <button
            type="button"
            onClick={save}
            disabled={!ready || busy || (capReached && !editing)}
            className="h-[52px] w-full rounded-[14px] bg-brand text-[15px] font-bold text-white disabled:bg-tg-200 disabled:text-tg-500"
          >
            {busy ? '저장하는 중…' : editing ? '고친 내용 저장' : '저장하기'}
          </button>
        ) : (
          <button
            type="button"
            onClick={startNew}
            disabled={capReached}
            className="h-[52px] w-full rounded-[14px] bg-brand text-[15px] font-bold text-white disabled:bg-tg-200 disabled:text-tg-500"
          >
            다음 발제 쓰기
          </button>
        )}
      </div>
    </main>
  )
}
