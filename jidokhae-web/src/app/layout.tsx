import { Suspense } from 'react'
import type { Metadata, Viewport } from 'next'
import { Noto_Serif_KR } from 'next/font/google'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import RouteChangeTracker from '@/components/analytics/RouteChangeTracker'
import { SerwistProvider } from './serwist'
import './globals.css'

const RAW_GA_ID = process.env.NEXT_PUBLIC_GA_ID
const GA_ID = /^G-[A-Z0-9]+$/.test(RAW_GA_ID ?? '') ? RAW_GA_ID : null

// 메타(페이스북/인스타) 픽셀. GA와 같은 방식으로 포맷 검증 후 조건부 렌더 —
// env가 없거나 형식이 틀리면 아무것도 심지 않는다(운영 사고 방지).
const RAW_META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const META_PIXEL_ID = /^\d{6,20}$/.test(RAW_META_PIXEL_ID ?? '') ? RAW_META_PIXEL_ID : null

const notoSerifKR = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['500', '600', '700', '900'],
  display: 'swap',
  variable: '--font-noto-serif',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://brainy-club.com'),
  title: '지독해 - 독서모임',
  description: '경주/포항 독서모임 지독해. 모임 일정 확인, 신청, 결제를 한 곳에서.',
  openGraph: {
    title: '지독해 — 로컬 기반 독서모임',
    description: '매주 책으로 모이는 사람들.',
    siteName: '지독해',
    type: 'website',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: '지독해 — 로컬 기반 독서모임',
    description: '매주 책으로 모이는 사람들.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className={notoSerifKR.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen antialiased">
        <SerwistProvider
          swUrl="/sw.js"
          disable={process.env.NODE_ENV === 'development'}
          cacheOnNavigation={false}
          reloadOnOnline={false}
        >
          <div className="mx-auto max-w-screen-sm min-h-screen bg-surface-50">
            <main>
              {children}
            </main>
          </div>
        </SerwistProvider>
        <Suspense fallback={null}>
          <RouteChangeTracker />
        </Suspense>
        <Analytics />
        <SpeedInsights />
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script
              id="ga-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA_ID}', { send_page_view: false });
                `,
              }}
            />
          </>
        )}
        {/*
          메타 픽셀 베이스.

          PageView 분담 (GA와 구조가 다르니 주의) —
            · 첫 진입  → 여기 스니펫이 직접 쏜다
            · 이후 SPA 이동 → RouteChangeTracker가 쏜다 (skipMeta로 첫 회 건너뜀)

          왜 GA처럼 트래커에 전부 위임하지 않나 — 이 스니펫이 window.fbq 스텁을
          만들기 전에 RouteChangeTracker의 effect가 먼저 돌면 window.fbq?.()가
          조용히 no-op이 되어 **첫 페이지뷰가 통째로 유실된다.** 로컬 검증에서
          실제로 /tr 요청 0건이었다. beforeInteractive로 올려도 SSR HTML의 head에
          들어가지 않아(index가 <body>보다 뒤) 순서가 보장되지 않았다.
          그래서 순서에 의존하지 않도록 초기 1회만 스니펫이 책임진다.

          ⚠️ 여기서 PageView를 빼거나, RouteChangeTracker의 skipMeta를 지우면
             둘 중 하나가 깨진다 (첫 진입 유실 또는 첫 진입 2중 집계).
        */}
        {META_PIXEL_ID && (
          <Script
            id="meta-pixel-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window,document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${META_PIXEL_ID}');
                fbq('track', 'PageView');
              `,
            }}
          />
        )}
      </body>
    </html>
  )
}
