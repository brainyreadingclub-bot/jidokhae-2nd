import TopicsScreen from '@/components/admin/TopicsScreen'

/** 스텝 구역 — 한 토론모임의 발제문 (본체는 운영 화면과 한 벌) */
export default async function StaffTopicsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TopicsScreen id={id} backHref="/staff/topics" backLabel="토론모임 목록으로" onlyDiscussion />
}
