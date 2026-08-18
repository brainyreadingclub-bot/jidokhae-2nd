# Project Profile — JIDOKHAE (지독해)

> **갱신일: 2026-08-17** (이전 갱신 2026-08-14 — **3일 만에 낡았다.** 발제 스레드 5테이블·5탭 개편·환불 규칙 개정이 그 사이 들어왔다)
> 근거: `CLAUDE.md` · `검토문서/DECISIONS.md` · `memory/MEMORY.md`
> ⚠️ 이 프로필이 낡으면 에이전트가 **존재하지 않는 시스템을 검증한다.**

## 이 프로필이 낡았는지 30초 안에 확인하는 법

사람이 기억해서 갱신하는 방식은 이미 두 번 실패했다(4개월 방치 → 3일 방치). 쓰기 전에 아래 셋을 확인하고, **하나라도 어긋나면 작업을 멈추고 관리자에게 보고한다.**

| 확인 | 방법 | 지금 값 |
|---|---|---|
| prod 테이블 수 | Supabase `list_tables` | **17개** |
| 결정 기록 최신 날짜 | `검토문서/DECISIONS.md` 첫 행 | **2026-08-17** |
| 갱신일 이후 코드 변경 | `git log --since=2026-08-17 --oneline -- jidokhae-web/src` | 있으면 의심 |

---

## 기본 정보
- **프로젝트명**: JIDOKHAE 2nd (지독해)
- **서비스 URL**: `https://www.brainy-club.com` (Vercel, 프로젝트 `jidokhae-2nd` / 팀 `flashchecks-projects`)
- **운영 국가**: 한국 (경주/포항)
- **도메인**: 독서 모임 커뮤니티 (일정 조회 + 결제 신청 + 취소/환불 + 대기 + 토론모임)
- **단계**: 프로덕션 운영 중. MVP + Phase 2 완료, **전면개편 1단계가 플래그 OFF로 반입된 상태**
- **저장소**: `C:\jidokhae-2nd`(기획) + `jidokhae-web/`(구현, 중첩)

## 기술 스택
- **프론트**: Next.js 16.1.6 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **백엔드**: Next.js API Routes (서버리스)
- **DB**: PostgreSQL 17 (Supabase) + RLS + SECURITY DEFINER 함수
- **호스팅**: Vercel. ⚠️ **Root Directory = `jidokhae-web`** — 저장소 루트의 `vercel.json`은 읽히지 않는다
- **인증**: Supabase Auth + Kakao OAuth (PKCE)
- **결제**: 🔴 **PortOne V2** (카카오페이 채널). TossPayments 직연동에서 이관됨. **토스 코드는 롤백 안전망으로 잔존하나 미사용** — 현행 결제로 오인 금지
- **결제 특성**: PortOne V2는 결제창 완료 시 **이미 승인된 상태**로 redirect. 서버는 `getPayment()`로 `status === 'PAID'` 검증만 한다
- **외부**: Solapi(카카오 알림톡), Vercel Analytics, GA4
- **Supabase 요금제**: **Pro + Micro compute**. auto-pause OFF, daily backup ON *(Free tier 아님)*

## 회원 화면 — 지금 두 벌이 공존한다 (중요)

| | 현행 (회원이 실제로 보는 것) | 신규 (플래그 OFF) |
|---|---|---|
| 라우트 | `(main)` | **`(next)`** |
| 탭 | 2개 — 홈 / 마이페이지 | **5개 — 홈·모임·이야기·서재·나** (`/home` `/meet` `/talk` `/shelf` `/me`) |
| 스킨 | 잉크그린 | 토스 스킨 |

플래그: `isNextUiEnabled()` (`src/lib/next-ui.ts`) = `NEXT_UI_PREVIEW==='on'`(Preview 전용 env) **OR** `site_settings.next_ui==='on'`(현재 꺼짐)

서재/물어보기도 같은 구조 — `isLibraryEnabled()`, `site_settings.library_enabled` 꺼짐.

> 🔴 **회원 노출은 0이다.** `(next)` 아래 코드를 두고 "회원이 이걸 본다"고 전제하지 말 것.

## 비즈니스 로직 핵심
- **모임 종류**: `meetings.meeting_type` — `regular`(정기) / `discussion`(토론). **규칙이 서로 다르다**
- **환불(정기)**: 3일 이상 100% / 2일 50% / 2일 미만 0%
- **환불(토론)**: 🔴 **7일 전 100% / 3일 전 50% / 이후 불가** (2026-08-14에 14/7일에서 완화. `feat/next-phase1a` 배포 대기)
- **토론모임 D-7 통일**: 신청 마감 = 환불 100% 경계 = 책 주문 마감이 **전부 같은 날**(D-7, 23:59 KST). 회원이 외울 날짜를 하나로
- **스텝 할인**: 50%, 모임당 슬롯 2명. 🔴 **정기모임 한정 — 토론모임 제외**(2026-08-17 확정). `pricing.ts` 상수 ↔ SQL 가드(`migration-staff-discount-discussion-guard.sql`) **동기 필수**
- **무료 회원**: `profiles.is_free=true` — 정산 목록에서만 제외. 토글 UI 없음(SQL로 지정)
- **엔티티 17개**: `profiles` `meetings` `registrations` `notifications` `site_settings` `venues` `venue_settlements` `banners` `book_quotes` `books` `library_entries` `book_asks` **`discussion_topics` `topic_answers` `answer_replies` `answer_reactions` `app_notifications`**
- **상태 머신**
  - Registration: `confirmed` → `cancelled` / `waitlisted` → `waitlist_cancelled` | `waitlist_refunded` | `confirmed`(승격) / `pending_transfer` → `confirmed`(운영자 수동)
  - Meeting: `active` → `deleting` → `deleted`
  - Notification: `pending` → `sent` | `failed` | `skipped`
- **동시성 보호**: `confirm_registration()` `register_transfer()` `promote_next_waitlisted()` `admin_confirm_transfer()` — 전부 `FOR UPDATE` 행 락
- **알림톡**: 7종. V2 6종 **APPROVED**, `BOOK_ASK`는 문구 수정 **재심사 중(INSPECTING)**. 켜는 날 = BOOK_ASK 승인 + env 템플릿 ID 6개 V2 교체 + `next_ui`·`library_enabled` 동시 flip

## 사용자
- **비기술 사용자 대다수.** 회원 수는 계속 변하므로 숫자를 여기 적지 않는다 — 필요하면 `profiles` 테이블을 직접 센다
- 모바일 중심, 카카오톡 링크 유입
- **운영 인력**: 총괄운영자 1명(비전공자) + 운영진 소수. **전담 개발자·QA·디자이너 없음**
- **역할**: `admin`(전체) / `editor`(모임 CRUD·회원 조회 **개인정보 제외**·배너·한줄) / `member`

## 디자인 시스템
- **토큰 위치**: `jidokhae-web/src/app/globals.css` (`@theme inline`). `tailwind.config.ts` **아님**
- **컨셉**: **"잉크 그린 × 에디토리얼"**. Primary Ink Green `#127A5A`(포인트 — *그린은 점이지 면이 아니다*), Accent Citrus Coral `#F4552A`(긴급·희소·에러·필수에만), Neutral Cool Warm Gray
- **폰트**: Noto Serif KR(워드마크·히어로·책/모임 제목), Pretendard(본문)
- **금액**: 🔴 **단위 없이 숫자만**(`"10,000"`). `원`·`₩` 금지 — 가격 프레이밍
- 상세: `jidokhae-web/DESIGN_TOKENS.md`. *(`(next)`는 토스 스킨이라 규칙이 일부 다름)*

## 법적·규정
- 적용: 개인정보보호법, 전자상거래법
- 수집: 카카오 프로필(이름·닉네임), 전화번호, 지역, 이메일
- 제3자: PortOne(결제), Solapi(알림톡), Supabase(DB), Vercel
- ✅ **통신판매업 신고 면제 확정**(간이과세자, 시행령 §12 ①-2). **재지적 금지**
- ✅ **GA4 동의 배너는 현 규모에서 법적 의무 아님**. privacy 쿠키 안내로 갈음. **재지적 금지**

## 인프라·운영
- 트래픽: 일 50~100명, 동시 10~20명
- 모니터링: Vercel Analytics, GA4, `/admin/notifications`(발송 이력)
- **크론**: `jidokhae-web/vercel.json`에만 등록. `waitlist-refund`(KST 18:30), `meeting-remind`(KST 19:00). Hobby 상한 100개, **실행 정밀도 ±59분**
- **배포**: PR 기반. 영향 대상별 분리 — 안정성 → 운영자 → 회원
- **롤백**: `git revert -m 1 <merge-sha>` (코드만. DB는 forward-compatible)
- **로컬 제약**: `(main)`·`(admin)`은 Kakao OAuth 때문에 **localhost 검증 불가**. preview/prod로 확인

## 코딩 컨벤션
- camelCase(변수·함수), PascalCase(컴포넌트)
- 세미콜론 없음, 작은따옴표, 함수형 컴포넌트만, **아이콘은 인라인 SVG**(라이브러리 없음)
- 알림은 fire-and-forget — 실패해도 결제·신청을 막지 않는다
- **API 응답**: `{ status: 'success' | 'error', message?, data? }`
- **날짜**: 반드시 `src/lib/kst.ts`. `new Date()` 직접 금지
- 검증: `npm run prelaunch` (lint + tsc + test + build)
- **테스트 파일에 `import { describe, it, expect } from 'vitest'` 명시 필수** — `globals: true`라도 `tsc --noEmit`가 실패한다

---

## 🔴 의도된 설계 — 문제로 오인하지 말 것

일부러 그렇게 만든 것이다. 지적하면 오탐이다. (전문가 패널이 맥락 없이 이것들을 결함으로 지적한 전례가 있다.)

| 설계 | 왜 그런가 |
|---|---|
| `pending_transfer`를 회원 화면에서 `confirmed`와 **동일하게** 표시 | 운영자가 입금 확인을 월말에 몰아 처리한다. 회원 입장에선 이미 끝난 신청이라 불안을 주지 않기 위함 |
| 계좌이체 입금 확인 시 **알림톡 미발송** | 위와 같은 이유. 월말에 수십 건이 한꺼번에 나가면 혼란 |
| 인앱 `pending_transfer` 라벨 3종이 서로 다름 | **통일하지 않기로 결정**(2026-08-13). 재제안 금지 |
| 신청자 3명 미만일 때 인원수 **마스킹** | social proof 역효과 방지. 운영자에겐 0명만 마스킹 |
| `user_id + meeting_id`가 **UNIQUE 아님** | 재신청 시 새 행을 만드는 설계 |
| 환불 실패 시 `confirmed` **유지** | 회원이 돈도 없고 신청도 없는 상태가 되는 것을 막는다 |
| `waitlisted`에서 부분 환불·safeCancel **금지** | 대기 취소·크론 환불·모임 삭제에서만 환불 |
| `attended` 컬럼 **미사용** | 참여 판정은 "결제완료 + 모임일 경과"로 자동 |
| TossPayments 코드 잔존 | 롤백 안전망. **의도적 보존** |
| 무료 회원 지정에 **토글 UI 없음** | 혜택이 editor에 노출되어 폐기. SQL로 지정 |
| `(next)` 5탭·서재가 회원에게 안 보임 | 플래그 OFF. **의도된 다크 배포** |
| `/policy/meetings*`의 `/auth/login` MIME 콘솔 에러 | **의도적 무시.** 영향 없음, 재조사 금지 |

## ⚠️ 알려진 미해결 문제 — 새로 발견한 척하지 말 것

| 문제 | 상태 |
|---|---|
| 알림 종류 union이 **4곳에 서로 다르게** 정의 (`types/notification.ts` 2종 / `lib/notification.ts` 5종 / `notification-log.ts` 7종 / `migration.sql` CHECK 5종). `types/notification.ts`는 **어디서도 import 안 되는 사문** | 인지됨. types로 통합하는 수정이 **미머지** |
| 발송 실패 시 이력 행이 남고 중복 방지 인덱스가 자리를 차지해 **재시도가 영영 안 됨** | 인지됨. 재발송 버튼은 별도 작업 |
| 호칭이 채널 간 불일치 — 인앱 닉네임, 알림톡 실명 우선 | 닉네임 통일로 결정됨. 🔨 **코드 미적용** |
| 토론모임 환불 7/3일, D-7 통일 | 🔨 구현됨, `feat/next-phase1a` **배포 대기** |
