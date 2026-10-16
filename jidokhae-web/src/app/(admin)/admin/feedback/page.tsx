import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getProfile } from '@/lib/profile'
import { createServiceClient } from '@/lib/supabase/admin'
import { listMemberFeedback } from '@/lib/member-feedback'
import MemberFeedbackList from '@/components/admin/MemberFeedbackList'

/**
 * 회원 의견 (보관함 I-001) — 「나」 탭·오류 화면의 「불편한 점 알려 주기」로 들어온 글.
 * admin 전용: 「개인정보는 적지 말아 주세요」를 안내해도 글에 연락처가 들어올 수 있다
 * (역할 매트릭스 2026-04-23 — 회원 개인정보는 admin만).
 * 표(`member_feedback`)가 아직 없으면 안내만 띄운다 — 화면을 깨지 않는다
 */
export default async function AdminFeedbackPage() {
  const user = await getUser()
  if (!user) redirect('/auth/login')
  const profile = await getProfile(user.id)
  if (profile.role !== 'admin') redirect('/admin')

  const result = await listMemberFeedback(createServiceClient())

  return (
    <div>
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-500">운영</div>
        <h1
          className="mt-1 text-2xl font-extrabold tracking-tight text-primary-900 lg:text-3xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          회원 의견
        </h1>
        <p className="mt-1 text-sm text-neutral-500 break-keep">
          「나」 탭과 오류 화면의 「불편한 점 알려 주기」로 들어온 글. 최근 순.
        </p>
      </div>

      <MemberFeedbackList result={result} />
    </div>
  )
}
