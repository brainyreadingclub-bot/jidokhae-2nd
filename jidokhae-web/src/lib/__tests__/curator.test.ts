/**
 * 큐레이터 판정 단위 테스트
 * 2026-08-17 결정: 발제 관리 권한 = admin · editor · 스텝(is_staff)
 * DB의 is_curator() SQL 함수와 동기 필수 (migration-discussion-thread.sql)
 */

import { describe, it, expect } from 'vitest'
import { isCurator } from '@/lib/curator'

describe('isCurator — admin·editor·is_staff', () => {
  it('admin → true', () =>
    expect(isCurator({ role: 'admin', is_staff: false })).toBe(true))
  it('editor → true', () =>
    expect(isCurator({ role: 'editor', is_staff: false })).toBe(true))
  it('member + is_staff → true (할인 외 첫 권한)', () =>
    expect(isCurator({ role: 'member', is_staff: true })).toBe(true))
  it('member → false', () =>
    expect(isCurator({ role: 'member', is_staff: false })).toBe(false))
  it('is_staff null → false', () =>
    expect(isCurator({ role: 'member', is_staff: null })).toBe(false))
})
