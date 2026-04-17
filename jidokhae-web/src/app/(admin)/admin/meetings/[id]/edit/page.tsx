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

  const [meetingResult, countsResult, venuesResult] = await Promise.all([
    supabase.from('meetings').select('*').eq('id', id).single(),
    supabase.rpc('get_confirmed_counts', { meeting_ids: [id] }),
    supabase.from('venues').select('id, name').eq('status', 'active').order('name'),
  ])

  if (meetingResult.error && meetingResult.error.code !== 'PGRST116') {
    throw new Error(`모임 조회 실패: ${meetingResult.error.message}`)
  }

  const typed = meetingResult.data as Meeting | null
  if (!typed || typed.status === 'deleted') {
    notFound()
  }

  if (countsResult.error) {
    throw new Error(`참가자 수 조회 실패: ${countsResult.error.message}`)
  }
  const confirmedCount = Number(
    (countsResult.data as { meeting_id: string; confirmed_count: number }[] | null)
      ?.find((c) => c.meeting_id === typed.id)?.confirmed_count ?? 0,
  )

  return (
    <div className="px-5 pt-4 pb-6">
      <h1 className="text-lg font-extrabold text-primary-900 tracking-tight mb-5">모임 수정</h1>
      <MeetingForm
        mode="edit"
        meetingId={typed.id}
        confirmedCount={confirmedCount}
        venues={venuesResult.data ?? []}
        initialValues={{
          title: typed.title,
          description: typed.description ?? '',
          date: typed.date,
          time: typed.time,
          venue_id: typed.venue_id ?? '',
          location: typed.location,
          capacity: String(typed.capacity),
          fee: String(typed.fee),
          region: typed.region,
          is_featured: typed.is_featured,
        }}
      />
    </div>
  )
}
