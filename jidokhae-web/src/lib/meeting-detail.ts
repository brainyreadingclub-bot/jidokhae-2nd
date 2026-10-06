import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { getMeeting } from '@/lib/meeting'
import { getKSTToday, getButtonState, type ButtonState } from '@/lib/kst'
import { isDiscussionApplyOpen } from '@/lib/discussion-rules'
import { getSiteSettings, DEFAULT_PAYMENT_MODE } from '@/lib/site-settings'
import { getDisplayFee } from '@/lib/staff-slot'
import type { Meeting } from '@/types/meeting'

/**
 * 모임 상세 한 화면에 필요한 데이터 + 판정을 모으는 단일 진입점.
 *
 * 왜 분리했나 — 같은 상세를 스킨 두 벌(`(main)` 잉크그린 / `(next)` 토스)로 그린다.
 * 조회·정원 마스킹·D-7 게이트·스텝 할인 표시가가 두 벌이 되면 다음에 규칙이
 * 바뀔 때 한쪽만 고쳐진다 (PR #64가 고친 사고의 모양). 화면은 둘, 판정은 하나로 둔다.
 *
 * 이 파일은 MeetingDetailContent.tsx에서 **그대로 옮긴 것**이다. 판정 규칙은 바뀌지 않았다.
 */

export type MeetingDetailBook = {
  title: string
  authors: string | null
  publisher: string | null
  thumbnail: string | null
  description: string | null
}

export type MeetingDetailData = {
  meeting: Meeting
  userId: string
  /** 토론모임 + book_id 연결 시에만 채워진다 */
  book: MeetingDetailBook | null
  confirmedCount: number
  buttonState: ButtonState
  /** 자격자(admin/editor/staff) + 슬롯 여석이면 할인가, 그 외 정가 */
  displayFee: number
  isStaffDiscount: boolean
  /** 정원을 차지한 본인(confirmed 또는 pending_transfer) */
  isBookedSelf: boolean
  hasConfirmed: boolean
  hasWaitlisted: boolean
  hasPendingTransfer: boolean
  isEditorOrAdmin: boolean
  /** 운영자 또는 정원을 차지한 본인 — 카운트 마스킹 해제 */
  showAccurateCount: boolean
  participantNicknames: string[]
  /** "M/D 닉네임" — 은행 입금자명 12자 한도 + 운영자 식별 편의 */
  depositorName: string
  nickname: string
  paymentMode: string
  bankName: string
  bankAccount: string
  bankHolder: string
  supportContact: string
  myRegistrationId?: string
  myPaidAmount?: number | null
  myPaymentMethod?: 'card' | 'transfer'
  waitlistRegistrationId?: string
  waitlistPaidAmount?: number | null
  waitlistPaymentMethod?: 'card' | 'transfer'
  pendingTransferRegistrationId?: string
  kstToday: string
}

export async function loadMeetingDetail(id: string): Promise<MeetingDetailData> {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) redirect('/auth/login')

  const typedMeeting = await getMeeting(id)

  if (!typedMeeting || typedMeeting.status === 'deleted') {
    notFound()
  }

  // 토론모임 + 책 연결 시 표지·선정 이유·책 소개 (2026-08-18 표지 배치)
  const { data: bookRow } =
    typedMeeting.meeting_type === 'discussion' && typedMeeting.book_id
      ? await supabase
          .from('books')
          .select('title, authors, publisher, thumbnail, description')
          .eq('id', typedMeeting.book_id)
          .maybeSingle()
      : { data: null }

  const [countsResult, myRegResult, myWaitlistResult, pendingResult, participantsResult, settings] = await Promise.all([
    supabase.rpc('get_confirmed_counts', { meeting_ids: [id] }),
    supabase
      .from('registrations')
      .select('id, paid_amount, payment_id, payment_method')
      .eq('user_id', user.id)
      .eq('meeting_id', id)
      .eq('status', 'confirmed')
      .limit(1),
    supabase
      .from('registrations')
      .select('id, paid_amount, payment_method')
      .eq('user_id', user.id)
      .eq('meeting_id', id)
      .eq('status', 'waitlisted')
      .limit(1),
    supabase
      .from('registrations')
      .select('id, paid_amount')
      .eq('user_id', user.id)
      .eq('meeting_id', id)
      .eq('status', 'pending_transfer')
      .limit(1),
    supabase.rpc('get_meeting_participant_nicknames', { p_meeting_id: id }),
    getSiteSettings(),
  ])

  if (countsResult.error) {
    throw new Error(`참가자 수 조회 실패: ${countsResult.error.message}`)
  }
  if (myRegResult.error) {
    throw new Error(`내 신청 조회 실패: ${myRegResult.error.message}`)
  }
  if (myWaitlistResult.error) {
    throw new Error(`대기 신청 조회 실패: ${myWaitlistResult.error.message}`)
  }
  // participantsResult.error는 명단이 부가 기능이라 throw 대신 무시 (빈 배열로 폴백)

  const profile = await getProfile(user.id)

  const confirmedCount = Number(
    (countsResult.data as { meeting_id: string; confirmed_count: number }[] | null)
      ?.find((c) => c.meeting_id === id)?.confirmed_count ?? 0,
  )
  const myReg = myRegResult.data?.[0] ?? null
  const myWaitlistReg = myWaitlistResult.data?.[0] ?? null
  const myPendingTransfer = pendingResult.data?.[0] ?? null
  const hasConfirmed = myReg !== null
  const hasWaitlisted = myWaitlistReg !== null
  const hasPendingTransfer = myPendingTransfer !== null
  const paymentMode = settings.payment_mode ?? DEFAULT_PAYMENT_MODE
  const isFull = confirmedCount >= typedMeeting.capacity
  const role = profile.role ?? 'member'
  const isAdmin = role === 'admin'
  const isEditorOrAdmin = role === 'admin' || role === 'editor'

  const participantNicknames = (participantsResult.data as { nickname: string }[] | null)
    ?.map((row) => row.nickname)
    .filter((n): n is string => typeof n === 'string' && n.length > 0) ?? []

  // 회원 입장에서 입금 후 운영자 확인 전이라도 "신청 완료"처럼 보이게 — 명단/카운트 모두 confirmed와 동등 취급
  const isBookedSelf = hasConfirmed || hasPendingTransfer

  // 카운트 마스킹 해제 조건: 운영자 또는 본인이 정원에 차지한 경우 (confirmed/pending_transfer)
  const showAccurateCount = isEditorOrAdmin || isBookedSelf

  // 입금자명: "M/D 닉네임" — 은행 입금자명 글자수(한글 12자) 한도 + 운영자 식별 편의
  const [, mm, dd] = typedMeeting.date.split('-')
  const depositorName = `${Number(mm)}/${Number(dd)} ${profile.nickname}`

  if (typedMeeting.status === 'deleting' && !isAdmin) {
    notFound()
  }

  const kstToday = getKSTToday()
  let buttonState = getButtonState(
    typedMeeting.date,
    kstToday,
    hasConfirmed,
    isFull,
    hasWaitlisted,
    hasPendingTransfer,
  )

  // displayFee — 자격자(admin/editor/staff) + 슬롯 여석 시 할인가, 그 외 정가
  const { fee: displayFee, isDiscounted } = await getDisplayFee(
    typedMeeting.id,
    { role: profile.role, is_staff: profile.is_staff },
    typedMeeting.fee,
    typedMeeting.meeting_type,
  )

  // 토론모임 D-7 신청 마감 (2026-08-17 결정) — 신규 신청·대기 진입만 차단.
  // 이미 신청한 사람의 취소/입금 버튼은 그대로 둔다 (환불 7/3 규칙은 별도 동작).
  if (
    typedMeeting.meeting_type === 'discussion' &&
    !isDiscussionApplyOpen(typedMeeting.date, kstToday) &&
    (buttonState.type === 'register' ||
      buttonState.type === 'join_waitlist' ||
      buttonState.type === 'full')
  ) {
    buttonState = { type: 'apply_closed' }
  }

  return {
    meeting: typedMeeting,
    userId: user.id,
    book: (bookRow as MeetingDetailBook | null) ?? null,
    confirmedCount,
    buttonState,
    displayFee,
    isStaffDiscount: isDiscounted,
    isBookedSelf,
    hasConfirmed,
    hasWaitlisted,
    hasPendingTransfer,
    isEditorOrAdmin,
    showAccurateCount,
    participantNicknames,
    depositorName,
    nickname: profile.nickname || '',
    paymentMode,
    bankName: settings.bank_name ?? '',
    bankAccount: settings.bank_account ?? '',
    bankHolder: settings.bank_holder ?? '',
    supportContact: settings.support_contact ?? '',
    myRegistrationId: myReg?.id,
    myPaidAmount: myReg?.paid_amount,
    myPaymentMethod: myReg?.payment_method,
    waitlistRegistrationId: myWaitlistReg?.id,
    waitlistPaidAmount: myWaitlistReg?.paid_amount,
    waitlistPaymentMethod: myWaitlistReg?.payment_method,
    pendingTransferRegistrationId: myPendingTransfer?.id,
    kstToday,
  }
}

/** 상세에 sticky 버튼이 붙는 상태인지 — 본문 하단 여백 계산용 */
export function hasStickyAction(buttonState: ButtonState): boolean {
  return (
    buttonState.type === 'register' ||
    buttonState.type === 'full' ||
    buttonState.type === 'cancel' ||
    buttonState.type === 'join_waitlist' ||
    buttonState.type === 'waitlist_cancel' ||
    buttonState.type === 'pending_transfer' ||
    buttonState.type === 'apply_closed'
  )
}
