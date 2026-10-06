import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  DETAIL_MAX,
  describeCoverage,
  formatKstStamp,
  isMissingTableError,
  isObservationStage,
  OBSERVE_DETAIL_MAX,
  partitionFailureRows,
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

/**
 * 「막아낸 것」을 사고에서 분리한다 (2026-10-06 관찰계획 ④).
 *
 * 왜 중요한가 — 분리하지 않으면 중복이 막힐 때마다 사고 건수가 올라가고, 상시 점등된
 * 경고는 아무도 안 본다. 그러면 **진짜 사고가 그 밑에 묻힌다.**
 */
describe('partitionFailureRows — 막아낸 것은 사고가 아니다', () => {
  const rows = [
    { stage: 'duplicate_call_blocked', payment_id: 'p1' },
    { stage: 'id_lookup_failed', payment_id: 'p2' },
    { stage: 'duplicate_call_blocked', payment_id: 'p3' },
    { stage: 'confirm_rejected', payment_id: 'p4' },
  ]

  it('관찰 단계만 observations로 간다', () => {
    const { incidents, observations } = partitionFailureRows(rows)
    expect(observations.map((r) => r.payment_id)).toEqual(['p1', 'p3'])
    expect(incidents.map((r) => r.payment_id)).toEqual(['p2', 'p4'])
  })

  it('🔴 버리지 않는다 — 두 쪽을 합치면 원래 건수다', () => {
    const { incidents, observations } = partitionFailureRows(rows)
    expect(incidents.length + observations.length).toBe(rows.length)
  })

  it('입력 순서(최근순)를 그대로 지킨다', () => {
    const { incidents } = partitionFailureRows([
      { stage: 'confirm_rejected', payment_id: 'late' },
      { stage: 'duplicate_call_blocked', payment_id: 'skip' },
      { stage: 'confirm_rejected', payment_id: 'early' },
    ])
    expect(incidents.map((r) => r.payment_id)).toEqual(['late', 'early'])
  })

  it('사고 요약(summarizeStages)에 막아낸 건이 섞이지 않는다', () => {
    const { incidents } = partitionFailureRows(rows)
    expect(summarizeStages(incidents).map((s) => s.stage)).not.toContain('duplicate_call_blocked')
  })

  it('기존 사고 단계를 관찰로 오인하지 않는다', () => {
    expect(isObservationStage('duplicate_call_blocked')).toBe(true)
    for (const stage of [
      'payment_id_malformed',
      'id_lookup_failed',
      'id_lookup_empty',
      'id_lookup_ambiguous',
      'confirm_rejected',
      'unhandled_exception',
    ]) {
      expect(isObservationStage(stage)).toBe(false)
    }
  })

  it('관찰 줄은 UA 끝(KAKAOTALK)이 잘리지 않을 만큼 길게 보여준다', () => {
    // 안드로이드 카카오톡 인앱 브라우저 UA (약 180자). 가르고 싶은 `KAKAOTALK`이 맨 뒤다.
    const ua =
      'ua=Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.119 Mobile Safari/537.36 KAKAOTALK 10.4.5'
    // 사고 줄 상한(DETAIL_MAX)에서는 핵심 단서가 잘려 나간다
    expect(truncateDetail(ua, DETAIL_MAX)).not.toContain('KAKAOTALK')
    // 관찰 줄 상한에서는 온전히 보인다
    expect(truncateDetail(ua, OBSERVE_DETAIL_MAX)).toContain('KAKAOTALK')
  })
})

/**
 * 🔴 **만들어놓고 안 부른** 사고 방지 트립와이어.
 *
 * 이 저장소는 순수 함수를 만들고 호출부를 배선하지 않아 "테스트는 통과하는데 실제로는
 * 동작하지 않는" 일을 이미 겪었다(2026-08-21 토론모임 환불 7/3, PR #64). 이번 기록도
 * 라우트가 부르지 않으면 **영원히 0건**이고, 0건은 "조용하다"로 오독된다.
 *
 * 라우트 레벨 테스트 하네스가 이 저장소에 없어서(선례 0건) 소스 존재 검사로 대신한다.
 * 약한 검증이라는 것을 알고 둔다 — 호출 여부만 보고 호출 조건은 못 본다.
 */
describe('두 라우트가 실제로 기록을 부른다 (배선 트립와이어)', () => {
  const root = fileURLToPath(new URL('../../..', import.meta.url))
  const routes = [
    'src/app/api/registrations/confirm/route.ts',
    'src/app/api/webhooks/portone/route.ts',
  ]

  for (const rel of routes) {
    it(`${rel} — recordDuplicateCallBlocked를 after()로 부른다`, () => {
      const src = readFileSync(root + rel, 'utf8')
      expect(src).toContain('recordDuplicateCallBlocked')
      // after()로 감싸지 않으면 Vercel 람다 freeze로 기록이 유실된다
      expect(src).toMatch(/after\(\s*\n?\s*recordDuplicateCallBlocked/)
      // User-Agent를 읽는 쪽은 라우트뿐이다 (payment.ts는 헤더를 모른다)
      expect(src).toContain("request.headers.get('user-agent')")
    })
  }
})
