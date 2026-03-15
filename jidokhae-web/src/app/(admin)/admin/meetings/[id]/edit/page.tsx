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

  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single()

  if (meetingError && meetingError.code !== 'PGRST116') {
    throw new Error(`모임 조회 실패: ${meetingError.message}`)
  }

  const typed = meeting as Meeting | null
  if (!typed || typed.status === 'deleted') {
    notFound()
  }

  const { data: counts, error: countsError } = await supabase.rpc('get_confirmed_counts', {
    meeting_ids: [typed.id],
  })

  if (countsError) {
    throw new Error(`참가자 수 조회 실패: ${countsError.message}`)
  }
  const confirmedCount = Number(
    (counts as { meeting_id: string; confirmed_count: number }[] | null)
      ?.find((c) => c.meeting_id === typed.id)?.confirmed_count ?? 0,
  )

  return (
    <div className="px-5 pt-4 pb-6">
      <h1 className="text-lg font-extrabold text-primary-900 tracking-tight mb-5">모임 수정</h1>
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
