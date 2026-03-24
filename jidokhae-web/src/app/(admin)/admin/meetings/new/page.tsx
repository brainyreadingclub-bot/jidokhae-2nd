import { createClient } from '@/lib/supabase/server'
import MeetingForm from '@/components/admin/MeetingForm'

export default async function NewMeetingPage() {
  const supabase = await createClient()
  const { data: venues } = await supabase
    .from('venues')
    .select('id, name')
    .eq('status', 'active')
    .order('name')

  return (
    <div className="px-5 pt-4 pb-6">
      <h1 className="text-lg font-extrabold text-primary-900 tracking-tight mb-5">새 모임 등록</h1>
      <MeetingForm mode="create" venues={venues ?? []} />
    </div>
  )
}
