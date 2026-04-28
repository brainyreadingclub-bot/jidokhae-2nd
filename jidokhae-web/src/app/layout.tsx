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
  weight: ['600', '700'],
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
      </body>
    </html>
  )
}
