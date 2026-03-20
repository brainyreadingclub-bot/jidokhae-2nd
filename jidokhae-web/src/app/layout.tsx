import type { Metadata, Viewport } from 'next'
import { Noto_Serif_KR } from 'next/font/google'
import './globals.css'

const notoSerifKR = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-noto-serif',
})

export const metadata: Metadata = {
  title: '지독해 - 독서모임',
  description: '경주/포항 독서모임 지독해. 모임 일정 확인, 신청, 결제를 한 곳에서.',
  openGraph: {
    title: '지독해 — 로컬 기반 독서모임',
    description: '매주 책으로 모이는 사람들. 넷플릭스 말고, 할 게 생깁니다.',
    siteName: '지독해',
    type: 'website',
    images: [
      {
        url: 'https://brainy-club.com/og-image.png',
        width: 1200,
        height: 630,
        alt: '지독해 — 로컬 기반 독서모임',
      },
    ],
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: '지독해 — 로컬 기반 독서모임',
    description: '매주 책으로 모이는 사람들. 넷플릭스 말고, 할 게 생깁니다.',
    images: ['https://brainy-club.com/og-image.png'],
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
        <div className="mx-auto max-w-screen-sm min-h-screen bg-surface-50">
          <main>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
