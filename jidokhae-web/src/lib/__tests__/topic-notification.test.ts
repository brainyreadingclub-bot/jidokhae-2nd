import { describe, it, expect } from 'vitest'
import { renderTopicPosted, topicPostedTitle } from '@/lib/topic-notification'

describe('topic_posted 알림 문구', () => {
  it('첫 공개 — 「발제문 N개가 올라왔어요」 + 모임 이름', () => {
    expect(
      renderTopicPosted({ meeting_id: 'm', meeting_title: '조찬모임', count: 5, more: false }),
    ).toEqual({ title: '발제문 5개가 올라왔어요', sub: '조찬모임' })
  })

  it('추가 공개 — 「발제문 N개가 더 올라왔어요」', () => {
    expect(renderTopicPosted({ meeting_id: 'm', meeting_title: '조찬모임', count: 2, more: true }))
      .toEqual({ title: '발제문 2개가 더 올라왔어요', sub: '조찬모임' })
  })

  it('옛 payload(발제 1건 = 알림 1건)도 깨지지 않는다', () => {
    expect(renderTopicPosted({ meeting_id: 'm', topic_no: 3, title: '질투' })).toEqual({
      title: '새 발제문이 올라왔어요',
      sub: '발제 3 · 질투',
    })
  })

  it('payload가 비어도 제목은 나온다', () => {
    expect(renderTopicPosted({})).toEqual({ title: '새 발제문이 올라왔어요', sub: undefined })
  })

  it('topicPostedTitle', () => {
    expect(topicPostedTitle(1, false)).toBe('발제문 1개가 올라왔어요')
    expect(topicPostedTitle(3, true)).toBe('발제문 3개가 더 올라왔어요')
  })
})
