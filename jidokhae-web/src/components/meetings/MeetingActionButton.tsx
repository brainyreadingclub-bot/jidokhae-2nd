'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as PortOne from '@portone/browser-sdk/v2'
import type { ButtonState } from '@/lib/kst'
// formatFee = 환불 금액(0은 "돌려받을 돈 없음")
// formatPaidAmountForScreen = 낼 돈/낸 돈 — 「무료」는 **모임 참가비**(meetingFee)로만 판정한다
import { formatFee, formatPaidAmountForScreen } from '@/lib/kst'
import { calculateRefundByType, getRefundRuleTextByType } from '@/lib/refund'
import ModalOverlay from '@/components/ui/ModalOverlay'
import BankInfoCard from '@/components/meetings/BankInfoCard'
import CopyableDepositorName from '@/components/meetings/CopyableDepositorName'
import { getActionSkin, type SkinName } from '@/components/meetings/actionButtonSkin'
import { trackEvent } from '@/lib/analytics'
import { getPaymentFailMessage, clipForLog } from '@/lib/payment-fail-message'
import { isWaitlistCardOnly } from '@/lib/waitlist-rules'
import { isNoTransferNeeded, registerEntry, showsCardOption, transferDoneHref } from '@/lib/transfer-rules'

type Props = {
  buttonState: ButtonState
  meetingId: string
  meetingTitle: string
  meetingFee: number
  /** 신청자에게 실제 청구되는 금액 (정가 또는 스텝 50%). PortOne value + 모달 표시에 사용. */
  displayFee?: number
  /** 스텝 할인이 적용되는 신청인지 여부. 모달에서 영수증 패턴 노출에 사용. */
  isStaffDiscount?: boolean
  /** 본인 `profiles.is_free` — 유료 대기에서도 계좌이체를 보여준다 (결정 A, 2026-10-09) */
  isFree?: boolean
  meetingDate: string
  /** 환불 규칙 분기용 (discussion = 14/7, 그 외 3/2) */
  meetingType?: string | null
  userId: string
  registrationId?: string
  paidAmount?: number | null
  waitlistRegistrationId?: string
  waitlistPaidAmount?: number | null
  pendingTransferRegistrationId?: string
  paymentMode?: string
  registrationPaymentMethod?: 'card' | 'transfer' | 'none'
  /** 본인이 이 모임 발제자(0원 신청 완료) — 취소 버튼 대신 한 줄 안내 (대표님 확정 ⑥, 2026-10-13) */
  isPresenter?: boolean
  supportContact?: string
  waitlistPaymentMethod?: 'card' | 'transfer'
  bankName?: string
  bankAccount?: string
  bankHolder?: string
  depositorName?: string
  /**
   * 겉 스타일만 고른다 — 로직은 한 벌이다 (actionButtonSkin.ts 주석 참조).
   * 'toss' = `(next)` 5탭 스킨. 미지정이면 구 화면 그대로.
   */
  skin?: SkinName
  /** 취소·환불 완료 후 "모임 일정으로" 도착지. 라벨과 실제 목적지를 맞춘다 */
  listHref?: string
  /** 주 버튼 문구 교체 (신청 확인 화면의 "이대로 신청하기 · 12,000") */
  registerLabel?: string
  /** 토론모임 자격 잠금 시 보낼 곳 (next_ui ON이면 /meet, OFF면 /). `loadMeetingDetail`이 계산한다 */
  regularListHref?: string
}

type CancelPhase = 'idle' | 'info' | 'confirm' | 'processing' | 'complete'
type PendingTransferCancelPhase = 'idle' | 'confirm' | 'processing'
type RegisterPhase = 'idle' | 'method' | 'transfer' | 'processing'
type WaitlistCancelPhase = 'idle' | 'confirm' | 'processing' | 'complete'

export default function MeetingActionButton({
  buttonState,
  meetingId,
  meetingTitle,
  meetingFee,
  displayFee,
  isStaffDiscount = false,
  isFree = false,
  meetingDate,
  meetingType = null,
  userId,
  registrationId,
  paidAmount,
  waitlistRegistrationId,
  waitlistPaidAmount,
  pendingTransferRegistrationId,
  paymentMode,
  registrationPaymentMethod,
  supportContact,
  waitlistPaymentMethod,
  bankName,
  bankAccount,
  bankHolder,
  depositorName,
  skin = 'legacy',
  listHref = '/',
  registerLabel,
  regularListHref = '/',
  isPresenter = false,
}: Props) {
  // 결제 처리에 사용할 실제 금액 — 미지정 시 정가 fallback
  const effectiveFee = displayFee ?? meetingFee

  // 대기 신청은 카드만 받는다 (2026-10-09 대표님 결정).
  // 받을 돈이 없는 건(0원)은 예외 — 입금 확인 단계가 애초에 없으므로 계좌이체로도 줄을 설 수 있다.
  // 본인이 is_free(입금 자체가 없는 무료 참석자)여도 예외다 (결정 A, 2026-10-09 밤).
  //
  // 여기 쓰는 값이 `meetingFee`가 아니라 `effectiveFee`인 이유 — 이 숫자가 그대로
  // `paid_amount`로 들어가고, 거절 판정을 하는 `register_transfer` RPC도 `paid_amount`를 본다.
  // 두 곳이 **같은 수를** 보게 해야 화면과 서버가 갈리지 않는다.
  // 🔴 이건 겉 막이다. 실제 방어선은 RPC다 — 정원 판정이 FOR UPDATE 락 안에 있어야
  // 동시 신청에 지지 않는다 (migration-waitlist-card-only.sql).
  const waitlistCardOnly = isWaitlistCardOnly(buttonState.type === 'join_waitlist', effectiveFee, isFree)
  // 0원 모임 — 계좌이체 단계에서 입금 안내를 숨긴다. 서버(register_transfer)도 같은 조건(참가비 0 · 신청 금액 0)으로
  // 바로 신청 완료로 넣는다 (2026-10-13)
  const noTransferNeeded = isNoTransferNeeded(meetingFee, effectiveFee)
  const s = getActionSkin(skin)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [cancelPhase, setCancelPhase] = useState<CancelPhase>('idle')
  const [cancelResult, setCancelResult] = useState<{
    refundedAmount: number
    refundRate: number
  } | null>(null)
  const [waitlistCancelPhase, setWaitlistCancelPhase] = useState<WaitlistCancelPhase>('idle')
  const [pendingTransferCancelPhase, setPendingTransferCancelPhase] = useState<PendingTransferCancelPhase>('idle')
  const [registerPhase, setRegisterPhase] = useState<RegisterPhase>('idle')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // --- Register ---
  async function handleRegister() {
    if (loading) return
    setLoading(true)

    const entry = registerEntry(paymentMode, effectiveFee)

    // 0원 — 계좌이체(= 바로 신청 완료) 한 길뿐이라 고르는 창 없이 그 단계로 (2026-10-13).
    // payment_mode보다 먼저 본다: card_only에서도 0원 회원이 카드 결제창으로 가지 않게
    if (entry === 'transfer') {
      trackEvent('begin_checkout', {
        item_id: meetingId,
        item_name: meetingTitle,
        value: 0,
        currency: 'KRW',
        registration_type: buttonState.type === 'join_waitlist' ? 'waitlist' : 'regular',
        payment_method: 'transfer',
      })
      setRegisterPhase('transfer')
      setLoading(false)
      return
    }

    // both / transfer_only: 결제 방법 선택 모달 표시
    // 'both'면 카드+계좌이체 둘 다 활성, 'transfer_only'면 카드는 "준비 중"으로 비활성
    if (entry === 'method') {
      trackEvent('begin_checkout', {
        item_id: meetingId,
        item_name: meetingTitle,
        value: effectiveFee,
        currency: 'KRW',
        registration_type: buttonState.type === 'join_waitlist' ? 'waitlist' : 'regular',
      })
      setRegisterPhase('method')
      setLoading(false)
      return
    }

    // card_only 또는 미지정: 카드결제 직행 (모달 생략)
    await handleCardPayment()
  }

  // --- Card Payment (PortOne V2) ---
  // both 모드에서 모달의 "카드결제" 옵션 클릭 시, 또는 card_only 모드에서 신청하기 클릭 시 호출됨.
  async function handleCardPayment() {
    setRegisterPhase('idle') // 모달 닫기 (열려있던 경우)
    setLoading(true)

    trackEvent('begin_checkout', {
      item_id: meetingId,
      item_name: meetingTitle,
      value: effectiveFee,
      currency: 'KRW',
      registration_type: buttonState.type === 'join_waitlist' ? 'waitlist' : 'regular',
      payment_method: 'card',
    })

    const meetingId8 = meetingId.replace(/-/g, '').slice(0, 8)
    const userId8 = userId.replace(/-/g, '').slice(0, 8)
    // PortOne paymentId — 우리 시스템의 결제 식별자 (= 기존 orderId 역할)
    const paymentId = `jdkh-${meetingId8}-${userId8}-${Date.now()}`

    try {
      const origin = window.location.origin

      // PortOne SDK 타입 정의 버그(alipayPlus가 required로 잘못 선언됨) 우회용 단언.
      // 실제 런타임은 카카오페이 단일 채널 + EASY_PAY로 정상 동작.
      const response = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!,
        paymentId,
        orderName: meetingTitle,
        totalAmount: effectiveFee, // 자격자 + 슬롯 여석이면 displayFee(할인가), 아니면 정가
        currency: 'CURRENCY_KRW',
        payMethod: 'EASY_PAY', // 카카오페이 결제창 (카드 + 카카오페이머니 모두 노출)
        redirectUrl: `${origin}/meetings/${meetingId}/payment-redirect`,
      } as Parameters<typeof PortOne.requestPayment>[0])

      // 모바일 redirect 케이스는 redirectUrl로 이동 → 여기 도달하지 않음
      // PC/팝업 inline 케이스만 도달 — 응답에 code가 있으면 실패
      if (response?.code !== undefined) {
        // PortOne SDK의 원문(개발용 내용일 수 있음)은 화면에 내지 않고 로그로만
        console.warn('[payment-request]', clipForLog(response.code), clipForLog(response.message))
        showToast(getPaymentFailMessage({ code: response.code, message: response.message }))
        setLoading(false)
        return
      }

      // PC 결제 성공 → redirect 핸들러로 직접 이동 (포트원이 자동 redirect 안 함)
      router.push(`/meetings/${meetingId}/payment-redirect?paymentId=${paymentId}`)
    } catch {
      showToast('결제를 시작하지 못했어요. 잠깐 뒤에 다시 시도해 주세요')
      setLoading(false)
    }
  }

  // --- Pending transfer cancel (2단계: confirm → processing) ---
  async function handlePendingTransferCancelConfirm() {
    if (!pendingTransferRegistrationId) return
    setPendingTransferCancelPhase('processing')
    try {
      const res = await fetch('/api/registrations/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: pendingTransferRegistrationId }),
      })
      const data = await res.json()
      if (data.status === 'success' || data.status === 'already_cancelled') {
        setPendingTransferCancelPhase('idle')
        router.refresh()
      } else {
        setPendingTransferCancelPhase('idle')
        showToast(data.message || '신청을 취소하지 못했어요')
      }
    } catch {
      setPendingTransferCancelPhase('idle')
      showToast('연결이 불안정해요. 잠깐 뒤에 다시 시도해 주세요')
    }
  }

  // --- Cancel flow ---
  // 🔴 `paidAmount ? … : null`이면 0원 신청은 취소 창이 아예 열리지 않았다 — 「취소하기」를 눌러도
  //    아무 일도 안 일어나던 결함 (0원 정기모임 회원, 설계서 §8-1). 0이어도 창을 연다.
  const refundInfo = paidAmount != null
    ? calculateRefundByType(meetingType, meetingDate, paidAmount)
    : null
  // 0원 신청 — 돌려받을 돈이 없다. 환불 비율·「환불 불가 기간」을 보여 주면 틀린 말이 된다
  const nothingToRefund = paidAmount === 0

  async function handleCancelConfirm() {
    if (!registrationId) return
    setCancelPhase('processing')

    try {
      const res = await fetch('/api/registrations/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId }),
      })

      const data = await res.json()

      if (data.status === 'success') {
        trackEvent('refund', {
          item_id: meetingId,
          value: data.refundedAmount,
          currency: 'KRW',
          refund_rate: data.refundRate,
          cancel_type: 'confirmed',
        })
        setCancelResult({
          refundedAmount: data.refundedAmount,
          refundRate: data.refundRate,
        })
        setCancelPhase('complete')
        router.refresh()
      } else if (data.status === 'already_cancelled') {
        setCancelPhase('idle')
        showToast('이미 취소된 신청이에요')
        router.refresh()
      } else {
        setCancelPhase('idle')
        showToast(data.message || '신청을 취소하지 못했어요')
      }
    } catch {
      setCancelPhase('idle')
      showToast('연결이 불안정해요. 잠깐 뒤에 다시 시도해 주세요')
    }
  }

  async function handleWaitlistCancelConfirm() {
    if (!waitlistRegistrationId) return
    setWaitlistCancelPhase('processing')

    try {
      const res = await fetch('/api/registrations/waitlist-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: waitlistRegistrationId }),
      })

      const data = await res.json()

      if (data.status === 'success') {
        trackEvent('refund', {
          item_id: meetingId,
          value: waitlistPaidAmount ?? 0,
          currency: 'KRW',
          refund_rate: 100,
          cancel_type: 'waitlist',
        })
        setWaitlistCancelPhase('complete')
        router.refresh()
      } else {
        setWaitlistCancelPhase('idle')
        showToast(data.message || '대기 신청을 취소하지 못했어요')
      }
    } catch {
      setWaitlistCancelPhase('idle')
      showToast('연결이 불안정해요. 잠깐 뒤에 다시 시도해 주세요')
    }
  }

  // Determine if we should show a sticky button
  const showStickyButton =
    (buttonState.type === 'register') ||
    (buttonState.type === 'full') ||
    (buttonState.type === 'discussion_locked') ||
    (buttonState.type === 'discussion_paused') ||
    (buttonState.type === 'cancel' && cancelPhase === 'idle') ||
    (buttonState.type === 'join_waitlist') ||
    (buttonState.type === 'waitlist_cancel' && waitlistCancelPhase === 'idle') ||
    (buttonState.type === 'pending_transfer' && pendingTransferCancelPhase === 'idle')

  return (
    <>
      {/* === Sticky bottom buttons === */}
      {showStickyButton && (
        <StickyBottom outerStyle={s.stickyOuterStyle} innerStyle={s.stickyInnerStyle}>
          {buttonState.type === 'register' && (
            <button
              onClick={handleRegister}
              disabled={loading}
              className={s.btnPrimary}
              style={s.btnPrimaryStyle}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  결제 진행 중...
                </span>
              ) : (
                registerLabel ?? '신청하기'
              )}
            </button>
          )}

          {buttonState.type === 'full' && (
            <button disabled className={s.btnDisabled}>
              마감
            </button>
          )}

          {/* 토론모임 자격 잠금 — 회색 비활성이 아니라 **갈 곳이 있는** 버튼.
              회색은 "아무도 할 수 있는 게 없다"는 뜻이고, 여기는 할 수 있는 일이 있다.
              주 버튼 색(그린/브랜드)은 이 화면에서 결제로 가는 색이라 쓰지 않는다. */}
          {buttonState.type === 'discussion_locked' && (
            <div>
              <Link
                href={regularListHref}
                className={`flex items-center justify-center ${s.btnGhost}`}
                style={s.btnGhostStyle}
              >
                다가오는 정기모임 보기
              </Link>
              <p className={s.note}>정기모임에 한 번 다녀오면 신청할 수 있어요</p>
            </div>
          )}

          {/* 격리 플래그 OFF — 새 신청만 막는다. 취소·환불 상태는 이 분기로 오지 않는다 */}
          {buttonState.type === 'discussion_paused' && (
            <button disabled className={s.btnDisabled}>
              지금은 신청을 받고 있지 않아요
            </button>
          )}

          {/* 발제자 본인 — 스스로 빠지면 운영자가 모른다. 빼기는 운영자가 한다 (서버도 막는다: cancel.ts) */}
          {buttonState.type === 'cancel' && cancelPhase === 'idle' && isPresenter && (
            <p className={s.note}>참석이 어려우면 운영자에게 알려 주세요</p>
          )}

          {buttonState.type === 'cancel' && cancelPhase === 'idle' && !isPresenter && (
            <button
              onClick={() => setCancelPhase('info')}
              className={s.btnGhost}
              style={s.btnGhostStyle}
            >
              신청 취소하기
            </button>
          )}

          {buttonState.type === 'join_waitlist' && (
            <div>
              <button
                onClick={handleRegister}
                disabled={loading}
                className={s.btnWaitlist}
                style={s.btnWaitlistStyle}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    결제 진행 중...
                  </span>
                ) : (
                  registerLabel ?? '대기 신청하기'
                )}
              </button>
              <p className={s.note}>
                자리가 나면 자동으로 신청이 완료돼요.
                <br />
                모임 전날까지 자리가 나지 않으면 결제 금액을 모두 환불해 드려요.
              </p>
            </div>
          )}

          {buttonState.type === 'waitlist_cancel' && waitlistCancelPhase === 'idle' && (
            <button
              onClick={() => setWaitlistCancelPhase('confirm')}
              className={s.btnGhost}
              style={s.btnGhostStyle}
            >
              대기 신청 취소하기
            </button>
          )}

          {buttonState.type === 'pending_transfer' && pendingTransferCancelPhase === 'idle' && (
            <button
              onClick={() => setPendingTransferCancelPhase('confirm')}
              className={s.btnGhost}
              style={s.btnGhostStyle}
            >
              신청 취소하기
            </button>
          )}
        </StickyBottom>
      )}

      {/* === Cancel complete (replaces button area) === */}
      {cancelPhase === 'complete' && cancelResult && (
        <div className={s.panel} style={s.panelStyle}>
          <div className={s.panelIcon}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={s.panelIconSvg}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className={s.panelTitle}>신청을 취소했어요</h3>
          <p className={s.panelBody}>
            {cancelResult.refundedAmount > 0 ? (
              <>
                환불 예정 금액:{' '}
                <span className={s.panelStrong}>
                  {formatFee(cancelResult.refundedAmount)}
                </span>
                <br />
                <span className={s.panelSmall}>
                  {registrationPaymentMethod === 'transfer'
                    ? supportContact || '환불은 운영진에게 문의해 주세요'
                    : '영업일 기준 3~5일 안에 환불돼요'}
                </span>
              </>
            ) : nothingToRefund ? (
              '취소됐어요'
            ) : (
              registrationPaymentMethod === 'transfer'
                ? '취소가 접수됐어요'
                : '환불 불가 기간이라 환불 금액이 없어요'
            )}
          </p>
          <button onClick={() => router.push(listHref)} className={s.panelCta}>
            모임 일정으로
          </button>
        </div>
      )}

      {/* === Waitlist info card === */}
      {buttonState.type === 'waitlist_cancel' && waitlistCancelPhase === 'idle' && (
        <div className={s.waitCard} style={s.waitCardStyle}>
          <div className="flex items-center justify-between mb-3">
            <span className={s.waitPill}>대기 중</span>
            {waitlistPaidAmount != null && (
              <span className={s.waitAmount}>{formatPaidAmountForScreen(waitlistPaidAmount, meetingFee)}</span>
            )}
          </div>
          <p className={s.waitBody}>
            자리가 나면 자동으로 신청이 완료돼요.
            <br />
            모임 전날까지 자리가 나지 않으면 결제 금액을 모두 환불해 드려요.
          </p>
        </div>
      )}

      {/* === Waitlist cancel complete === */}
      {waitlistCancelPhase === 'complete' && (
        <div className={s.panel} style={s.panelStyle}>
          <div className={s.panelIcon}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={s.panelIconSvg}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className={s.panelTitle}>대기 신청을 취소했어요</h3>
          <p className={s.panelBody}>
            {waitlistPaymentMethod === 'transfer' ? (
              '대기 신청이 취소됐어요'
            ) : (
              <>
                결제 금액을 모두 환불해 드려요.
                <br />
                <span className={s.panelSmall}>영업일 기준 3~5일 안에 환불돼요</span>
              </>
            )}
          </p>
          <button onClick={() => router.push(listHref)} className={s.panelCta}>
            모임 일정으로
          </button>
        </div>
      )}

      {/* === Attended === */}
      {buttonState.type === 'attended' && (
        <div className={s.attended} style={s.attendedStyle}>
          참여 완료
        </div>
      )}

      {/* === Cancel Info Modal (Phase 1) === */}
      {cancelPhase === 'info' && refundInfo && (
        <ModalOverlay onClose={() => setCancelPhase('idle')}>
          <h3 className={s.modalTitle}>환불 규정 안내</h3>
          <div className={s.infoBox} style={s.infoBoxStyle}>
            <div className="flex justify-between text-sm">
              <span className={s.infoLabel}>결제 금액</span>
              <span className={s.infoValue}>{formatPaidAmountForScreen(paidAmount ?? 0, meetingFee)}</span>
            </div>
            {!nothingToRefund && (
              <div className="mt-2 flex justify-between text-sm">
                <span className={s.infoLabel}>환불 비율</span>
                <span className={s.infoValue}>{refundInfo.refundRate}%</span>
              </div>
            )}
            <div
              className="mt-2 pt-2 flex justify-between text-sm"
              style={s.infoDividerStyle}
            >
              <span className={s.infoTotalLabel}>
                환불 예정 금액
              </span>
              <span className={s.infoTotalValue}>
                {nothingToRefund ? '없음' : formatFee(refundInfo.refundAmount)}
              </span>
            </div>
          </div>
          {!nothingToRefund && refundInfo.refundRate === 0 && (
            <p className={`mt-3 ${s.warnText}`}>
              환불 불가 기간이에요. 지금 취소하면 환불 금액이 없어요.
            </p>
          )}
          {!nothingToRefund && (
            <div className={s.ruleText}>{getRefundRuleTextByType(meetingType)}</div>
          )}
          {registrationPaymentMethod === 'transfer' && refundInfo.refundAmount > 0 && supportContact && (
            <div className={s.supportBox} style={s.supportBoxStyle}>
              <p className={s.supportText}>{supportContact}</p>
            </div>
          )}
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setCancelPhase('idle')}
              className={s.btnSecondary}
              style={s.btnSecondaryStyle}
            >
              닫기
            </button>
            <button onClick={() => setCancelPhase('confirm')} className={s.btnConfirm}>
              취소 진행
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* === Cancel Confirm Modal (Phase 2) === */}
      {cancelPhase === 'confirm' && refundInfo && (
        <ModalOverlay onClose={() => setCancelPhase('info')}>
          <h3 className={`${s.modalTitle} text-center`}>
            신청을 취소할까요?
          </h3>
          {nothingToRefund ? (
            <p className={`${s.modalBody} text-center`}>낸 참가비가 없어 환불은 없어요.</p>
          ) : (
            <p className={`${s.modalBody} text-center`}>
              환불 예정 금액:{' '}
              <span className={s.panelStrong}>{formatFee(refundInfo.refundAmount)}</span>
              {refundInfo.refundRate < 100 && (
                <span className={s.modalMuted}> ({refundInfo.refundRate}%)</span>
              )}
            </p>
          )}
          {!nothingToRefund && refundInfo.refundAmount === 0 && (
            <p className={`mt-1 ${s.warnText}`}>
              환불 예정 금액이 0원이에요. 그래도 취소할까요?
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setCancelPhase('info')}
              className={s.btnSecondary}
              style={s.btnSecondaryStyle}
            >
              돌아가기
            </button>
            <button onClick={handleCancelConfirm} className={s.btnDanger}>
              취소 확정
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* === Cancel Processing Modal (Phase 3) === */}
      {cancelPhase === 'processing' && (
        <ModalOverlay>
          <div className="flex flex-col items-center py-4">
            <Spinner />
            <p className={s.processingText}>취소 처리 중...</p>
          </div>
        </ModalOverlay>
      )}

      {/* === Waitlist Cancel Confirm Modal === */}
      {waitlistCancelPhase === 'confirm' && (
        <ModalOverlay onClose={() => setWaitlistCancelPhase('idle')}>
          <h3 className={`${s.modalTitle} text-center`}>
            대기 신청을 취소할까요?
          </h3>
          <p className={`${s.modalBody} text-center`}>결제 금액을 모두 환불해 드려요.</p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setWaitlistCancelPhase('idle')}
              className={s.btnSecondary}
              style={s.btnSecondaryStyle}
            >
              닫기
            </button>
            <button onClick={handleWaitlistCancelConfirm} className={s.btnDanger}>
              대기 신청 취소하기
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* === Waitlist Cancel Processing Modal === */}
      {waitlistCancelPhase === 'processing' && (
        <ModalOverlay>
          <div className="flex flex-col items-center py-4">
            <Spinner />
            <p className={s.processingText}>대기 취소 처리 중...</p>
          </div>
        </ModalOverlay>
      )}

      {/* === Register Method / Transfer Modal === */}
      {(registerPhase === 'method' || registerPhase === 'transfer' || registerPhase === 'processing') && (
        <ModalOverlay onClose={() => setRegisterPhase('idle')}>
          <div className="max-h-[85vh] overflow-y-auto">
            {/* Method Selection */}
            {registerPhase === 'method' && (
              <>
                <h3 className={`${s.modalTitle} text-center`}>
                  결제 방법을 골라 주세요
                </h3>
                {/* 자격자 — 결제 금액 사전 확인용 영수증 (정가 + 할인 + 총액) */}
                {isStaffDiscount && (
                  <div className={`mt-4 max-w-[280px] ${s.receipt}`} style={s.receiptStyle}>
                    <div className={`flex justify-between mb-1 ${s.receiptStruck}`}>
                      <span className="line-through">참가비</span>
                      <span className="line-through">{formatFee(meetingFee)}</span>
                    </div>
                    <div className="flex justify-between text-[12px] mb-2">
                      <span className={s.receiptDiscountLabel}>스텝 할인 50%</span>
                      <span className={s.receiptDiscountValue}>−{formatFee(meetingFee - effectiveFee)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-2" style={s.receiptDividerStyle}>
                      <span className={s.receiptTotalLabel}>결제 금액</span>
                      <span className={s.receiptTotalValue}>{formatFee(effectiveFee)}</span>
                    </div>
                  </div>
                )}
                <div className="mt-5 space-y-3">
                  {/* 카드결제 — 'both' 모드면 활성, 'transfer_only' 모드면 비활성. 0원이면 아예 없다 (2026-10-13) */}
                  {!showsCardOption(effectiveFee) ? null : paymentMode === 'both' ? (
                    <button
                      onClick={handleCardPayment}
                      className={s.optionCard}
                      style={s.optionCardStyle}
                    >
                      <div className="flex items-center gap-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={s.optionIcon}>
                          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                          <line x1="1" y1="10" x2="23" y2="10" />
                        </svg>
                        <div>
                          <p className={s.optionTitle}>카드</p>
                          <p className={s.optionSub}>카카오페이 (카드 + 카카오페이머니)</p>
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className={s.optionCardOff} style={s.optionCardOffStyle}>
                      <div className="flex items-center gap-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={s.optionIconOff}>
                          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                          <line x1="1" y1="10" x2="23" y2="10" />
                        </svg>
                        <div>
                          <p className={s.optionTitleOff}>카드</p>
                          <p className={s.optionSubOff}>준비 중이에요</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 계좌이체 — 대기 신청(유료)에서는 아예 내보이지 않는다 (2026-10-09 결정).
                      "준비 중"으로 흐려 두지 않는 이유 — 나중에 열릴 것처럼 읽힌다. */}
                  {!waitlistCardOnly && (
                    <button
                      onClick={() => setRegisterPhase('transfer')}
                      className={s.optionCard}
                      style={s.optionCardStyle}
                    >
                      <div className="flex items-center gap-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={s.optionIcon}>
                          <line x1="12" y1="1" x2="12" y2="23" />
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                        <div>
                          <p className={s.optionTitle}>계좌이체</p>
                          <p className={s.optionSub}>계좌번호로 직접 입금</p>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
                {waitlistCardOnly && (
                  <p className={s.note}>
                    대기 신청은 카드 결제로만 가능해요.
                  </p>
                )}
              </>
            )}

            {/* Transfer Details */}
            {registerPhase === 'transfer' && (
              <>
                {/* 0원은 고르는 창을 건너뛰고 왔다 — 돌아갈 선택지가 없으니 「뒤로」를 숨긴다 */}
                {!noTransferNeeded && (
                  <button onClick={() => setRegisterPhase('method')} className={s.backBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    뒤로
                  </button>
                )}

                <div className="text-center mb-4">
                  <p className={s.transferTitle}>{meetingTitle}</p>
                  {isStaffDiscount ? (
                    <div className={`mt-3 max-w-[260px] ${s.receipt}`} style={s.receiptStyle}>
                      <div className={`flex justify-between mb-1 ${s.receiptStruck}`}>
                        <span className="line-through">참가비</span>
                        <span className="line-through">{formatFee(meetingFee)}</span>
                      </div>
                      <div className="flex justify-between text-[12px] mb-2">
                        <span className={s.receiptDiscountLabel}>스텝 할인 50%</span>
                        <span className={s.receiptDiscountValue}>−{formatFee(meetingFee - effectiveFee)}</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-2" style={s.receiptDividerStyle}>
                        <span className={s.receiptTotalLabel}>결제 금액</span>
                        <span className={s.receiptTotalValue}>{formatFee(effectiveFee)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className={s.transferAmount}>{formatPaidAmountForScreen(effectiveFee, meetingFee)}</p>
                  )}
                </div>

                {/* 0원 모임은 받을 돈이 없다 — 계좌·입금자명을 보여 주면 입금하라는 말이 된다 (2026-10-13) */}
                {!noTransferNeeded && bankName && bankAccount && bankHolder && (
                  <BankInfoCard
                    bankName={bankName}
                    bankAccount={bankAccount}
                    bankHolder={bankHolder}
                    skin={skin}
                  />
                )}

                {!noTransferNeeded && depositorName && (
                  <CopyableDepositorName depositorName={depositorName} skin={skin} />
                )}

                {/* 이 버튼은 「입금했다」고 알리는 버튼이 아니라 신청 요청을 보내는 버튼이다 — 문구만 바꿈, 동작 그대로 (2026-10-14 코드 조사 §1-3 12번) */}
                {!noTransferNeeded && (
                  <p className="mt-5 text-center text-[13px] text-neutral-500 break-keep">신청하면 바로 자리가 잡혀요. 입금은 안내된 계좌로 해 주세요</p>
                )}

                <button
                  onClick={async () => {
                    setRegisterPhase('processing')
                    try {
                      const res = await fetch('/api/registrations/transfer', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ meetingId }),
                      })
                      const data = await res.json()
                      // 'confirmed' = 0원 모임 — 처음부터 신청 완료(2026-10-13), 입금 안내 없는 완료 화면
                      const doneHref = transferDoneHref(meetingId, data.status)
                      if (doneHref) {
                        // GA sign_up_meeting — 기록표 registration.sign_up_meeting과 짝 (GA 이름 = 점 뒤 부분). 카드 purchase와 별개
                        trackEvent('sign_up_meeting', { payment_method: 'transfer', value: effectiveFee, currency: 'KRW', meeting_id: meetingId, registration_type: data.status })
                        router.replace(doneHref)
                      } else if (data.status === 'already_registered') {
                        setRegisterPhase('transfer')
                        showToast('이미 신청한 모임이에요')
                      } else {
                        setRegisterPhase('transfer')
                        showToast(data.message || '신청하지 못했어요. 잠깐 뒤에 다시 시도해 주세요')
                      }
                    } catch {
                      setRegisterPhase('transfer')
                      showToast('연결이 불안정해요. 잠깐 뒤에 다시 시도해 주세요')
                    }
                  }}
                  className={`${noTransferNeeded ? 'mt-5' : 'mt-2'} ${s.btnPrimary}`}
                  style={s.btnPrimaryStyle}
                >
                  {noTransferNeeded ? '신청하기' : '계좌이체로 신청하기'}
                </button>
              </>
            )}

            {/* Processing */}
            {registerPhase === 'processing' && (
              <div className="flex flex-col items-center py-4">
                <Spinner />
                <p className={s.processingText}>신청 처리 중...</p>
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* === Pending Transfer Cancel Confirm Modal === */}
      {pendingTransferCancelPhase === 'confirm' && (
        <ModalOverlay onClose={() => setPendingTransferCancelPhase('idle')}>
          <h3 className={`${s.modalTitle} text-center`}>
            신청을 취소할까요?
          </h3>
          <p className={`${s.modalBody} text-center`}>취소하면 다시 신청해야 해요.</p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setPendingTransferCancelPhase('idle')}
              className={s.btnSecondary}
              style={s.btnSecondaryStyle}
            >
              돌아가기
            </button>
            <button onClick={handlePendingTransferCancelConfirm} className={s.btnDanger}>
              신청 취소하기
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* === Pending Transfer Cancel Processing Modal === */}
      {pendingTransferCancelPhase === 'processing' && (
        <ModalOverlay>
          <div className="flex flex-col items-center py-4">
            <Spinner />
            <p className={s.processingText}>취소 처리 중...</p>
          </div>
        </ModalOverlay>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-medium text-white animate-[fadeIn_0.2s_ease-out]"
          style={s.toastStyle}
        >
          {toast}
        </div>
      )}
    </>
  )
}

// --- Sub-components ---

function StickyBottom({
  children,
  outerStyle,
  innerStyle,
}: {
  children: React.ReactNode
  outerStyle: React.CSSProperties
  innerStyle: React.CSSProperties
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40" style={outerStyle}>
      <div className="mx-auto max-w-screen-sm px-5 py-3" style={innerStyle}>
        {children}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-current"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
