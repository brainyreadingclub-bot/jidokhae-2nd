'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ModalOverlay from '@/components/ui/ModalOverlay'
import { formatFee } from '@/lib/kst'
import type { MoneyKind, SeatPlan } from '@/lib/presenter-rules'

/**
 * 운영자 모임 상세의 「발제자」 칸 + 고르기·확인·빼기 창 (시안 2026-10-13-발제자지정 A~D).
 * 토론모임에만 그린다. 지정·빼기 버튼은 **총괄운영자(admin)만** 본다 — editor는 칸만 본다(대표님 확정 ⑤).
 * 돈 갈래·자리 셈은 서버 미리보기(`GET /api/admin/meetings/[id]/presenter`)가 정하고 여기는 그리기만 한다.
 * 금액은 숫자만.
 */

export type PresenterApplicant = {
  userId: string
  nickname: string
  realName: string | null
  status: 'confirmed' | 'pending_transfer' | 'waitlisted'
  paymentMethod: string
}

type Props = {
  meetingId: string
  capacity: number
  seatedCount: number
  isAdmin: boolean
  /** 지난 모임·진행 중 아님 — 칸만 보이고 버튼은 없다 */
  locked: boolean
  presenter: { registrationId: string; nickname: string; realName: string | null } | null
  /** 이 모임의 살아 있는 신청 (발제자 행 제외) */
  applicants: PresenterApplicant[]
  waitlistedCount: number
  /** 대기 1번 — 빼면 그 사람이 자리를 받는다. goesConfirmed = 바로 확정(승격 알림톡) */
  firstWaitlisted: { nickname: string; goesConfirmed: boolean } | null
}

type Preview = {
  userId: string
  nickname: string
  realName: string | null
  eligible: boolean | null
  candidate: {
    registrationId: string
    status: 'confirmed' | 'pending_transfer' | 'waitlisted'
    paymentMethod: string
    paidAmount: number
  } | null
  money: { kind: MoneyKind; refundAmount: number } | null
  seat: SeatPlan
}

type SearchRow = { userId: string; nickname: string; realName: string | null; eligible: boolean | null }

type Phase =
  | { k: 'idle' }
  | { k: 'pick' }
  | { k: 'loading' }
  | { k: 'ask_deposit'; preview: Preview }
  | { k: 'confirm'; preview: Preview; pendingDeposited: boolean | null }
  | { k: 'processing' }
  | { k: 'remove' }

export default function PresenterPanel({
  meetingId,
  capacity,
  seatedCount,
  isAdmin,
  locked,
  presenter,
  applicants,
  waitlistedCount,
  firstWaitlisted,
}: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>({ k: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const isFull = seatedCount >= capacity
  const canAct = isAdmin && !locked

  const close = useCallback(() => {
    setPhase({ k: 'idle' })
    setError(null)
  }, [])

  async function openPreview(userId: string, pendingDeposited: boolean | null = null) {
    setError(null)
    setPhase({ k: 'loading' })
    try {
      const qs = new URLSearchParams({ userId })
      if (pendingDeposited !== null) qs.set('pendingDeposited', pendingDeposited ? 'yes' : 'no')
      const res = await fetch(`/api/admin/meetings/${meetingId}/presenter?${qs}`)
      const data = await res.json()
      if (data.status !== 'success') {
        setError(data.message || '잠시 후 다시 시도해 주세요')
        setPhase({ k: 'pick' })
        return
      }
      const preview = data.data as Preview
      if (!preview.money) setPhase({ k: 'ask_deposit', preview })
      else setPhase({ k: 'confirm', preview, pendingDeposited })
    } catch {
      setError('네트워크 오류가 발생했어요')
      setPhase({ k: 'pick' })
    }
  }

  async function assign(preview: Preview, pendingDeposited: boolean | null) {
    if (!preview.money) return
    setError(null)
    setPhase({ k: 'processing' })
    try {
      const res = await fetch(`/api/admin/meetings/${meetingId}/presenter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          userId: preview.userId,
          expectedRegistrationId: preview.candidate?.registrationId ?? null,
          expectedKind: preview.money.kind,
          expectedRefundAmount: preview.money.refundAmount,
          pendingDeposited,
        }),
      })
      const data = await res.json()
      if (data.status === 'success') {
        close()
        router.refresh()
        return
      }
      // 상황이 바뀌었거나(409) 환불 뒤 전환이 안 됐으면 — 미리보기를 다시 받아 지금 상태로 다시 묻는다.
      // 「환불은 끝났고 전환이 안 됐어요」는 다시 받으면 PortOne 없이 전환만 하는 창으로 바뀐다.
      if (data.code === 'state_changed' || data.code === 'refunded_but_not_switched') {
        await openPreview(preview.userId, pendingDeposited)
        setError(data.message)
        return
      }
      setError(data.message || '잠시 후 다시 시도해 주세요')
      setPhase({ k: 'confirm', preview, pendingDeposited })
      if (data.code === 'capacity_full_refunded') router.refresh()
    } catch {
      setError('네트워크 오류가 발생했어요. 새로고침해서 상태를 확인해 주세요')
      setPhase({ k: 'confirm', preview, pendingDeposited })
    }
  }

  async function unassign() {
    if (!presenter) return
    setError(null)
    setPhase({ k: 'processing' })
    try {
      const res = await fetch(`/api/admin/meetings/${meetingId}/presenter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unassign', registrationId: presenter.registrationId }),
      })
      const data = await res.json()
      if (data.status === 'success') {
        close()
        router.refresh()
        return
      }
      setError(data.message || '잠시 후 다시 시도해 주세요')
      setPhase({ k: 'remove' })
    } catch {
      setError('네트워크 오류가 발생했어요')
      setPhase({ k: 'remove' })
    }
  }

  return (
    <>
      <div className={`${card} break-keep lg:col-span-2 lg:flex-row lg:items-center lg:justify-between lg:gap-6`}>
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-neutral-700">발제자</div>
          {presenter ? (
            <>
              <div className="mt-1 text-lg font-extrabold tracking-tight text-neutral-900">
                {presenter.nickname}
                {presenter.realName && (
                  <small className="ml-1.5 text-[13px] font-medium text-neutral-500">{presenter.realName}</small>
                )}
              </div>
              <p className="mt-1 text-[13px] text-neutral-600">
                참가비 없이 신청 완료 · 회원 화면에는 발제자로 안 보여요
              </p>
            </>
          ) : (
            <>
              <div className="mt-1 text-lg font-extrabold tracking-tight text-neutral-400">지정 안 함</div>
              {canAct && isFull ? (
                <>
                  <p className="mt-1 text-[13px] font-bold text-neutral-900">
                    정원이 찼어요. 정원을 늘리거나 자리가 나면 지정하세요
                  </p>
                  {applicants.some(isSeated) && (
                    <button
                      onClick={() => setPhase({ k: 'pick' })}
                      className="mt-1.5 text-[13px] font-bold text-primary-600 hover:text-primary-700"
                    >
                      이미 신청한 분 중에서 고르기
                    </button>
                  )}
                </>
              ) : (
                <p className="mt-1 text-[13px] text-neutral-600">
                  정하면 참가비 없이 신청 완료로 정원 한 자리를 차지해요. 안 정해도 돼요
                </p>
              )}
            </>
          )}
        </div>
        {canAct && (
          <div className="mt-4 flex-none lg:mt-0">
            {presenter ? (
              <button onClick={() => setPhase({ k: 'remove' })} className={lineBtn}>
                빼기
              </button>
            ) : isFull ? (
              <button disabled className={disabledBtn}>
                발제자 지정
              </button>
            ) : (
              <button onClick={() => setPhase({ k: 'pick' })} className={lineBtn}>
                발제자 지정
              </button>
            )}
          </div>
        )}
      </div>

      {phase.k === 'pick' && (
        <PickSheet
          meetingId={meetingId}
          applicants={isFull ? applicants.filter(isSeated) : applicants}
          fullMode={isFull}
          error={error}
          onPick={(userId) => openPreview(userId)}
          onClose={close}
        />
      )}

      {(phase.k === 'loading' || phase.k === 'processing') && (
        <ModalOverlay>
          <div className="flex flex-col items-center py-4">
            <Spinner />
            <p className="mt-3 text-sm font-medium text-primary-700">
              {phase.k === 'loading' ? '확인하는 중...' : '처리하는 중...'}
            </p>
          </div>
        </ModalOverlay>
      )}

      {phase.k === 'ask_deposit' && (
        <ModalOverlay onClose={close}>
          <h3 className={title}>{phase.preview.nickname}님을 발제자로 바꿀까요?</h3>
          <p className={body}>
            {phase.preview.nickname}님은 아직 「입금 대기」예요.{' '}
            <b className="text-neutral-900">통장에 입금이 들어왔나요?</b>
          </p>
          <div className={moneyBox}>
            <MoneyRow label="입금 대기 · 계좌이체" value={formatFee(phase.preview.candidate?.paidAmount ?? 0)} />
          </div>
          <p className={note}>
            들어왔으면 정산 「환불 대기」에 올리고, 안 들어왔으면 돌려줄 돈 없이 바로 바꿔요
          </p>
          {error && <p className={errText}>{error}</p>}
          <div className="mt-5 flex gap-2">
            <button onClick={() => openPreview(phase.preview.userId, false)} className={`flex-1 ${lineBtn}`}>
              아니요, 안 들어왔어요
            </button>
            <button onClick={() => openPreview(phase.preview.userId, true)} className={`flex-1 ${primaryBtn}`}>
              네, 들어왔어요
            </button>
          </div>
          <button onClick={close} className="mt-3 w-full text-center text-sm font-bold text-neutral-500">
            취소
          </button>
        </ModalOverlay>
      )}

      {phase.k === 'confirm' && (
        <ConfirmSheet
          preview={phase.preview}
          error={error}
          onCancel={close}
          onConfirm={() => assign(phase.preview, phase.pendingDeposited)}
        />
      )}

      {phase.k === 'remove' && presenter && (
        <ModalOverlay onClose={close}>
          <h3 className={title}>{presenter.nickname}님을 발제자에서 뺄까요?</h3>
          {waitlistedCount > 0 && firstWaitlisted ? (
            <>
              <p className={body}>
                {presenter.nickname}님의 신청도 함께 취소돼 자리가 다시 열려요.{' '}
                {firstWaitlisted.goesConfirmed ? (
                  <b className="text-neutral-900">대기 1번 {firstWaitlisted.nickname}님이 바로 확정돼요.</b>
                ) : (
                  <b className="text-neutral-900">
                    대기 1번 {firstWaitlisted.nickname}님이 자리를 받아 입금 확인 중으로 올라가요.
                  </b>
                )}
              </p>
              <div className={moneyBox}>
                <MoneyRow label="대기" value={`${waitlistedCount} → ${waitlistedCount - 1}명`} />
              </div>
              <p className={note}>
                참가비 없이 들어온 자리라 돌려줄 돈은 없어요
                {firstWaitlisted.goesConfirmed && ` · ${firstWaitlisted.nickname}님에게는 확정 알림톡이 가요`} ·{' '}
                {presenter.nickname}님이 다시 오려면 직접 신청해야 해요
              </p>
            </>
          ) : (
            <>
              <p className={body}>
                {presenter.nickname}님의 신청도 함께 취소돼 자리가 다시 열려요. 다른 회원이 신청할 수 있어요.
              </p>
              <div className={moneyBox}>
                <MoneyRow
                  label="남은 자리"
                  value={`${Math.max(0, capacity - seatedCount)} → ${Math.max(0, capacity - seatedCount) + 1}`}
                />
              </div>
              <p className={note}>
                참가비 없이 들어온 자리라 돌려줄 돈은 없어요 · {presenter.nickname}님이 다시 오려면 직접
                신청해야 해요
              </p>
            </>
          )}
          {error && <p className={errText}>{error}</p>}
          <div className="mt-5 flex gap-2">
            <button onClick={close} className={`flex-1 ${lineBtn}`}>
              취소
            </button>
            <button onClick={unassign} className={`flex-1 ${dangerBtn}`}>
              빼기
            </button>
          </div>
        </ModalOverlay>
      )}
    </>
  )
}

function isSeated(a: PresenterApplicant): boolean {
  return a.status === 'confirmed' || a.status === 'pending_transfer'
}

function matches(q: string, nickname: string, realName: string | null): boolean {
  const n = q.trim()
  if (!n) return true
  return nickname.includes(n) || (realName ?? '').includes(n)
}

function PickSheet({
  meetingId,
  applicants,
  fullMode,
  error,
  onPick,
  onClose,
}: {
  meetingId: string
  applicants: PresenterApplicant[]
  fullMode: boolean
  error: string | null
  onPick: (userId: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [others, setOthers] = useState<SearchRow[] | null>(null)
  const [searchError, setSearchError] = useState(false)
  const shownApplicants = applicants.filter((a) => matches(q, a.nickname, a.realName))
  const applicantIds = useMemo(() => new Set(applicants.map((a) => a.userId)), [applicants])

  // 신청 안 한 회원은 검색할 때만 찾는다 — 정원이 찼으면 새 자리가 없으니 찾지 않는다
  useEffect(() => {
    const term = q.trim()
    if (fullMode || !term) return
    let alive = true
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/meetings/${meetingId}/presenter/search?q=${encodeURIComponent(term)}`,
        )
        const data = await res.json()
        if (!alive) return
        if (data.status === 'success') {
          setOthers((data.data as SearchRow[]).filter((r) => !applicantIds.has(r.userId)))
          setSearchError(false)
        } else {
          setSearchError(true)
        }
      } catch {
        if (alive) setSearchError(true)
      }
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, fullMode, meetingId, applicantIds])

  const searching = !fullMode && q.trim() !== ''
  const otherRows = searching ? (others ?? []) : []
  const anyIneligible = otherRows.some((r) => r.eligible === false)
  const noResult = searching && others !== null && shownApplicants.length === 0 && otherRows.length === 0

  return (
    <ModalOverlay onClose={onClose} widthClass="max-w-md">
      <h3 className={title}>{fullMode ? '신청자 중에서 발제자 지정' : '발제자 지정'}</h3>
      {fullMode && <p className={note}>정원이 차서 이미 신청한 분만 고를 수 있어요. 자리는 그대로예요</p>}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="닉네임 또는 실명 검색"
        autoComplete="off"
        className="mt-4 w-full rounded-[12px] border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none"
      />
      <div className="mt-3 max-h-[50vh] overflow-y-auto">
        {noResult ? (
          <p className="py-6 text-center text-sm text-neutral-500">「{q.trim()}」와 맞는 회원이 없어요</p>
        ) : (
          <>
            {shownApplicants.length > 0 && (
              <>
                <GroupHead label="이 모임 신청자" count={shownApplicants.length} />
                {shownApplicants.map((a) => (
                  <PickRow key={a.userId} nickname={a.nickname} realName={a.realName} onClick={() => onPick(a.userId)}>
                    <StatusChip status={a.status} method={a.paymentMethod} />
                  </PickRow>
                ))}
              </>
            )}
            {otherRows.length > 0 && (
              <>
                <GroupHead label="신청 안 한 회원" count={otherRows.length} />
                {otherRows.map((r) => (
                  <PickRow key={r.userId} nickname={r.nickname} realName={r.realName} onClick={() => onPick(r.userId)}>
                    {r.eligible === false && (
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-bold text-neutral-600">
                        자격 없음
                      </span>
                    )}
                  </PickRow>
                ))}
              </>
            )}
            {anyIneligible && (
              <p className={note}>자격 없음 — 정기모임에 와 본 적 없는 회원이에요. 지정은 할 수 있어요</p>
            )}
            {!fullMode && !searching && (
              <p className={note}>신청 안 한 회원은 닉네임이나 실명으로 찾아요</p>
            )}
            {searchError && <p className={errText}>회원을 찾지 못했어요. 잠시 후 다시 시도해 주세요</p>}
          </>
        )}
      </div>
      {error && <p className={errText}>{error}</p>}
      <button onClick={onClose} className="mt-4 w-full text-center text-sm font-bold text-neutral-500">
        닫기
      </button>
    </ModalOverlay>
  )
}

/** 확인 창 — 갈래마다 「무엇을 하고 돈이 어떻게 되는지」를 말한다 (시안 B5 · C1~C3 + 대표님 확정 ④⑦) */
function ConfirmSheet({
  preview,
  error,
  onCancel,
  onConfirm,
}: {
  preview: Preview
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const n = preview.nickname
  const kind = preview.money?.kind ?? 'none'
  const amt = formatFee(preview.money?.refundAmount ?? 0)
  const paid = formatFee(preview.candidate?.paidAmount ?? 0)
  const seatLine = preview.seat.takesNewSeat ? (
    <MoneyRow label="남은 자리" value={`${preview.seat.remainingBefore} → ${preview.seat.remainingAfter}`} />
  ) : null
  const notes: string[] = []
  if (preview.eligible === false) notes.push('정기모임에 와 본 적 없는 회원이에요(자격 없음)')
  if (!preview.seat.takesNewSeat) notes.push('자리는 그대로예요')
  if (kind === 'pending_deposited' || kind === 'pending_no_money') notes.push('정산 「입금 확인 대기」에서 빠져요')
  notes.push(kind === 'none' ? '지정했다는 알림톡은 가지 않아요' : '알림톡은 가지 않아요')

  let heading = `${n}님을 발제자로 바꿀까요?`
  let text: React.ReactNode = null
  let rows: React.ReactNode = null
  let label = '발제자로 바꾸기'

  switch (kind) {
    case 'none':
      heading = `${n}님을 발제자로 지정할까요?`
      text = (
        <>
          참가비 없이 <b className="text-neutral-900">신청 완료</b>로 정원 한 자리를 차지해요. 다른 신청자처럼 전날
          알림과 발제 공개 알림을 받고, 답변도 쓸 수 있어요.
        </>
      )
      rows = seatLine
      label = '지정하기'
      break
    case 'zero_paid':
      text = <>{n}님의 신청을 참가비 없는 발제자로 바꿔요. 낸 참가비가 없어 돌려줄 돈은 없어요.</>
      rows = <MoneyRow label="돌려줄 금액" value="0" />
      break
    case 'card_full_refund':
      text = (
        <>
          {n}님의 <b className="text-neutral-900">{amt}</b>을{' '}
          <b className="text-neutral-900">카드 결제 취소로 바로 환불</b>하고, 참가비 없는 발제자로 바꿔요.
        </>
      )
      rows = (
        <>
          <MoneyRow label="낸 참가비 · 카드" value={paid} />
          <MoneyRow label="돌려줄 금액" how="자동 환불" value={amt} divider />
        </>
      )
      label = '환불하고 바꾸기'
      break
    case 'waitlist_card_refund':
      heading = `${n}님을 발제자로 넣을까요?`
      text = (
        <>
          {n}님의 대기 신청 <b className="text-neutral-900">{amt}</b>을{' '}
          <b className="text-neutral-900">카드 결제 취소로 바로 환불</b>하고, 참가비 없는 발제자로 넣어요.
        </>
      )
      rows = (
        <>
          <MoneyRow label="낸 참가비 · 카드 (대기)" value={paid} />
          <MoneyRow label="돌려줄 금액" how="자동 환불" value={amt} divider />
          {seatLine}
        </>
      )
      label = '환불하고 지정하기'
      break
    case 'card_already_refunded':
      text = (
        <>
          {n}님의 카드 결제 <b className="text-neutral-900">{amt}</b>은 이미 환불됐어요. 발제자 전환만 마무리해요.
        </>
      )
      rows = (
        <>
          <MoneyRow label="돌려준 금액" how="카드 환불 끝남" value={amt} />
          {seatLine}
        </>
      )
      break
    case 'transfer_manual_refund':
    case 'pending_deposited':
      text = (
        <>
          {n}님의 <b className="text-neutral-900">{amt}</b>을 환불하고 발제자로 바꿔요. 계좌이체라{' '}
          <b className="text-neutral-900">자동 환불이 안 돼요</b> — 정산 「환불 대기」에 올라가요.
        </>
      )
      rows = (
        <>
          <MoneyRow
            label={kind === 'pending_deposited' ? '낸 참가비 · 계좌이체 (입금 확인 전)' : '낸 참가비 · 계좌이체'}
            value={paid}
          />
          <MoneyRow label="돌려줄 금액" how="직접 이체 · 보낸 뒤 「환불 완료」 체크" value={amt} divider />
        </>
      )
      label = '바꾸고 환불 대기에 올리기'
      break
    case 'pending_no_money':
      text = (
        <>
          {n}님은 아직 입금 전이라 <b className="text-neutral-900">돌려줄 돈이 없어요</b>. 바로 참가비 없는 발제자로
          바꿔요.
        </>
      )
      rows = (
        <>
          <MoneyRow label="받은 돈" how={`입금 대기 ${paid} — 이제 안 받아요`} value="0" />
          <MoneyRow label="돌려줄 금액" value="0" divider />
        </>
      )
      break
    case 'waitlist_no_money':
      heading = `${n}님을 발제자로 넣을까요?`
      text = <>{n}님의 대기 신청을 닫고 참가비 없는 발제자로 넣어요. 돌려줄 돈은 없어요.</>
      rows = seatLine
      label = '지정하기'
      break
  }

  return (
    <ModalOverlay onClose={onCancel} widthClass="max-w-md">
      <h3 className={title}>{heading}</h3>
      <p className={body}>{text}</p>
      {rows && <div className={moneyBox}>{rows}</div>}
      <p className={note}>{notes.join(' · ')}</p>
      {error && <p className={errText}>{error}</p>}
      <div className="mt-5 flex gap-2">
        <button onClick={onCancel} className={`flex-1 ${lineBtn}`}>
          취소
        </button>
        <button onClick={onConfirm} className={`flex-1 ${primaryBtn}`}>
          {label}
        </button>
      </div>
    </ModalOverlay>
  )
}

function MoneyRow({ label, how, value, divider }: { label: string; how?: string; value: string; divider?: boolean }) {
  return (
    <div
      className={`flex items-start justify-between gap-3 py-2 ${divider ? 'border-t border-surface-300' : ''}`}
    >
      <span className="break-keep text-[13px] text-neutral-700">
        {label}
        {how && <span className="block text-[12px] text-neutral-500">{how}</span>}
      </span>
      <b className="flex-none text-[14px] text-neutral-900">{value}</b>
    </div>
  )
}

function GroupHead({ label, count }: { label: string; count: number }) {
  return (
    <div className="mt-3 mb-1 text-[12px] font-bold text-neutral-500">
      {label} <span className="ml-0.5">{count}</span>
    </div>
  )
}

function PickRow({
  nickname,
  realName,
  onClick,
  children,
}: {
  nickname: string
  realName: string | null
  onClick: () => void
  children?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-[10px] px-2 py-2.5 text-left hover:bg-surface-100"
    >
      <span className="min-w-0">
        <b className="block truncate text-[15px] font-bold text-neutral-900">{nickname}</b>
        {realName && <small className="block text-[12px] text-neutral-500">{realName}</small>}
      </span>
      <span className="flex flex-none items-center gap-1.5">{children}</span>
    </button>
  )
}

function StatusChip({ status, method }: { status: PresenterApplicant['status']; method: string }) {
  const m = method === 'transfer' ? '이체' : method === 'card' ? '카드' : null
  const chip =
    status === 'confirmed' ? (
      <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700" style={{ border: '1px solid var(--color-primary-100)' }}>
        결제완료
      </span>
    ) : (
      <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-bold text-accent-700" style={{ border: '1px solid var(--color-accent-200)' }}>
        {status === 'pending_transfer' ? '입금 대기' : '대기 중'}
      </span>
    )
  return (
    <>
      {chip}
      {m && <span className="text-[10px] text-primary-400">{m}</span>}
    </>
  )
}

function Spinner() {
  return (
    <svg className="h-6 w-6 animate-spin text-primary-400" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

const card =
  'flex flex-col rounded-[var(--radius-lg)] border border-surface-300 bg-white px-[18px] py-[18px] lg:px-[22px] lg:py-5'
const title = 'break-keep text-[17px] font-extrabold tracking-tight text-neutral-900'
const body = 'mt-2.5 break-keep text-sm leading-relaxed text-neutral-700'
const note = 'mt-3 break-keep text-xs leading-relaxed text-neutral-600'
const errText = 'mt-3 break-keep text-xs font-medium text-error'
const moneyBox = 'mt-3.5 rounded-[12px] bg-surface-200 px-3.5 py-1.5'
const lineBtn =
  'inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] border border-surface-300 bg-white px-5 text-sm font-bold text-primary-700 transition-colors hover:bg-surface-100'
const primaryBtn =
  'inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] bg-primary-600 px-5 text-sm font-bold text-white transition-colors hover:bg-primary-700'
const dangerBtn =
  'inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] bg-error px-5 text-sm font-bold text-white transition-colors hover:bg-error/90'
const disabledBtn =
  'inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] bg-neutral-200 px-5 text-sm font-bold text-neutral-500 lg:w-auto'
