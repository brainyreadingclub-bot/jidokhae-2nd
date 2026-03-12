import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MeetingForm from '@/components/admin/MeetingForm'
import type { Meeting } from '@/types/meeting'

type Props = {
  params: Promise<{ id: string }>
}

export default async function EditMeetingPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: meeting } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single()

  const typed = meeting as Meeting | null
  if (!typed || typed.status === 'deleted') {
    notFound()
  }

  const { data: counts } = await supabase.rpc('get_confirmed_counts', {
    meeting_ids: [typed.id],
  })
  const confirmedCount = Number(
    (counts as { meeting_id: string; confirmed_count: number }[] | null)
      ?.find((c) => c.meeting_id === typed.id)?.confirmed_count ?? 0,
  )

  return (
    <div className="px-4 pt-4 pb-6">
      <h1 className="text-lg font-bold text-gray-900 mb-5">모임 수정</h1>
      <MeetingForm
        mode="edit"
        meetingId={typed.id}
        confirmedCount={confirmedCount}
        initialValues={{
          title: typed.title,
          date: typed.date,
          time: typed.time,
          location: typed.location,
          capacity: String(typed.capacity),
          fee: String(typed.fee),
        }}
      />
    </div>
  )
}
