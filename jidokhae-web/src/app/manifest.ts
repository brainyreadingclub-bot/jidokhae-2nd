import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '지독해 — 경주·포항 독서모임',
    short_name: '지독해',
    description: '경주/포항 독서모임 지독해. 모임 일정 확인, 신청, 결제를 한 곳에서.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0d2920',
    theme_color: '#0d2920',
    lang: 'ko',
    icons: [
      {
        src: '/icon',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
