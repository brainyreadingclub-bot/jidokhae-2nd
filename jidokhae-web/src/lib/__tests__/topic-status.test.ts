import { describe, it, expect } from 'vitest'
import { topicStatusLabel, needsTopicAction, countTopicsByMeeting, isTopicPublishLate } from '@/lib/topic-status'
import { formatKSTDateTime } from '@/lib/kst'

describe('topicStatusLabel', () => {
  it('네 가지 모양', () => {
    expect(topicStatusLabel({ draft: 0, published: 0 })).toBe('발제문 없음')
    expect(topicStatusLabel({ draft: 3, published: 0 })).toBe('작성 중 3개')
    expect(topicStatusLabel({ draft: 0, published: 5 })).toBe('공개됨 5개')
    expect(topicStatusLabel({ draft: 2, published: 3 })).toBe('공개됨 3개 · 작성 중 2개')
  })
})

describe('needsTopicAction — 첫 화면에 띄울 모임', () => {
  it('발제문 없음 → 띄운다', () => expect(needsTopicAction({ draft: 0, published: 0 })).toBe(true))
  it('작성 중 있음 → 띄운다', () => expect(needsTopicAction({ draft: 1, published: 4 })).toBe(true))
  it('전부 공개 → 안 띄운다', () => expect(needsTopicAction({ draft: 0, published: 5 })).toBe(false))
})

describe('countTopicsByMeeting', () => {
  it('모임별로 작성 중/공개를 센다', () => {
    const m = countTopicsByMeeting([
      { meeting_id: 'a', published_at: null },
      { meeting_id: 'a', published_at: '2026-10-09T13:40:00Z' },
      { meeting_id: 'a', published_at: null },
      { meeting_id: 'b', published_at: '2026-10-09T13:40:00Z' },
    ])
    expect(m.get('a')).toEqual({ draft: 2, published: 1 })
    expect(m.get('b')).toEqual({ draft: 0, published: 1 })
    expect(m.get('c')).toBeUndefined()
  })
})

describe('formatKSTDateTime — 공개 시각 표시', () => {
  it('UTC를 KST로 바꿔 보여준다 (날짜가 넘어가는 경우 포함)', () => {
    expect(formatKSTDateTime('2026-10-09T13:40:00Z')).toBe('10월 9일 22:40')
    expect(formatKSTDateTime('2026-10-09T15:05:00Z')).toBe('10월 10일 00:05')
  })
})

describe('isTopicPublishLate — 공개 안 한 발제 경고 (D-3부터)', () => {
  const draft = { draft: 1, published: 2 }
  it('작성 중이 있고 모임까지 3일 이하(당일 포함)면 띄운다', () => {
    expect(isTopicPublishLate(draft, 3)).toBe(true)
    expect(isTopicPublishLate(draft, 1)).toBe(true)
    expect(isTopicPublishLate(draft, 0)).toBe(true)
  })
  it('4일 이상 남았거나 지난 모임이면 안 띄운다', () => {
    expect(isTopicPublishLate(draft, 4)).toBe(false)
    expect(isTopicPublishLate(draft, -1)).toBe(false)
  })
  it('작성 중이 없으면 안 띄운다', () => {
    expect(isTopicPublishLate({ draft: 0, published: 3 }, 1)).toBe(false)
    expect(isTopicPublishLate({ draft: 0, published: 0 }, 1)).toBe(false)
  })
})
