import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const TEXT = '지'

async function loadGoogleFont() {
  const url = `https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700&text=${encodeURIComponent(TEXT)}`
  const css = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (X11; U; Linux i686) AppleWebKit/535.7+ (KHTML, like Gecko) Version/5.0 Safari/533.16',
    },
  }).then((res) => res.text())
  const match = css.match(/src:\s*url\(([^)]+)\)/)
  if (!match) {
    throw new Error('failed to parse Google Fonts CSS for Noto Serif KR')
  }
  return fetch(match[1]).then((res) => res.arrayBuffer())
}

export default async function AppleIcon() {
  const fontData = await loadGoogleFont()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at 35% 30%, #FFFCF5 0%, #FAF7F0 55%, #EFE6D2 100%)',
          position: 'relative',
          fontFamily: 'NotoSerifKR',
        }}
      >
        <div
          style={{
            fontSize: 124,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            color: '#0d2920',
            textShadow: '0 1px 0 rgba(13,41,32,0.06)',
            marginTop: -4,
            display: 'flex',
          }}
        >
          지
        </div>
        <div
          style={{
            position: 'absolute',
            top: 38,
            right: 42,
            width: 6,
            height: 6,
            background: '#c97b50',
            transform: 'rotate(45deg)',
            display: 'flex',
          }}
        />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'NotoSerifKR', data: fontData, weight: 700, style: 'normal' },
      ],
    },
  )
}
