# 지독해 서비스 UI/UX 리뷰 자료

## 서비스 개요
- **서비스명**: 지독해 (JIDOKHAE) - 독서모임 관리 웹앱
- **대상**: 모바일 사용자 (max-width: 640px)
- **사용자 역할**: 회원 (모임 탐색/신청/취소) + 운영자 (모임 생성/수정/관리)
- **기술 스택**: Next.js 16, Supabase (Auth + DB), TossPayments, Tailwind CSS v4
- **프로덕션 URL**: https://www.brainy-club.com
- **캡처 뷰포트**: 390×844 (iPhone 14), 2x DPR

## 화면 목록

### Flow 1: 온보딩

- **로그인 페이지**: `flow1-onboarding/1-1-login.png`
### Flow 2: 모임 탐색

- **홈 — 모임 목록 (캘린더 스트립)**: `flow2-browse/2-1-meeting-list.png`
- **모임 상세 (회원 시점)**: `flow2-browse/2-2-meeting-detail-member.png`
### Flow 3: 결제 결과

- **결제 확인 (신청 완료)**: `flow3-payment/3-1-confirm.png`
- **결제 실패**: `flow3-payment/3-2-payment-fail.png`
### Flow 4: 내 신청 관리

- **내 신청 목록 (회원)**: `flow4-my-registrations/4-1-my-registrations-member.png`
- **내 신청 목록 (운영자)**: `flow4-my-registrations/4-2-my-registrations-admin.png`
### Flow 5: 운영자 — 모임 관리

- **운영 대시보드**: `flow5-admin/5-1-admin-dashboard.png`
- **모임 생성 폼**: `flow5-admin/5-2-meeting-create-form.png`
- **모임 수정 폼**: `flow5-admin/5-3-meeting-edit-form.png`
- **모임 상세 (관리 영역 포함)**: `flow5-admin/5-4-meeting-detail-admin.png`
- **회원 관리**: `flow5-admin/5-5-admin-members.png`
- **사이트 설정**: `flow5-admin/5-6-admin-settings.png`
### Flow 6: 공개 페이지

- **공개 모임 목록**: `flow6-public/6-1-public-meetings.png`
- **공개 모임 상세**: `flow6-public/6-2-public-meeting-detail.png`
- **서비스 소개**: `flow6-public/6-3-about.png`
- **이용약관**: `flow6-public/6-4-terms.png`
- **개인정보처리방침**: `flow6-public/6-5-privacy.png`
- **환불규정**: `flow6-public/6-6-refund.png`

## AI 리뷰 요청 사항

아래 관점에서 UI/UX 개선점을 분석해주세요:

1. **모바일 UX 흐름**: 사용자가 모임을 발견하고 신청하는 과정이 직관적인가?
2. **시각적 계층 구조**: 정보 밀도가 적절한가? 중요 정보가 눈에 잘 띄는가?
3. **접근성**: 터치 타겟 크기, 색상 대비, 텍스트 가독성은 적절한가?
4. **일관성**: 컴포넌트 스타일, 간격, 타이포그래피가 통일되어 있는가?
5. **페이지 전환**: 네비게이션 구조가 명확한가? 사용자가 현재 위치를 알 수 있는가?
6. **빈 상태 / 에러 상태**: 사용자에게 다음 행동을 안내하고 있는가?
7. **운영자 화면**: 모임 관리 흐름이 효율적인가? 불필요한 단계는 없는가?

---
*캡처 일시: 2026-03-26*
