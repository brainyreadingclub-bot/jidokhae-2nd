import { getUser } from '@/lib/auth'
import { isLibraryEnabled } from '@/lib/library'
import { getPendingAsk, askSourceLabel } from '@/lib/asks'
import AskStrip from '@/components/library/AskStrip'

export default async function AskStripSection() {
  if (!(await isLibraryEnabled())) return null

  const user = await getUser()
  if (!user) return null

  const pending = await getPendingAsk(user.id)
  if (!pending) return null

  // askSourceLabel → "7월 정기모임에서" → strip 라벨은 "7월 정기모임"만 필요
  const label = (askSourceLabel(pending.meetingDate) ?? '정기모임에서').replace('에서', '')

  return <AskStrip meetingId={pending.meetingId} meetingLabel={label} />
}
