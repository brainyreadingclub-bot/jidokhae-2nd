import { describe, it, expect } from 'vitest'
import { safeUuid } from '@/lib/payment-failure'

/**
 * 실패 원장의 제1원칙은 "행을 잃지 않는 것"이다.
 * UUID 컬럼에 이상한 값이 들어가 INSERT가 통째로 거절되면, 하필 가장 수상한
 * 요청의 기록이 사라진다. 그 자리를 막는 가드의 테스트.
 */
describe('safeUuid — 이상한 값 때문에 기록 자체를 잃지 않는다', () => {
  it('정상 UUID는 그대로 통과한다', () => {
    expect(safeUuid('20425c26-4b1e-4b3a-9f0c-1a2b3c4d5e6f')).toEqual({
      uuid: '20425c26-4b1e-4b3a-9f0c-1a2b3c4d5e6f',
      note: null,
    })
  })

  it('대문자 UUID도 통과한다 (Postgres가 정규화한다)', () => {
    expect(safeUuid('20425C26-4B1E-4B3A-9F0C-1A2B3C4D5E6F').uuid).not.toBeNull()
  })

  it('UUID가 아니면 null로 돌리고 원문을 note에 남긴다 — 버리지 않는다', () => {
    const result = safeUuid('not-a-uuid')
    expect(result.uuid).toBeNull()
    expect(result.note).toContain('not-a-uuid')
  })

  it('SQL/제어문자가 섞인 긴 입력도 잘라서 남긴다', () => {
    const result = safeUuid('x'.repeat(500))
    expect(result.uuid).toBeNull()
    expect(result.note!.length).toBeLessThan(120)
  })

  it('없는 값(null/undefined/빈 문자열)은 조용히 null — 잡음을 남기지 않는다', () => {
    expect(safeUuid(null)).toEqual({ uuid: null, note: null })
    expect(safeUuid(undefined)).toEqual({ uuid: null, note: null })
    expect(safeUuid('')).toEqual({ uuid: null, note: null })
  })
})
