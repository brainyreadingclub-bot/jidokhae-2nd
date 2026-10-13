import { describe, it, expect } from 'vitest'
import {
  redirectCandidate,
  needsOnboardingCheck,
  nextUiRedirectTarget,
} from '@/lib/next-ui-redirect'
import { AFTER_LOGIN_PATH, safeNextPath } from '@/lib/next-path'

const ID = '21a967c3-7f4c-4f7d-a4f7-d8ab7dd2fa10'

describe('redirectCandidate — 미들웨어가 DB를 읽는 주소는 둘뿐', () => {
  it('첫 주소와 옛 모임 상세만 대상', () => {
    expect(redirectCandidate('/')).toBe('root')
    expect(redirectCandidate(`/meetings/${ID}`)).toBe('old-detail')
  })

  it('결제 흐름(옛 상세 아래)은 대상이 아니다 — 돌려보내면 결제가 끊긴다', () => {
    expect(redirectCandidate(`/meetings/${ID}/confirm`)).toBeNull()
    expect(redirectCandidate(`/meetings/${ID}/payment-redirect`)).toBeNull()
    expect(redirectCandidate(`/meetings/${ID}/payment-fail`)).toBeNull()
  })

  it('그 밖의 화면은 대상이 아니다', () => {
    for (const p of ['/home', '/meet', `/meet/${ID}`, '/my', '/meetings', '/admin', '/api/x']) {
      expect(redirectCandidate(p)).toBeNull()
    }
  })

  it('프로필은 첫 주소일 때만 읽는다', () => {
    expect(needsOnboardingCheck('/')).toBe(true)
    expect(needsOnboardingCheck(`/meetings/${ID}`)).toBe(false)
  })
})

describe('nextUiRedirectTarget', () => {
  it('플래그 ON + 온보딩 완료 → / 는 /home', () => {
    expect(nextUiRedirectTarget('/', true, true)).toBe('/home')
  })

  it('온보딩 미완성 회원은 / 에 남는다 — (next) 레이아웃이 / 로 돌려보내므로 보내면 순환한다', () => {
    expect(nextUiRedirectTarget('/', true, false)).toBeNull()
  })

  it('플래그 OFF면 아무 데도 보내지 않는다 (되돌리기 안전)', () => {
    expect(nextUiRedirectTarget('/', false, true)).toBeNull()
    expect(nextUiRedirectTarget(`/meetings/${ID}`, false, true)).toBeNull()
  })

  it('옛 모임 상세 → 새 상세 (온보딩 여부와 무관 — 옛 페이지 redirect와 같은 조건)', () => {
    expect(nextUiRedirectTarget(`/meetings/${ID}`, true, true)).toBe(`/meet/${ID}`)
    expect(nextUiRedirectTarget(`/meetings/${ID}`, true, false)).toBe(`/meet/${ID}`)
  })

  it('대상이 아닌 주소는 null', () => {
    expect(nextUiRedirectTarget(`/meetings/${ID}/confirm`, true, true)).toBeNull()
    expect(nextUiRedirectTarget('/home', true, true)).toBeNull()
  })
})

describe('로그인 직후 기본 도착지', () => {
  it('목적지가 없으면 /home — / 를 거치면 한 번 더 왕복한다', () => {
    expect(AFTER_LOGIN_PATH).toBe('/home')
    expect(safeNextPath(undefined, AFTER_LOGIN_PATH)).toBe('/home')
  })

  it('목적지가 있으면 그대로 (알림톡 딥링크)', () => {
    expect(safeNextPath(`/meet/${ID}`, AFTER_LOGIN_PATH)).toBe(`/meet/${ID}`)
  })

  it('외부 주소는 여전히 막고 /home으로', () => {
    expect(safeNextPath('//evil.com', AFTER_LOGIN_PATH)).toBe('/home')
  })
})
