import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // 0. 전체 프로필 확인
  const { data: profiles } = await sb.from('profiles').select('id, nickname, role')
  console.log('=== 전체 프로필 ===')
  profiles?.forEach(p => console.log(`  ${p.id} | ${p.nickname} | ${p.role}`))
  console.log(`  총 ${profiles?.length}명\n`)
  const memberId = 'c25f13be-ac6d-4382-b3bc-b8a9bbf17a95'
  const m2Id = '1cf57a31-835f-4476-9cc5-29baf180e7f6'

  // 1. member의 모든 registrations
  const { data: allRegs } = await sb
    .from('registrations')
    .select('meeting_id, status, payment_id')
    .eq('user_id', memberId)
  console.log('=== member의 전체 registrations ===')
  allRegs?.forEach(r => console.log(`  ${r.payment_id} | meeting=${r.meeting_id} | ${r.status}`))

  // 2. member의 M2 confirmed만
  const { data: m2Regs } = await sb
    .from('registrations')
    .select('meeting_id')
    .eq('user_id', memberId)
    .eq('status', 'confirmed')
    .eq('meeting_id', m2Id)
  console.log('\n=== M2 confirmed 조회 ===')
  console.log('결과:', m2Regs)

  // 3. 홈페이지와 동일한 쿼리 시뮬레이션
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const { data: meetings } = await sb
    .from('meetings')
    .select('id, title')
    .eq('status', 'active')
    .gte('date', today)
  const meetingIds = (meetings ?? []).map(m => m.id)
  console.log('\n=== 활성 모임 IDs ===')
  meetings?.forEach(m => console.log(`  ${m.id} | ${m.title}`))

  // 4. member의 confirmed + in meetingIds
  const { data: myRegs, error } = await sb
    .from('registrations')
    .select('meeting_id')
    .eq('user_id', memberId)
    .eq('status', 'confirmed')
    .in('meeting_id', meetingIds)
  console.log('\n=== 홈페이지 registrations 쿼리 결과 ===')
  console.log('data:', myRegs)
  console.log('error:', error)
}
main()
