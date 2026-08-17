'use client'

import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'

type EventParams = Record<string, string | number | boolean | undefined>

type Props = React.ComponentProps<typeof Link> & {
  eventName: string
  eventParams?: EventParams
}

/**
 * 클릭 시 GA4 이벤트를 남기는 Link 래퍼.
 * 서버 컴포넌트(HomeView 등)에서 특정 링크만 계측할 때 사용 —
 * 화면 전체를 client로 바꾸지 않고 링크 하나만 감싼다.
 */
export default function TrackedLink({ eventName, eventParams, onClick, ...props }: Props) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        trackEvent(eventName, eventParams)
        onClick?.(e)
      }}
    />
  )
}
