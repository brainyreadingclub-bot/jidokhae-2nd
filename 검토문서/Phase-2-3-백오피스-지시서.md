# Phase 2-3: 백오피스 (관리자 대시보드 + 사이트 설정)

> 이 문서는 Phase 2-3에서 구현할 백오피스 기능의 설계서입니다.
> **구현 주체: Claude Code (jidokhae-web/ 내에서 작업)**
> 지금 할 것과 나중에 할 것을 명확히 분리합니다.

---

## 현재 상태 요약

### 이미 있는 관리 기능

| 기능 | 위치 | 상태 |
|------|------|------|
| 모임 목록/생성/수정/삭제 | `/admin`, `/admin/meetings/*` | ✅ 동작 |
| 회원 목록 (닉네임 검색 + 역할 변경) | `/admin/members` | ✅ 동작, 기능 부족 |
| 신청자 테이블 (참석 체크 포함) | 모임 상세 내 운영자 관리 섹션 | ✅ 동작, 결제 정보 미표시 |

### 없는 것

- 결제/환불 금액 표시 (어디에도 없음)
- 회원 상세 (연락처, 참여 이력, 통계)
- 정산 현황 (매출, 환불, 공간별 정산)
- 사이트 설정 (하드코딩 값 관리)
- 대시보드 (핵심 지표 요약)

---

## 구현 컨텍스트 (Claude Code 참고)

### 기존 코드 컨벤션 (반드시 따를 것)

- Server Components by default. Client Component는 인터랙션 필요한 곳만 (`'use client'`)
- No semicolons, single quotes, function components only
- Tailwind v4: 디자인 토큰은 `@theme inline` in `globals.css` (DESIGN_TOKENS.md 참조)
- 모바일 퍼스트: `max-w-screen-sm`, 하단 탭 네비게이션
- 날짜는 항상 `src/lib/kst.ts` 유틸리티 사용
- Supabase 3종: server.ts (anon), client.ts (anon), admin.ts (service_role)
- API Route에서 admin 권한 체크 패턴: cookie 기반 auth → service_role로 role 조회
- `Promise.all()`로 병렬 데이터 페칭
- 금액 표시: `formatFee()` 사용 (숫자만 반환, '원' 접미사는 JSX에서 직접)
- Admin 접근 제어: layout 레벨 role check + RLS 이중 보호

### Client Component에서 DB 설정값 접근 방식

`login/page.tsx`, `WelcomeScreen.tsx`는 `'use client'`이므로 서버 유틸리티를 직접 호출할 수 없음.

**방식:** 부모 Server Component에서 settings를 가져와 props로 전달.
- `WelcomeScreen` — 이미 `page.tsx`(Server Component)에서 props를 받는 구조. `page.tsx`에서 `getSiteSettings()` 호출 후 props로 전달.
- `login/page.tsx` — `'use client'` 전체 페이지. **`src/app/auth/login/page.tsx`를 Server Component wrapper + Client Component 분리로 리팩토링 필요.** 즉, `LoginPage` (Server) → `LoginClient` (Client, props로 settings 수신) 구조.
- `Footer.tsx` — Server Component이므로 직접 호출 가능.
- `about/page.tsx` — Server Component이므로 직접 호출 가능.

---

## Phase 2-3에서 구현할 것 (8개 항목)

### 작업 1. 환불 규칙 상수 통합 (코드 리팩토링)

**목적:** 3곳에 분산된 환불 규칙을 1곳으로 통합. 불일치 위험 제거.

**현재 분산 위치 (3곳):**

| 파일 | 내용 | 역할 |
|------|------|------|
| `src/lib/refund.ts:37-43` | `daysRemaining >= 3 → 100%` 등 | 실제 계산 |
| `src/components/meetings/MeetingActionButton.tsx:273` | "모임 3일 전: 100% · 2일 전: 50%..." 텍스트 | 취소 모달 UI |
| `src/app/policy/refund/page.tsx:41-50` | 환불정책 표 | 정책 페이지 |

**⚠️ 주의:** Claude Code 분석에서 `MeetingActionButton.tsx`를 누락하고 2곳으로 잡는 경우가 있었음. 반드시 3곳 모두 수정할 것.

**변경 내용:**

`src/lib/refund.ts`에 규칙 상수를 추가하고, `calculateRefund()`도 이 상수에서 계산하도록 수정:

```typescript
export const REFUND_RULES = [
  { daysBeforeMeeting: 3, rate: 100, label: '모임 3일 전까지', rateLabel: '참가비 100% 환불' },
  { daysBeforeMeeting: 2, rate: 50, label: '모임 2일 전', rateLabel: '참가비 50% 환불' },
] as const

// 규칙에 매칭되지 않는 경우 (전날/당일)
export const REFUND_DEFAULT = {
  rate: 0,
  label: '모임 전날 · 당일',
  rateLabel: '환불 없음 (취소는 가능)',
} as const

// 취소 모달용 한 줄 요약
export function getRefundRuleText(): string {
  return REFUND_RULES
    .map(r => `${r.daysBeforeMeeting}일 전: ${r.rate}%`)
    .concat(['전날/당일: 0%'])
    .join(' · ')
}
```

**역할 분리:**
- `calculateRefund()` — `REFUND_RULES`의 `rate`로 계산 (기존 로직과 동일한 결과)
- `refund/page.tsx` — `REFUND_RULES`의 `label` + `rateLabel` + `REFUND_DEFAULT`로 테이블 동적 생성
- `MeetingActionButton.tsx` — `getRefundRuleText()`로 한 줄 요약

**수정 대상 파일:**
1. `src/lib/refund.ts` — `REFUND_RULES` + `REFUND_DEFAULT` 상수 추가, `calculateRefund()`가 이 상수 사용
2. `src/components/meetings/MeetingActionButton.tsx:273` — 하드코딩 텍스트를 `getRefundRuleText()` import로 교체
3. `src/app/policy/refund/page.tsx:41-50` — 하드코딩 테이블을 `REFUND_RULES` + `REFUND_DEFAULT` import로 동적 생성

**검증:** 기존 `src/lib/__tests__/refund.test.ts`가 통과하는지 확인. 환불 계산 결과가 달라지면 안 됨.

**난이도:** 하.

---

### 작업 2. 지역 목록 상수 통합 (코드 리팩토링)

**목적:** 2곳에 중복된 지역 배열을 1곳으로 통합.

**현재 분산 위치 (2곳):**

| 파일 | 내용 |
|------|------|
| `src/components/ProfileSetup.tsx:21` | `const REGIONS = ['경주', '포항', ...] as const` |
| `src/app/api/profile/setup/route.ts:66` | `const VALID_REGIONS = ['경주', '포항', ...]` |

**변경 내용:**

`src/lib/regions.ts` (신규 파일):

```typescript
export const VALID_REGIONS = [
  '경주', '포항', '울산', '부산', '대구',
  '창원', '대전', '광주', '전주',
  '수원', '인천', '서울', '제주',
] as const

export type Region = (typeof VALID_REGIONS)[number]
```

**수정 대상 파일:**
1. `src/lib/regions.ts` — 신규 생성
2. `src/components/ProfileSetup.tsx` — 로컬 `REGIONS` 삭제, `VALID_REGIONS` import
3. `src/app/api/profile/setup/route.ts` — 로컬 `VALID_REGIONS` 삭제, import로 교체

**참고:** DB CHECK 제약(`profiles_region_check`)은 수동 동기화 유지. 추후 지역을 DB 테이블로 이관하면 CHECK 제거 가능.

**난이도:** 하.

---

### 작업 3. 신청 테이블에 결제/환불 금액 표시

**목적:** 운영자가 모임 상세에서 결제/환불 현황을 바로 확인. 정산의 첫걸음.

**변경 대상:** `src/components/meetings/AdminMeetingSection.tsx`

**현재 테이블 컬럼:** 이름 | 신청일 | 상태 | 참석

**추가할 정보:**

| 정보 | 데이터 소스 | 표시 조건 |
|------|-----------|---------|
| 결제 금액 | `reg.paid_amount` | confirmed 건 |
| 환불 금액 | `reg.refunded_amount` | cancelled 건만 |
| 취소 사유 | `reg.cancel_type` | cancelled 건만 (`user_cancelled` → "회원 취소", `meeting_deleted` → "모임 삭제") |

**모바일 레이아웃 전략:**

7컬럼은 640px에서 읽을 수 없음. **테이블에 컬럼을 추가하지 말고**, 기존 상태 뱃지 아래에 서브텍스트로 금액을 표시:

```
이름                신청일    상태         참석
───────────────────────────────────────────────
홍길동 (길동)       3/15     결제완료      ☑
                             10,000원
───────────────────────────────────────────────
김철수 (철수)       3/14     취소됨
                             환불 10,000원
                             (회원 취소)
```

즉, 상태 셀 안에 금액과 취소 사유를 서브라인으로 넣는 방식.

**추가:** 테이블 상단에 요약 카드

```
총 결제: 140,000원 | 환불: 20,000원 | 순매출: 120,000원
참석률: 85% (11/13명) — 모임 날짜 이후에만 표시
```

요약 카드의 데이터는 부모 페이지(`meetings/[id]/page.tsx`)에서 props로 전달받은 `registrations` 배열에서 컴포넌트 내 계산 (추가 쿼리 불필요, 부모가 `*`로 이미 전체 필드 가져오고 있음). AdminMeetingSection은 Server Component이며 직접 DB 쿼리를 하지 않음.

**난이도:** 하.

---

### 작업 4. site_settings 테이블 + 관리 UI

**목적:** 하드코딩된 운영 데이터를 DB로 이관. 코드 배포 없이 변경 가능.

#### DB 스키마

```sql
CREATE TABLE public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 읽기: 전체 공개 (비로그인 페이지에서도 사용하므로)
CREATE POLICY "site_settings_select_all"
  ON public.site_settings FOR SELECT
  USING (true);

-- 쓰기: admin만
CREATE POLICY "site_settings_insert_admin"
  ON public.site_settings FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "site_settings_update_admin"
  ON public.site_settings FOR UPDATE
  USING (public.is_admin());

-- 초기 데이터
INSERT INTO public.site_settings (key, value) VALUES
  ('member_count', '250'),
  ('active_regions_label', '경주 · 포항'),
  ('company_name', '지독해'),
  ('representative', '임재윤'),
  ('business_number', '494-42-01276'),
  ('address', '경상북도 경주시 태종로 801-11 (황오동) 208호'),
  ('phone', '0507-1396-7908'),
  ('support_contact', '카카오톡 ''단무지''에게 1:1 채팅으로 연락해 주세요.');
```

#### 데이터 읽기 유틸리티

`src/lib/site-settings.ts` (신규):

```typescript
import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/admin'

// Server Component 전용. React cache()로 동일 요청 내 중복 호출 방지.
// service_role 사용 — RLS는 전체 공개이지만, 미들웨어를 안 거치는 public 페이지에서도 안정적으로 조회하기 위함.
export const getSiteSettings = cache(async (): Promise<Record<string, string>> => {
  const supabase = createServiceClient()
  const { data } = await supabase.from('site_settings').select('key, value')
  const settings: Record<string, string> = {}
  for (const row of data ?? []) {
    settings[row.key] = row.value
  }
  return settings
})
```

#### 하드코딩 제거 대상 (7개 파일)

**⚠️ `layout.tsx`는 대상에서 제외.** root layout의 `metadata` 객체를 `generateMetadata()`로 바꾸면 영향 범위가 큼. "경주/포항" 표기가 바뀌는 건 대구 확장 때뿐이므로 코드에 유지.

| 파일 | 현재 하드코딩 | 대체할 설정 키 | 비고 |
|------|-------------|-------------|------|
| `auth/login/page.tsx:81,116,148,151` | "경주 · 포항", "250명", 사업자 정보 | `active_regions_label`, `member_count`, 사업자 전체 | ⚠️ Client Component → Server+Client 분리 필요 |
| `WelcomeScreen.tsx:88,90` | "250명", "경주·포항" | `member_count`, `active_regions_label` | props로 수신 (부모 page.tsx에서 전달) |
| `about/page.tsx:42,53` | "경주·포항", "250명" | `active_regions_label`, `member_count` | Server Component, 직접 호출 가능 |
| `Footer.tsx:10-14` | 상호/대표/주소/전화 | 사업자 정보 전체 | Server Component, 직접 호출 가능 |
| `privacy/page.tsx:175` | "임재윤" | `representative` | Server Component, 직접 호출 가능 |
| `refund/page.tsx:89` | "단무지" | `support_contact` | Server Component, 직접 호출 가능 |

**login/page.tsx 리팩토링 방법:**

현재 `src/app/auth/login/page.tsx`는 전체가 `'use client'`. 다음과 같이 분리:
1. `src/app/auth/login/page.tsx` — Server Component. `getSiteSettings()` 호출 후 `LoginClient`에 props 전달.
2. `src/components/LoginClient.tsx` (신규) — Client Component. 기존 login 페이지 로직 전체를 이동. settings를 props로 수신.

#### 관리 UI

**라우트:** `/admin/settings`
**접근:** admin만 (admin layout에서 editor/admin 통과 → 페이지에서 admin 재확인)
**레이아웃:** 단일 폼 페이지, 섹션별 구분

| 섹션 | 필드 | 타입 | 검증 |
|------|------|------|------|
| 사이트 정보 | 회원 수 | number input | 양의 정수, 필수 |
| | 활동 지역 표기 | text input | 1-30자, 필수 |
| 사업자 정보 | 상호명 | text | 1-50자, 필수 |
| | 대표자 | text | 1-20자, 필수 |
| | 사업자등록번호 | text | `000-00-00000` 형식 |
| | 주소 | text | 1-100자, 필수 |
| | 연락처 | text | 필수 |
| 문의 | 문의 안내 문구 | text | 1-100자, 필수 |

**API:** POST `/api/admin/settings` → admin 권한 확인 → service_role로 site_settings UPSERT

**프론트 반영:** Server Component에서 매 요청마다 `getSiteSettings()` 호출. React `cache()`로 동일 요청 내 중복 방지. 별도 캐시 퍼지 불필요.

**admin 메인 페이지에 진입점 추가:** `/admin/page.tsx`에 기존 "회원 관리" 링크 아래에 "사이트 설정" 링크 추가 (admin only).

**난이도:** 중.

---

### 작업 5. venues 테이블 + 모임 폼 공간 선택 + 공간 관리 UI

**목적:** 공간별 정산 자동화의 기반. 공간이 바뀌어도 대응 가능.

#### DB 스키마

```sql
-- 공간 테이블
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  settlement_type TEXT NOT NULL DEFAULT 'percentage'
    CHECK (settlement_type IN ('percentage', 'fixed', 'none')),
  settlement_rate INTEGER DEFAULT 80
    CHECK (settlement_rate >= 0 AND settlement_rate <= 100),
  settlement_fixed INTEGER DEFAULT 0
    CHECK (settlement_fixed >= 0),
  contact_name TEXT,
  contact_info TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venues_select_all"
  ON public.venues FOR SELECT USING (true);
CREATE POLICY "venues_insert_admin"
  ON public.venues FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "venues_update_admin"
  ON public.venues FOR UPDATE USING (public.is_admin());

-- meetings에 venue_id 추가 (nullable — 기존 데이터 호환)
ALTER TABLE public.meetings ADD COLUMN venue_id UUID REFERENCES public.venues(id);

-- 정산 이력 테이블
CREATE TABLE public.venue_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id),
  month TEXT NOT NULL,
  total_paid INTEGER NOT NULL,
  settlement_amount INTEGER NOT NULL,
  settled_at TIMESTAMPTZ,
  settled_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (venue_id, month)
);

ALTER TABLE public.venue_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_settlements_select_admin"
  ON public.venue_settlements FOR SELECT
  USING (public.is_admin());
CREATE POLICY "venue_settlements_insert_admin"
  ON public.venue_settlements FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "venue_settlements_update_admin"
  ON public.venue_settlements FOR UPDATE
  USING (public.is_admin());

-- 초기 데이터
INSERT INTO public.venues (name, settlement_type, settlement_rate, contact_name) VALUES
  ('우연히 책방', 'percentage', 80, '우연히 책방 담당자'),
  ('공간 지그시', 'percentage', 80, '공간 지그시 담당자');
```

#### settlement_type 설명

| 타입 | 의미 | 계산 |
|------|------|------|
| `percentage` | 참가비 합산의 N%를 공간에 지급 | SUM(paid_amount) × rate / 100 |
| `fixed` | 모임 1회당 고정 금액 | 모임 수 × settlement_fixed |
| `none` | 정산 불필요 (자체 공간) | — |

#### 공간 관리 UI

**라우트:** `/admin/settings` 페이지 내 "공간 관리" 섹션 (별도 페이지 아님)

**기능:**
- 공간 목록 (active → inactive 순, 이름순)
- 공간 추가: 이름, 정산 유형, 정산율/금액, 담당자, 연락처
- 공간 수정: 위 필드 전체 편집 가능
- 공간 비활성화: status → inactive (삭제 불가 — 기존 모임 데이터 참조)

**검증 규칙:**

| 필드 | 규칙 |
|------|------|
| 이름 | 1-30자, 필수 |
| 정산 유형 | percentage / fixed / none 중 택 1 |
| 정산율 | percentage일 때만 필수, 0-100 정수 |
| 정산 고정금액 | fixed일 때만 필수, 0 이상 정수 |
| 담당자/연락처 | 선택 |

#### 모임 생성 폼 변경

`MeetingForm.tsx`의 "장소" 필드를 변경:

**현재:** 텍스트 인풋 (`location`)
**변경:** 공간 선택 드롭다운 + "기타(직접 입력)" 옵션

- venue 선택 → `venue_id` 세팅 + `location`에 venue.name 자동 입력 (수정 가능 — "공간 지그시 2층" 같이 상세 추가 가능)
- "기타" 선택 → `venue_id` = null + `location` 직접 입력
- 기존 모임 데이터 호환: `venue_id`가 null이면 기존 `location` 텍스트 그대로 표시
- MeetingForm은 Client Component이므로, venues 목록은 부모 Server Component에서 가져와 props로 전달

**types/meeting.ts 수정:** `Meeting` 타입에 `venue_id: string | null` 추가

#### 정산 완료 워크플로우

대시보드(작업 6)의 공간 정산 섹션에서 "정산 완료" 버튼을 누르면:

1. 해당 월의 결제 합계(`total_paid`)와 정산 예정액(`settlement_amount`)을 **그 시점에 확정(freeze)**
2. `venue_settlements` 테이블에 INSERT (또는 기존 행의 `settled_at` UPDATE)
3. `settled_at`에 현재 시간, `settled_by`에 현재 admin ID 세팅
4. **한 번 확정된 숫자는 변경 불가.** 이후 환불이 발생해도 이미 정산된 달은 안 바뀜. 차액은 다음 달 정산에 반영.

**API (모두 POST — 기존 프로젝트 컨벤션 준수):**
- POST `/api/admin/venues` → 공간 생성 (body에 필드)
- POST `/api/admin/venues/[id]` → 공간 수정 (body에 수정 필드, URL path에 venue ID)
- POST `/api/admin/venues/settle` → 정산 확정 (body에 venue_id, month)

**난이도:** 중.

---

### 작업 6. 대시보드 — 핵심 숫자

**목적:** 운영자가 매일 확인할 핵심 지표 한 화면.

**라우트:** `/admin` 메인 페이지 상단에 대시보드 섹션 추가 (기존 모임 목록 위에)

**집계 기준:** "이번 달"은 **모임일(meetings.date) 기준**으로 확정. registrations를 meetings와 JOIN하여 해당 월에 열린 모임의 결제/환불을 집계한다. (등록일 기준이 아님)

#### 대시보드 레이아웃 — 접기/펼치기 구조

모바일에서 대시보드가 모임 목록을 밀어내지 않도록, 카드별 접기/펼치기 적용:

- **"주의 필요" (🔴🟡):** 항상 펼침. 해당 없으면 섹션 자체 미표시.
- **"이번 달 정산":** 기본 접힘. 한 줄 요약만 표시 ("순수입 420,000원"). 펼치면 상세 + 공간 정산 테이블.
- **"회원 현황":** 기본 접힘. 한 줄 요약만 ("전체 250명, 이번 달 +3명"). 펼치면 상세.
- 회원 관리 / 사이트 설정 링크
- 필터 탭 + 모임 목록 (기존)

#### 대시보드 카드 상세

**① 이번 달 정산** (기본 접힘 — 한 줄 요약: "순수입 000,000원")

| 지표 | 계산 | 표시 |
|------|------|------|
| 총 결제 | SUM(r.paid_amount) JOIN meetings m WHERE m.date IN 이번 달 + r.status='confirmed' | 000,000원 |
| 총 환불 | SUM(r.refunded_amount) JOIN meetings m WHERE m.date IN 이번 달 | 000,000원 |
| 순수입 | 결제 - 환불 | 000,000원 |
| 전월 대비 | 이번 달 순수입 - 지난 달 순수입 | +00,000원 ↑ / -00,000원 ↓ |

**② 다가오는 모임**

| 지표 | 계산 | 표시 |
|------|------|------|
| 이번 주 모임 수 | meetings WHERE date BETWEEN today AND +7d, status='active' | N회 |
| 평균 신청률 | AVG(confirmedCount / capacity) for 이번 주 모임 | 00% |
| 🟡 신청률 낮은 모임 | 내일 모임인데 capacity의 50% 미만 | "내일 [모임명] 신청 N/14명" |

**③ 회원 현황** (기본 접힘 — 한 줄 요약: "전체 N명, 이번 달 +N명")

| 지표 | 계산 | 표시 |
|------|------|------|
| 전체 가입자 | COUNT(profiles) | N명 |
| 프로필 완성 | profile_completed_at IS NOT NULL | N명 (00%) |
| 전화번호 등록 | phone IS NOT NULL | N명 (00%) |
| 이번 달 신규 | created_at >= 이번 달 1일 | +N명 |

**④ 주의 필요** (항상 펼침 — 해당 없으면 미표시)

| 항목 | 조건 | 표시 |
|------|------|------|
| 환불 미처리 모임 | meetings.status = 'deleting' | 🔴 "N건 환불 실패 — 재시도 필요" (모임 상세 링크) |
| 공간 미정산 | 이번 달 venue별 모임이 있는데 venue_settlements에 settled_at이 없음 | 🟡 "[공간명] 이번 달 미정산" |

**⑤ 공간 정산 테이블** (작업 5의 venue_settlements 기반)

```
이번 달 공간 정산
┌──────────────┬───────┬──────────┬───────┬───────────┬──────────┐
│     공간     │ 모임수│ 결제 합계 │ 정산율│ 정산 예정액│   상태   │
├──────────────┼───────┼──────────┼───────┼───────────┼──────────┤
│ 우연히 책방   │  4회  │ 400,000원│  80% │ 320,000원 │ [완료]   │
│ 공간 지그시   │  4회  │ 560,000원│  80% │ 448,000원 │ [정산하기]│
└──────────────┴───────┴──────────┴───────┴───────────┴──────────┘
```

#### 데이터 조회 구현

모든 지표는 실시간 쿼리. 250명 규모에서 집계 테이블 불필요.

```typescript
// /admin/page.tsx에서 Promise.all로 병렬 조회
// anon client 사용 (기존 패턴 유지 — RLS가 admin/editor 조회를 허용)
const supabase = await createClient()
const [monthlyRevenue, upcomingMeetings, memberStats, alerts, venueSettlements] = await Promise.all([
  getMonthlyRevenue(supabase, currentMonth, prevMonth),
  getUpcomingMeetings(supabase, kstToday),
  getMemberStats(supabase),
  getAlerts(supabase),
  getVenueSettlements(supabase, currentMonth),  // venue_settlements RLS: is_admin()
])
```

집계 쿼리는 `src/lib/dashboard.ts` (신규)에 분리. admin 페이지에서 import.

**주의:** venue_settlements의 RLS가 `is_admin()`이므로, editor는 정산 테이블을 볼 수 없음. 대시보드에서 정산 섹션(④ 공간 미정산 알림, ⑤ 공간 정산 테이블)은 admin에게만 표시.

**난이도:** 중.

---

### 작업 7. 회원 목록 강화

**목적:** 실명 검색, 전화번호 유무 확인.

**변경 대상:** `src/components/admin/MemberList.tsx`, `src/app/(admin)/admin/members/page.tsx`

#### 목록 화면 개선

| 항목 | 현재 | 변경 |
|------|------|------|
| 검색 | 닉네임만 | + 실명 검색 (닉네임 OR 실명에 포함) |
| 필터 | 없음 (역할별 섹션만) | + 프로필 완성 여부 토글, 전화번호 유무 토글 |
| 표시 정보 | 닉네임, 지역, 역할, ⚠미완성 | + 가입일, 전화번호 유무 아이콘 (📱 or —) |

#### editor 열람 권한

현재 `/admin/members`는 admin만 접근 가능 (`page.tsx`에서 `profile.role !== 'admin'` 체크).

**변경:** editor에게도 열어주되, 민감 정보와 수정 권한 차등:

| 정보 | admin | editor |
|------|:-----:|:------:|
| 실명 + 닉네임 | ✅ | ✅ |
| 지역 | ✅ | ✅ |
| 역할 뱃지 | ✅ | ✅ (변경 불가) |
| 전화번호 | ✅ 전체 표시 | 유무만 (📱/—) |
| 이메일 | ✅ | ❌ 미표시 |
| 역할 변경 버튼 | ✅ | ❌ 미표시 |

**구현:** `page.tsx`에서 role을 `MemberList`에 props로 전달. `MemberList`에서 role에 따라 조건부 렌더링.

**page.tsx 접근 체크 변경:** `profile.role !== 'admin'` → `profile.role !== 'admin' && profile.role !== 'editor'`

**난이도:** 중하.

---

### 작업 8. admin 모임 목록 기간 필터

**목적:** 과거 모임 조회. 별도 화면 없이 기존 목록에 필터만 추가.

**변경 대상:** `src/app/(admin)/admin/page.tsx`

**현재:** `status IN ('active', 'deleting')` 고정 쿼리

**변경:** 기간 필터 탭 추가

```
[ 진행 중 ] [ 지난 달 ] [ 전체 ]
```

| 필터 | 쿼리 조건 |
|------|---------|
| 진행 중 (기본) | status IN ('active', 'deleting') |
| 지난 달 | date >= 지난 달 1일 AND date < 이번 달 1일 (모든 status) |
| 전체 | 전체 (deleted 제외) |

**구현:** URL search params로 필터 상태 관리 (`?filter=active`, `?filter=last-month`, `?filter=all`). Server Component에서 params 읽어서 쿼리 조건 변경.

과거 모임 클릭 → 기존 모임 상세 페이지 → 운영자 관리 섹션에서 신청자/참석 확인 가능. 새 화면 불필요.

**난이도:** 하.

---

## 구현 순서

```
작업 1 (환불 상수 통합) ─┐
작업 2 (지역 상수 통합) ─┤── 리팩토링 (UI 변경 없음, 먼저 정리)
                         │
작업 3 (신청 결제 표시) ─┤── 기존 화면 확장 (빠른 효과)
작업 8 (모임 기간 필터) ─┘
                         │
작업 4 (site_settings)  ─┤── 신규 테이블 + UI (login 리팩토링 포함)
작업 5 (venues + 정산)  ─┘
                         │
작업 6 (대시보드)       ─┤── 작업 4, 5 완료 후 (데이터 기반)
작업 7 (회원 목록 강화) ─┘
```

**신규 생성 파일 예상:**
- `src/lib/regions.ts`
- `src/lib/site-settings.ts`
- `src/lib/dashboard.ts`
- `src/components/LoginClient.tsx`
- `src/app/(admin)/admin/settings/page.tsx`
- `src/app/api/admin/settings/route.ts`
- `src/app/api/admin/venues/route.ts` (공간 생성)
- `src/app/api/admin/venues/[id]/route.ts` (공간 수정)
- `src/app/api/admin/venues/settle/route.ts` (정산 확정)
- `src/types/venue.ts`

**신규 DB 테이블:** site_settings, venues, venue_settlements

**수정 파일 예상:** AdminMeetingSection.tsx, MeetingForm.tsx, MemberList.tsx, admin/page.tsx, admin/members/page.tsx, login/page.tsx, WelcomeScreen.tsx, about/page.tsx, Footer.tsx, privacy/page.tsx, refund/page.tsx, refund.ts, MeetingActionButton.tsx, meeting.ts (type)

---

## Phase 2-3에서 하지 않는 것 (나중에)

| 항목 | 트리거 시점 | 이유 |
|------|-----------|------|
| 회원 상세 페이지 (/admin/members/[id]) | 회원 300+ 또는 Phase 3 착수 시 | 목록 강화만으로 당분간 충분 |
| 정산/결제 상세 화면 (건별 조회) | 출시 후 1개월 | 대시보드 숫자 + 모임별 요약으로 우선 대응 |
| 환불 규칙 DB 관리 | 규칙이 실제로 변경될 때 | 상수 통합으로 충분 |
| 지역 DB 테이블 이관 | 대구 확장 구체화 시 | 상수 통합으로 충분 |
| 관리자 활동 로그 | editor 3명+ 또는 운영 사고 시 | 1~2명 운영 시 불필요 |
| 개인정보 마스킹 (전화번호 중간 4자리) | editor 다수 운영 시 | 현재 editor에게는 유무만 표시로 대응 |
| 알림톡 관리 화면 | Phase 2-1 착수 시 | 알림톡 구현과 동시에 |
| 메인 공지/배너 | 모임 유형 다양화 시 | 정기모임만 있는 지금은 불필요 |
| 쿠폰/할인 | Phase 4 | 과설계 |
| 회원 정지/탈퇴 | 500명+ 또는 분쟁 시 | 카톡으로 직접 처리 |
| 회원 상태 분류 (활성/비활성/신규) | 출시 후 3개월 데이터 쌓인 후 | 분류 기준의 적절성을 실데이터로 검증해야 함 |
| 재참여율 지표 | 대시보드 v2 | 참석 데이터가 충분히 쌓인 후 의미 있음 |
| 노쇼 목록 | Phase 3 (활동 기록/배지) 착수 시 | 참석 체크가 정착된 후 |
| layout.tsx 메타데이터 동적화 | 대구 확장 시 | generateMetadata() 전환 영향 범위가 큼 |

---

## 부록: 시니어 검토 반영 이력 (2026-03-20)

지시서 v1.0 → v1.2 사이의 시니어 검토에서 도출된 13개 의견(A~M)과 처리 결과. 코드 대조 검증 결과 지시서의 모든 사실 주장(파일/라인 번호, 코드 패턴 11건)은 정확.

| # | 의견 | 영역 | 처리 |
|:-:|------|------|------|
| A | Venue CRUD 데이터 접근 방식이 site_settings(API)와 venues(RLS)로 혼재 | 작업 5 | ✅ v1.2 — POST API route로 통일 (`/api/admin/venues`, `/api/admin/venues/[id]`, `/api/admin/venues/settle`) |
| B | 대시보드에서 editor가 venue_settlements `is_admin()` RLS로 차단됨 | 작업 6 | ✅ v1.2 — 정산 섹션은 admin에게만 표시. 대시보드 anon client 명시 |
| C | `kst.ts`에 월 단위 유틸 부재 (`getKSTMonth`, `getMonthRange`) | 작업 6 | — 구현 시 자연 추가 |
| D | login/page.tsx 리팩토링 시 카카오 OAuth 플로우 회귀 위험 | 작업 4 | — 구현 시 수동 테스트 필수 (`window.location.origin`은 LoginClient에서만) |
| E | settlement_rate CHECK가 `none` 타입에도 적용됨 (의미 없는 80) | 작업 5 | — 운영 영향 없음. UI에서 `none` 시 정산율 필드 숨김 권장 |
| F | "전체" 필터에 모임 누적 시 페이징 필요 (1년 후 50~100건) | 작업 8 | — 현재 250명 규모에서 불필요. 추후 트리거 |
| G | editor profiles RLS는 email 필드까지 읽힘 (프론트엔드 마스킹만) | 작업 7 | — 1~2명 editor 규모 충분. "개인정보 마스킹" 트리거 등록 |
| H | `getRefundRuleText()` 짧은 형식 vs 정책 페이지 풍부한 텍스트 매핑 누락 | 작업 1 | ✅ v1.2 — `REFUND_RULES`에 `label`/`rateLabel` 필드 + `REFUND_DEFAULT` 추가 |
| I | "클라이언트에서 계산"은 부정확 — Server Component에서 props 기반 계산 | 작업 3 | ✅ v1.2 — 표현 정정 |
| J | "이번 달 정산" 집계 기준 미명시 (등록일 vs 모임일) | 작업 6 | ✅ v1.2 — 모임일(meetings.date) 기준 JOIN으로 확정 |
| K | 정산 확정 후 환불 차액 처리 메커니즘 없음 | 작업 5 | — 현재 규모(250명)에서는 무시. 발생 시 다음 달 정산에서 구두 조정 |
| L | admin/page.tsx 정보 과밀 (대시보드 + 모임 목록 모바일 한 페이지) | 작업 6 | ✅ v1.2 — 접기/펼치기 구조 (주의필요=항상펼침, 정산/회원=접힘+한줄요약) |
| M | "지난 달"(deleted 포함) vs "전체"(deleted 제외) status 범위 불일치 | 작업 8 | — 의도된 설계 (월별 정산은 삭제 모임 포함, 전체는 가독성 위해 제외) |

원본 검토 의견 13건(A~M) 중 6건이 v1.2에 직접 반영(A·B·H·I·J·L), 나머지 7건은 트리거 조건과 함께 백로그 또는 구현 시 자연 추가(C·D·E·F·G·K·M). 검토의견 별도 파일은 흡수 후 폐기.

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v1.0 | 2026-03-20 | 최초 작성. 하드코딩 분석 + DB 미표시 데이터 + 공간 정산 + 대시보드 설계 통합 |
| v1.1 | 2026-03-20 | 검토 반영: site_settings RLS 수정(SELECT 전체 공개 + INSERT 추가), Client Component settings 접근 방식 명시(login 리팩토링 방법 포함), venue_settlements RLS 추가, venues 관리 UI 추가(설정 페이지 내), 정산 완료 워크플로우 명시(freeze 정책), 신청 테이블 모바일 레이아웃 전략(서브라인 방식), layout.tsx 대상 제외, "나중에" 목록 4건 추가(회원 상태 분류/재참여율/노쇼/layout 동적화), Claude Code 구현 컨텍스트 섹션 추가 |
| v1.2 | 2026-03-20 | 시니어 검토 후 확정 반영: (1) REFUND_RULES에 label/rateLabel 필드 + REFUND_DEFAULT 추가, (2) 정산 집계 기준을 모임일(meetings.date) JOIN으로 확정, (3) Venue CRUD를 POST API route로 통일 + venue ID 동적 라우트, (4) 대시보드 접기/펼치기 구조 확정 (주의필요=항상펼침, 정산/회원=접힘+한줄요약), (5) AdminMeetingSection 데이터 흐름 정정, (6) 대시보드 anon client 사용 + editor 정산 가시성 명시 |
| v1.3 | 2026-04-28 | 검토의견(Phase-2-3-검토의견.md) 흡수 후 별도 파일 폐기. 시니어 검토 반영 이력을 본 문서 부록으로 통합 |
