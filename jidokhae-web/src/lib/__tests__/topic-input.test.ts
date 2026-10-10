import { describe, it, expect } from 'vitest'
import { normalizeTopicInput, classifySaveFailure } from '@/lib/topic-input'

describe('normalizeTopicInput', () => {
  it('앞뒤 공백을 자르고 빈 선택 칸은 null', () => {
    expect(
      normalizeTopicInput({ title: ' 질투 ', quote: '  ', quote_page: '', question: ' 어떻게? ' }),
    ).toEqual({ title: '질투', quote: null, quote_page: null, question: '어떻게?' })
  })
  it('제목이나 질문이 비면 거절', () => {
    expect(normalizeTopicInput({ title: '질투', question: '' })).toBeNull()
    expect(normalizeTopicInput({ title: '', question: '어떻게?' })).toBeNull()
  })
  it('너무 길면 거절', () => {
    expect(normalizeTopicInput({ title: 'a'.repeat(201), question: 'q' })).toBeNull()
    expect(normalizeTopicInput({ title: 't', question: 'q'.repeat(2001) })).toBeNull()
  })
  it('객체가 아니면 거절', () => {
    expect(normalizeTopicInput(null)).toBeNull()
    expect(normalizeTopicInput('x')).toBeNull()
  })
})

describe('classifySaveFailure — 덮어쓰지 않고 이유를 가른다', () => {
  const base = { published_at: null, updated_at: '2026-10-10T10:00:00Z' }
  it('행이 없으면 지워진 것', () => {
    expect(classifySaveFailure(null, { forbidPublished: true })).toBe('deleted')
  })
  it('발제자 링크: 공개된 발제는 고칠 수 없다', () => {
    expect(
      classifySaveFailure({ ...base, published_at: '2026-10-10T11:00:00Z' }, { forbidPublished: true }),
    ).toBe('published')
  })
  it('운영자: 공개된 발제도 고칠 수 있으니 공개는 실패 이유가 아니다', () => {
    expect(
      classifySaveFailure({ ...base, published_at: '2026-10-10T11:00:00Z' }, { forbidPublished: false }),
    ).toBe('conflict')
  })
  it('다른 기기가 쓴 발제', () => {
    expect(classifySaveFailure({ ...base, mine: false }, { forbidPublished: true })).toBe('not_mine')
  })
  it('나머지는 그새 다른 곳에서 고친 것', () => {
    expect(classifySaveFailure({ ...base, mine: true }, { forbidPublished: true })).toBe('conflict')
  })
})
