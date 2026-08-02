import { describe, it, expect } from 'vitest'
import { safeNextPath, toNextParam, shouldRememberPath } from '@/lib/next-path'

describe('safeNextPath', () => {
  it('내부 절대경로는 그대로 통과시킨다', () => {
    expect(safeNextPath('/meetings/abc-123')).toBe('/meetings/abc-123')
    expect(safeNextPath('/my')).toBe('/my')
  })

  it('쿼리스트링을 보존한다', () => {
    expect(safeNextPath('/meetings/abc?ask=1')).toBe('/meetings/abc?ask=1')
  })

  it('없거나 빈 값이면 fallback', () => {
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath(undefined)).toBe('/')
    expect(safeNextPath('')).toBe('/')
  })

  // ── 오픈 리다이렉트 방어 ──
  it('외부 절대 URL을 거부한다', () => {
    expect(safeNextPath('https://evil.com')).toBe('/')
    expect(safeNextPath('http://evil.com/path')).toBe('/')
  })

  it('프로토콜 상대 URL을 거부한다', () => {
    expect(safeNextPath('//evil.com')).toBe('/')
    expect(safeNextPath('//evil.com/path')).toBe('/')
  })

  it('백슬래시 우회를 거부한다', () => {
    // 일부 브라우저가 /\evil.com 을 //evil.com 처럼 해석한다
    expect(safeNextPath('/\\evil.com')).toBe('/')
  })

  it('상대경로를 거부한다', () => {
    expect(safeNextPath('meetings/abc')).toBe('/')
    expect(safeNextPath('../admin')).toBe('/')
  })

  // ── 순환 방어 ──
  it('로그인 화면으로 되돌아가는 경로를 거부한다', () => {
    expect(safeNextPath('/auth')).toBe('/')
    expect(safeNextPath('/auth/login')).toBe('/')
    expect(safeNextPath('/auth/callback?code=x')).toBe('/')
  })

  it('/authors 처럼 /auth로 시작만 하는 정상 경로는 막지 않는다', () => {
    expect(safeNextPath('/authors')).toBe('/authors')
  })

  it('fallback을 지정할 수 있다', () => {
    expect(safeNextPath(null, '/my')).toBe('/my')
  })
})

describe('toNextParam', () => {
  it('경로와 쿼리를 합친다', () => {
    expect(toNextParam('/meetings/abc', '?ask=1')).toBe('/meetings/abc?ask=1')
  })

  it('쿼리가 없으면 경로만', () => {
    expect(toNextParam('/my')).toBe('/my')
  })
})

describe('shouldRememberPath', () => {
  it('회원이 보려던 화면(GET 페이지)은 기억한다', () => {
    expect(shouldRememberPath('GET', '/meetings/abc')).toBe(true)
    expect(shouldRememberPath('GET', '/my')).toBe(true)
  })

  it('API 요청은 기억하지 않는다', () => {
    // 세션 만료 시점의 백그라운드 fetch가 목적지로 남으면 로그인 직후
    // JSON 라우트로 GET 리다이렉트되어 405 화면을 보게 된다
    expect(shouldRememberPath('POST', '/api/library/ask')).toBe(false)
    expect(shouldRememberPath('GET', '/api/library/ask')).toBe(false)
  })

  it('GET이 아닌 요청은 기억하지 않는다', () => {
    expect(shouldRememberPath('POST', '/my')).toBe(false)
    expect(shouldRememberPath('HEAD', '/my')).toBe(false)
  })

  it('prefetch는 기억하지 않는다', () => {
    // 회원이 누른 적 없는 링크가 로그인 후 목적지가 되면 안 된다
    expect(shouldRememberPath('GET', '/meetings/abc', true)).toBe(false)
  })
})
