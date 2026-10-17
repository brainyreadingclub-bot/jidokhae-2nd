/**
 * Vercel Cron — 모임 전날 리마인드 알림톡.
 * 매일 19:00 KST (UTC 10:00) 실행.
 * Hobby 플랜: 19:00~19:59 사이 랜덤 실행.
 *
 * Phase 3 M7 Step 2.5: Promise.allSettled 병렬 발송으로 전환.
 *   직렬 await 루프는 신청자 10명 이상 모임에서 Vercel 10초 타임아웃을
 *   초과할 위험이 있었다. waitlist-refund cron과 동일한 패턴으로 통일.
 *
 * 2026-07-30: 대상자 필터를 confirmed 단독 → PARTICIPATED_STATUSES로 교정.
 *   운영자가 입금 확인을 월말에 몰아 처리하므로 모임 전날 시점엔 계좌이체 신청자가
 *   대부분 pending_transfer로 남아 리마인드를 못 받고 있었다(당시 27명).
 *
 * 2026-08-11: `#{결제상태}` 변수 추가.
 *   위 교정으로 pending_transfer 신청자가 리마인드를 받게 됐는데, 템플릿 본문의
 *   `(결제완료)`가 고정 문구라 아직 입금하지 않은 회원에게도 "결제완료"라고
 *   단언하고 있었다. 상태에 따라 갈리도록 변수로 뺀다.
 *   ⚠️ 이 코드는 MEETING_REMIND_V2 템플릿이 승인된 뒤에 배포해야 한다.
 *      구 템플릿에는 `#{결제상태}` 변수가 없어 치환 오류로 발송이 막힌다.
 *
 * 2026-10-16: 모임 종류로 템플릿을 고른다 (`lib/remind-template.ts`).
 *   토론모임 → MEETING_REMIND_DISCUSSION_V2. 해당 env가 없으면 전부 종전
 *   SOLAPI_TEMPLATE_REMIND — 배포 순서를 안 탄다.
 *
 * 2026-10-17: 돌 때마다 공통 기록표에 「언제 · 누가 대상이었나 · 결과」를 남긴다
 *   (`cron.meeting_remind_run`). 운영 화면 「알림 못 받은 회원」이 이걸로
 *   ① 이 시각 전에 신청한 사람만 대상으로 보고 ② 크론이 아예 안 돌았는지(마지막 점검 시각)를 안다.
 *   응답 JSON은 Vercel 로그에만 남아 일주일이면 사라진다. 명단을 못 읽은 모임을 조용히 건너뛰던
 *   자리(`if (!registrations) continue`)도 기록에 `query_failed`로 남긴다.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/admin'
import { getTomorrowKST, formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import { sendNotification } from '@/lib/notification'
import { PARTICIPATED_STATUSES, paymentStatusLabel } from '@/lib/registration-status'
import { buildRemindVariables, pickRemindTemplate, type RemindVariant } from '@/lib/remind-template'
import { recordAppEvent } from '@/lib/app-events'
import type { Meeting } from '@/types/meeting'

type RemindTask = {
  meeting: Meeting
  registrationId: string
  userId: string
  paidAmount: number | null
  /** 알림톡 `#{결제상태}` 치환용. confirmed면 결제완료, pending_transfer면 입금 확인 중 */
  registrationStatus: string
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
  const { data: meetings, error: meetingsError } = await supabase
    .from('meetings')
    .select('*')
    .eq('date', tomorrow)
    .eq('status', 'active')

  // 조회 실패를 「내일 모임 없음」으로 덮지 않는다 — 그러면 아무도 안 받았는데 정상처럼 보인다
  if (meetingsError) {
    console.error('[meeting-remind] 모임 조회 실패:', meetingsError)
    await recordAppEvent({
      event: 'cron.meeting_remind_run',
      userId: null,
      props: { date: tomorrow, query_failed: true },
    })
    return NextResponse.json(
      { status: 'error', message: 'meetings query failed', data: { date: tomorrow } },
      { status: 500 },
    )
  }

  if (!meetings || meetings.length === 0) {
    await recordAppEvent({
      event: 'cron.meeting_remind_run',
      userId: null,
      props: { date: tomorrow, meetings: 0, targets: 0 },
    })
    return NextResponse.json({
      status: 'success',
      message: 'No meetings tomorrow',
      data: { date: tomorrow, sent: 0 },
    })
  }

  // 모든 confirmed 신청자 + profile을 한 번에 flatten 수집
  const tasks: RemindTask[] = []
  /** 명단을 못 읽은 모임 — 기록에 남겨 운영 화면이 「보낸 기록 없음」으로 잡게 한다 */
  const queryFailed = new Set<string>()

  for (const rawMeeting of meetings) {
    const meeting = rawMeeting as Meeting

    const { data: registrations, error: regsError } = await supabase
      .from('registrations')
      .select('id, user_id, paid_amount, status, profiles(phone, real_name, nickname)')
      .eq('meeting_id', meeting.id)
      .in('status', PARTICIPATED_STATUSES)

    if (regsError || !registrations) {
      console.error('[meeting-remind] 신청자 조회 실패:', meeting.id, regsError)
      queryFailed.add(meeting.id)
      continue
    }

    for (const reg of registrations) {
      // Supabase FK JOIN: many-to-one은 단일 객체지만 타입은 배열로 추론됨
      const profileData = reg.profiles as unknown as {
        phone: string | null
        real_name: string | null
        nickname: string
      } | null

      if (!profileData) {
        // 프로필 없는 신청 — 보낼 수 없다. 조용히 넘기지 않고 로그를 남긴다(운영 화면은 「보낸 기록 없음」으로 잡는다)
        console.error('[meeting-remind] 프로필 없음:', reg.id)
        continue
      }

      tasks.push({
        meeting,
        registrationId: reg.id,
        userId: reg.user_id,
        paidAmount: reg.paid_amount,
        registrationStatus: reg.status,
        profile: profileData,
      })
    }
  }

  const env = {
    SOLAPI_TEMPLATE_REMIND: process.env.SOLAPI_TEMPLATE_REMIND,
    SOLAPI_TEMPLATE_REMIND_DISCUSSION: process.env.SOLAPI_TEMPLATE_REMIND_DISCUSSION,
  }

  // 갈래별 건수 — 켠 뒤 첫 실행에서 크론 응답만 보고도 갈래가 맞게 나뉘었는지 확인할 수 있게
  const variantCounts: Record<RemindVariant, number> = { default: 0, discussion: 0 }

  // 병렬 발송 (Vercel 10s 타임아웃 대응 — Promise.allSettled로 부분 실패 허용)
  const results = await Promise.allSettled(
    tasks.map(({ meeting, registrationId, userId, paidAmount, registrationStatus, profile }) => {
      const displayName = profile.nickname || profile.real_name || ''
      const { templateCode, variant } = pickRemindTemplate({ meetingType: meeting.meeting_type, env })
      variantCounts[variant]++
      return sendNotification({
        // 갈래와 무관하게 meeting_remind — 중복 막기 인덱스를 공유해 한 사람이 두 통 받지 않는다
        type: 'meeting_remind',
        recipientId: userId,
        recipientPhone: profile.phone,
        meetingId: meeting.id,
        registrationId: registrationId,
        templateCode,
        variables: buildRemindVariables({
          displayName,
          meetingTitle: meeting.title,
          dateTime: `${formatKoreanDate(meeting.date)} ${formatKoreanTime(meeting.time)}`,
          location: meeting.location,
          fee: formatFee(paidAmount ?? meeting.fee),
          paymentStatus: paymentStatusLabel(registrationStatus),
          meetingId: meeting.id,
        }),
      })
    }),
  )

  let totalSent = 0
  let totalSkipped = 0
  let totalFailed = 0
  /** 모임별 결과 — 기록표에 모임마다 1행 */
  const perMeeting = new Map<string, { targets: number; sent: number; skipped: number; failed: number }>()
  for (const m of meetings) perMeeting.set(m.id, { targets: 0, sent: 0, skipped: 0, failed: 0 })

  results.forEach((r, idx) => {
    const tally = perMeeting.get(tasks[idx].meeting.id)!
    tally.targets++
    if (r.status === 'fulfilled') {
      if (r.value.status === 'sent') {
        totalSent++
        tally.sent++
      } else if (r.value.status === 'skipped') {
        totalSkipped++
        tally.skipped++
      } else {
        totalFailed++
        tally.failed++
      }
    } else {
      // sendNotification은 에러를 throw하지 않고 { status: 'failed' }로 응답하지만
      // 만약 예기치 못한 throw가 발생하면 여기서 집계
      totalFailed++
      tally.failed++
      console.error('[meeting-remind] task rejected:', r.reason)
    }
  })

  // 절대 throw하지 않는다(lib/app-events.ts). 발송은 이미 끝났다
  await Promise.all(
    meetings.map((m) =>
      recordAppEvent({
        event: 'cron.meeting_remind_run',
        userId: null,
        meetingId: m.id,
        props: { date: tomorrow, ...perMeeting.get(m.id)!, query_failed: queryFailed.has(m.id) },
      }),
    ),
  )

  return NextResponse.json({
    status: totalFailed === 0 ? 'success' : 'partial',
    data: {
      date: tomorrow,
      meetings: meetings.length,
      sent: totalSent,
      skipped: totalSkipped,
      failed: totalFailed,
      variants: variantCounts,
    },
  })
}
