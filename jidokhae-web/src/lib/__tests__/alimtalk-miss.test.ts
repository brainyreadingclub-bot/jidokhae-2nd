import { describe, it, expect } from 'vitest'
import {
  buildMeetingMissReport,
  expectsSignupNotice,
  isRemindRunStale,
  missHeadline,
  remindDeadlineMs,
  TRANSFER_SIGNUP_NOTICE_SINCE,
  type MissNotification,
  type MissParticipant,
} from '@/lib/alimtalk-miss'
import { describeAlimtalkError, failedFromSendResult, ERROR_MESSAGE_MAX } from '@/lib/alimtalk-error'

// 모임 10/28(수). 전날 안내 마감 = 10/27 21:00 KST = 10/27 12:00Z
const MEETING_DATE = '2026-10-28'
const RAN_AT = '2026-10-27T10:03:00Z' // 10/27 19:03 KST

function person(n: number, over: Partial<MissParticipant> = {}): MissParticipant {
  return {
    registrationId: `reg-${n}`,
    userId: `user-${n}`,
    createdAt: '2026-10-20T03:00:00Z',
    paymentMethod: 'card',
    paymentId: `jdkh-${n}`,
    nickname: `회원${n}`,
    realName: null,
    ...over,
  }
}

function note(over: Partial<MissNotification> & Pick<MissNotification, 'type' | 'recipientId'>): MissNotification {
  return { status: 'sent', registrationId: null, createdAt: '2026-10-20T03:00:05Z', ...over }
}

function signupSent(n: number): MissNotification {
  return note({ type: 'registration_confirm', recipientId: `user-${n}`, registrationId: `reg-${n}` })
}

function remindSent(n: number, status = 'sent'): MissNotification {
  return note({ type: 'meeting_remind', recipientId: `user-${n}`, registrationId: `reg-${n}`, status, createdAt: RAN_AT })
}

const AFTER_REMIND = new Date('2026-10-28T01:00:00Z')

describe('buildMeetingMissReport — 못 받은 사람만 잡는다', () => {
  it('다 받았으면 0명', () => {
    const r = buildMeetingMissReport({
      meetingDate: MEETING_DATE,
      participants: [person(1), person(2)],
      notifications: [signupSent(1), signupSent(2), remindSent(1), remindSent(2)],
      remindRun: { ranAt: RAN_AT, targets: 2 },
      now: AFTER_REMIND,
    })
    expect(r.participants).toBe(2)
    expect(r.missedPeople).toBe(0)
    expect(r.items).toEqual([])
  })

  it('실패·전화번호 없음·기록 없음을 이유별로 가른다', () => {
    const r = buildMeetingMissReport({
      meetingDate: MEETING_DATE,
      participants: [person(1), person(2), person(3)],
      notifications: [
        signupSent(1),
        note({ type: 'registration_confirm', recipientId: 'user-2', registrationId: 'reg-2', status: 'failed' }),
        signupSent(3),
        remindSent(1),
        remindSent(2, 'skipped'),
        // user-3 전날 안내 행 없음
      ],
      remindRun: { ranAt: RAN_AT, targets: 3 },
      now: AFTER_REMIND,
    })
    expect(r.missedPeople).toBe(2)
    expect(r.items.map((i) => `${i.userId}:${i.kind}:${i.reason}`).sort()).toEqual([
      'user-2:remind:no_phone',
      'user-2:signup:failed',
      'user-3:remind:no_record',
    ])
    expect(missHeadline(r)).toBe('3명 중 2명에게 알림톡이 안 갔어요')
  })

  it('전날 안내가 돈 뒤에 신청한 사람은 전날 안내 대상이 아니다 (거짓 경고 막기)', () => {
    const late = person(9, { createdAt: '2026-10-27T23:00:00Z' }) // 모임 당일 아침 신청
    const r = buildMeetingMissReport({
      meetingDate: MEETING_DATE,
      participants: [person(1), late],
      notifications: [signupSent(1), remindSent(1), signupSent(9)],
      remindRun: { ranAt: RAN_AT, targets: 1 },
      now: AFTER_REMIND,
    })
    expect(r.missedPeople).toBe(0)
  })

  it('전날 저녁 전이면 전날 안내를 따지지 않는다', () => {
    const r = buildMeetingMissReport({
      meetingDate: MEETING_DATE,
      participants: [person(1)],
      notifications: [signupSent(1)],
      remindRun: null,
      now: new Date('2026-10-26T05:00:00Z'),
    })
    expect(r.remind.state).toBe('not_yet')
    expect(r.missedPeople).toBe(0)
  })

  it('마감이 지났는데 크론 기록도 알림 행도 없으면 — 안 돈 것. 전원 「기록 없음」', () => {
    const r = buildMeetingMissReport({
      meetingDate: MEETING_DATE,
      participants: [person(1), person(2)],
      notifications: [signupSent(1), signupSent(2)],
      remindRun: null,
      now: AFTER_REMIND,
    })
    expect(r.remind.state).toBe('missing')
    expect(r.missedPeople).toBe(2)
    expect(r.items.every((i) => i.kind === 'remind' && i.reason === 'no_record')).toBe(true)
  })

  it('크론 기록이 없던 옛 모임은 첫 전날 알림 행 시각을 돈 시각으로 쓴다', () => {
    const r = buildMeetingMissReport({
      meetingDate: MEETING_DATE,
      participants: [person(1), person(2)],
      notifications: [signupSent(1), signupSent(2), remindSent(1)],
      remindRun: null,
      now: AFTER_REMIND,
    })
    expect(r.remind).toEqual({ state: 'ran', ranAt: RAN_AT, targets: 1 })
    expect(r.items.map((i) => `${i.userId}:${i.reason}`)).toEqual(['user-2:no_record'])
  })

  it('명단을 못 읽고 돈 경우(대상 0) — 돈 시각 전 신청자는 「기록 없음」으로 잡힌다', () => {
    const r = buildMeetingMissReport({
      meetingDate: MEETING_DATE,
      participants: [person(1)],
      notifications: [signupSent(1)],
      remindRun: { ranAt: RAN_AT, targets: 0 },
      now: AFTER_REMIND,
    })
    expect(r.items.map((i) => `${i.kind}:${i.reason}`)).toEqual(['remind:no_record'])
  })

  it('발송 중에 10분 넘게 멈춘 건은 「멈춤」, 방금 것은 기다린다', () => {
    const now = new Date('2026-10-20T03:30:00Z')
    const r = buildMeetingMissReport({
      meetingDate: MEETING_DATE,
      participants: [person(1), person(2, { createdAt: '2026-10-20T03:27:00Z' })],
      notifications: [
        note({ type: 'registration_confirm', recipientId: 'user-1', registrationId: 'reg-1', status: 'pending' }),
        note({
          type: 'registration_confirm',
          recipientId: 'user-2',
          registrationId: 'reg-2',
          status: 'pending',
          createdAt: '2026-10-20T03:27:05Z',
        }),
      ],
      remindRun: null,
      now,
    })
    expect(r.items.map((i) => `${i.userId}:${i.reason}`)).toEqual(['user-1:stuck'])
  })

  it('대기에서 승격된 회원은 대기 신청·승격 안내를 신청 안내로 친다', () => {
    const r = buildMeetingMissReport({
      meetingDate: MEETING_DATE,
      participants: [person(1)],
      notifications: [
        note({ type: 'waitlist_confirm', recipientId: 'user-1', registrationId: 'reg-1' }),
        note({ type: 'waitlist_promoted', recipientId: 'user-1', registrationId: 'reg-1', status: 'failed' }),
      ],
      remindRun: null,
      now: new Date('2026-10-21T00:00:00Z'),
    })
    // 받은 것이 하나라도 있으면 받은 것
    expect(r.missedPeople).toBe(0)
  })

  it('발제자(결제 없음)·안내가 생기기 전 계좌이체 신청은 신청 안내를 기대하지 않는다', () => {
    const r = buildMeetingMissReport({
      meetingDate: MEETING_DATE,
      participants: [
        person(1, { paymentMethod: 'none' }),
        person(2, { paymentMethod: 'transfer', paymentId: null, createdAt: '2026-10-01T03:00:00Z' }),
        // 구글폼에서 옮겨 넣은 신청 — 앱 신청이 아니다 (10/27 토론 실제 사례)
        person(3, { paymentMethod: 'transfer', paymentId: 'googleform-55-x', createdAt: '2026-10-12T00:58:00Z' }),
      ],
      notifications: [],
      remindRun: null,
      now: new Date('2026-10-21T00:00:00Z'),
    })
    expect(r.missedPeople).toBe(0)
  })

  it('같은 사람이 두 번 걸려도 사람 수는 1', () => {
    const r = buildMeetingMissReport({
      meetingDate: MEETING_DATE,
      participants: [person(1)],
      notifications: [],
      remindRun: { ranAt: RAN_AT, targets: 1 },
      now: AFTER_REMIND,
    })
    expect(r.items).toHaveLength(2)
    expect(r.missedPeople).toBe(1)
  })
})

describe('규칙 조각', () => {
  it('전날 안내 마감 = 전날 21시 KST (달 넘김 포함)', () => {
    expect(new Date(remindDeadlineMs('2026-10-28')).toISOString()).toBe('2026-10-27T12:00:00.000Z')
    expect(new Date(remindDeadlineMs('2026-11-01')).toISOString()).toBe('2026-10-31T12:00:00.000Z')
  })

  it('계좌이체 신청 안내는 배포 시각부터', () => {
    const t = { paymentMethod: 'transfer', paymentId: null }
    expect(expectsSignupNotice({ ...t, createdAt: TRANSFER_SIGNUP_NOTICE_SINCE })).toBe(true)
    expect(expectsSignupNotice({ ...t, createdAt: '2026-10-09T12:00:00Z' })).toBe(false)
    expect(expectsSignupNotice({ ...t, paymentId: 'googleform-1', createdAt: '2026-10-12T00:00:00Z' })).toBe(false)
    expect(expectsSignupNotice({ paymentMethod: 'card', paymentId: 'jdkh-1', createdAt: '2026-01-01T00:00:00Z' })).toBe(true)
  })

  it('마지막 점검이 26시간 넘으면 멈춘 것. 기록이 한 번도 없으면 판단 안 함', () => {
    const now = new Date('2026-10-28T12:00:00Z')
    expect(isRemindRunStale('2026-10-27T10:00:00Z', now)).toBe(false)
    expect(isRemindRunStale('2026-10-27T09:00:00Z', now)).toBe(true)
    expect(isRemindRunStale(null, now)).toBe(false)
  })
})

describe('describeAlimtalkError — 실패 원문을 남긴다', () => {
  it('Solapi 실패 목록의 코드·설명을 쓰고 전화번호는 버린다', () => {
    const err = {
      _tag: 'MessageNotReceivedError',
      message: '1개의 메시지가 접수되지 못했습니다. 자세한 에러 메시지는 해당 에러 내 failedMessageList를 확인해주세요.',
      failedMessageList: [
        { to: '01012345678', from: '0212345678', statusCode: '3034', statusMessage: '템플릿 변수가 일치하지 않습니다' },
      ],
    }
    const text = describeAlimtalkError(err)
    expect(text).toBe('[3034] 템플릿 변수가 일치하지 않습니다')
    expect(text).not.toContain('010')
  })

  it('실패 목록이 없으면 에러 이름과 문장', () => {
    expect(describeAlimtalkError(new Error('network down'))).toBe('Error: network down')
    expect(describeAlimtalkError(null)).toBe('알 수 없는 오류')
  })

  it('길면 자른다', () => {
    expect(describeAlimtalkError(new Error('x'.repeat(1000))).length).toBe(ERROR_MESSAGE_MAX)
  })

  it('던지지 않은 응답에 실패가 섞여 있으면 잡는다', () => {
    expect(failedFromSendResult({ failedMessageList: [] })).toBeNull()
    expect(failedFromSendResult({ failedMessageList: [{ statusCode: '1030', statusMessage: '잔액 부족' }] })).toBe(
      '[1030] 잔액 부족',
    )
  })
})
