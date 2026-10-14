import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '지독해 — 경주·포항 독서모임',
    short_name: '지독해',
    description: '경주/포항 독서모임 지독해. 모임 일정 확인, 신청, 결제를 한 곳에서.',
    // id는 옛 start_url('/')로 고정한다 — id가 없으면 브라우저가 start_url을 앱 신원으로 써서,
    // 시작 주소를 바꾸는 순간 이미 설치한 앱을 다른 앱으로 볼 수 있다.
    id: '/',
    // '/'로 열면 '/'가 다시 '/home'으로 보내 한 번 더 왕복한다(2026-10-13 속도 점검).
    // 온보딩 미완성 회원·플래그 OFF는 (next) 레이아웃이 '/'로 돌려보낸다.
    start_url: '/home',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F9FAFB',
    theme_color: '#127A5A',
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
