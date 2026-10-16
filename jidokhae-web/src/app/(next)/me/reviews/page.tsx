import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getMyReviews, isReviewEnabled } from '@/lib/review'
import BackLink from '@/components/next/BackLink'
import MyReviewsList from '@/components/next/review/MyReviewsList'

/**
 * 나 › 내가 남긴 후기 (시안 15·16). 한 줄 소감의 공개를 내리고 다시 켜는 자리 —
 * 철회만 되고 다시 못 켜면 「한 번 내리면 끝」이 무서워 처음부터 안 켠다(시안 README).
 * 운영자가 내린 소감은 「운영자가 내림」 한 줄만 — 다시 공개 버튼이 없다.
 */
export default async function MyReviewsPage() {
  if (!(await isReviewEnabled())) redirect('/me')
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const { items, error } = await getMyReviews(user.id)
  if (error) throw new Error('내가 남긴 후기 조회 실패')

  return (
    <div className="pt-1">
      <BackLink href="/me" label="내가 남긴 후기" />
      <p className="mt-2 text-[13.5px] leading-relaxed text-tg-600 break-keep">
        공개한 소감은 닉네임과 함께 그 지역 정기모임 소개에 보여요. 표정과 아쉬운 점은 운영자만 봐요.
      </p>
      <MyReviewsList items={items} />
    </div>
  )
}
