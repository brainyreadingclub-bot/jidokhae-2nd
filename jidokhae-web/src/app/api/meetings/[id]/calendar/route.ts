import { NextResponse, type NextRequest } from 'next/server'
import { getRouteUser } from '@/lib/api-auth'
import { loadMyCalendarEvent } from '@/lib/calendar-event-server'
import { buildIcs } from '@/lib/calendar-event'

/**
 * 신청 완료 화면 「내 달력에 추가」의 .ics 파일.
 * 서버에서 내려주는 이유 — iOS 사파리는 `text/calendar` 응답을 받으면 「캘린더에 추가」 창을 띄운다.
 * 브라우저에서 만든 Blob 다운로드는 앱 안 브라우저(카카오톡 등)에서 잘 안 열린다.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getRouteUser(request)
  if (!user) {
    return NextResponse.json({ status: 'error', message: '로그인이 필요해요' }, { status: 401 })
  }

  const mine = await loadMyCalendarEvent(id, user.id)
  if (!mine) {
    return NextResponse.json({ status: 'error', message: '신청한 모임이 아니에요' }, { status: 404 })
  }

  return new NextResponse(buildIcs(mine.event, new Date()), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // inline — iOS 사파리가 내려받기 대신 「캘린더에 추가」 미리보기를 띄우게 한다.
      // 열어 보일 수 없는 브라우저(데스크톱 크롬 등)는 알아서 파일로 받는다
      'Content-Disposition': `inline; filename="jidokhae-${id.slice(0, 8)}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
