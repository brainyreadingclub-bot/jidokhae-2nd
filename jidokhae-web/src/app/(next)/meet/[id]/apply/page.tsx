import { redirect } from 'next/navigation'
import { loadMeetingDetail } from '@/lib/meeting-detail'
import ApplyConfirmView from '@/components/next/ApplyConfirmView'

/** 신청 확인 (승인 시안 07). 화면은 ApplyConfirmView, 판정은 loadMeetingDetail 한 벌. */
export default async function ApplyConfirmPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await loadMeetingDetail(id)

  // 신청할 수 없는 상태(이미 신청·마감·지난 모임)면 상세로 돌려보낸다.
  // 여기서 판정하지 않는다 — loadMeetingDetail이 D-7 게이트까지 이미 계산했다.
  const type = data.buttonState.type
  if (type !== 'register' && type !== 'join_waitlist') {
    redirect(`/meet/${id}`)
  }

  return <ApplyConfirmView data={data} />
}
