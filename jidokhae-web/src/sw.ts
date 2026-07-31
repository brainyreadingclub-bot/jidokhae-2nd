/// <reference lib="webworker" />
import {
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from 'serwist'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/'),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith('/auth/'),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith('/_next/data/'),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new NetworkFirst({
        cacheName: 'pages',
        networkTimeoutSeconds: 3,
      }),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith('/_next/static/'),
      handler: new CacheFirst({
        cacheName: 'next-static',
      }),
    },
    {
      matcher: ({ url }) =>
        url.hostname === 'cdn.jsdelivr.net' ||
        url.hostname === 'fonts.googleapis.com' ||
        url.hostname === 'fonts.gstatic.com',
      handler: new CacheFirst({
        cacheName: 'fonts',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 16,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          }),
        ],
      }),
    },
    {
      matcher: ({ url }) =>
        url.pathname === '/icon' ||
        url.pathname === '/icon-maskable' ||
        url.pathname === '/apple-icon' ||
        url.pathname === '/opengraph-image' ||
        url.pathname === '/twitter-image' ||
        url.pathname === '/favicon.ico',
      handler: new CacheFirst({
        cacheName: 'app-icons',
      }),
    },
    {
      matcher: ({ url }) =>
        url.pathname === '/manifest.webmanifest' ||
        url.pathname === '/manifest.json',
      handler: new StaleWhileRevalidate({
        cacheName: 'app-manifest',
      }),
    },
    {
      // 책 표지가 이 매처의 사실상 유일한 대상이다(앱 아이콘·OG는 위에서 처리).
      // StaleWhileRevalidate였을 때는 캐시로 즉시 그려주면서도 매 방문 전량을
      // 백그라운드 재다운로드해 데이터 절감이 0이었다. 표지를 원본 해상도(약 41KB,
      // 기존 썸네일의 3.8배)로 올린 뒤로는 그 낭비가 그대로 3.8배가 된다.
      // 카카오 표지 URL은 `?timestamp=` 버전 키가 붙은 불변 리소스라 CacheFirst가 맞다.
      //
      // cacheableResponse가 필요한 이유: 표지는 교차 출처(t1.daumcdn.net)라 opaque
      // 응답(status 0)으로 온다. CacheFirst의 기본 허용 status는 200뿐이라 이걸
      // 안 붙이면 캐시가 아예 안 된다(SWR은 기본이 [0,200]이었다).
      // 주의: 브라우저는 opaque 응답을 실제 크기가 아니라 수 MB로 패딩해 쿼터에
      // 계상하므로 maxEntries를 무르게 키우지 말 것.
      matcher: ({ request }) => request.destination === 'image',
      handler: new CacheFirst({
        cacheName: 'images',
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          }),
        ],
      }),
    },
  ],
})

serwist.addEventListeners()
