import { describe, it, expect } from 'vitest'
import { topicStatusLabel, needsTopicAction, countTopicsByMeeting } from '@/lib/topic-status'
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
