import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { searchKakaoBooks } from '@/lib/kakao-books'

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ status: 'error', message: '로그인이 필요합니다' }, { status: 401 })
  }

  const query = request.nextUrl.searchParams.get('q')?.trim()
  if (!query) {
    return NextResponse.json({ status: 'success', data: [] })
  }

  try {
    const results = await searchKakaoBooks(query)
    return NextResponse.json({ status: 'success', data: results })
  } catch {
    return NextResponse.json({ status: 'error', message: '책 검색에 실패했습니다' }, { status: 500 })
  }
}
