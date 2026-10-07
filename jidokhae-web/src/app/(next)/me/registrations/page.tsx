import { Suspense } from 'react'
import BackLink from '@/components/next/BackLink'
import MyRegistrationContent from '@/components/my/MyRegistrationContent'
import RegistrationsSkeleton from '@/components/skeletons/RegistrationsSkeleton'

/**
 * 나 탭 → 신청 내역. 「나」가 구 `/my#registrations`로 내보내던 자리다.
 *
 * 내용은 그대로 두고 주소만 5탭 안으로 옮긴다 — 넘어가면 구 헤더(이름·운영자·
 * 로그아웃)와 구 푸터가 새 5탭 위에 겹쳐 떠서 **딴 앱처럼 보였다**(2026-10-07 실측).
 * `MyRegistrationContent`를 그대로 재사용하므로 신청·취소 코드는 한 벌이다.
 *
 * 🔴 구 `/my`는 지우지 않는다. `next_ui`를 OFF로 되돌리면 그쪽이 다시 유일한 경로다.
 */
export default function NextRegistrationsPage() {
  return (
    <div className="pt-1">
      <BackLink href="/me" label="신청 내역" />
      <Suspense fallback={<RegistrationsSkeleton />}>
        {/* 5탭에서는 "모임 둘러보기"가 모임 탭으로 가야 한다. 기본값 `/`는
            next_ui가 켜지면 홈으로 리다이렉트돼 라벨과 도착지가 어긋난다 */}
        <MyRegistrationContent browseHref="/meet" />
      </Suspense>
    </div>
  )
}
