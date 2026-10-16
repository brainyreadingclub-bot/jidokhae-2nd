import { describe, it, expect } from 'vitest'
import {
  buildCommentPatch,
  buildPublishPatch,
  buildReviewSteps,
  chooseDayAfterNotice,
  commentPublicState,
  findFirstTimers,
  getReviewWindow,
  isLowMood,
  judgeReregistration,
  normalizeCommentInput,
  normalizeMoodInput,
  pickNextRegularMeeting,
  pickReviewTargets,
  resolveMyRedirect,
  reviewDeadline,
  reviewMeetingLabel,
  summarizeMeetingReviews,
} from '@/lib/review-rules'

describe('후기 받는 기간 — 모임 다음 날 ~ 3일 뒤 (KST 날짜 단위)', () => {
  const meeting = '2026-10-14'
  it('모임 당일·이전은 아직 아니다', () => {
    expect(getReviewWindow(meeting, '2026-10-13')).toBe('before')
    expect(getReviewWindow(meeting, '2026-10-14')).toBe('before')
  })
  it('다음 날부터 3일 뒤까지 열린다', () => {
    expect(getReviewWindow(meeting, '2026-10-15')).toBe('open')
    expect(getReviewWindow(meeting, '2026-10-17')).toBe('open')
  })
  it('4일 뒤 ~ 7일 뒤는 「기간 지남」 안내, 그 뒤는 닫힘', () => {
    expect(getReviewWindow(meeting, '2026-10-18')).toBe('expired')
    expect(getReviewWindow(meeting, '2026-10-21')).toBe('expired')
    expect(getReviewWindow(meeting, '2026-10-22')).toBe('closed')
  })
  it('달이 바뀌어도 날짜로 센다', () => {
    expect(getReviewWindow('2026-10-30', '2026-11-02')).toBe('open')
    expect(getReviewWindow('2026-10-30', '2026-11-03')).toBe('expired')
    expect(reviewDeadline('2026-10-30')).toBe('2026-11-02')
  })
  it('마감일은 모임 3일 뒤', () => {
    expect(reviewDeadline(meeting)).toBe('2026-10-17')
  })
})

describe('낮은 점수 분기 — 1·2만 「무엇이 아쉬웠나요?」', () => {
  it('1·2는 낮은 표정, 3~5는 아니다', () => {
    expect([1, 2, 3, 4, 5].map(isLowMood)).toEqual([true, true, false, false, false])
    expect(isLowMood(null)).toBe(false)
  })
  it('낮은 표정이면 고른 아쉬운 점을 화면 순서로 남긴다 (모르는 코드·중복은 버린다)', () => {
    const r = normalizeMoodInput({ mood: 2, regretCodes: ['space', 'short_time', 'hack', 'space'] })
    expect(r).toEqual({ ok: true, value: { mood: 2, regret_codes: ['short_time', 'space'], regret_other: null } })
  })
  it('🔴 표정을 3 이상으로 올리면 아쉬운 점을 같이 비운다 (안 비우면 DB CHECK에 걸린다)', () => {
    const r = normalizeMoodInput({ mood: 4, regretCodes: ['space'], regretOther: '시끄러움' })
    expect(r).toEqual({ ok: true, value: { mood: 4, regret_codes: [], regret_other: null } })
  })
  it('낮은 표정인데 하나도 안 골라도 저장된다 (「안 골라도 돼요」)', () => {
    expect(normalizeMoodInput({ mood: 1, regretCodes: [] })).toEqual({
      ok: true,
      value: { mood: 1, regret_codes: [], regret_other: null },
    })
  })
  it('「기타」 글은 기타를 골랐을 때만, 50자까지', () => {
    expect(normalizeMoodInput({ mood: 2, regretCodes: ['space'], regretOther: '덥다' })).toMatchObject({
      ok: true,
      value: { regret_other: null },
    })
    expect(normalizeMoodInput({ mood: 2, regretCodes: ['other'], regretOther: '  덥다 ' })).toMatchObject({
      ok: true,
      value: { regret_codes: ['other'], regret_other: '덥다' },
    })
    expect(normalizeMoodInput({ mood: 2, regretCodes: ['other'], regretOther: '가'.repeat(51) }).ok).toBe(false)
  })
  it('표정이 없거나 범위 밖이면 거절', () => {
    expect(normalizeMoodInput({ mood: null }).ok).toBe(false)
    expect(normalizeMoodInput({ mood: 6 }).ok).toBe(false)
    expect(normalizeMoodInput({ mood: 2.5 }).ok).toBe(false)
  })
})

describe('한 줄 소감 · 공개', () => {
  it('빈 소감은 null이고 공개도 꺼진다 (공개는 소감이 있어야)', () => {
    expect(normalizeCommentInput({ comment: '   ', isPublic: true })).toEqual({
      ok: true,
      value: { comment: null, isPublic: false },
    })
  })
  it('100자 넘으면 거절 — 이모지는 한 글자로 센다', () => {
    expect(normalizeCommentInput({ comment: '가'.repeat(101), isPublic: false }).ok).toBe(false)
    expect(normalizeCommentInput({ comment: '📚'.repeat(100), isPublic: false }).ok).toBe(true)
  })
  it('🔴 운영자가 내린 소감은 회원이 다시 공개할 수 없다', () => {
    const hidden = { comment: '좋았다', comment_public: false, comment_hidden_at: '2026-10-15T01:00:00Z' }
    expect(buildCommentPatch(hidden, { comment: '좋았다', isPublic: true }, 'now')).toEqual({
      ok: false,
      reason: 'hidden',
    })
    expect(buildPublishPatch(hidden, true, 'now')).toEqual({ ok: false, reason: 'hidden' })
    // 내리는 쪽(비공개 유지)은 된다
    expect(buildCommentPatch(hidden, { comment: '고침', isPublic: false }, 'now').ok).toBe(true)
  })
  it('새로 공개하면 공개 시각을 남기고, 공개를 끄면 회원이 내린 시각을 남긴다', () => {
    const none = null
    expect(buildCommentPatch(none, { comment: 'a', isPublic: true }, 'T1')).toEqual({
      ok: true,
      patch: { comment: 'a', comment_public: true, comment_published_at: 'T1' },
    })
    const pub = { comment: 'a', comment_public: true, comment_hidden_at: null }
    expect(buildCommentPatch(pub, { comment: 'a', isPublic: false }, 'T2')).toEqual({
      ok: true,
      patch: { comment: 'a', comment_public: false, comment_unpublished_at: 'T2' },
    })
    // 공개 중 같은 글 그대로면 공개 시각을 안 바꾼다
    expect(buildCommentPatch(pub, { comment: 'a', isPublic: true }, 'T3')).toEqual({
      ok: true,
      patch: { comment: 'a', comment_public: true },
    })
  })
  it('나 › 내가 남긴 후기 — 공개하기 / 공개 그만하기', () => {
    const priv = { comment: 'a', comment_public: false, comment_hidden_at: null }
    expect(buildPublishPatch(priv, true, 'T')).toEqual({
      ok: true,
      patch: { comment_public: true, comment_published_at: 'T' },
    })
    expect(buildPublishPatch(priv, false, 'T')).toEqual({ ok: false, reason: 'noop' })
    expect(buildPublishPatch({ ...priv, comment: null }, true, 'T')).toEqual({ ok: false, reason: 'no_comment' })
  })
  it('공개 상태 — 운영자 내림이 회원 상태보다 앞선다', () => {
    expect(commentPublicState({ comment: null, comment_public: false, comment_hidden_at: null })).toBe('none')
    expect(commentPublicState({ comment: 'a', comment_public: true, comment_hidden_at: null })).toBe('public')
    expect(
      commentPublicState({ comment: 'a', comment_public: false, comment_hidden_at: 'x', comment_unpublished_at: 'y' }),
    ).toBe('admin_hidden')
    expect(
      commentPublicState({ comment: 'a', comment_public: false, comment_hidden_at: null, comment_unpublished_at: 'y' }),
    ).toBe('member_unpublished')
    expect(commentPublicState({ comment: 'a', comment_public: false, comment_hidden_at: null })).toBe('private')
  })
})

describe('흐름 단계 — 배열(칭찬 자리)', () => {
  it('책 담기가 열려 있으면 3단계, 아니면 2단계', () => {
    expect(buildReviewSteps({ bookStep: true })).toEqual(['mood', 'comment', 'book'])
    expect(buildReviewSteps({ bookStep: false })).toEqual(['mood', 'comment'])
  })
  it('🔴 칭찬은 아직 없다 (DECISIONS 2026-10-16)', () => {
    expect(buildReviewSteps({ bookStep: true })).not.toContain('praise')
  })
})

describe('마침 화면 — 같은 지역 다음 정기모임 고르기', () => {
  const base = { time: '19:00', meeting_type: 'regular', status: 'active' }
  const ms = [
    { ...base, id: 'past', date: '2026-10-14', region: '경주' },
    { ...base, id: 'pohang', date: '2026-10-16', region: '포항' },
    { ...base, id: 'disc', date: '2026-10-17', region: '경주', meeting_type: 'discussion' },
    { ...base, id: 'deleted', date: '2026-10-18', region: '경주', status: 'deleted' },
    { ...base, id: 'gj-late', date: '2026-10-21', region: '경주', time: '20:00' },
    { ...base, id: 'gj-early', date: '2026-10-21', region: '경주', time: '10:00', full: true },
    { ...base, id: 'gj-28', date: '2026-10-28', region: '경주' },
  ]
  it('같은 지역 · 정기 · active · 오늘 이후 중 가장 빠른 것 (같은 날이면 시간순)', () => {
    expect(pickNextRegularMeeting(ms, '경주', '2026-10-16', new Set())?.id).toBe('gj-early')
  })
  it('마감된 모임도 후보다 — 홈 「다가오는 정기모임」 칸과 같은 규칙', () => {
    // gj-early는 정원이 찬 모임이다 (full) — 빼지 않는다
    expect(pickNextRegularMeeting(ms, '경주', '2026-10-16', new Set())?.id).toBe('gj-early')
  })
  it('오늘 열리는 모임은 포함, 내가 이미 신청한 모임은 뺀다', () => {
    expect(pickNextRegularMeeting(ms, '포항', '2026-10-16', new Set())?.id).toBe('pohang')
    expect(pickNextRegularMeeting(ms, '경주', '2026-10-16', new Set(['gj-early', 'gj-late']))?.id).toBe('gj-28')
  })
  it('없으면 null (→ 「모임 목록 보기」), 지역을 모르면 null', () => {
    expect(pickNextRegularMeeting(ms, '대구', '2026-10-16', new Set())).toBeNull()
    expect(pickNextRegularMeeting(ms, null, '2026-10-16', new Set())).toBeNull()
  })
})

describe('/my 분기', () => {
  const p = (meetingId: string, date: string, meetingType = 'regular', meetingStatus = 'active') => ({
    meetingId,
    date,
    meetingType,
    meetingStatus,
  })
  const today = '2026-10-16'

  it('기간 안 · 안 남긴 정기모임 중 가장 최근 것', () => {
    const r = pickReviewTargets([p('a', '2026-10-13'), p('b', '2026-10-15'), p('c', '2026-10-16')], new Set(), new Set(), today)
    expect(r.open).toEqual({ meetingId: 'b', date: '2026-10-15' })
  })
  it('이미 남긴 모임 · 토론모임 · 삭제된 모임은 빼고, 같은 모임 두 행은 하나로', () => {
    const r = pickReviewTargets(
      [p('b', '2026-10-15'), p('b', '2026-10-15'), p('d', '2026-10-14', 'discussion'), p('x', '2026-10-14', 'regular', 'deleted'), p('a', '2026-10-13')],
      new Set(['b']),
      new Set(),
      today,
    )
    expect(r.open).toEqual({ meetingId: 'a', date: '2026-10-13' })
  })
  it('기간 지남(4~7일 뒤)은 후기 알림톡을 받은 모임만', () => {
    const parts = [p('old', '2026-10-10')]
    expect(pickReviewTargets(parts, new Set(), new Set(), today).expired).toBeNull()
    expect(pickReviewTargets(parts, new Set(), new Set(['old']), today).expired).toEqual({
      meetingId: 'old',
      date: '2026-10-10',
    })
    // 8일 뒤는 닫힘
    expect(pickReviewTargets([p('older', '2026-10-08')], new Set(), new Set(['older']), today).expired).toBeNull()
  })

  const base = {
    nextUi: true,
    loggedIn: true,
    reviewEnabled: true,
    openReviewMeetingId: null,
    expiredReviewMeetingId: null,
    hasPendingAsk: false,
  }
  it('후기가 물어보기보다 앞이다', () => {
    expect(resolveMyRedirect({ ...base, openReviewMeetingId: 'm1', hasPendingAsk: true })).toBe('/review/m1')
    expect(resolveMyRedirect({ ...base, expiredReviewMeetingId: 'm2', hasPendingAsk: true })).toBe('/review/m2')
    expect(resolveMyRedirect({ ...base, openReviewMeetingId: 'm1', expiredReviewMeetingId: 'm2' })).toBe('/review/m1')
  })
  it('🔴 스위치가 꺼져 있으면 지금 동작 그대로 (물어보기 → /shelf, 없으면 /me)', () => {
    expect(resolveMyRedirect({ ...base, reviewEnabled: false, openReviewMeetingId: 'm1', hasPendingAsk: true })).toBe('/shelf')
    expect(resolveMyRedirect({ ...base, reviewEnabled: false, openReviewMeetingId: 'm1' })).toBe('/me')
  })
  it('next_ui가 꺼져 있거나 로그인 전이면 구 화면 (null)', () => {
    expect(resolveMyRedirect({ ...base, nextUi: false, openReviewMeetingId: 'm1' })).toBeNull()
    expect(resolveMyRedirect({ ...base, loggedIn: false, openReviewMeetingId: 'm1' })).toBeNull()
  })
})

describe('10:00 크론 스위치 — 무엇을 보낼지', () => {
  const on = { reviewEnabled: true, nextUiEnabled: true, reviewTemplateId: 'KA01TP-REVIEW' }
  it('셋 다 맞을 때만 meeting_review', () => {
    expect(chooseDayAfterNotice(on)).toBe('meeting_review')
  })
  it('🔴 스위치가 꺼져 있으면 book_ask', () => {
    expect(chooseDayAfterNotice({ ...on, reviewEnabled: false })).toBe('book_ask')
  })
  it('🔴 템플릿 env가 없거나 비었으면 book_ask (실패 행이 재시도를 막는다)', () => {
    expect(chooseDayAfterNotice({ ...on, reviewTemplateId: undefined })).toBe('book_ask')
    expect(chooseDayAfterNotice({ ...on, reviewTemplateId: '' })).toBe('book_ask')
    expect(chooseDayAfterNotice({ ...on, reviewTemplateId: '   ' })).toBe('book_ask')
  })
  it('next_ui가 꺼져 있으면 book_ask (후기 화면이 next_ui 뒤에 있다)', () => {
    expect(chooseDayAfterNotice({ ...on, nextUiEnabled: false })).toBe('book_ask')
  })
})

describe('운영자 숫자', () => {
  it('🔴 분자(후기)는 분모(참여자)와 교집합 — 참여를 취소한 사람의 후기는 세지 않는다', () => {
    const s = summarizeMeetingReviews(
      ['u1', 'u2', 'u3', 'u4'],
      [
        { user_id: 'u1', did_not_attend: false, mood: 5, regret_codes: [] },
        { user_id: 'u2', did_not_attend: false, mood: 2, regret_codes: ['space', 'short_time'] },
        { user_id: 'u3', did_not_attend: true, mood: null, regret_codes: [] },
        { user_id: 'gone', did_not_attend: false, mood: 1, regret_codes: ['space'] },
      ],
    )
    expect(s).toMatchObject({ participants: 4, reviewed: 2, absent: 1, notYet: 1, moodAvg: 3.5, lowCount: 1 })
    expect(s.moodCounts).toEqual({ 1: 0, 2: 1, 3: 0, 4: 0, 5: 1 })
    // 같은 수면 화면 순서 (short_time이 space보다 앞)
    expect(s.regretCounts).toEqual([
      { code: 'short_time', count: 1 },
      { code: 'space', count: 1 },
    ])
  })
  it('후기가 없으면 평균은 null', () => {
    expect(summarizeMeetingReviews(['u1'], []).moodAvg).toBeNull()
  })

  it('첫 모임 = DB상 처음 참여한 정기모임', () => {
    const parts = [
      { user_id: 'new', meeting_id: 'm2', date: '2026-10-14' },
      { user_id: 'new', meeting_id: 'm3', date: '2026-10-21' },
      { user_id: 'old', meeting_id: 'm1', date: '2026-09-30' },
      { user_id: 'old', meeting_id: 'm2', date: '2026-10-14' },
    ]
    expect(findFirstTimers('m2', ['new', 'old'], parts)).toEqual(['new'])
  })

  const meeting = { id: 'm2', date: '2026-10-14' }
  const h = (meeting_id: string, created_at: string, meeting_date: string) => ({
    user_id: 'u',
    meeting_id,
    created_at,
    meeting_date,
    region: '경주',
  })
  it('14일 안 재신청 (가) — 모임 뒤 14일 안 새 신청, 취소 건도 센다', () => {
    const r = judgeReregistration('u', meeting, [h('m3', '2026-10-20T03:00:00Z', '2026-10-28')], '2026-10-29')
    expect(r).toEqual({ kind: 'yes', meetingDate: '2026-10-28', region: '경주' })
  })
  it('(나) — 그 모임 전에 이미 신청해 둔 다음 모임', () => {
    const r = judgeReregistration('u', meeting, [h('m3', '2026-10-01T03:00:00Z', '2026-11-11')], '2026-10-16')
    expect(r.kind).toBe('yes')
  })
  it('KST로 날짜를 가른다 — UTC 15:00 이후는 다음 날이다', () => {
    // 2026-10-14T15:30Z = KST 10-15 00:30 → 모임 다음 날 신청 (가)
    const late = judgeReregistration('u', meeting, [h('m3', '2026-10-14T15:30:00Z', '2026-10-01')], '2026-10-16')
    expect(late.kind).toBe('yes')
    // 2026-10-14T14:30Z = KST 10-14 23:30 → 모임 당일 신청, 그 모임보다 앞선 모임이면 재신청 아님
    const same = judgeReregistration('u', meeting, [h('m0', '2026-10-14T14:30:00Z', '2026-10-01')], '2026-10-16')
    expect(same.kind).toBe('pending')
  })
  it('기한이 남았으면 「아직 · N일 남음」, 지나면 「안 했어요」', () => {
    expect(judgeReregistration('u', meeting, [], '2026-10-15')).toEqual({ kind: 'pending', daysLeft: 13 })
    expect(judgeReregistration('u', meeting, [], '2026-10-28')).toEqual({ kind: 'pending', daysLeft: 0 })
    expect(judgeReregistration('u', meeting, [], '2026-10-29')).toEqual({ kind: 'no' })
  })
})

describe('모임 이름', () => {
  it('제목 대신 날짜 + 지역 (정기모임 제목은 매번 같다)', () => {
    expect(reviewMeetingLabel('2026-10-14', '경주')).toBe('10월 14일 (수) 경주 정기모임')
    expect(reviewMeetingLabel('2026-10-14', '경주', false)).toBe('10월 14일 경주 정기모임')
    expect(reviewMeetingLabel('2026-10-14', null, false)).toBe('10월 14일 정기모임')
  })
})
