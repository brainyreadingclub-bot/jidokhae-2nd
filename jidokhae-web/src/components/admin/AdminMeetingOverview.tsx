import Link from 'next/link'
import { formatKoreanDate, formatKoreanTime, formatFee, shiftDate } from '@/lib/kst'
import { DISCUSSION_APPLY_CLOSE_DAYS } from '@/lib/discussion-rules'
import { NO_TOPICS, type TopicCounts } from '@/lib/topic-status'
import AdminMeetingSection from '@/components/meetings/AdminMeetingSection'
import DeleteMeetingButton from '@/components/meetings/DeleteMeetingButton'
import type { Meeting } from '@/types/meeting'
import type { RegistrationWithProfile } from '@/types/registration'

/**
 * 운영자 모임 상세 화면 본문 (2026-10-09 시안 C). 조회는 페이지가 하고 여기는 그리기만 한다.
 * 위에서부터 — 제목·정보 한 줄 / 발제문·신청 큰 칸 / 신청자 / 맨 아래 삭제.
 * 수정·회원 화면 보기는 오른쪽 위 작은 버튼. 금액은 숫자만.
 */
export default function AdminMeetingOverview({
  meeting,
  confirmedCount,
  registrations,
  topicCounts,
  isAdmin,
}: {
  meeting: Meeting
  confirmedCount: number
  registrations: RegistrationWithProfile[]
  /** 토론모임만. 정기모임은 null — 발제문 칸을 그리지 않는다 */
  topicCounts: TopicCounts | null
  isAdmin: boolean
}) {
  const isDiscussion = meeting.meeting_type === 'discussion'
  const waitlistedCount = registrations.filter((r) => r.status === 'waitlisted').length
  const remaining = Math.max(0, meeting.capacity - confirmedCount)
  const fillPct = meeting.capacity > 0 ? Math.min(100, (confirmedCount / meeting.capacity) * 100) : 0

  // 삭제 시 돌려줄 돈이 있는 사람 — api/meetings/[id]/delete가 쓰는 값과 맞춘다:
  //   confirmed(카드 = 자동 환불 / 계좌이체 = refunded_amount null → 운영자 손 환불)
  //   waitlisted 카드(자동 환불). 계좌이체 대기·pending_transfer는 refunded_amount 0 = 받은 돈 없음
  const refundable = registrations.filter(
    (r) =>
      r.status === 'confirmed' ||
      (r.status === 'waitlisted' && r.payment_method !== 'transfer'),
  )
  const refundAmount = refundable.reduce((sum, r) => sum + (r.paid_amount ?? 0), 0)
  const refundTransferCount = refundable.filter((r) => r.payment_method === 'transfer').length

  const tc = topicCounts ?? NO_TOPICS
  const id = meeting.id
  const infoLine = `${formatKoreanDate(meeting.date)} ${formatKoreanTime(meeting.time)} · ${meeting.location} · 참가비 ${formatFee(meeting.fee)}`

  return (
    <div>
      {/* 맨 위 줄 — 돌아가기 + 작은 버튼 */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/admin/meetings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-500 hover:text-primary-700"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          모임 관리
        </Link>
        <div className="flex flex-none gap-1.5">
          <Link href={`/meetings/${id}`} className={smallLineBtn}>
            회원 화면 보기
          </Link>
          <Link href={`/admin/meetings/${id}/edit`} className={smallLineBtn}>
            수정
          </Link>
        </div>
      </div>

      {/* 모임 메타 정보 */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-bold text-primary-700">
          {meeting.region}
        </span>
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-bold text-neutral-700">
          {isDiscussion ? '토론' : '정기'}
        </span>
        {meeting.is_featured && (
          <span className="rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-bold text-accent-700">
            PICK
          </span>
        )}
        {meeting.status === 'deleting' && (
          <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-[11px] font-bold text-warning" style={{ border: '1px solid var(--color-accent-200)' }}>
            환불 미처리
          </span>
        )}
      </div>
      <h1
        className="text-2xl font-extrabold tracking-tight text-primary-900 lg:text-3xl"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {meeting.title}
      </h1>
      {/* 정보 줄 — 한 줄 고정. 넘치면 장소만 줄어들며 말줄임(전체는 title) */}
      <div
        className="mt-2 flex items-baseline overflow-hidden whitespace-nowrap text-[13px] text-primary-600 lg:text-sm"
        title={infoLine}
      >
        <span className="flex-none">
          {formatKoreanDate(meeting.date)} {formatKoreanTime(meeting.time)}
        </span>
        <span className="mx-2 flex-none text-primary-400">·</span>
        <span className="min-w-0 truncate">{meeting.location}</span>
        <span className="mx-2 flex-none text-primary-400">·</span>
        <span className="flex-none">참가비 {formatFee(meeting.fee)}</span>
      </div>

      {/* 발제문 · 신청 — 위로 크게 */}
      <div className="mt-6 grid grid-cols-1 gap-3 lg:mt-8 lg:grid-cols-2 lg:gap-4">
        {isDiscussion && (
          <div className={statCard}>
            <div className="text-[13px] font-bold text-neutral-700">발제문</div>
            <div className={statBig}>
              {tc.published > 0
                ? `공개됨 ${tc.published}개`
                : tc.draft > 0
                  ? `작성 중 ${tc.draft}개`
                  : '없음'}
            </div>
            <p className="mt-1.5 text-[13px] text-neutral-600">
              {tc.draft > 0 ? (
                <>
                  {tc.published > 0 && (
                    <b className="font-bold text-neutral-900">작성 중 {tc.draft}개 · </b>
                  )}
                  공개 전이라 회원에게 안 보여요
                </>
              ) : tc.published > 0 ? (
                '신청자에게 보이고 있어요'
              ) : (
                `공개하면 신청자 ${confirmedCount}명에게 알림이 한 번 가요`
              )}
            </p>
            <Link
              href={`/admin/meetings/${id}/topics`}
              className={`mt-4 self-start ${
                tc.draft === 0 && tc.published > 0 ? lineBtn : primaryBtn
              }`}
            >
              {tc.draft === 0 && tc.published === 0
                ? '발제문 등록하기'
                : tc.draft > 0
                  ? '이어서 하기'
                  : '발제문 관리'}
            </Link>
          </div>
        )}
        <div className={statCard}>
          <div className="text-[13px] font-bold text-neutral-700">신청</div>
          <div className={statBig}>
            {confirmedCount}
            <small className="text-xl font-bold text-neutral-500">/{meeting.capacity}</small>
          </div>
          <p className="mt-1.5 text-[13px] text-neutral-600">
            <b className="font-bold text-primary-600">
              {remaining > 0 ? `남은 ${remaining}자리` : '정원 마감'}
            </b>{' '}
            · 대기 {waitlistedCount}명
          </p>
          <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
            <i className="block h-full rounded-full bg-primary-500" style={{ width: `${fillPct}%` }} />
          </div>
          {isDiscussion && (
            <p className="mt-auto pt-4 text-xs text-neutral-500">
              신청 마감 {formatKoreanDate(shiftDate(meeting.date, -DISCUSSION_APPLY_CLOSE_DAYS))}
            </p>
          )}
        </div>
      </div>

      <AdminMeetingSection
        confirmedCount={confirmedCount}
        registrations={registrations}
        meetingDate={meeting.date}
        meetingType={meeting.meeting_type ?? null}
      />

      {/* 삭제 — 맨 아래, 빨간색. 되돌릴 수 없는 동작이라 확인 창에서 「삭제」를 직접 입력한다 */}
      {isAdmin && (
        <div className="mt-14 flex flex-col gap-4 border-t border-surface-300 pt-6 lg:mt-[72px] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <b className="block text-sm font-bold text-error">모임 삭제</b>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">
              {refundable.length > 0
                ? `신청자 ${refundable.length}명에게 참가비가 전액 환불되고, 되돌릴 수 없어요.`
                : '삭제한 모임은 되돌릴 수 없어요.'}
            </p>
          </div>
          <DeleteMeetingButton
            meetingId={meeting.id}
            meetingStatus={meeting.status}
            refundCount={refundable.length}
            refundAmount={refundAmount}
            refundTransferCount={refundTransferCount}
          />
        </div>
      )}
    </div>
  )
}

const smallLineBtn =
  'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[9px] border border-surface-300 bg-white px-3 text-xs font-bold text-primary-700 transition-colors hover:bg-surface-100'
const statCard =
  'flex flex-col rounded-[var(--radius-lg)] border border-surface-300 bg-white px-[18px] py-[18px] lg:px-[22px] lg:py-5'
const statBig =
  'mt-1.5 text-[30px] font-extrabold leading-tight tracking-tight text-neutral-900 lg:text-[34px]'
const primaryBtn =
  'inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] bg-primary-600 px-5 text-sm font-bold text-white transition-colors hover:bg-primary-700'
const lineBtn =
  'inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] border border-surface-300 bg-white px-5 text-sm font-bold text-primary-700 transition-colors hover:bg-surface-100'
