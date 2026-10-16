'use client'

import { trackEvent } from '@/lib/analytics'
import { Chevron } from '@/components/next/TossUI'

type Props = {
  meetingId: string
  /** 구글 캘린더 링크. null이면 달력 줄을 그리지 않는다(대기 신청 — 아직 확정이 아니다) */
  googleCalendarUrl: string | null
  /** 채널 친구 추가 링크. 빈 문자열이면 채널 줄을 그리지 않는다 */
  channelUrl: string
  /** GA4 `payment_method` — 신청 행에 적힌 값 */
  paymentMethod: string
}

/**
 * 신청 완료 화면 아래 — 「내 달력에 추가」 · 「카카오톡 채널 추가」.
 *
 * 채널 문구는 전문가 패널(docs/expert-panel/2026-08-19-kakao-channel-add-rate.md) 권고를 따른다:
 * 혜택·할인을 말하지 않고, 받는 것(모임 소식)과 **선택**임을 함께 적는다.
 * 채널 추가는 마케팅 수신 동의와 다른 일이라 「동의」라는 말도 쓰지 않는다.
 * 회원이 카톡에서 보는 채널 이름은 「지똑똑」이다(VOICE.md).
 */
export default function RegistrationFollowUps({
  meetingId,
  googleCalendarUrl,
  channelUrl,
  paymentMethod,
}: Props) {
  if (!googleCalendarUrl && !channelUrl) return null

  const trackCalendar = (method: 'ics' | 'google') =>
    trackEvent('calendar_add_click', {
      location: 'registration_complete',
      method,
      payment_method: paymentMethod,
    })

  return (
    <section className="mt-7">
      {googleCalendarUrl && (
        <div className="border-t border-tg-100 py-3">
          <div className="flex min-h-[44px] items-center gap-3">
            <span
              className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] bg-brand-bg text-[17px]"
              aria-hidden
            >
              📅
            </span>
            <span className="min-w-0 flex-1 text-sm font-bold tracking-tight text-tg-900">
              내 달력에 추가
            </span>
          </div>
          <div className="mt-2.5 flex gap-2">
            {/* 서버가 text/calendar로 내려준다 — 휴대폰 기본 달력(아이폰 캘린더 등)이 받는다 */}
            <a
              href={`/api/meetings/${meetingId}/calendar`}
              onClick={() => trackCalendar('ics')}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-[12px] bg-tg-100 text-[14px] font-bold tracking-tight text-tg-800"
            >
              휴대폰 달력
            </a>
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackCalendar('google')}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-[12px] bg-tg-100 text-[14px] font-bold tracking-tight text-tg-800"
            >
              구글 캘린더
            </a>
          </div>
        </div>
      )}

      {channelUrl && (
        <a
          href={channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackEvent('channel_add_click', {
              location: 'registration_complete',
              payment_method: paymentMethod,
            })
          }
          className="flex min-h-[56px] items-center gap-3 border-t border-tg-100 py-3"
        >
          <span
            className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] bg-brand-bg text-[17px]"
            aria-hidden
          >
            💬
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold tracking-tight text-tg-900">
              카카오톡 채널 추가
            </span>
            <span className="mt-0.5 block text-xs text-tg-600 break-keep">
              지똑똑 채널에서 모임 소식을 받아볼 수 있어요 · 선택
            </span>
          </span>
          <Chevron />
        </a>
      )}
    </section>
  )
}
