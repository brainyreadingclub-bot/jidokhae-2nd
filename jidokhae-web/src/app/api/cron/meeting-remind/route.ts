/**
 * Vercel Cron — 모임 전날 리마인드 알림톡.
 * 매일 19:00 KST (UTC 10:00) 실행.
 * Hobby 플랜: 19:00~19:59 사이 랜덤 실행.
 *
 * Phase 3 M7 Step 2.5: Promise.allSettled 병렬 발송으로 전환.
 *   직렬 await 루프는 신청자 10명 이상 모임에서 Vercel 10초 타임아웃을
 *   초과할 위험이 있었다. waitlist-refund cron과 동일한 패턴으로 통일.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/admin'
import { getTomorrowKST, formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import { sendNotification } from '@/lib/notification'
import type { Meeting } from '@/types/meeting'

type RemindTask = {
  meeting: Meeting
  registrationId: string
  userId: string
  profile: {
    phone: string | null
    real_name: string | null
    nickname: string
  }
}

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

  // 모든 confirmed 신청자 + profile을 한 번에 flatten 수집
  const tasks: RemindTask[] = []

  for (const rawMeeting of meetings) {
    const meeting = rawMeeting as Meeting

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

      if (!profileData) continue

      tasks.push({
        meeting,
        registrationId: reg.id,
        userId: reg.user_id,
        profile: profileData,
      })
    }
  }

  // 병렬 발송 (Vercel 10s 타임아웃 대응 — Promise.allSettled로 부분 실패 허용)
  const results = await Promise.allSettled(
    tasks.map(({ meeting, registrationId, userId, profile }) => {
      const displayName = profile.real_name || profile.nickname
      return sendNotification({
        type: 'meeting_remind',
        recipientId: userId,
        recipientPhone: profile.phone,
        meetingId: meeting.id,
        registrationId: registrationId,
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
    }),
  )

  let totalSent = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (r.value.status === 'sent') totalSent++
      else if (r.value.status === 'skipped') totalSkipped++
      else totalFailed++
    } else {
      // sendNotification은 에러를 throw하지 않고 { status: 'failed' }로 응답하지만
      // 만약 예기치 못한 throw가 발생하면 여기서 집계
      totalFailed++
      console.error('[meeting-remind] task rejected:', r.reason)
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
