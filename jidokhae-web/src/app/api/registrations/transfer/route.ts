/**
 * 계좌이체 신청.
 *
 * 2026-10-09에 둘이 달라졌다 (대표님 결정).
 *   1. 정원이 찬 뒤의 **계좌이체 대기를 받지 않는다** — 0원 건과 is_free 회원만 예외(결정 A).
 *      거절은 `register_transfer` RPC가 FOR UPDATE 락 안에서 한다
 *      ('waitlist_card_only'). 라우트에서 미리 세면 동시 신청에 진다.
 *   2. `pending_transfer`로 신청이 생기면 **신청 완료 알림톡을 보낸다.**
 *      그전까지 계좌이체 신청에는 알림톡이 **아예 없었다** — 카드 경로
 *      (`api/registrations/confirm`)에만 있었다.
 */

import { NextResponse, after, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/admin'
import { getDisplayFee } from '@/lib/staff-slot'
import { isDiscussionApplyOpen } from '@/lib/discussion-rules'
import { getDiscussionApplyBlock, DISCUSSION_BLOCK_MESSAGE } from '@/lib/discussion-gate'
import { sendRegistrationConfirmNotification } from '@/lib/notification'

export async function POST(request: NextRequest) {
  try {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { status: 'error', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }

  let body: { meetingId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: '잘못된 요청입니다' },
      { status: 400 },
    )
  }

  const { meetingId } = body
  if (!meetingId) {
    return NextResponse.json(
      { status: 'error', message: 'meetingId가 필요합니다' },
      { status: 400 },
    )
  }

  const admin = createServiceClient()

  // 모임 정보 조회 (참가비 확인)
  const { data: meeting, error: meetingError } = await admin
    .from('meetings')
    .select('fee, status, meeting_type, date')
    .eq('id', meetingId)
    .single()

  if (meetingError || !meeting) {
    return NextResponse.json(
      { status: 'error', message: '모임을 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  if (meeting.status !== 'active') {
    return NextResponse.json(
      { status: 'error', message: '신청할 수 없는 모임입니다' },
      { status: 400 },
    )
  }

  // 토론모임 D-7 신청 마감 강제 (2026-08-17 결정) — 딥링크·공유 URL 경로 차단
  if (meeting.meeting_type === 'discussion' && !isDiscussionApplyOpen(meeting.date)) {
    return NextResponse.json(
      { status: 'error', message: '신청이 마감된 모임입니다' },
      { status: 400 },
    )
  }

  // 토론모임 참여 자격 + 격리 플래그 — 딥링크·공유 URL 경로 차단.
  // 이체는 승인 개념이 없어 돈이 움직이기 전에 거절된다(카드와 달리 환불이 필요 없다)
  const discussionBlock = await getDiscussionApplyBlock(meeting.meeting_type, user.id)
  if (discussionBlock) {
    return NextResponse.json(
      { status: 'error', message: DISCUSSION_BLOCK_MESSAGE[discussionBlock] },
      { status: 400 },
    )
  }

  // 신청자 자격 + 슬롯 기반 자동 할인가 결정 (RPC가 마지막 방어선)
  const { data: profile } = await admin
    .from('profiles')
    .select('role, is_staff')
    .eq('id', user.id)
    .single()

  const { fee: paidAmount } = await getDisplayFee(
    meetingId,
    profile as { role: string; is_staff: boolean | null } | null,
    meeting.fee,
    meeting.meeting_type,
  )

  // 계좌이체 신청 RPC 호출
  const { data: result, error: rpcError } = await admin
    .rpc('register_transfer', {
      p_user_id: user.id,
      p_meeting_id: meetingId,
      p_paid_amount: paidAmount,
    })

  if (rpcError) {
    console.error('[transfer] RPC 오류:', rpcError)
    return NextResponse.json(
      { status: 'error', message: '신청 처리 중 오류가 발생했습니다' },
      { status: 500 },
    )
  }

  if (result === 'not_found' || result === 'not_active') {
    return NextResponse.json(
      { status: 'error', message: '신청할 수 없는 모임입니다' },
      { status: 400 },
    )
  }

  if (result === 'already_registered') {
    return NextResponse.json(
      { status: 'error', message: '이미 신청한 모임입니다' },
      { status: 400 },
    )
  }

  // 스텝 할인 race 거부 (사전 슬롯 카운트 후 다른 사용자가 차지)
  if (result === 'discount_not_eligible') {
    return NextResponse.json(
      { status: 'error', message: '스텝 할인 자격이 없습니다' },
      { status: 400 },
    )
  }

  if (result === 'staff_slot_full') {
    return NextResponse.json(
      { status: 'error', message: '스텝 할인 슬롯이 마감되었습니다. 정가로 다시 신청해주세요.' },
      { status: 400 },
    )
  }

  // 정원이 찬 뒤의 계좌이체 대기 — RPC가 INSERT하지 않고 돌려보낸 건 (2026-10-09 결정).
  // 화면에서도 선택지를 감추지만(MeetingActionButton) 딥링크·동시 신청으로 여기까지 온다.
  // 정원 판정이 RPC의 FOR UPDATE 락 안에 있어야 하므로 이 거절은 라우트가 미리 세지 않는다.
  if (result === 'waitlist_card_only') {
    return NextResponse.json(
      { status: 'error', message: '자리가 모두 찼어요. 대기 신청은 카드 결제로만 가능해요.' },
      { status: 400 },
    )
  }

  // 신청 완료 알림톡 — `pending_transfer`로 자리를 잡은 건에만 보낸다 (2026-10-09 승인).
  // 대기(`waitlisted`)에는 보내지 않는다. 그쪽은 0원 건·is_free 회원만 남고 성격이 다른 소식이다.
  //
  // ⚠️ `after()`로 감싼다 — `void`로 띄우면 Vercel 람다가 응답 뒤 freeze되어 유실·지연된다
  //    (2026-08-17 Preview 실측 13분 지연).
  // 알림은 부가 기능이라 실패해도 신청은 유효하다. 중복 차단은
  // `idx_notifications_confirm_unique`(registration_id 단위)가 맡는다.
  if (result === 'pending_transfer') {
    // RPC는 status 문자열만 돌려준다 — 알림톡은 registration_id가 필요해 되찾는다.
    // 위 중복 체크가 통과한 건이라 이 회원·이 모임에 살아 있는 건은 방금 만든 1건뿐이다.
    const { data: created } = await admin
      .from('registrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('meeting_id', meetingId)
      .eq('status', 'pending_transfer')
      .order('created_at', { ascending: false })
      .limit(1)

    const registrationId = created?.[0]?.id
    if (registrationId) {
      after(
        sendRegistrationConfirmNotification(meetingId, user.id, registrationId).catch((error) => {
          console.error('[transfer] 신청 완료 알림톡 발송 실패:', error)
        }),
      )
    } else {
      console.error('[transfer] 알림톡 대상 신청을 되찾지 못했습니다:', user.id, meetingId)
    }
  }

  // pending_transfer 또는 waitlisted
  return NextResponse.json({ status: result })
  } catch (error) {
    console.error('[transfer] 예기치 않은 오류:', error)
    return NextResponse.json(
      { status: 'error', message: '서버 오류가 발생했습니다' },
      { status: 500 },
    )
  }
}
