# Project Profile — JIDOKHAE (지독해)

> **갱신일: 2026-08-14** (이전: 2026-04-08 — 4개월간 방치되어 결제 게이트웨이·디자인 토큰이 실제와 달랐음)
> 근거: `C:\jidokhae-2nd\CLAUDE.md` · `검토문서/DECISIONS.md` · `memory/MEMORY.md`
> ⚠️ 이 프로필이 낡으면 에이전트가 **존재하지 않는 시스템을 검증한다.** 큰 변경이 있으면 함께 갱신할 것.

## 기본 정보
- **프로젝트명**: JIDOKHAE 2nd (지독해)
- **서비스 URL**: `https://www.brainy-club.com` (Vercel 프로덕션)
- **운영 국가**: 한국 (경주/포항 지역)
- **비즈니스 도메인**: 독서 모임 커뮤니티 플랫폼 (일정 조회 + 결제 신청 + 취소/환불 + 대기)
- **서비스 단계**: 프로덕션 운영 중. MVP + Phase 2 완료, **Phase 3 M7 진행 중**
- **저장소 구조**: `C:\jidokhae-2nd` (기획 문서) + `jidokhae-web/` (구현 코드, 중첩)

## 기술 스택
- **프론트엔드**: Next.js 16.1.6 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **백엔드**: Next.js API Routes (서버리스)
- **데이터베이스**: PostgreSQL (Supabase) + RLS + SECURITY DEFINER 함수
- **호스팅**: Vercel. ⚠️ **Root Directory = `jidokhae-web`** — 저장소 루트의 `vercel.json`은 읽히지 않는다
- **인증**: Supabase Auth + Kakao OAuth (PKCE)
- **결제**: 🔴 **PortOne V2** (카카오페이 채널, `@portone/browser-sdk` + `@portone/server-sdk`). 2026년 PR #28에서 TossPayments 직연동에서 마이그레이션(토스 PG 심사 거절 → 포트원 경유). **TossPayments 코드는 롤백 안전망으로 잔존하나 미사용** — 이걸 현행 결제로 오인하지 말 것
- **결제 흐름 특성**: PortOne V2는 결제창에서 완료 시 **이미 승인된 상태**로 redirect. 서버는 `getPayment()`로 `status === 'PAID'` 검증만 한다(토스처럼 confirm으로 돈을 옮기지 않음)
- **외부 서비스**: Solapi(카카오 알림톡), Vercel Analytics, GA4
- **Supabase 요금제**: **Pro plan + Micro compute** (2026-05-19부터). auto-pause OFF, daily backup ON. *(Free tier 아님)*

## 비즈니스 로직 핵심
- **핵심 기능**: 모임 조회, 결제 신청, 취소/환불, 대기 신청 + 자동 승격, 운영자 CRUD, 백오피스, 정산, 서재/물어보기(플래그 OFF)
- **금전 거래**: 있음 — PortOne 카드결제 또는 **계좌이체 브릿지**
- **환불 규칙(정기모임)**: 3일 이상 100% / 2일 50% / 2일 미만 0% (취소 자체는 항상 가능)
- **환불 규칙(토론모임)**: 14일 전 100% / 7일 전 50% / 이후 불가 — **정기모임과 다르다.** 🔨 코드 미적용(2026-08-13 결정)
- **핵심 엔티티**: `profiles`, `meetings`, `registrations`, `notifications`, `site_settings`, `venues`, `venue_settlements`, `books`, `library_entries`, `book_asks`, `banners`, `book_quotes`
- **상태 머신**:
  - Registration: `confirmed` → `cancelled` / `waitlisted` → `waitlist_cancelled` | `waitlist_refunded` | `confirmed`(승격) / `pending_transfer` → `confirmed`(운영자 수동)
  - Meeting: `active` → `deleting` → `deleted`
  - Notification: `pending` → `sent` | `failed` | `skipped`
- **동시성 보호**: `confirm_registration()`, `register_transfer()`, `promote_next_waitlisted()`, `admin_confirm_transfer()` — 모두 `FOR UPDATE` 행 락
- **가격**: 모임별 변동(고정 10,000원 아님). **스텝 할인** 50%(모임당 슬롯 2명, `is_staff`), **무료 회원** `is_free`
- **알림톡**: 기존 5종 + 신규 2종(물어보기, 가입 환영) = **7종**. 신규 2종은 **카카오 승인 대기 중**

## 사용자 정보
- **주요 사용자층**: 경주/포항 독서 모임 회원 **250명**, 비기술 사용자 대다수
- **사용 환경**: 모바일 중심(카카오톡 링크 유입), iOS/Android 브라우저
- **운영 인력**: 총괄운영자 1명(비전공자) + 운영진 소수. **전담 개발자·QA·디자이너 없음**
- **역할**: `admin`(전체) / `editor`(모임 CRUD·회원 조회, **개인정보 제외**·배너·한줄) / `member`

## 디자인 시스템
- **토큰 위치**: `jidokhae-web/src/app/globals.css` (`@theme inline` 블록). `tailwind.config.ts` **아님**
- **컨셉**: 🔴 **"잉크 그린 × 에디토리얼"** (2026-07-12 2535 전면 리디자인, PR #39)
- **Primary**: Ink Green `#127A5A` — 워드마크·링크·강조 **포인트**. *"그린은 점이지 면이 아니다"*
- **Accent**: Citrus Coral `#F4552A` — 긴급·희소·에러·필수에만
- **Neutral**: Cool Warm Gray (`neutral-50` = `#F9FAFB`)
- **폰트**: Noto Serif KR(워드마크·히어로·책/모임 제목), Pretendard(본문)
- **금액 표기**: 🔴 **단위 없이 숫자만** (`"10,000"`). `원`·`₩` 금지 — 가격 프레이밍 심리
- 상세: `jidokhae-web/DESIGN_TOKENS.md`

## 법적/규정 정보
- **적용 법률**: 개인정보보호법, 전자상거래법
- **수집 개인정보**: 카카오 프로필(이름·닉네임), 전화번호, 지역, 이메일
- **제3자 제공**: PortOne(결제), Solapi(알림톡), Supabase(DB), Vercel
- ✅ **통신판매업 신고 면제 확정** — 간이과세자이므로 전자상거래법 시행령 §12 ①-2 적용. **재지적 금지**
- ✅ **GA4 동의 배너는 현 규모(250명·국내)에서 법적 의무 아님** — privacy 페이지 쿠키 안내로 갈음하기로 확정. **재지적 금지**

## 인프라/운영 정보
- **트래픽**: 일일 50~100명, 동시 10~20명
- **모니터링**: Vercel Analytics, GA4, `/admin/notifications`(알림 발송 이력)
- **크론**: `jidokhae-web/vercel.json`에 등록. `waitlist-refund`(KST 18:30), `meeting-remind`(KST 19:00). Hobby 상한 100개, **실행 정밀도 ±59분**
- **배포**: PR 기반. 마일스톤은 한 브랜치로 구현하되 **배포는 영향 대상별로 분리** — 안정성 → 운영자 → 회원
- **롤백**: `git revert -m 1 <merge-sha>` (코드만. DB 스키마는 forward-compatible 설계라 되돌리지 않음)
- **로컬 제약**: `(main)`·`(admin)` 페이지는 Kakao OAuth 때문에 **localhost에서 검증 불가.** preview/prod로 확인

## 코딩 컨벤션
- **네이밍**: camelCase(변수·함수), PascalCase(컴포넌트)
- **스타일**: 세미콜론 없음, 작은따옴표, 함수형 컴포넌트만, 아이콘은 인라인 SVG(아이콘 라이브러리 없음)
- **에러 핸들링**: try-catch + `NextResponse.json`. 알림은 fire-and-forget(실패해도 결제·신청 흐름을 막지 않음)
- **API 응답 표준**: `{ status: 'success' | 'error', message?, data? }`. 구형 `{ success: true }`는 점진 마이그레이션 중
- **날짜**: 반드시 `src/lib/kst.ts` 유틸 사용. `new Date()` 직접 사용 금지
- **린터**: ESLint 9 flat config. 검증은 `npm run prelaunch` (lint + tsc + test + build)
- **테스트 파일**: `import { describe, it, expect } from 'vitest'` **명시 필수** — `globals: true`라도 `tsc --noEmit`가 실패한다

---

## 🔴 의도된 설계 — 문제로 오인하지 말 것

아래는 **일부러 그렇게 만든 것**이다. 지적하면 오탐이다. (과거 전문가 패널이 맥락 없이 이것들을 결함으로 지적한 전례가 있다.)

| 설계 | 왜 그런가 |
|---|---|
| `pending_transfer`를 회원 화면에서 `confirmed`와 **동일하게** 표시 | 운영자가 입금 확인을 월말에 몰아 처리한다. 회원 입장에선 이미 신청이 끝난 상태라 불안을 주지 않기 위함 |
| 계좌이체 입금 확인 시 **알림톡을 보내지 않음** | 위와 같은 이유. 월말에 수십 건이 한꺼번에 나가면 회원이 혼란스럽다 (2026-04-23 확정) |
| 신청자 3명 미만일 때 인원수 **마스킹** ("N명 모집 중") | social proof 역효과 방지. 운영자에게는 0명만 마스킹 |
| `user_id + meeting_id`가 **UNIQUE가 아님** | 재신청 시 새 행을 만드는 설계 |
| 환불 실패 시 `confirmed` 상태를 **유지** | 회원이 돈도 없고 신청도 없는 상태가 되는 것을 막기 위함 |
| `waitlisted` 상태에서 부분 환불·safeCancel **금지** | 대기 취소·크론 환불·모임 삭제에서만 환불한다. 돈 안전성 규칙 |
| `attended` 컬럼이 **미사용** | 참여 판정은 "결제완료 + 모임일 경과"로 자동. 향후 노쇼 대응용 예약 컬럼 |
| TossPayments 코드 잔존 | 롤백 안전망. 죽은 코드가 아니라 **의도적 보존** |
| 무료 회원 지정에 **토글 UI가 없음** | 혜택이 editor에게 노출되는 문제로 폐기. SQL로 직접 지정 |
| 서재/물어보기가 회원에게 안 보임 | `site_settings.library_enabled` 플래그 OFF. **의도된 다크 배포** |

## ⚠️ 알려진 미해결 문제 — 새로 발견한 척하지 말 것

| 문제 | 상태 |
|---|---|
| 알림 발송 실패 시 이력 행이 남고 중복 방지 인덱스가 자리를 차지해 **재시도가 영영 안 됨** | 인지됨. 재발송 버튼은 별도 작업으로 남아 있음 |
| 인앱 `pending_transfer` 라벨 3종이 서로 다름 | **통일하지 않기로 결정**(2026-08-13). 재제안 금지 |
| 호칭이 채널 간 불일치 — 인앱은 닉네임, 알림톡은 실명 우선 | 닉네임 통일로 결정됨. 🔨 **코드 미적용** |
| `/policy/meetings*`의 `/auth/login` MIME 콘솔 에러 | **의도적 무시.** 영향 없음, 재조사 금지 |
