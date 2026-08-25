import Link from 'next/link'
import { formatKoreanDate, formatKoreanTime, formatFee, formatDDay } from '@/lib/kst'
import type { MeetingDetailData } from '@/lib/meeting-detail'
import { hasStickyAction } from '@/lib/meeting-detail'
import { shouldMaskConfirmedCount } from '@/lib/visibility'
import MeetingActionButton from '@/components/meetings/MeetingActionButton'
import BankInfoCard from '@/components/meetings/BankInfoCard'
import BookIntro from '@/components/meetings/BookIntro'
import TrackMeetingView from '@/components/analytics/TrackMeetingView'
import MeetingInfoRows, { type InfoRow } from '@/components/next/MeetingInfoRows'
import RefundNotice from '@/components/next/RefundNotice'
import BackLink from '@/components/next/BackLink'
import { Chevron } from '@/components/next/TossUI'

/**
 * 모임 상세 — 토스 스킨 (승인 시안 06 「정기모임 상세」 / 09 「토론모임 상세」).
 * 유형은 라벨이 아니라 **형태**로 갈린다 (2026-08-14 결정): 토론은 표지가 얼굴, 정기는 제목.
 *
 * 조회·판정은 `lib/meeting-detail.ts` 한 벌을 구 화면과 공유한다.
 * 결제·취소 버튼도 구 화면과 **같은 컴포넌트**를 쓰고 스킨만 바꾼다 — 돈 흐름 코드는 한 벌이다.
 */
export default function MeetingDetailView({ data }: { data: MeetingDetailData }) {
  const m = data.meeting
  const isDiscussion = m.meeting_type === 'discussion'
  const canApply = data.buttonState.type === 'register' || data.buttonState.type === 'join_waitlist'
  const dday = formatDDay(m.date, m.time, data.kstToday)

  const rows: InfoRow[] = [
    { label: '언제', value: `${formatKoreanDate(m.date)} ${formatKoreanTime(m.time)}` },
    { label: '어디서', value: [m.location, m.region].filter(Boolean).join(' · ') },
    {
      label: '참여',
      // 마스킹 판정은 `shouldMaskConfirmedCount()` 한 벌이다 — 구 상세·모임 탭과 같은 함수.
      // showAccurateCount를 그대로 쓰면 **마감(count >= capacity)인데 "N명 모집 중"**으로 보인다
      // (규칙 함수는 마감이면 마스킹을 푼다). 2026-08-25 렌더 전수에서 나온 회귀.
      value: shouldMaskConfirmedCount(data.confirmedCount, m.capacity, data.showAccurateCount)
        ? `${m.capacity}명 모집 중`
        : `${data.confirmedCount}/${m.capacity}명`,
    },
    {
      label: '참가비',
      value: formatFee(data.displayFee),
      sub: data.isStaffDiscount ? '스텝 가격이 적용되었어요' : undefined,
      subTone: 'brand',
    },
  ]

  return (
    <div
      style={{
        paddingBottom: hasStickyAction(data.buttonState) || canApply
          ? 'calc(8rem + env(safe-area-inset-bottom, 0px))'
          : '1.5rem',
      }}
    >
      <TrackMeetingView meetingId={m.id} title={m.title} fee={m.fee} />

      <div className="pt-1">
        <BackLink href="/meet" label={isDiscussion ? '토론모임' : '정기모임'} />
      </div>

      {/* 내 신청 상태 — confirmed/pending_transfer는 같게 보인다
          (운영자 입금 확인이 월말이라 회원을 불안하게 두지 않는다) */}
      {data.isBookedSelf && (
        <div className="mt-2 flex min-h-[46px] items-center gap-2.5 rounded-[14px] bg-brand-bg px-3.5 py-2.5">
          <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
            ✓
          </span>
          <span className="min-w-0 flex-1 text-[13px] font-bold text-brand-deep">
            신청 완료
            {data.hasPendingTransfer && (
              <span className="ml-1 font-semibold text-tg-700">· 입금 확인 중</span>
            )}
          </span>
          {dday && <span className="flex-none text-xs font-bold text-brand-deep">{dday}</span>}
        </div>
      )}
      {data.hasWaitlisted && (
        <div className="mt-2 flex min-h-[46px] items-center gap-2.5 rounded-[14px] bg-tg-100 px-3.5 py-2.5">
          <span className="text-[13px] font-bold text-tg-700">대기 중이에요</span>
          <span className="text-xs text-tg-600">자리가 나면 자동으로 확정돼요</span>
        </div>
      )}

      {isDiscussion && data.book ? (
        <div className="mt-4 flex gap-4">
          {data.book.thumbnail ? (
            <img
              src={data.book.thumbnail}
              alt={data.book.title}
              width={96}
              height={144}
              className="h-[144px] w-[96px] flex-none rounded-[6px] object-cover"
              style={{ boxShadow: '0 0 0 1px rgba(0,0,0,.06), 0 8px 18px rgba(25,31,40,.18)' }}
            />
          ) : (
            <div className="flex h-[144px] w-[96px] flex-none items-center justify-center rounded-[6px] bg-tg-100 p-2 text-center text-xs font-bold text-tg-700">
              {data.book.title}
            </div>
          )}
          <div className="min-w-0 self-center">
            <p className="text-xs font-extrabold text-brand">{m.title}</p>
            <p className="mt-1 text-[19px] font-extrabold leading-snug tracking-[-0.02em] text-tg-900 break-keep">
              {data.book.title}
            </p>
            {(data.book.authors || data.book.publisher) && (
              <p className="mt-1 text-xs text-tg-600">
                {[data.book.authors, data.book.publisher].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
      ) : (
        <h1 className="mt-3 text-[24px] font-extrabold leading-[1.3] tracking-[-0.03em] text-tg-900 break-keep">
          {m.title}
        </h1>
      )}

      {/* 선정 이유 — 사람이 쓴 것. 출판사 소개(책 소개)보다 앞선다 (설계서 §5-4) */}
      {isDiscussion && m.selection_reason && (
        <div className="mt-4 rounded-[18px] bg-tg-100 px-4 py-3.5">
          <p className="text-[13.5px] font-extrabold text-tg-900">왜 이 책을 골랐냐면</p>
          <p className="mt-1 text-sm leading-relaxed text-tg-700 break-keep">
            {m.selection_reason}
          </p>
        </div>
      )}
      {isDiscussion && data.book?.description && (
        <BookIntro description={data.book.description} skin="toss" />
      )}

      {!isDiscussion && m.description && (
        <div className="mt-4 rounded-[18px] bg-tg-100 px-4 py-3.5">
          <p className="text-sm leading-relaxed text-tg-700 whitespace-pre-line break-keep">
            {m.description}
          </p>
        </div>
      )}

      <MeetingInfoRows rows={rows} />

      {/* 발제문 진입 — 이번 개편이 만든 단절을 메운다.
          이야기 탭 → 상세 방향은 링크가 있었는데 반대 방향이 0이었다 (2026-08-25 조사 §3-2). */}
      {isDiscussion && (
        <Link
          href="/talk"
          className="mt-4 flex min-h-[56px] items-center gap-3 border-t border-tg-100 py-3"
        >
          <span
            className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] bg-brand-bg text-[17px]"
            aria-hidden
          >
            📝
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold tracking-tight text-tg-900">
              발제문 먼저 읽어보기
            </span>
            <span className="mt-0.5 block text-xs text-tg-600">
              답 안 써도 괜찮아요 — 와서 들으셔도 돼요
            </span>
          </span>
          <Chevron />
        </Link>
      )}

      <RefundNotice meetingType={m.meeting_type} meetingDate={m.date} />

      {/* 입금 대기 — 아직 안 보냈을 수 있으니 계좌를 다시 보여준다 */}
      {data.hasPendingTransfer && (
        <div className="mt-5">
          <BankInfoCard
            bankName={data.bankName}
            bankAccount={data.bankAccount}
            bankHolder={data.bankHolder}
            skin="toss"
          />
        </div>
      )}

      {/* 참여자 명단 — 닉네임만. 정원을 차지한 본인 또는 운영자에게만 (RPC가 단일 진입점) */}
      {(data.isBookedSelf || data.isEditorOrAdmin) && data.participantNicknames.length > 0 && (
        <section className="mt-6">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[13.5px] font-bold tracking-tight text-tg-600">함께하는 멤버</h3>
            <span className="text-xs font-semibold text-tg-600">
              {data.participantNicknames.length}명
            </span>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {data.participantNicknames.map((nickname, idx) => (
              <li
                key={`${nickname}-${idx}`}
                className="inline-flex items-center rounded-full bg-tg-100 px-3 py-1.5 text-[13px] font-bold text-tg-800"
              >
                {nickname}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.isEditorOrAdmin && (
        <Link
          href={`/admin/meetings/${m.id}`}
          className="mt-6 flex min-h-[56px] items-center gap-3 rounded-[18px] bg-tg-50 px-4 py-3"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-tg-900">관리자 페이지에서 보기</span>
            <span className="mt-0.5 block text-xs text-tg-600">
              신청자 목록 · 입금 확인 · 재정 요약
            </span>
          </span>
          <Chevron />
        </Link>
      )}

      {canApply ? (
        /* 신청 가능 상태에서는 결제로 바로 가지 않는다 — 신청 확인 화면을 한 번 거친다.
           금액·입금처·환불 규정을 결제 **전에** 보여주는 자리다 (시안 07). */
        <div
          className="fixed bottom-0 left-0 right-0 z-40"
          style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div
            className="mx-auto max-w-screen-sm px-5 py-3"
            style={{ backgroundColor: '#FFFFFF', boxShadow: '0 -2px 10px rgba(25, 31, 40, 0.06)' }}
          >
            <Link
              href={`/meet/${m.id}/apply`}
              className={`flex min-h-[52px] w-full items-center justify-center rounded-[14px] text-[15px] font-bold tracking-tight text-white ${
                data.buttonState.type === 'join_waitlist' ? 'bg-warnx' : 'bg-brand'
              }`}
            >
              {data.buttonState.type === 'join_waitlist' ? '대기 신청하러 가기' : '신청하러 가기'} ·{' '}
              {formatFee(data.displayFee)}
            </Link>
          </div>
        </div>
      ) : (
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
          registrationId={data.myRegistrationId}
          paidAmount={data.myPaidAmount}
          waitlistRegistrationId={data.waitlistRegistrationId}
          waitlistPaidAmount={data.waitlistPaidAmount}
          pendingTransferRegistrationId={data.pendingTransferRegistrationId}
          paymentMode={data.paymentMode}
          registrationPaymentMethod={data.myPaymentMethod}
          supportContact={data.supportContact}
          waitlistPaymentMethod={data.waitlistPaymentMethod}
          bankName={data.bankName}
          bankAccount={data.bankAccount}
          bankHolder={data.bankHolder}
          depositorName={data.depositorName}
          skin="toss"
          listHref="/meet"
        />
      )}
    </div>
  )
}
