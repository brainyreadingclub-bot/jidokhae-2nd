import { describe, it, expect } from 'vitest'
import {
  isLinkOpen,
  isValidToken,
  isValidDeviceId,
  linkClosesAtLabel,
} from '@/lib/presenter-link'

const meeting = { date: '2026-10-27', status: 'active', meeting_type: 'discussion' }
const open = { closed_at: null }

describe('isLinkOpen — 닫히는 시각은 저장하지 않고 계산한다', () => {
  it('모임 당일까지 열린다', () => {
    expect(isLinkOpen(open, meeting, '2026-10-20')).toBe(true)
    expect(isLinkOpen(open, meeting, '2026-10-27')).toBe(true)
  })
  it('모임 다음날(0시 이후)이면 닫힌다', () => {
    expect(isLinkOpen(open, meeting, '2026-10-28')).toBe(false)
  })
  it('운영자가 닫으면 닫힌다', () => {
    expect(isLinkOpen({ closed_at: '2026-10-20T01:00:00Z' }, meeting, '2026-10-20')).toBe(false)
  })
  it('모임이 삭제·삭제 중이면 바로 닫힌다', () => {
    expect(isLinkOpen(open, { ...meeting, status: 'deleted' }, '2026-10-20')).toBe(false)
    expect(isLinkOpen(open, { ...meeting, status: 'deleting' }, '2026-10-20')).toBe(false)
  })
  it('토론모임이 아니면 닫힌다', () => {
    expect(isLinkOpen(open, { ...meeting, meeting_type: 'regular' }, '2026-10-20')).toBe(false)
  })
  it('링크·모임이 없으면 닫힌다', () => {
    expect(isLinkOpen(null, meeting, '2026-10-20')).toBe(false)
    expect(isLinkOpen(open, null, '2026-10-20')).toBe(false)
  })
})

describe('linkClosesAtLabel', () => {
  it('모임 다음날 0시', () => {
    expect(linkClosesAtLabel('2026-10-27')).toBe('10월 28일 0시')
    expect(linkClosesAtLabel('2026-10-31')).toBe('11월 1일 0시')
  })
})

describe('토큰·기기 모양', () => {
  it('토큰은 32자 base64url', () => {
    expect(isValidToken('k7Qm2xVb9RtL4pNw8sHd3eAbCdEfGh_-')).toBe(true)
    expect(isValidToken('short')).toBe(false)
    expect(isValidToken('k7Qm2xVb9RtL4pNw8sHd3eAbCdEfGh/-')).toBe(false)
  })
  it('기기 표시는 22~64자', () => {
    expect(isValidDeviceId('a'.repeat(22))).toBe(true)
    expect(isValidDeviceId('a'.repeat(21))).toBe(false)
    expect(isValidDeviceId(123)).toBe(false)
  })
})
