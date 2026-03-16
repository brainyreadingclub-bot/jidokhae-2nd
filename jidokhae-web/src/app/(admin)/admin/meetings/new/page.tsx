import MeetingForm from '@/components/admin/MeetingForm'

export default function NewMeetingPage() {
  return (
    <div className="px-5 pt-4 pb-6">
      <h1 className="text-lg font-extrabold text-primary-900 tracking-tight mb-5">새 모임 등록</h1>
      <MeetingForm mode="create" />
    </div>
  )
}
