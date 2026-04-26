import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = '지독해 — 경주·포항 독서모임'

const TEXT = '지독해경주·포항 독서모임넷플릭스 말고,독서습관이 생깁니다.책으로 연결되는 사람들brainy-club.com'

async function loadGoogleFont(weight: 400 | 700) {
  const url = `https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@${weight}&text=${encodeURIComponent(TEXT)}`
  const css = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (X11; U; Linux i686) AppleWebKit/535.7+ (KHTML, like Gecko) Version/5.0 Safari/533.16',
    },
  }).then((res) => res.text())
  const match = css.match(/src:\s*url\(([^)]+)\)/)
  if (!match) {
    throw new Error(`failed to parse Google Fonts CSS for weight ${weight}`)
  }
  return fetch(match[1]).then((res) => res.arrayBuffer())
}

export default async function OpenGraphImage() {
  const [serif700, serif400] = await Promise.all([
    loadGoogleFont(700),
    loadGoogleFont(400),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0d2920',
          color: 'white',
          fontFamily: 'NotoSerifKR',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 320,
            height: 320,
            borderRadius: 9999,
            background:
              'radial-gradient(circle, rgba(201,123,80,0.18) 0%, rgba(13,41,32,0) 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 200,
            left: -60,
            width: 240,
            height: 240,
            borderRadius: 9999,
            background:
              'radial-gradient(circle, rgba(136,181,160,0.14) 0%, rgba(13,41,32,0) 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            right: 80,
            width: 180,
            height: 180,
            borderRadius: 9999,
            background:
              'radial-gradient(circle, rgba(201,123,80,0.14) 0%, rgba(13,41,32,0) 70%)',
            display: 'flex',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            padding: '88px 96px 0',
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 96,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              지독해
            </div>
            <div
              style={{
                width: 64,
                height: 1,
                background: '#4b5563',
                margin: '28px 0 24px',
              }}
            />
            <div
              style={{
                fontSize: 24,
                color: '#9ca3af',
                fontWeight: 400,
                letterSpacing: '0.04em',
              }}
            >
              경주·포항 독서모임
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 76,
                color: '#9ca3af',
                fontWeight: 400,
                lineHeight: 1.18,
              }}
            >
              넷플릭스 말고,
            </div>
            <div
              style={{
                fontSize: 76,
                color: 'white',
                fontWeight: 700,
                lineHeight: 1.18,
              }}
            >
              독서습관이 생깁니다.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              margin: '60px -96px 0',
              padding: '26px 96px',
              fontSize: 22,
              color: '#9ca3af',
              fontWeight: 400,
              letterSpacing: '0.02em',
            }}
          >
            <div>책으로 연결되는 사람들</div>
            <div>brainy-club.com</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'NotoSerifKR', data: serif700, weight: 700, style: 'normal' },
        { name: 'NotoSerifKR', data: serif400, weight: 400, style: 'normal' },
      ],
    },
  )
}
