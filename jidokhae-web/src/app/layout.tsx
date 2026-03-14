import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '지독해 - 독서모임',
  description: '경주/포항 독서모임 지독해. 모임 일정 확인, 신청, 결제를 한 곳에서.',
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
    <html lang="ko">
      <body className="min-h-screen antialiased" style={{ backgroundColor: 'var(--color-surface-100)' }}>
        <div className="mx-auto max-w-screen-sm min-h-screen" style={{ backgroundColor: 'var(--color-surface-50)' }}>
          <main>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
