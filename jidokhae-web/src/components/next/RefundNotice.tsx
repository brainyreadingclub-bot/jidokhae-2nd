import { formatMonthDay } from '@/lib/kst'
import { getRefundScheduleByType, getFullRefundDeadline } from '@/lib/refund'

/**
 * 결제 **전**에 보이는 환불 안내 (승인 시안 07 「신청 확인」·09 「토론모임 상세」).
 *
 * 왜 있나 — 지금까지 환불 규정은 "취소하기"를 눌러야 뜨는 모달 안에만 있었다.
 * 회원은 조건을 모른 채 돈을 보냈다. 이 블록이 그것을 신청 전으로 옮긴다.
 *
 * ⚠️ 비율·날짜를 손으로 적지 않는다 — `lib/refund.ts`의 규칙 상수에서 계산한다.
 * 토론 7/3, 정기 3/2가 두 곳에 적히면 다음에 한쪽만 고쳐진다 (PR #64가 고친 사고).
 */
export default function RefundNotice({
  meetingType,
  meetingDate,
  showHeading = false,
}: {
  meetingType: string | null | undefined
  meetingDate: string
  showHeading?: boolean
}) {
  const schedule = getRefundScheduleByType(meetingType, meetingDate)
  const full = schedule.find((s) => s.rate === 100)
  const half = schedule.find((s) => s.rate === 50)
  const isDiscussion = meetingType === 'discussion'

  return (
    <div className="mt-5">
      {showHeading && (
        <h3 className="text-[13.5px] font-bold tracking-tight text-tg-600">환불</h3>
      )}
      {isDiscussion ? (
        <>
          <p className="mt-1.5 text-[13px] leading-relaxed text-tg-600 break-keep">
            환불은{' '}
            <b className="font-bold text-tg-900">
              {full ? formatMonthDay(full.date) : ''}까지 전액
            </b>
            {half && `, ${formatMonthDay(half.date)}까지 50%`}, 이후는 어려워요.
          </p>
          {/* 신청 마감·환불 100% 경계·책 주문 마감이 한 날짜다 (2026-08-17 결정) */}
          <p className="mt-1 text-[13px] leading-relaxed text-tg-600 break-keep">
            책 주문 마감도 같은 날({formatMonthDay(getFullRefundDeadline(meetingType, meetingDate))})이에요.
          </p>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[13px] leading-relaxed text-tg-600 break-keep">
            모임{' '}
            <b className="font-bold text-tg-900">{full ? `${full.daysBefore}일 전까지 전액` : ''}</b>
            {half && `, ${half.daysBefore}일 전 50%`}, 이후는 환불이 어려워요.
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-tg-600">
            취소는 언제든 하실 수 있어요.
          </p>
        </>
      )}
    </div>
  )
}
