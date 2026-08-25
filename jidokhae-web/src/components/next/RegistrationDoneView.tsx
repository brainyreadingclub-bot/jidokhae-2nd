import Link from 'next/link'
import { formatKoreanDate, formatKoreanTime, formatFee } from '@/lib/kst'

export type RegistrationDoneData = {
  meetingId: string
  title: string
  date: string
  time: string
  location: string
  region: string | null
  /** 실제 결제(또는 입금 예정) 금액 */
  amount: number | null
  kind: 'confirmed' | 'waitlisted' | 'pending_transfer'
  bankName: string
  bankAccount: string
  bankHolder: string
  /** "M/D 닉네임" — 상세·신청 확인과 같은 규칙 */
  depositorName: string
}

/**
 * 신청 완료 (승인 시안 08) — 토스 스킨.
 * 흐름은 그대로다: 카드결제는 payment-redirect가, 계좌이체는 transfer 응답이 구경로로 보내고
 * 구경로(`(main)/meetings/[id]/confirm`)가 `next_ui` ON일 때 여기로 넘긴다.
 * 알림톡 딥링크 하위 호환도 그 리다이렉트가 함께 처리한다 (설계서 §10 QA).
 */
export default function RegistrationDoneView({ data }: { data: RegistrationDoneData }) {
  const isWaitlisted = data.kind === 'waitlisted'
  const isPendingTransfer = data.kind === 'pending_transfer'

  return (
    <div className="pb-6">
      <div className="pt-1">
        <h1 className="py-2 text-[17px] font-extrabold tracking-tight text-tg-900">
          {isWaitlisted ? '대기 신청 완료' : '신청 완료'}
        </h1>
      </div>

      <div className="mt-8 text-center">
        <div className="mx-auto flex h-[70px] w-[70px] items-center justify-center rounded-full bg-brand-bg">
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-brand"
            aria-hidden
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="mt-5 text-[24px] font-extrabold tracking-[-0.03em] text-tg-900">
          {isWaitlisted ? '대기 신청됐어요' : '신청됐어요'}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-tg-600 break-keep">
          {formatKoreanDate(data.date)} {formatKoreanTime(data.time)}
          <br />
          {[data.location, data.region].filter(Boolean).join(' · ')}
        </p>
      </div>

      {isPendingTransfer && (
        <div className="mt-7 rounded-[18px] bg-tg-100 px-4 py-4">
          <p className="text-[15px] font-extrabold tracking-tight text-tg-900">
            입금을 기다리고 있어요
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-tg-700 break-keep">
            {data.bankName} {data.bankAccount} {data.bankHolder}
            <br />
            입금자명 <b className="font-extrabold text-tg-900">{data.depositorName}</b>
            {data.amount !== null && ` · ${formatFee(data.amount)}`}
            <br />
            확인되면 신청이 확정돼요.
          </p>
        </div>
      )}

      {isWaitlisted && (
        <div className="mt-7 rounded-[18px] bg-tg-100 px-4 py-4">
          <p className="text-[15px] font-extrabold tracking-tight text-tg-900">
            자리가 나면 자동으로 확정돼요
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-tg-700 break-keep">
            모임 전날까지 자리가 나지 않으면 전액 환불해 드려요.
          </p>
        </div>
      )}

      {data.kind === 'confirmed' && data.amount !== null && (
        <div className="mt-7 rounded-[18px] bg-tg-100 px-4 py-4 text-center">
          <p className="text-[13px] font-semibold text-tg-600">결제 금액</p>
          <p className="mt-1 text-[22px] font-extrabold tracking-tight text-tg-900">
            {formatFee(data.amount)}
          </p>
        </div>
      )}

      <div className="mt-8 space-y-2.5">
        <Link
          href={`/meet/${data.meetingId}`}
          className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-brand-bg text-[15px] font-bold tracking-tight text-brand-deep"
        >
          모임 다시 보기
        </Link>
        <Link
          href="/home"
          className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-tg-100 text-[15px] font-bold tracking-tight text-tg-700"
        >
          홈으로
        </Link>
      </div>
    </div>
  )
}
