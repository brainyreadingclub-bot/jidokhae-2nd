import { describe, it, expect } from 'vitest'
import {
  splitPastedTopics,
  matchNumberLine,
  matchPage,
  matchQuoteLine,
  isTopicIncomplete,
} from '@/lib/topic-paste'

// 시안 B(2026-10-09 `B-발제문관리.html`)의 붙여넣기 칸에 실린 글 그대로
const MOCKUP_B = `📚 10/27 토론모임 발제문

1. 사랑과 관념
"사랑은 변할 수 있다. 그러나 사랑에 대한 관념은 그러기가 쉽지 않다." (p.289)
사랑에 관해 나만의 관념이 있었나요? 책에서 가장 와닿았던 사랑 관련 문장과 새롭게 발견한 나의 관념 혹은 떠오른 생각에 대해 나눠봐요.

2) 도덕, 연애, 결혼 그리고 사랑
사랑은 그저 사랑일 뿐일까요? 도덕과 제도 테두리 속에서 성숙을 더해가는 것일까요?

3. 사랑이 실종된 현대
사랑은 힘을 잃은 것일까요? 아니면 다가오기 전에 너무 많은 허들을 두는 것일까요?

4. 질투
「질투는 사랑의 크기가 아니라 그가 느끼는 약점의 크기를 나타낸다」
어떻게 읽으셨나요?

5. 사람이 사랑을 이기지 못한다`

// 2026-08-14 시안(`2026-08-14-발제문-번개-배지-v2.html`)에 실린 발제문을 카톡 모양으로 —
// 원형 번호 · 쪽수 단독 줄 · 질문이 여러 줄로 나뉜 경우
const MOCKUP_0814 = `[9월 토론모임] 사랑의 생애 발제

① 사랑과 관념
“사랑은 변할 수 있다. 그러나 사랑에 대한 관념은 그러기가 쉽지 않다.”
289쪽
사랑에 관해 나만의 관념이 있었나요?
책에서 가장 와닿았던 사랑 관련 문장과 새롭게 발견한 나의 관념 혹은 떠오른 생각에 대해 나눠봐요.
② 도덕, 연애, 결혼 그리고 사랑
사랑은 그저 사랑일 뿐일까요? 도덕과 제도 테두리 속에서 성숙을 더해가는 것일까요?
③ 사랑이 실종된 현대
사랑은 힘을 잃은 것일까요? 아니면 다가오기 전에 너무 많은 허들을 두는 것일까요?
④ 질투
질투는 사랑의 크기가 아니라 그가 느끼는 약점의 크기를 나타냅니다. 어떻게 읽으셨나요?
⑤ 사람이 사랑을 이기지 못한다
사랑이 성숙해진 걸까요, 다루는 내가 성숙해진 걸까요?`

describe('splitPastedTopics — 시안 B 예시', () => {
  const r = splitPastedTopics(MOCKUP_B)

  it('발제 5개로 나눈다', () => {
    expect(r.topics).toHaveLength(5)
    expect(r.topics.map((t) => t.title)).toEqual([
      '사랑과 관념',
      '도덕, 연애, 결혼 그리고 사랑',
      '사랑이 실종된 현대',
      '질투',
      '사람이 사랑을 이기지 못한다',
    ])
  })

  it('머리말 줄은 발제에 넣지 않고 따로 돌려준다', () => {
    expect(r.ignored).toEqual(['📚 10/27 토론모임 발제문'])
  })

  it('따옴표 줄 = 인용문, 뒤의 (p.289) = 쪽수', () => {
    expect(r.topics[0].quote).toBe(
      '사랑은 변할 수 있다. 그러나 사랑에 대한 관념은 그러기가 쉽지 않다.',
    )
    expect(r.topics[0].quote_page).toBe('289')
  })

  it('물음표 뒤에 문장이 이어져도 질문을 자르지 않는다', () => {
    expect(r.topics[0].question).toBe(
      '사랑에 관해 나만의 관념이 있었나요? 책에서 가장 와닿았던 사랑 관련 문장과 새롭게 발견한 나의 관념 혹은 떠오른 생각에 대해 나눠봐요.',
    )
  })

  it('물음표 문장 두 개가 한 질문에 그대로 남는다', () => {
    expect(r.topics[1].question).toBe(
      '사랑은 그저 사랑일 뿐일까요? 도덕과 제도 테두리 속에서 성숙을 더해가는 것일까요?',
    )
    expect(r.topics[1].quote).toBeNull()
  })

  it('「 」 인용문 + 쪽수 없음', () => {
    expect(r.topics[3].quote).toBe('질투는 사랑의 크기가 아니라 그가 느끼는 약점의 크기를 나타낸다')
    expect(r.topics[3].quote_page).toBeNull()
    expect(r.topics[3].question).toBe('어떻게 읽으셨나요?')
  })

  it('질문을 못 찾은 발제는 질문이 빈 채로 — 공개 전 채워야 한다', () => {
    expect(r.topics[4].question).toBe('')
    expect(isTopicIncomplete(r.topics[4])).toBe(true)
    expect(isTopicIncomplete(r.topics[0])).toBe(false)
  })
})

describe('splitPastedTopics — 2026-08-14 원문 예시', () => {
  const r = splitPastedTopics(MOCKUP_0814)

  it('원형 번호로도 5개로 나눈다', () => {
    expect(r.topics).toHaveLength(5)
    expect(r.ignored).toEqual(['[9월 토론모임] 사랑의 생애 발제'])
  })

  it('쪽수만 있는 줄은 쪽수로, 여러 줄 질문은 한 질문으로 이어 붙인다', () => {
    expect(r.topics[0].quote_page).toBe('289')
    expect(r.topics[0].question).toBe(
      '사랑에 관해 나만의 관념이 있었나요? 책에서 가장 와닿았던 사랑 관련 문장과 새롭게 발견한 나의 관념 혹은 떠오른 생각에 대해 나눠봐요.',
    )
  })

  it('따옴표 없는 인용 + 물음표 문장은 전부 질문 (버리는 줄 없음)', () => {
    expect(r.topics[3].quote).toBeNull()
    expect(r.topics[3].question).toBe(
      '질투는 사랑의 크기가 아니라 그가 느끼는 약점의 크기를 나타냅니다. 어떻게 읽으셨나요?',
    )
  })
})

describe('splitPastedTopics — 경계', () => {
  it('빈 글 → 발제 0개', () => {
    expect(splitPastedTopics('')).toEqual({ topics: [], ignored: [] })
    expect(splitPastedTopics('\n\n  \n')).toEqual({ topics: [], ignored: [] })
  })

  it('번호 줄이 하나도 없으면 전부 ignored — 아무것도 만들지 않는다', () => {
    const r = splitPastedTopics('그냥 메모\n두 번째 줄')
    expect(r.topics).toEqual([])
    expect(r.ignored).toEqual(['그냥 메모', '두 번째 줄'])
  })

  it('번호만 있는 줄이면 다음 줄이 제목', () => {
    const r = splitPastedTopics('발제 1\n사랑과 관념\n어땠나요?')
    expect(r.topics[0].title).toBe('사랑과 관념')
    expect(r.topics[0].question).toBe('어땠나요?')
  })

  it('CRLF 줄바꿈도 같은 결과', () => {
    const r = splitPastedTopics('1. 가\r\n질문?\r\n2. 나\r\n질문2?')
    expect(r.topics.map((t) => [t.title, t.question])).toEqual([
      ['가', '질문?'],
      ['나', '질문2?'],
    ])
  })

  it('따옴표로 시작해도 뒤에 글이 이어지면 인용문이 아니라 질문', () => {
    const r = splitPastedTopics('1. 제목\n"사랑"이라는 말, 어떻게 들리세요?')
    expect(r.topics[0].quote).toBeNull()
    expect(r.topics[0].question).toBe('"사랑"이라는 말, 어떻게 들리세요?')
  })
})

describe('번호 · 쪽수 · 인용문 판정', () => {
  it('번호 형식 네 가지', () => {
    expect(matchNumberLine('1. 사랑')).toBe('사랑')
    expect(matchNumberLine('12) 사랑')).toBe('사랑')
    expect(matchNumberLine('③ 사랑')).toBe('사랑')
    expect(matchNumberLine('발제 2. 사랑')).toBe('사랑')
    expect(matchNumberLine('발제2 사랑')).toBe('사랑')
  })

  it('번호처럼 보이지만 아닌 줄', () => {
    expect(matchNumberLine('1.5배 빨라졌다')).toBeNull()
    expect(matchNumberLine('2023년에 읽었어요')).toBeNull()
    expect(matchNumberLine('사랑은 1. 무엇인가')).toBeNull()
  })

  it('쪽수 표기', () => {
    expect(matchPage('p.289')).toBe('289')
    expect(matchPage('(p.289)')).toBe('289')
    expect(matchPage('P 289')).toBe('289')
    expect(matchPage('289쪽')).toBe('289')
    expect(matchPage('289p')).toBe('289')
    expect(matchPage('pp.12-13')).toBe('12-13')
    expect(matchPage('289')).toBeNull()
    expect(matchPage('289쪽을 보면')).toBeNull()
  })

  it('인용문 줄', () => {
    expect(matchQuoteLine('“가나다” 289쪽')).toEqual({ text: '가나다', page: '289' })
    expect(matchQuoteLine('『가나다』')).toEqual({ text: '가나다', page: null })
    expect(matchQuoteLine('"가나다')).toBeNull()
    expect(matchQuoteLine('가나다')).toBeNull()
  })
})
