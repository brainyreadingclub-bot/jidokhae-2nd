'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/analytics'

type Props = {
  meetingId: string
  title: string
  fee: number
}

export default function TrackMeetingView({ meetingId, title, fee }: Props) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    trackEvent('view_item', {
      item_id: meetingId,
      item_name: title,
      price: fee,
      currency: 'KRW',
    })
  }, [meetingId, title, fee])

  return null
}
