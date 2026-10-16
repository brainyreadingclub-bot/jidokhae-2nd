import { describe, it, expect } from 'vitest'
import { adminAreaOf, registrantProfileColumns, STAFF_PAGES, STAFF_HOME } from '@/lib/admin-access'

describe('adminAreaOf — 운영 화면 들어오는 문 (2026-10-16)', () => {
  it('총괄·운영진 → 운영 화면', () => {
    expect(adminAreaOf({ role: 'admin', is_staff: false })).toBe('admin')
    expect(adminAreaOf({ role: 'editor', is_staff: null })).toBe('admin')
    expect(adminAreaOf({ role: 'editor', is_staff: true })).toBe('admin')
  })

  it('스텝 → 스텝 구역만 (운영 화면은 닫힘)', () => {
    expect(adminAreaOf({ role: 'member', is_staff: true })).toBe('staff')
  })

  it('회원·없음 → 어디도 아님', () => {
    expect(adminAreaOf({ role: 'member', is_staff: false })).toBe('none')
    expect(adminAreaOf({ role: 'member', is_staff: null })).toBe('none')
    expect(adminAreaOf(null)).toBe('none')
    expect(adminAreaOf(undefined)).toBe('none')
  })

  it('스텝 구역 화면은 발제문 둘뿐이다 — 늘리려면 이 테스트를 같이 고친다', () => {
    expect(STAFF_PAGES).toEqual(['/staff/topics', '/staff/topics/[id]'])
    expect(STAFF_PAGES).toContain(STAFF_HOME)
  })
})

describe('registrantProfileColumns — 전화번호는 총괄만 불러온다', () => {
  it('총괄은 전화번호까지', () => {
    expect(registrantProfileColumns('admin')).toContain('phone')
  })

  it.each(['editor', 'member', ''])('%s는 전화번호를 읽지 않는다', (role) => {
    expect(registrantProfileColumns(role)).not.toContain('phone')
    expect(registrantProfileColumns(role)).toContain('nickname')
  })
})
