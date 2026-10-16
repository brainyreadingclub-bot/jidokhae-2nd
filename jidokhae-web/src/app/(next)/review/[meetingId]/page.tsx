import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { getKSTToday } from '@/lib/kst'
import { createServiceClient } from '@/lib/supabase/admin'
import { isLibraryEnabled } from '@/lib/library'
import { getPendingAsk, isAskPendingForMeeting } from '@/lib/asks'
import {
  getMyReviewRow,
  getNextRegularMeeting,
  getReviewableMeeting,
  isReviewEnabled,
} from '@/lib/review'
import { buildReviewSteps, getReviewWindow, reviewDeadline } from '@/lib/review-rules'
import ReviewFlow, { type ReviewInitial } from '@/components/next/review/ReviewFlow'

/**
 * 모임 후기 (2026-10-12 결정 · 시안 `docs/시안-공유/2026-10-12-모임후기/`).
 * 들어오는 길 — 알림톡 버튼 `/my` → 서버 분기(`resolveMyRedirect`) → 여기. 주소를 직접 쳐도 같은 판정을 한다.
 *
 * 스위치(`review_enabled`)가 꺼져 있으면 없는 화면이다 — 나 탭으로 보낸다.
 * 대상(참여 · 정기 · active)이 아니거나 모임 전이면 나 탭으로.
 */
export default async function ReviewPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params
  if (!(await isReviewEnabled())) redirect('/me')

  const user = await getUser()
  if (!user) redirect('/auth/login')

  const admin = createServiceClient()
  const meeting = await getReviewableMeeting(admin, user.id, meetingId)
  if (!meeting) redirect('/me')

  const reviewWindow = getReviewWindow(meeting.date, getKSTToday())
  if (reviewWindow === 'before') redirect('/me')
  const canEdit = reviewWindow === 'open'

  const [{ review, error }, profile, libraryOn] = await Promise.all([
    getMyReviewRow(admin, user.id, meetingId),
    getProfile(user.id),
    isLibraryEnabled(),
  ])
  // 남겼는지 모르면 흐름을 열지 않는다 — 이미 남긴 사람에게 처음부터 다시 묻게 된다
  if (error) throw new Error('후기 조회 실패')

  const initial: ReviewInitial = review
    ? review.did_not_attend
      ? 'absent'
      : 'already'
    : canEdit
      ? 'flow'
      : 'expired'

  // ④ 책 담기 — 서재가 켜져 있고, 그 모임 물어보기가 아직 열려 있을 때만(이미 담았거나 닫았으면 또 묻지 않는다)
  const [bookStep, nextMeeting, pendingAsk] = await Promise.all([
    initial === 'flow' || initial === 'absent'
      ? libraryOn && canEdit
        ? isAskPendingForMeeting(user.id, meetingId)
        : false
      : false,
    initial === 'flow' || initial === 'absent'
      ? getNextRegularMeeting(admin, user.id, meeting.region)
      : null,
    initial === 'expired' && libraryOn ? getPendingAsk(user.id) : null,
  ])

  return (
    <ReviewFlow
      meeting={{ id: meeting.id, date: meeting.date, region: meeting.region }}
      nickname={profile?.nickname || '회원'}
      initial={initial}
      canEdit={canEdit}
      deadline={reviewDeadline(meeting.date)}
      review={review}
      steps={buildReviewSteps({ bookStep })}
      nextMeeting={
        nextMeeting
          ? {
              id: nextMeeting.id,
              date: nextMeeting.date,
              time: nextMeeting.time,
              region: nextMeeting.region,
              location: nextMeeting.location,
              fee: nextMeeting.fee,
            }
          : null
      }
      hasPendingAsk={Boolean(pendingAsk)}
    />
  )
}
