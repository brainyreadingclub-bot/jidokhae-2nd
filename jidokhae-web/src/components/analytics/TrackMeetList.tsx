'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/analytics'

/**
 * 새 모임 탭(/meet) 목록 GA `view_item_list` — 마운트 1회.
 * 옛 모임 목록(`MeetingsView`)과 같은 모양(item_list_name · items_count)으로 보낸다.
 * 짝이 되는 기록표 이벤트는 `meet.view_item_list` (GA 이름 = 점 뒤 부분, `lib/app-events.ts`)
 */
export default function TrackMeetList({ itemsCount }: { itemsCount: number }) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    trackEvent('view_item_list', {
      item_list_name: 'meetings',
      items_count: itemsCount,
    })
  }, [itemsCount])

  return null
}
