import { describe, it, expect } from 'vitest'
import {
  DETAIL_MAX,
  describeCoverage,
  formatKstStamp,
  isMissingTableError,
  summarizeStages,
  truncateDetail,
} from '@/lib/payment-failure-report'

describe('isMissingTableError — 표가 없는 환경에서 대사가 죽지 않아야 한다', () => {
  it('Postgres undefined_table(42P01)을 표 없음으로 본다', () => {
    expect(isMissingTableError({ code: '42P01', message: 'relation "payment_failures" does not exist' })).toBe(true)
  })

  it('PostgREST 스키마 캐시 코드(PGRST205)를 표 없음으로 본다', () => {
    expect(
      isMissingTableError({
        code: 'PGRST205',
        message: "Could not find the table 'public.payment_failures' in the schema cache",
      }),
    ).toBe(true)
  })

  it('코드가 비어 와도 메시지로 판정한다', () => {
    expect(isMissingTableError({ message: 'Could not find the table in the schema cache' })).toBe(true)
    expect(isMissingTableError({ code: null, message: 'relation does not exist' })).toBe(true)
  })

  it('권한·네트워크 같은 다른 실패를 표 없음으로 오인하지 않는다', () => {
    expect(isMissingTableError({ code: '42501', message: 'permission denied for table payment_failures' })).toBe(false)
    expect(isMissingTableError({ code: 'PGRST301', message: 'JWT expired' })).toBe(false)
    expect(isMissingTableError(null)).toBe(false)
    expect(isMissingTableError(undefined)).toBe(false)
  })
})

describe('summarizeStages — 한 종류가 몰린 것 자체가 신호다', () => {
  it('건수 내림차순으로 센다', () => {
    expect(
      summarizeStages([
        { stage: 'id_lookup_failed' },
        { stage: 'confirm_rejected' },
        { stage: 'id_lookup_failed' },
        { stage: 'id_lookup_failed' },
      ]),
    ).toEqual([
      { stage: 'id_lookup_failed', count: 3 },
      { stage: 'confirm_rejected', count: 1 },
    ])
  })

  it('건수가 같으면 이름순 — 실행마다 순서가 흔들리면 비교를 못 한다', () => {
    expect(summarizeStages([{ stage: 'b_stage' }, { stage: 'a_stage' }])).toEqual([
      { stage: 'a_stage', count: 1 },
      { stage: 'b_stage', count: 1 },
    ])
  })

  it('빈 목록은 빈 요약', () => {
    expect(summarizeStages([])).toEqual([])
  })
})

describe('truncateDetail — 잘랐으면 잘랐다고 말한다', () => {
  it('짧은 원문은 그대로 둔다', () => {
    expect(truncateDetail('42883 operator does not exist')).toBe('42883 operator does not exist')
  })

  it('줄바꿈·연속 공백은 한 칸으로 눌러 한 줄로 만든다', () => {
    expect(truncateDetail('앞줄\n  뒷줄')).toBe('앞줄 뒷줄')
  })

  it('상한을 넘으면 자르되 몇 자 중 몇 자인지 붙인다', () => {
    const long = 'x'.repeat(DETAIL_MAX + 40)
    const out = truncateDetail(long)
    expect(out.startsWith('x'.repeat(DETAIL_MAX))).toBe(true)
    expect(out).toContain(`원문 ${DETAIL_MAX + 40}자 중 ${DETAIL_MAX}자만 표시`)
  })

  it('null·공백은 빈 칸 표시로', () => {
    expect(truncateDetail(null)).toBe('-')
    expect(truncateDetail('   ')).toBe('-')
  })
})

describe('formatKstStamp', () => {
  it('UTC ISO를 KST로 옮겨 적는다', () => {
    expect(formatKstStamp('2026-09-10T05:30:00.000Z')).toBe('2026-09-10 14:30 KST')
  })

  it('날짜 경계를 넘겨도 맞다', () => {
    expect(formatKstStamp('2026-09-10T16:00:00.000Z')).toBe('2026-09-11 01:00 KST')
  })

  it('파싱 못 하는 값은 버리지 않고 원문을 돌려준다', () => {
    expect(formatKstStamp('(형식 밖)')).toBe('(형식 밖)')
  })
})

describe('describeCoverage — 조용한 절단 금지', () => {
  it('전부 받아 전부 보여줬으면 아무 말도 안 한다', () => {
    expect(describeCoverage(12, 12, 12)).toEqual([])
  })

  it('받아온 게 전체보다 적으면 알린다', () => {
    const notes = describeCoverage(5000, 2000, 2000)
    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('5000건 중 최근 2000건만 받아왔다')
  })

  it('표시만 줄였으면 그것도 알린다', () => {
    const notes = describeCoverage(120, 120, 50)
    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('120건 중 최근 50건만 표시했다')
  })

  it('둘 다 잘렸으면 두 줄 다 나온다', () => {
    expect(describeCoverage(5000, 2000, 50)).toHaveLength(2)
  })
})
