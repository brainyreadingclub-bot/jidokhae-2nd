'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as PortOne from '@portone/browser-sdk/v2'
import type { ButtonState } from '@/lib/kst'
import { formatFee } from '@/lib/kst'
import { calculateRefundByType, getRefundRuleTextByType } from '@/lib/refund'
import ModalOverlay from '@/components/ui/ModalOverlay'
import BankInfoCard from '@/components/meetings/BankInfoCard'
import CopyableDepositorName from '@/components/meetings/CopyableDepositorName'
import { getActionSkin, type SkinName } from '@/components/meetings/actionButtonSkin'
import { trackEvent } from '@/lib/analytics'

type Props = {
  buttonState: ButtonState
  meetingId: string
  meetingTitle: string
  meetingFee: number
  /** 신청자에게 실제 청구되는 금액 (정가 또는 스텝 50%). PortOne value + 모달 표시에 사용. */
  displayFee?: number
  /** 스텝 할인이 적용되는 신청인지 여부. 모달에서 영수증 패턴 노출에 사용. */
  isStaffDiscount?: boolean
  meetingDate: string
  /** 환불 규칙 분기용 (discussion = 7/3, 그 외 3/2) */
  meetingType?: string | null
  userId: string
  registrationId?: string
  paidAmount?: number | null
  waitlistRegistrationId?: string
  waitlistPaidAmount?: number | null
  pendingTransferRegistrationId?: string
  paymentMode?: string
  registrationPaymentMethod?: 'card' | 'transfer'
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
}: Props) {
  // 결제 처리에 사용할 실제 금액 — 미지정 시 정가 fallback
  const effectiveFee = displayFee ?? meetingFee
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

    // both / transfer_only: 결제 방법 선택 모달 표시
    // 'both'면 카드+계좌이체 둘 다 활성, 'transfer_only'면 카드는 "준비 중"으로 비활성
    if (paymentMode === 'transfer_only' || paymentMode === 'both') {
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
        showToast(response.message || '결제 요청에 실패했습니다')
        setLoading(false)
        return
      }

      // PC 결제 성공 → redirect 핸들러로 직접 이동 (포트원이 자동 redirect 안 함)
      router.push(`/meetings/${meetingId}/payment-redirect?paymentId=${paymentId}`)
    } catch {
      showToast('결제 요청에 실패했습니다')
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
        showToast(data.message || '취소에 실패했습니다')
      }
    } catch {
      setPendingTransferCancelPhase('idle')
      showToast('네트워크 오류가 발생했습니다')
    }
  }

  // --- Cancel flow ---
  const refundInfo = paidAmount
    ? calculateRefundByType(meetingType, meetingDate, paidAmount)
    : null

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
        showToast('이미 취소된 신청입니다')
        router.refresh()
      } else {
        setCancelPhase('idle')
        showToast(data.message || '취소에 실패했습니다')
      }
    } catch {
      setCancelPhase('idle')
      showToast('네트워크 오류가 발생했습니다')
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
        showToast(data.message || '대기 취소에 실패했습니다')
      }
    } catch {
      setWaitlistCancelPhase('idle')
      showToast('네트워크 오류가 발생했습니다')
    }
  }

  // Determine if we should show a sticky button
  const showStickyButton =
    (buttonState.type === 'register') ||
    (buttonState.type === 'full') ||
    (buttonState.type === 'apply_closed') ||
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

          {buttonState.type === 'apply_closed' && (
            <button disabled className={s.btnDisabled}>
              신청 마감 · 모임 7일 전까지 신청할 수 있어요
            </button>
          )}

          {buttonState.type === 'cancel' && cancelPhase === 'idle' && (
            <button
              onClick={() => setCancelPhase('info')}
              className={s.btnGhost}
              style={s.btnGhostStyle}
            >
              취소하기
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
                취소자 발생 시 자동으로 참여가 확정됩니다.
                <br />
                모임 전날까지 승격되지 않으면 자동 전액 환불됩니다.
              </p>
            </div>
          )}

          {buttonState.type === 'waitlist_cancel' && waitlistCancelPhase === 'idle' && (
            <button
              onClick={() => setWaitlistCancelPhase('confirm')}
              className={s.btnGhost}
              style={s.btnGhostStyle}
            >
              대기 취소하기
            </button>
          )}

          {buttonState.type === 'pending_transfer' && pendingTransferCancelPhase === 'idle' && (
            <button
              onClick={() => setPendingTransferCancelPhase('confirm')}
              className={s.btnGhost}
              style={s.btnGhostStyle}
            >
              신청 취소
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
          <h3 className={s.panelTitle}>취소 완료</h3>
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
                    ? supportContact || '환불은 운영자에게 문의해주세요'
                    : '영업일 기준 3~5일 내 환불됩니다'}
                </span>
              </>
            ) : (
              registrationPaymentMethod === 'transfer'
                ? '취소가 접수되었습니다'
                : '환불 불가 기간으로 환불 금액이 없습니다'
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
              <span className={s.waitAmount}>{formatFee(waitlistPaidAmount)}</span>
            )}
          </div>
          <p className={s.waitBody}>
            자리가 나면 자동으로 참여가 확정됩니다.
            <br />
            모임 전날까지 승격되지 않으면 자동 전액 환불됩니다.
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
          <h3 className={s.panelTitle}>대기 취소 완료</h3>
          <p className={s.panelBody}>
            {waitlistPaymentMethod === 'transfer' ? (
              '대기가 취소되었습니다'
            ) : (
              <>
                결제 금액이 전액 환불됩니다.
                <br />
                <span className={s.panelSmall}>영업일 기준 3~5일 내 환불됩니다</span>
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
              <span className={s.infoValue}>{formatFee(paidAmount ?? 0)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className={s.infoLabel}>환불 비율</span>
              <span className={s.infoValue}>{refundInfo.refundRate}%</span>
            </div>
            <div
              className="mt-2 pt-2 flex justify-between text-sm"
              style={s.infoDividerStyle}
            >
              <span className={s.infoTotalLabel}>환불 예정 금액</span>
              <span className={s.infoTotalValue}>{formatFee(refundInfo.refundAmount)}</span>
            </div>
          </div>
          {refundInfo.refundRate === 0 && (
            <p className={`mt-3 ${s.warnText}`}>
              환불 불가 기간입니다. 취소 시 환불 금액이 없습니다.
            </p>
          )}
          <div className={s.ruleText}>{getRefundRuleTextByType(meetingType)}</div>
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
            취소를 확정하시겠습니까?
          </h3>
          <p className={`${s.modalBody} text-center`}>
            환불 금액:{' '}
            <span className={s.panelStrong}>{formatFee(refundInfo.refundAmount)}</span>
            {refundInfo.refundRate < 100 && (
              <span className={s.modalMuted}> ({refundInfo.refundRate}%)</span>
            )}
          </p>
          {refundInfo.refundAmount === 0 && (
            <p className={`mt-1 ${s.warnText}`}>
              환불 금액이 0입니다. 그래도 취소하시겠습니까?
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
            대기를 취소하시겠습니까?
          </h3>
          <p className={`${s.modalBody} text-center`}>결제 금액이 전액 환불됩니다.</p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setWaitlistCancelPhase('idle')}
              className={s.btnSecondary}
              style={s.btnSecondaryStyle}
            >
              닫기
            </button>
            <button onClick={handleWaitlistCancelConfirm} className={s.btnDanger}>
              대기 취소
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
                  결제 방법을 선택해주세요
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
                  {/* 카드결제 — 'both' 모드면 활성, 'transfer_only' 모드면 비활성 */}
                  {paymentMode === 'both' ? (
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
                          <p className={s.optionTitle}>카드결제</p>
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
                          <p className={s.optionTitleOff}>카드결제</p>
                          <p className={s.optionSubOff}>준비 중입니다</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 계좌이체 — active */}
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
                </div>
              </>
            )}

            {/* Transfer Details */}
            {registerPhase === 'transfer' && (
              <>
                <button onClick={() => setRegisterPhase('method')} className={s.backBtn}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  뒤로
                </button>

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
                    <p className={s.transferAmount}>{formatFee(effectiveFee)}</p>
                  )}
                </div>

                {bankName && bankAccount && bankHolder && (
                  <BankInfoCard
                    bankName={bankName}
                    bankAccount={bankAccount}
                    bankHolder={bankHolder}
                    skin={skin}
                  />
                )}

                {depositorName && (
                  <CopyableDepositorName depositorName={depositorName} skin={skin} />
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
                      if (data.status === 'pending_transfer') {
                        router.replace(`/meetings/${meetingId}/confirm?type=pending_transfer`)
                      } else if (data.status === 'waitlisted') {
                        router.replace(`/meetings/${meetingId}/confirm?type=waitlisted`)
                      } else if (data.status === 'already_registered') {
                        setRegisterPhase('transfer')
                        showToast('이미 신청한 모임입니다')
                      } else {
                        setRegisterPhase('transfer')
                        showToast(data.message || '신청 처리에 실패했습니다')
                      }
                    } catch {
                      setRegisterPhase('transfer')
                      showToast('네트워크 오류가 발생했습니다')
                    }
                  }}
                  className={`mt-5 ${s.btnPrimary}`}
                  style={s.btnPrimaryStyle}
                >
                  입금 완료
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
            신청을 취소하시겠습니까?
          </h3>
          <p className={`${s.modalBody} text-center`}>취소 후에는 다시 신청해야 합니다.</p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setPendingTransferCancelPhase('idle')}
              className={s.btnSecondary}
              style={s.btnSecondaryStyle}
            >
              돌아가기
            </button>
            <button onClick={handlePendingTransferCancelConfirm} className={s.btnDanger}>
              취소하기
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
