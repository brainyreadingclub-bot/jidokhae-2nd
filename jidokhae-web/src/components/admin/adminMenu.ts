/**
 * 관리자 사이드바 메뉴 정의 (WP7-3)
 *
 * - adminOnly: admin role에게만 보임 (editor 제외)
 * - '준비 중' placeholder는 M8/M10에서 실제 기능 구현
 */

export type AdminMenuItem = {
  label: string
  href: string
  adminOnly?: boolean
}

export type AdminMenuGroup = {
  label: string
  items: AdminMenuItem[]
}

export const ADMIN_MENU_GROUPS: AdminMenuGroup[] = [
  {
    label: '운영',
    items: [
      { label: '대시보드', href: '/admin' },
      { label: '모임 관리', href: '/admin/meetings' },
      { label: '정산', href: '/admin/settlements', adminOnly: true },
      { label: '회원 관리', href: '/admin/members' },
    ],
  },
  {
    label: '콘텐츠',
    items: [
      // 배너/한줄 모두 editor도 관리 (2026-04-23 확정, 검토문서 §3.1)
      { label: '배너 관리', href: '/admin/banners' },
      { label: '한 줄 관리', href: '/admin/quotes' },
    ],
  },
  {
    label: '시스템',
    items: [
      { label: '설정', href: '/admin/settings', adminOnly: true },
    ],
  },
]
