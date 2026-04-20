/**
 * Vercel Cron — 모임 전날 리마인드 알림톡.
 * 매일 19:00 KST (UTC 10:00) 실행.
 * Hobby 플랜: 19:00~19:59 사이 랜덤 실행.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/admin'
import { getTomorrowKST, formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import { sendNotification } from '@/lib/notification'
import type { Meeting } from '@/types/meeting'

export async function GET(request: NextRequest) {
  // Vercel Cron 인증
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()
  const tomorrow = getTomorrowKST()

  // 내일 active 모임 조회
  const { data: meetings } = await supabase
    .from('meetings')
    .select('*')
    .eq('date', tomorrow)
    .eq('status', 'active')

  if (!meetings || meetings.length === 0) {
    return NextResponse.json({
      status: 'success',
      message: 'No meetings tomorrow',
      data: { date: tomorrow, sent: 0 },
    })
  }

  let totalSent = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const rawMeeting of meetings) {
    const meeting = rawMeeting as Meeting

    // confirmed 신청자 + profile 조회
    const { data: registrations } = await supabase
      .from('registrations')
      .select('id, user_id, profiles(phone, real_name, nickname)')
      .eq('meeting_id', meeting.id)
      .eq('status', 'confirmed')

    if (!registrations) continue

    for (const reg of registrations) {
      // Supabase FK JOIN: many-to-one은 단일 객체지만 타입은 배열로 추론됨
      const profileData = reg.profiles as unknown as {
        phone: string | null
        real_name: string | null
        nickname: string
      } | null
      const profile = profileData

      if (!profile) continue

      const displayName = profile.real_name || profile.nickname

      const result = await sendNotification({
        type: 'meeting_remind',
        recipientId: reg.user_id,
        recipientPhone: profile.phone,
        meetingId: meeting.id,
        registrationId: reg.id,
        templateCode: process.env.SOLAPI_TEMPLATE_REMIND!,
        variables: {
          '#{회원명}': displayName,
          '#{모임명}': meeting.title,
          '#{모임일시}': `${formatKoreanDate(meeting.date)} ${formatKoreanTime(meeting.time)}`,
          '#{장소}': meeting.location,
          '#{참가비}': formatFee(meeting.fee),
          '#{모임ID}': meeting.id,
        },
      })

      if (result.status === 'sent') totalSent++
      else if (result.status === 'skipped') totalSkipped++
      else totalFailed++
    }
  }

  return NextResponse.json({
    status: totalFailed === 0 ? 'success' : 'partial',
    data: {
      date: tomorrow,
      meetings: meetings.length,
      sent: totalSent,
      skipped: totalSkipped,
      failed: totalFailed,
    },
  })
}
