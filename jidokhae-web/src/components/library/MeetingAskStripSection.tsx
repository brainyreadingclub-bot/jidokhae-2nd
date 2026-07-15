import { getUser } from '@/lib/auth'
import { getMeeting } from '@/lib/meeting'
import { isLibraryEnabled } from '@/lib/library'
import { isAskPendingForMeeting } from '@/lib/asks'
import { askSourceLabel } from '@/lib/asks-pure'
import AskStrip from '@/components/library/AskStrip'

/** 모임 상세 진입점 — 최근 60일 내 다녀온 정기모임에서 아직 안 담은 회원에게 노출. AskStrip 재사용. */
export default async function MeetingAskStripSection({ meetingId }: { meetingId: string }) {
  if (!(await isLibraryEnabled())) return null

  const user = await getUser()
  if (!user) return null

  const pending = await isAskPendingForMeeting(user.id, meetingId)
  if (!pending) return null

  const meeting = await getMeeting(meetingId)
  if (!meeting) return null

  const label = (askSourceLabel(meeting.date) ?? '정기모임에서').replace('에서', '')

  return <AskStrip meetingId={meetingId} meetingLabel={label} entryPoint="meeting_detail" />
}
