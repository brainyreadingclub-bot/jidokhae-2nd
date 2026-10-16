import AdminTopicsScreen from '@/components/admin/TopicsScreen'

/** 발제문 관리 (admin·editor — (admin) 레이아웃이 역할 검사). 본체는 TopicsScreen — 스텝 화면과 한 벌 */
export default async function AdminTopicsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <AdminTopicsScreen id={id} backHref={`/admin/meetings/${id}`} backLabel="모임 상세로 돌아가기" />
}
