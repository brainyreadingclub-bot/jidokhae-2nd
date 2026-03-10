import MeetingForm from '@/components/admin/MeetingForm'

export default function NewMeetingPage() {
  return (
    <div className="px-4 pt-4 pb-6">
      <h1 className="text-lg font-bold text-gray-900 mb-5">새 모임 등록</h1>
      <MeetingForm mode="create" />
    </div>
  )
}
