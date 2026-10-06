import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'
import type { MeetingDetailData } from '@/lib/meeting-detail'
import MeetingActionButton from '@/components/meetings/MeetingActionButton'
import MeetingInfoRows, { type InfoRow } from '@/components/next/MeetingInfoRows'
import RefundNotice from '@/components/next/RefundNotice'
import BackLink from '@/components/next/BackLink'

/**
 * 신청 확인 (승인 시안 07) — **결제 전에** 무엇을·언제·얼마·어디로 입금·환불은 어떻게를
 * 한 화면에서 본다.
 *
 * 왜 새로 만들었나 — 지금까지 환불 규정은 "취소하기"를 눌러야 뜨는 모달 안에만 있었다
 * (`MeetingActionButton` cancelPhase === 'info'). 즉 **회원은 환불 조건을 모른 채 돈을 보냈다.**
 *
 * 흐름 로직은 그대로다. 이 화면의 버튼은 구 화면과 **같은 `MeetingActionButton`**이고
 * 문구와 스킨만 다르다 — 결제·환불 코드를 두 벌로 만들지 않는다.
 */
export default function ApplyConfirmView({ data }: { data: MeetingDetailData }) {
  const m = data.meeting
  const isWaitlist = data.buttonState.type === 'join_waitlist'

  const rows: InfoRow[] = [
    { label: '모임', value: m.title },
    { label: '언제', value: `${formatKoreanDate(m.date)} ${formatKoreanTime(m.time)}` },
    { label: '어디서', value: [m.location, m.region].filter(Boolean).join(' · ') },
    {
      label: '참가비',
      value: formatFee(data.displayFee),
      sub: data.isStaffDiscount ? '스텝 가격이 적용되었어요' : undefined,
      subTone: 'brand',
    },
  ]

  const transferOnly = data.paymentMode === 'transfer_only'
  const hasBank = Boolean(data.bankName && data.bankAccount && data.bankHolder)

  return (
    <div style={{ paddingBottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="pt-1">
        <BackLink href={`/meet/${m.id}`} label="신청 확인" />
      </div>

      <MeetingInfoRows rows={rows} />

      {isWaitlist && (
        <div className="mt-4 rounded-[18px] bg-warnx-bg px-4 py-3.5">
          <p className="text-[13.5px] font-extrabold text-tg-900">지금은 자리가 다 찼어요</p>
          <p className="mt-1 text-[13px] leading-relaxed text-tg-700 break-keep">
            대기로 신청하면 취소자가 생길 때 자동으로 확정돼요. 모임 전날까지 자리가 나지 않으면
            전액 환불해 드려요.
          </p>
        </div>
      )}

      {/* 입금 안내 — 계좌이체만 열려 있을 때는 미리 보여준다.
          카드가 함께 열려 있으면 다음 화면에서 수단을 고르므로 여기서 단정하지 않는다. */}
      {transferOnly && hasBank && (
        <section className="mt-6">
          <h3 className="text-[13.5px] font-bold tracking-tight text-tg-600">입금 안내</h3>
          <div className="mt-2 rounded-[18px] bg-tg-100 px-4 py-4">
            <p className="text-[15px] font-extrabold tracking-tight text-tg-900 break-keep">
              {data.bankName} {data.bankAccount} {data.bankHolder}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-tg-700 break-keep">
              입금자명을 <b className="font-extrabold text-tg-900">{data.depositorName}</b>로
              보내주세요.
              <br />
              확인되면 신청이 확정돼요.
            </p>
          </div>
        </section>
      )}
      {!transferOnly && (
        <p className="mt-5 text-[13px] leading-relaxed text-tg-600">
          결제 수단은 다음 화면에서 고를 수 있어요.
        </p>
      )}

      <RefundNotice meetingType={m.meeting_type} meetingDate={m.date} showHeading />

      <MeetingActionButton
        buttonState={data.buttonState}
        meetingId={m.id}
        meetingTitle={m.title}
        meetingFee={m.fee}
        displayFee={data.displayFee}
        isStaffDiscount={data.isStaffDiscount}
        meetingDate={m.date}
        meetingType={m.meeting_type ?? null}
        userId={data.userId}
        paymentMode={data.paymentMode}
        supportContact={data.supportContact}
        bankName={data.bankName}
        bankAccount={data.bankAccount}
        bankHolder={data.bankHolder}
        depositorName={data.depositorName}
        skin="toss"
        listHref="/meet"
        registerLabel={`이대로 ${isWaitlist ? '대기 ' : ''}신청하기 · ${formatFee(data.displayFee)}`}
      />
    </div>
  )
}
