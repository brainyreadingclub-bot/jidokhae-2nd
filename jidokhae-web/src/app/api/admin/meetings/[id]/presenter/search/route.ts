import { NextResponse, type NextRequest } from 'next/server'
import { requireAdminRoute } from '@/lib/admin-route'
import { searchMembersForPresenter } from '@/lib/presenter'

/**
 * 발제자 고르기 창의 「신청 안 한 회원」 찾기 — 닉네임 또는 실명 (admin만, 실명이 보이는 화면).
 * 이 모임 신청자 여부는 화면이 이미 들고 있는 신청자 목록으로 가른다.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdminRoute(request)
  if ('error' in ctx) return ctx.error
  const result = await searchMembersForPresenter(ctx.admin, request.nextUrl.searchParams.get('q') ?? '')
  if (!result.ok) {
    return NextResponse.json({ status: 'error', message: '잠시 후 다시 시도해 주세요' }, { status: 500 })
  }
  return NextResponse.json({ status: 'success', data: result.rows })
}
