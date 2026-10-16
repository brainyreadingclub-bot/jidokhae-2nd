'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  COMMENT_MAX,
  MOODS,
  REGRET_OPTIONS,
  REGRET_OTHER_MAX,
  charLength,
  commentPublicState,
  isLowMood,
  reviewMeetingLabel,
  type ReviewStep,
} from '@/lib/review-rules'
import { formatKoreanDate, formatKoreanTime, formatMeetingFeeForScreen, formatMonthDay } from '@/lib/kst'
import type { MyReview } from '@/lib/review'
import type { BookSearchResult } from '@/types/book'
import MoodFace from '@/components/next/review/MoodFace'
import {
  Cta,
  DoneIcon,
  FlowHeader,
  FootBar,
  Question,
  QuestionSub,
  SaveError,
  SkipButton,
  SummaryRow,
} from '@/components/next/review/ReviewChrome'

/**
 * 모임 후기 흐름 (시안 `docs/시안-공유/2026-10-12-모임후기/` #s02~#s13).
 *
 * - 한 화면 = 한 질문. 단계는 서버가 준 `steps` 배열을 따른다(칭찬은 2단계에서 그 배열에 끼운다)
 * - **각 단계 「다음」에서 바로 저장한다** — 표정이 뒤 단계 이탈로 사라지지 않게. 저장이 실패하면
 *   쓴 내용은 그대로 두고 다시 누르게 한다(시안 13)
 * - ④ 책 담기는 새 표가 아니라 지금 물어보기 경로(`/api/library/ask {action:'answer'}`)를 그대로 쓴다
 */

export type ReviewInitial = 'flow' | 'absent' | 'already' | 'expired'

export type ReviewNextMeeting = {
  id: string
  date: string
  time: string
  region: string | null
  location: string | null
  fee: number
}

type Props = {
  meeting: { id: string; date: string; region: string | null }
  nickname: string
  initial: ReviewInitial
  /** 후기 받는 기간 안인가 — 「잘못 눌렀어요」로 되돌아갈 수 있는지 */
  canEdit: boolean
  deadline: string
  review: MyReview | null
  steps: ReviewStep[]
  nextMeeting: ReviewNextMeeting | null
  hasPendingAsk: boolean
}

type Screen = 'step' | 'absent' | 'done' | 'already' | 'expired'

const SAVE_FAIL = '저장하지 못했어요. 쓴 내용은 그대로 있으니 다시 눌러 주세요.'

export default function ReviewFlow(props: Props) {
  const { meeting, steps } = props
  const router = useRouter()
  const label = reviewMeetingLabel(meeting.date, meeting.region)
  const shortLabel = reviewMeetingLabel(meeting.date, meeting.region, false)

  const [screen, setScreen] = useState<Screen>(props.initial === 'flow' ? 'step' : props.initial)
  const [stepIndex, setStepIndex] = useState(0)
  const [saved, setSaved] = useState<MyReview | null>(props.review)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ① 표정
  const [mood, setMood] = useState<number | null>(props.review?.mood ?? null)
  const [regrets, setRegrets] = useState<string[]>(props.review?.regret_codes ?? [])
  const [regretOther, setRegretOther] = useState(props.review?.regret_other ?? '')
  // ② 한 줄 소감
  const [comment, setComment] = useState(props.review?.comment ?? '')
  const [isPublic, setIsPublic] = useState(props.review?.comment_public ?? false)
  // ④ 책
  const [addedBook, setAddedBook] = useState<string | null>(null)

  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1

  function goNext() {
    setError(null)
    if (isLast) setScreen('done')
    else setStepIndex((i) => i + 1)
    window.scrollTo(0, 0)
  }

  function goBack() {
    setError(null)
    if (stepIndex === 0) router.push('/me')
    else setStepIndex((i) => i - 1)
  }

  async function post(body: Record<string, unknown>): Promise<MyReview | null> {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: meeting.id, ...body }),
      })
      const json = await res.json().catch(() => null)
      if (json?.status === 'success') {
        const review = json.data?.review as MyReview
        setSaved(review)
        return review
      }
      // 흐름 도중 기간이 끝났다(자정을 넘긴 경우 등) — 막다른 저장 실패 대신 「기간 지남」으로
      if (json?.data?.reason === 'expired') {
        setScreen('expired')
        return null
      }
      setError(json?.status === 'error' && res.status === 400 && json.message ? json.message : SAVE_FAIL)
      return null
    } catch {
      setError(SAVE_FAIL)
      return null
    } finally {
      setSaving(false)
    }
  }

  async function saveMood() {
    const ok = await post({ action: 'mood', mood, regretCodes: regrets, regretOther })
    if (ok) goNext()
  }

  async function saveAbsent() {
    const ok = await post({ action: 'absent' })
    if (ok) {
      setMood(null)
      setRegrets([])
      setComment('')
      setIsPublic(false)
      setScreen('absent')
    }
  }

  async function saveComment() {
    const ok = await post({ action: 'comment', comment, isPublic })
    if (ok) goNext()
  }

  // ─── 화면들 ───

  if (screen === 'absent') {
    return (
      <Shell>
        <FlowHeader title="모임 후기" backHref="/me" />
        <DoneIcon muted />
        <Question>알려주셔서 고마워요</Question>
        <QuestionSub>
          {shortLabel}은 후기 없이 넘어갈게요.
          <br />
          다음 모임에서 만나요.
        </QuestionSub>
        <FootBar>
          {error && <SaveError>{error}</SaveError>}
          <Cta tone="soft" href="/home">
            홈으로
          </Cta>
          {props.canEdit && (
            <SkipButton
              onClick={() => {
                setError(null)
                setStepIndex(0)
                setScreen('step')
              }}
            >
              잘못 눌렀어요 · 후기 남기기
            </SkipButton>
          )}
        </FootBar>
      </Shell>
    )
  }

  if (screen === 'expired') {
    return (
      <Shell>
        <FlowHeader title="모임 후기" backHref="/me" />
        <h1 className="mt-[30px] text-[23px] font-extrabold leading-[1.36] tracking-[-0.03em] text-tg-900">
          후기 받는 기간이
          <br />
          끝났어요
        </h1>
        <QuestionSub>
          {shortLabel} 후기는 {formatMonthDay(props.deadline)}까지 받았어요. 다음 모임 뒤에 다시
          여쭤볼게요.
        </QuestionSub>
        <FootBar>
          {/* 막다른 길이 되지 않게 — 그 모임 책 담기가 아직 열려 있으면 서재로 (계획서 §3-5) */}
          {props.hasPendingAsk ? (
            <>
              <Cta href="/shelf">읽은 책 서재에 담기</Cta>
              <SkipButton href="/home">홈으로</SkipButton>
            </>
          ) : (
            <Cta tone="soft" href="/home">
              홈으로
            </Cta>
          )}
        </FootBar>
      </Shell>
    )
  }

  if (screen === 'done' || screen === 'already') {
    const done = screen === 'done'
    const state = saved ? commentPublicState(saved) : 'none'
    const commentSub =
      state === 'public'
        ? done
          ? <>모임 소개에 공개 중 · <span className="whitespace-nowrap">나 › 내가 남긴 후기</span>에서 내릴 수 있어요</>
          : '모임 소개에 공개 중'
        : state === 'admin_hidden'
          ? '운영자가 모임 소개에서 내렸어요'
          : '운영자만 봐요'
    const next = props.nextMeeting
    return (
      <Shell>
        <FlowHeader title="모임 후기" backHref={done ? undefined : '/me'} />
        {done ? (
          <>
            <DoneIcon />
            <Question>후기를 남겼어요</Question>
          </>
        ) : (
          <h1 className="mt-[30px] text-[23px] font-extrabold leading-[1.36] tracking-[-0.03em] text-tg-900">
            이 모임 후기는
            <br />
            이미 남겼어요
          </h1>
        )}
        <QuestionSub>{shortLabel}</QuestionSub>

        {(saved?.comment || addedBook) && (
          <div className="mt-7">
            {saved?.comment && <SummaryRow label="한 줄 소감" value={saved.comment} sub={commentSub} />}
            {addedBook && <SummaryRow label="서재" value={addedBook} sub="서재에 담았어요" />}
          </div>
        )}

        {done && (
          <>
            <h3 className="mb-1 mt-5 text-[13.5px] font-bold tracking-tight text-tg-600">
              다음 {meeting.region ? `${meeting.region} ` : ''}정기모임
            </h3>
            {next ? (
              <NextMeetingCard m={next} />
            ) : (
              <p className="mt-2 rounded-[18px] bg-tg-100 px-4 py-3.5 text-[13.5px] leading-relaxed text-tg-700 break-keep">
                {meeting.region ? `${meeting.region} ` : ''}정기모임 다음 일정은 아직 안 올라왔어요. 다른
                지역 모임은 모임 탭에서 볼 수 있어요.
              </p>
            )}
          </>
        )}

        <FootBar>
          {done ? (
            <>
              <Cta href={next ? `/meet/${next.id}` : '/meet'}>
                {next ? '신청하러 가기' : '모임 목록 보기'}
              </Cta>
              <SkipButton href="/home">홈으로</SkipButton>
            </>
          ) : saved?.comment ? (
            <>
              <Cta tone="soft" href="/me/reviews">
                공개 설정 바꾸기
              </Cta>
              <SkipButton href="/home">홈으로</SkipButton>
            </>
          ) : (
            <Cta tone="soft" href="/home">
              홈으로
            </Cta>
          )}
        </FootBar>
      </Shell>
    )
  }

  // ─── 단계 ───
  const header = (
    <FlowHeader title="모임 후기" onBack={goBack} step={{ index: stepIndex, total: steps.length }} />
  )

  if (step === 'mood') {
    const low = isLowMood(mood)
    return (
      <Shell>
        {header}
        <p className="mt-[22px] text-[13px] font-bold text-brand-deep">{label}</p>
        <h1 className="mt-1.5 text-[23px] font-extrabold leading-[1.36] tracking-[-0.03em] text-tg-900">
          그날 모임,
          <br />
          어땠어요?
        </h1>
        <QuestionSub>표정은 운영자만 봐요. 다음 모임을 꾸릴 때 참고할게요.</QuestionSub>

        <div className="mt-8 flex justify-between" role="radiogroup" aria-label="그날 모임 표정">
          {MOODS.map((m) => {
            const on = mood === m.value
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMood(m.value)}
                className="flex w-[58px] flex-col items-center gap-2"
              >
                <MoodFace value={m.value} on={on} />
                <span
                  className={`whitespace-nowrap text-xs tracking-[-0.03em] ${
                    on ? 'font-extrabold text-tg-900' : 'font-semibold text-tg-600'
                  }`}
                >
                  {m.label}
                </span>
              </button>
            )
          })}
        </div>

        {low ? (
          <>
            <p className="mt-[30px] text-base font-extrabold tracking-tight text-tg-900">무엇이 아쉬웠나요?</p>
            <p className="mt-1 text-[13px] text-tg-600">여러 개 골라도, 안 골라도 돼요 · 운영자만 봐요</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {REGRET_OPTIONS.map((o) => {
                const on = regrets.includes(o.code)
                return (
                  <button
                    key={o.code}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setRegrets((cur) => (on ? cur.filter((c) => c !== o.code) : [...cur, o.code]))
                    }
                    className={`inline-flex min-h-[38px] items-center rounded-xl px-[13px] text-[13.5px] tracking-tight ${
                      on ? 'bg-brand-bg font-extrabold text-brand-deep' : 'bg-tg-100 font-semibold text-tg-700'
                    }`}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
            {regrets.includes('other') && (
              <input
                type="text"
                value={regretOther}
                onChange={(e) => setRegretOther(Array.from(e.target.value).slice(0, REGRET_OTHER_MAX).join(''))}
                placeholder="짧게 적어 주세요 (운영자만 봐요)"
                aria-label="기타 — 무엇이 아쉬웠나요"
                className="mt-3 h-12 w-full rounded-[14px] bg-tg-100 px-4 text-[15px] text-tg-900 placeholder:text-tg-400 focus:outline-none"
              />
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={saveAbsent}
            disabled={saving}
            className="mx-auto mt-[26px] block text-sm font-bold text-tg-600 underline decoration-tg-300 underline-offset-[3px] disabled:opacity-50"
          >
            이 모임에 못 갔어요
          </button>
        )}

        <FootBar>
          {error && <SaveError>{error}</SaveError>}
          <Cta onClick={saveMood} disabled={mood === null || saving}>
            {saving ? '저장 중' : error ? '다시 저장하기' : '다음'}
          </Cta>
        </FootBar>
      </Shell>
    )
  }

  if (step === 'comment') {
    const count = charLength(comment)
    const hasText = comment.trim() !== ''
    // 저장된 소감을 지우는 것도 「다음」으로 저장할 수 있게 — 비었는데 예전 글이 있으면 켠다
    const canSave = hasText || Boolean(saved?.comment)
    const hidden = Boolean(saved?.comment_hidden_at)
    return (
      <Shell>
        {header}
        <Question>한 줄로 남겨볼까요?</Question>
        <QuestionSub>안 써도 괜찮아요.</QuestionSub>

        <div className="mt-[22px] flex min-h-[120px] flex-col rounded-2xl bg-tg-100 px-4 pb-3 pt-3.5">
          <textarea
            value={comment}
            onChange={(e) => setComment(Array.from(e.target.value).slice(0, COMMENT_MAX).join(''))}
            placeholder="그날 기억에 남은 것 한 줄"
            aria-label="한 줄 소감"
            rows={3}
            className="flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-tg-900 placeholder:text-tg-400 focus:outline-none"
          />
          <span className="self-end text-xs tabular-nums text-tg-500">
            {count} / {COMMENT_MAX}
          </span>
        </div>

        {hidden ? (
          <p className="mt-4 text-[13px] leading-relaxed text-tg-600">
            운영자가 이 소감을 모임 소개에서 내렸어요. 운영자만 봐요.
          </p>
        ) : (
          <label className="mt-4 flex cursor-pointer items-start gap-[11px]">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="peer sr-only"
            />
            <span
              className={`mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-brand ${
                isPublic ? 'border-brand bg-brand' : 'border-tg-300'
              }`}
              aria-hidden
            >
              {isPublic && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
            <span>
              <span className="block text-[15px] font-bold tracking-tight text-tg-900">모임 소개에 공개해도 좋아요</span>
              <span className="mt-[3px] block text-[13px] leading-relaxed text-tg-700">처음 오는 분께 도움이 돼요.</span>
              <span className="mt-[3px] block text-[13px] leading-relaxed text-tg-600 break-keep">
                {isPublic ? (
                  <>
                    닉네임과 함께 {meeting.region ? `${meeting.region} ` : ''}정기모임 소개에 보여요.{' '}
                    <span className="whitespace-nowrap">나 › 내가 남긴 후기</span>에서 언제든 내릴 수 있어요.
                  </>
                ) : (
                  '체크하지 않으면 운영자만 봐요.'
                )}
              </span>
            </span>
          </label>
        )}

        {isPublic && hasText && !hidden && (
          <div className="mt-3.5 rounded-[14px] bg-tg-50 px-3.5 py-3">
            <p className="text-xs font-bold text-tg-500">이렇게 보여요</p>
            <p className="mt-1.5 text-sm leading-relaxed text-tg-800 break-keep">
              {comment.trim()}
              <span className="mt-[3px] block text-xs font-bold text-tg-600">
                {props.nickname} · {formatMonthDay(meeting.date)} 모임
              </span>
            </p>
          </div>
        )}

        <FootBar>
          {error && <SaveError>{error}</SaveError>}
          <Cta onClick={saveComment} disabled={!canSave || saving}>
            {saving ? '저장 중' : error ? '다시 저장하기' : isLast ? '후기 마치기' : '다음'}
          </Cta>
          <SkipButton onClick={goNext} disabled={saving}>
            {isLast ? '건너뛰고 마치기' : '건너뛰기'}
          </SkipButton>
        </FootBar>
      </Shell>
    )
  }

  // step === 'book'
  return (
    <Shell>
      {header}
      <BookStep
        meetingId={meeting.id}
        onAdded={(title) => {
          setAddedBook(title)
          setScreen('done')
          window.scrollTo(0, 0)
        }}
        onSkip={goNext}
      />
    </Shell>
  )
}

/** 본문 — 하단 고정 버튼에 가리지 않게 아래 여백을 둔다 */
function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ paddingBottom: 'calc(9rem + env(safe-area-inset-bottom, 0px))' }}>{children}</div>
}

function NextMeetingCard({ m }: { m: ReviewNextMeeting }) {
  const day = Number(m.date.slice(8, 10))
  // "10월 21일 (수)"에서 요일만 — 날짜 계산은 kst.ts 한 벌
  const weekday = formatKoreanDate(m.date).match(/\((.)\)/)?.[1] ?? ''
  return (
    <div
      className="mt-2 flex items-center gap-3.5 rounded-[20px] bg-white px-4 py-3.5"
      style={{ boxShadow: 'var(--shadow-toss-card)' }}
    >
      <span className="w-10 flex-none text-center">
        <b className="block text-[22px] font-extrabold leading-[1.1] tracking-[-0.03em] tabular-nums text-tg-900">{day}</b>
        <small className="block text-[11px] font-bold text-tg-600">{weekday}</small>
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-sm font-bold tracking-tight text-tg-900">
          {reviewMeetingLabel(m.date, m.region, false)}
        </b>
        <small className="mt-0.5 block truncate text-xs text-tg-600">
          {[formatKoreanTime(m.time), m.location].filter(Boolean).join(' · ')}
        </small>
      </span>
      <span className="flex-none text-sm font-bold tabular-nums text-tg-800">{formatMeetingFeeForScreen(m.fee)}</span>
    </div>
  )
}

/**
 * ④ 그날 읽은 책 담기 (시안 09). 지금 물어보기 경로를 그대로 쓴다 —
 * `library_entries`(source='ask', 출처 = 그 모임) + `book_asks` answered. 화면은 'review'로 남긴다.
 * 「건너뛰기」는 아무것도 쓰지 않는다 — dismissed로 쓰면 서재 띠 안전망이 닫힌다 (계획서 §6)
 */
function BookStep({
  meetingId,
  onAdded,
  onSkip,
}: {
  meetingId: string
  onAdded: (title: string) => void
  onSkip: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 노출 기록(최초 1회) — 후기 경로에서도 북극성 분모가 같은 장부(book_asks)에 쌓이게
  useEffect(() => {
    fetch('/api/library/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'view', meetingId }),
    }).catch(() => {})
  }, [meetingId])

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setError(null)
    setPicked(null)
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json.status !== 'success') throw new Error('search failed')
      setResults(json.data as BookSearchResult[])
      setSearched(true)
    } catch {
      setError('검색하지 못했어요. 잠시 뒤 다시 찾아 주세요.')
    } finally {
      setSearching(false)
    }
  }

  async function finish() {
    if (picked === null) return
    const book = results[picked]
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/library/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'answer', meetingId, book, surface: 'review' }),
      })
      const json = await res.json().catch(() => null)
      if (json?.status !== 'success') throw new Error('add failed')
      onAdded(book.title)
    } catch {
      setError(SAVE_FAIL)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Question>
        그날 읽은 책,
        <br />
        서재에 담을까요?
      </Question>
      <QuestionSub>담은 책은 서재 탭에 쌓여요.</QuestionSub>

      <form onSubmit={search} className="mt-[22px] flex h-12 items-center gap-2 rounded-[14px] bg-tg-100 pl-3.5 pr-1.5">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="flex-none text-tg-500" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="책 제목 일부만 넣어도 돼요"
          aria-label="책 찾기"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-tg-900 placeholder:text-tg-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="h-9 flex-none rounded-[10px] bg-white px-3 text-[13px] font-bold text-tg-700 disabled:opacity-50"
        >
          {searching ? '찾는 중' : '찾기'}
        </button>
      </form>

      {searched && results.length === 0 && (
        <p className="mt-3 text-[13px] leading-relaxed text-tg-600 break-keep">
          찾는 책이 안 보이면 제목을 조금 줄이거나 띄어쓰기를 바꿔 다시 찾아 보세요.
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-2" role="radiogroup" aria-label="찾은 책">
          {results.map((b, i) => {
            const on = picked === i
            return (
              <li key={`${b.isbn13 ?? 'x'}-${i}`} className="border-t border-tg-100 first:border-t-0">
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(i)}
                  className="flex w-full items-center gap-[13px] py-[11px] text-left"
                >
                  {b.thumbnail ? (
                    // 카카오 CDN — next/image 금지(remotePatterns에 없음, kakao-books.ts)
                    <img src={b.thumbnail} alt="" width={44} height={64} className="h-16 w-11 flex-none rounded object-cover" />
                  ) : (
                    <span className="flex h-16 w-11 flex-none items-end rounded bg-tg-200 p-1 text-[8px] font-bold leading-tight text-tg-600">
                      {b.title}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[14.5px] font-bold tracking-tight text-tg-900">{b.title}</b>
                    <small className="mt-[3px] block truncate text-[12.5px] text-tg-600">
                      {[b.authors, b.publisher].filter(Boolean).join(' · ')}
                    </small>
                  </span>
                  <span
                    className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 ${
                      on ? 'border-brand bg-brand' : 'border-tg-300'
                    }`}
                    aria-hidden
                  >
                    {on && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <FootBar>
        {error && <SaveError>{error}</SaveError>}
        <Cta onClick={finish} disabled={picked === null || saving}>
          {saving ? '담는 중' : error ? '다시 저장하기' : '후기 마치기'}
        </Cta>
        <SkipButton onClick={onSkip} disabled={saving}>
          책은 건너뛰고 마치기
        </SkipButton>
      </FootBar>
    </>
  )
}
