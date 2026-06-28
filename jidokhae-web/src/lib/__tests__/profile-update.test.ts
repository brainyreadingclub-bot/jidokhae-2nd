import { describe, it, expect } from 'vitest'
import { resolveProfileUpdate } from '@/lib/profile-update'

const current = {
  nickname: '초록고래',
  phone: '01012345678',
  region: ['경주', '포항'],
  email: 'hong@example.com',
  nickname_changed_at: null,
}

describe('resolveProfileUpdate', () => {
  it('닉네임이 현재와 같으면 변경으로 치지 않는다 (1회 소비 안 함)', () => {
    const r = resolveProfileUpdate({ nickname: '초록고래' }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: true, updates: {}, nicknameChanged: false })
  })

  it('닉네임이 실제로 바뀌면 변경으로 처리한다', () => {
    const r = resolveProfileUpdate({ nickname: '파란고래' }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: true, updates: { nickname: '파란고래' }, nicknameChanged: true })
  })

  it('이미 1회 변경한 회원은 닉네임 변경이 막힌다', () => {
    const changed = { ...current, nickname_changed_at: '2026-06-01T00:00:00Z' }
    const r = resolveProfileUpdate({ nickname: '파란고래' }, changed, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: false, message: '닉네임은 1회만 변경할 수 있어요' })
  })

  it('입금 대기 중이면 닉네임 변경이 막힌다', () => {
    const r = resolveProfileUpdate({ nickname: '파란고래' }, current, { hasPendingTransfer: true })
    expect(r).toEqual({ ok: false, message: '입금 확인이 끝난 뒤 닉네임을 변경할 수 있어요' })
  })

  it('닉네임 길이가 2자 미만이면 막힌다', () => {
    const r = resolveProfileUpdate({ nickname: '왕' }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: false, message: '닉네임은 2~20자로 입력해주세요' })
  })

  it('전화번호 형식이 틀리면 막힌다', () => {
    const r = resolveProfileUpdate({ phone: '0212345678' }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: false, message: '010으로 시작하는 휴대폰 번호를 입력해주세요' })
  })

  it('전화번호의 하이픈은 제거되어 저장된다', () => {
    const r = resolveProfileUpdate({ phone: '010-9999-8888' }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: true, updates: { phone: '01099998888' }, nicknameChanged: false })
  })

  it('지역이 비어 있으면 막힌다', () => {
    const r = resolveProfileUpdate({ region: [] }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: false, message: '지역을 하나 이상 선택해주세요' })
  })

  it('유효하지 않은 지역이면 막힌다', () => {
    const r = resolveProfileUpdate({ region: ['도쿄'] }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: false, message: '지역을 하나 이상 선택해주세요' })
  })

  it('이메일을 빈 값으로 보내면 null로 저장된다', () => {
    const r = resolveProfileUpdate({ email: '  ' }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: true, updates: { email: null }, nicknameChanged: false })
  })

  it('잘못된 이메일이면 막힌다', () => {
    const r = resolveProfileUpdate({ email: 'not-an-email' }, current, { hasPendingTransfer: false })
    expect(r).toEqual({ ok: false, message: '올바른 이메일을 입력해주세요' })
  })

  it('여러 필드를 동시에 부분 수정한다 (닉네임 미변경)', () => {
    const r = resolveProfileUpdate(
      { nickname: '초록고래', phone: '010-1111-2222', region: ['울산'] },
      current,
      { hasPendingTransfer: false },
    )
    expect(r).toEqual({
      ok: true,
      updates: { phone: '01011112222', region: ['울산'] },
      nicknameChanged: false,
    })
  })
})
