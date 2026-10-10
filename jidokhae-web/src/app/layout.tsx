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
        {/* 무료 단계 한도(팀 전체 30일 10,000건)를 넘으면 기록이 최소 14일 멈춘다.
            30%만 보내 한도 절반(5,000) 아래에 머문다 — 근거는 docs/agent-team/조사/2026-10-11-도쿄이전-반영계획.md */}
        <SpeedInsights sampleRate={0.3} />
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
      </body>
    </html>
  )
}
