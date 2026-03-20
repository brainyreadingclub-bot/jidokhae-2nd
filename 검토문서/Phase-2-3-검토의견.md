# Phase 2-3 백오피스 지시서 — 시니어 검토 의견

> 검토일: 2026-03-20
> 검토 방법: 지시서에서 언급하는 모든 파일/라인을 실제 코드와 대조 검증

---

## 총평

**지시서 완성도: 높음.** 현재 코드 상태를 정확히 분석하고, 구현 순서와 난이도를 현실적으로 구분했습니다. "나중에" 목록도 명확한 트리거 조건이 있어 scope creep을 방지합니다. 아래는 실제 구현 시 주의할 점과 보완 제안입니다.

---

## 1. 코드 대조 검증 결과 (모두 정확)

| 지시서 주장 | 실제 코드 | 판정 |
|-----------|----------|------|
| 환불 규칙 3곳 분산 | `refund.ts:37-43`, `MeetingActionButton.tsx:273`, `refund/page.tsx:41-50` 모두 확인 | ✅ |
| 지역 상수 2곳 분산 | `ProfileSetup.tsx:21`, `profile/setup/route.ts:66` 동일 배열 확인 | ✅ |
| 신청자 테이블이 `*`로 쿼리하나 금액 미표시 | 부모 `meetings/[id]/page.tsx:119`에서 `.select('*, profiles(...)')` 후 props 전달. paid_amount 등 미표시 | ✅ |
| login/page.tsx가 전체 `'use client'` | 1행 `'use client'` 확인. useState, 브라우저 API 사용 | ✅ |
| 하드코딩 위치 7개 파일 | 모든 파일/라인 번호 정확 | ✅ |
| admin/page.tsx 쿼리 조건 | `.in('status', ['active', 'deleting'])` 확인 | ✅ |
| members/page.tsx admin-only | `profile.role !== 'admin'` 확인 | ✅ |
| MeetingForm 장소가 텍스트 인풋 | `<input type="text">` 확인 (158-167행) | ✅ |
| Meeting 타입에 venue_id 없음 | `types/meeting.ts` 확인 — location: string만 존재 | ✅ |
| Registration 타입에 paid_amount 등 있음 | `types/registration.ts` 확인 — paid_amount, refunded_amount, cancel_type 모두 존재 | ✅ |

---

## 2. 검토 의견 — 구현 시 주의사항

### 의견 A: 작업 5 — Venue CRUD API 엔드포인트 미정의 (보완 필요)

**현상:** site_settings는 `/api/admin/settings` API route를 명시적으로 정의하고 있으나, venue CRUD(추가/수정/비활성화)의 데이터 접근 방식이 정의되어 있지 않습니다.

**선택지 2가지:**
1. **브라우저 Supabase client + RLS** (MeetingForm 패턴) — venues RLS가 admin INSERT/UPDATE를 허용하므로 가능. 별도 API route 불필요.
2. **API route** (site_settings 패턴) — `/api/admin/venues` 엔드포인트 추가.

**권장:** MeetingForm과 동일한 패턴(브라우저 client + RLS)이 기존 코드와 일관성이 높음. 다만, 설정 페이지(`/admin/settings`) 안에서 site_settings는 API, venues는 RLS로 접근하면 한 페이지 내 두 가지 패턴이 혼재합니다.

**제안:** 둘 다 API route로 통일하거나, 둘 다 RLS 직접 접근으로 통일하는 것이 유지보수에 유리합니다. site_settings의 `is_admin()` RLS INSERT/UPDATE가 있으므로 브라우저 client로도 충분합니다.

---

### 의견 B: 작업 6 — 대시보드 데이터 접근 패턴 불일치

**현상:** 코드 예시에서 `adminSupabase` (service_role)를 사용하지만, 현재 `admin/page.tsx`는 `createClient()` (anon key)를 사용합니다.

**분석:**
- registrations: `is_editor_or_admin()` RLS로 admin/editor가 전체 조회 가능 → anon OK
- profiles: `is_editor_or_admin()` RLS로 admin/editor가 전체 조회 가능 → anon OK
- meetings: SELECT는 전체 공개 → anon OK
- venues: SELECT는 전체 공개 → anon OK
- venue_settlements: `is_admin()` RLS → anon OK (admin 인증 상태에서)

**결론:** 모든 대시보드 쿼리는 anon client로 충분합니다. 기존 패턴(Server Component = anon)을 유지하는 것이 일관성에 좋습니다.

**단, 주의점:** editor가 admin 페이지에 접근할 수 있으므로(layout 허용), venue_settlements의 `is_admin()` RLS 때문에 editor는 정산 데이터를 볼 수 없습니다. 대시보드에서 정산 섹션을 admin에게만 표시하거나, venue_settlements RLS를 `is_editor_or_admin()`으로 변경해야 합니다.

---

### 의견 C: 작업 6 — KST 월 단위 유틸리티 부재

**현상:** 대시보드에서 "이번 달", "지난 달" 경계를 빈번히 사용하지만, 현재 `kst.ts`에는 월 단위 함수가 없습니다.

**제안:** `kst.ts`에 다음 유틸리티 추가 필요:

```typescript
// "YYYY-MM" 형식의 현재 KST 월
export function getKSTMonth(): string

// 주어진 월의 시작일/종료일 ("YYYY-MM-DD")
export function getMonthRange(month: string): { start: string; end: string }
```

이건 작업 6 구현 시 자연스럽게 추가되겠지만, 미리 인지하면 좋습니다.

---

### 의견 D: 작업 4 — login/page.tsx 리팩토링 위험

**현상:** login/page.tsx는 카카오 OAuth 초기화(`supabase.auth.signInWithOAuth`), 에러 핸들링, 로딩 상태 관리를 포함합니다. `window.location.origin` 참조도 있어 반드시 Client Component여야 합니다.

**주의점:**
- 분리 후에도 `window.location.origin`은 Client Component에서만 접근 가능 → LoginClient에서 처리해야 함
- `useSearchParams()`를 쓰지 않으므로 분리 자체는 직관적
- 카카오 로그인 후 `/auth/callback` → 홈으로 리다이렉트하는 기존 플로우에 영향이 없는지 확인 필요
- 분리 후 Server Component wrapper가 인증 상태 체크를 추가해야 하는지 검토 (현재는 middleware가 담당)

**결론:** 리팩토링 난이도는 낮지만, 기존 인증 플로우가 깨지지 않도록 수동 테스트 필수.

---

### 의견 E: 작업 5 — settlement_rate CHECK 제약 범위

**사소한 사항.** `settlement_rate CHECK (0-100)`이 모든 settlement_type에 적용됩니다. `none` 타입에서도 기본값 80이 저장되는데, 의미 없는 데이터가 됩니다.

운영에 실질적 문제는 없으나, `none` 타입 생성 시 UI에서 정산율 필드를 숨기면 기본값 80이 들어갑니다. 대시보드에서 `none` 공간의 정산율을 표시할 때 혼란이 없도록 `settlement_type`이 `none`이면 정산 관련 컬럼을 표시하지 않아야 합니다.

---

### 의견 F: 작업 8 — "전체" 필터 장기 관점

현재 meetings 상태는 `active | deleting | deleted` 3종류뿐입니다. 모임 날짜가 지나도 `active` 상태로 유지됩니다.

"전체 (deleted 제외)"는 active + deleting인데, 모임이 누적되면 목록이 길어집니다. 당장은 250명 규모에서 문제없지만, 1년 후에는 50-100개 모임이 쌓일 수 있습니다. 페이징이 필요해질 수 있으나, Phase 2-3 범위에서는 불필요합니다.

---

### 의견 G: 작업 7 — editor의 profiles RLS와 이메일 접근

지시서에서 editor에게 이메일을 미표시한다고 했지만, RLS 레벨에서 editor가 profiles의 email 필드에 접근할 수 있는지 확인이 필요합니다.

현재 `profiles_select_by_editor_admin` RLS가 `is_editor_or_admin()`이면 profiles 전체 필드를 읽을 수 있습니다. 즉, RLS 레벨이 아닌 **프론트엔드 레벨**에서 이메일을 숨기는 것입니다. 현재 1-2명 editor 규모에서는 충분하지만, "나중에" 목록의 "개인정보 마스킹" 트리거(editor 다수)와 연결됩니다.

---

### 의견 H: 작업 1 — REFUND_RULES로 정책 페이지 테이블 생성 시 텍스트 매핑 문제

**현상:** `getRefundRuleText()`는 짧은 형식 `"3일 전: 100% · 2일 전: 50% · 전날/당일: 0%"`을 생성합니다. 이건 MeetingActionButton.tsx의 취소 모달에 적합합니다.

그러나 `refund/page.tsx`의 테이블은 더 풍부한 텍스트를 사용합니다:
- "모임 3일 전**까지**" (vs "3일 전")
- "참가비 100% **환불**" (vs "100%")
- "환불 없음 **(취소는 가능)**" (vs "0%")

`REFUND_RULES` 상수에 `daysBeforeMeeting`과 `rate`만 있으면 정책 페이지의 풍부한 텍스트를 자동 생성하기 어렵습니다.

**제안:** `REFUND_RULES`에 라벨 필드를 추가하거나, 정책 페이지용 별도 렌더링 함수를 만들어야 합니다:

```typescript
export const REFUND_RULES = [
  { daysBeforeMeeting: 3, rate: 100, periodLabel: '모임 3일 전까지', resultLabel: '참가비 100% 환불' },
  { daysBeforeMeeting: 2, rate: 50, periodLabel: '모임 2일 전', resultLabel: '참가비 50% 환불' },
] as const
// + 별도 "모임 전일 · 당일" / "환불 없음 (취소는 가능)" 처리
```

이 부분이 설계에서 빠져있어, 구현 시 결정이 필요합니다.

---

### 의견 I: 작업 3 — AdminMeetingSection의 데이터 흐름 정정

**지시서 표현:** "요약 카드의 데이터는 `registrations` 배열에서 **클라이언트에서** 계산"

**실제:** AdminMeetingSection은 **Server Component**입니다. 데이터를 직접 쿼리하지 않고, 부모 페이지(`meetings/[id]/page.tsx:119-125`)에서 `.select('*, profiles(nickname, real_name)')` 쿼리 후 props로 전달받습니다.

"클라이언트에서 계산"이 아닌 "**서버 컴포넌트에서 props 기반 계산**"이 정확합니다. 구현에는 영향 없지만, 혼선 방지를 위해 수정하면 좋겠습니다.

---

### 의견 J: 작업 6 — "이번 달 정산" 집계 기준 미명시 (중요)

**현상:** 대시보드의 "총 결제" 지표가 `SUM(paid_amount) WHERE 이번 달 + confirmed`인데, **"이번 달"의 기준**이 명시되어 있지 않습니다.

**선택지:**
1. **등록일(registrations.created_at) 기준** — 결제가 발생한 시점
2. **모임일(meetings.date) 기준** — 해당 모임이 속한 달

**정산 목적이라면 모임일 기준이 맞습니다.** 3월 모임에 2월 말에 결제한 건은 3월 정산에 포함되어야 합니다.

**구현 영향:** registrations 테이블에 meeting_id는 있지만 meeting date는 없으므로, **meetings JOIN이 필수**입니다. 이는 `dashboard.ts`의 쿼리 복잡도에 영향을 줍니다:

```typescript
// meetings.date 기준이면 JOIN 필요
supabase
  .from('registrations')
  .select('paid_amount, meetings!inner(date)')
  .eq('status', 'confirmed')
  .gte('meetings.date', monthStart)
  .lt('meetings.date', monthEnd)
```

---

### 의견 K: 작업 5 — 정산 확정 후 환불 차액 처리 메커니즘 부재

**지시서:** "한 번 확정된 숫자는 변경 불가. 이후 환불이 발생해도 이미 정산된 달은 안 바뀜. **차액은 다음 달 정산에 반영.**"

**문제:** "다음 달 정산에 반영"의 구체적 메커니즘이 없습니다.

예시: 3월 정산을 확정한 후, 4월에 3월 모임에 대한 환불이 발생했다면:
- 4월 정산 = 4월 모임의 결제 합계 (모임일 기준)
- 3월 환불은 4월 모임이 아니므로 **자동으로 반영되지 않음**

이를 해결하려면:
1. **수동 조정** — admin이 정산 시 수동으로 차감 (현재 설계에서 가장 현실적)
2. **adjustment 필드 추가** — venue_settlements에 `adjustment_amount` 컬럼
3. **무시** — 250명 규모에서 정산 후 환불은 극히 드물어 실무적으로 문제없음

**권장:** 현재 규모에서는 3번(무시)이 적절. 발생 시 다음 달 정산에서 구두로 조정. Phase 2-3 범위에서 별도 구현 불필요.

---

### 의견 L: 작업 6 — admin/page.tsx 정보 과밀 우려

**현상:** Phase 2-3 이후 admin/page.tsx에 들어갈 내용:
1. 대시보드 카드 5개 (정산, 다가오는 모임, 회원 현황, 주의 필요, 공간 정산 테이블)
2. 네비게이션 링크 (회원 관리, 사이트 설정)
3. 기간 필터 탭 (진행 중/지난 달/전체)
4. 모임 목록

모바일 화면(max-w-screen-sm ≈ 640px)에서 대시보드 카드만으로 2-3 스크롤이 필요할 수 있습니다. 운영자의 **주된 작업**(모임 관리)이 스크롤 아래로 밀립니다.

**대안 검토:** 대시보드를 접을 수 있는 아코디언으로 만들거나, 별도 `/admin/dashboard` 페이지로 분리. 단, 현재 규모에서는 한 페이지가 더 편리할 수 있으므로, 구현 후 사용성을 보고 판단해도 됩니다.

---

### 의견 M: 작업 8 — "지난 달" vs "전체" 필터의 status 포함 범위 불일치

**지시서:**
- 지난 달: `date >= 지난 달 1일 AND date < 이번 달 1일` **(모든 status)**
- 전체: 전체 **(deleted 제외)**

"지난 달"은 deleted를 포함하고, "전체"는 deleted를 제외합니다. 이유가 명시되어 있지 않습니다.

**추정:** 지난 달은 월별 정산/리뷰 용도로 삭제된 모임도 포함해야 하고, "전체"는 목록이 길어지지 않도록 삭제된 모임을 제외한 것일 수 있습니다.

의도된 설계라면 OK. 구현 시 혼동하지 않도록 주석으로 명시하면 좋겠습니다.

---

## 3. 구현 순서에 대한 의견

지시서의 순서가 합리적입니다:
1. **작업 1,2** (상수 통합) — 기존 동작 변경 없이 코드 정리. 이후 작업의 기반.
2. **작업 3,8** (기존 화면 확장) — DB 변경 없이 빠른 효과.
3. **작업 4,5** (신규 테이블) — DB 마이그레이션 필요. 코드 확정 후 SQL 안내 (프로젝트 규칙).
4. **작업 6,7** (대시보드+회원강화) — 작업 4,5의 데이터에 의존.

**추가 제안:** 작업 4와 5는 각각 독립된 DB 마이그레이션이므로, SQL을 한 번에 묶어 안내하는 것이 사용자 부담을 줄입니다. 작업 4 코드 + 작업 5 코드 모두 완성 후 → 마이그레이션 SQL 통합 전달.

---

## 4. 누락 및 미결정 사항 요약

| # | 항목 | 관련 의견 | 심각도 | 상태 |
|---|------|----------|--------|:----:|
| 1 | Venue CRUD API 접근 방식 미정의 | A | 중 | ✅ 확정 — POST API route 통일 |
| 2 | "이번 달 정산" 집계 기준 (등록일 vs 모임일) | J | 중 | ✅ 확정 — 모임일 기준 JOIN |
| 3 | REFUND_RULES → 정책 페이지 텍스트 매핑 | H | 중 | ✅ 확정 — label/rateLabel + REFUND_DEFAULT |
| 4 | admin/page.tsx 정보 과밀 | L | 중 | ✅ 확정 — 접기/펼치기 구조 |
| 5 | login 리팩토링 후 수동 테스트 | D | 중 | — (구현 시) |
| 6 | 대시보드 editor 정산 가시성 | B | 하 | ✅ 지시서 반영 — admin만 표시 |
| 7 | kst.ts 월 단위 유틸 | C | 하 | — (구현 시 자연 추가) |
| 8 | 정산 후 환불 차액 처리 | K | 하 | — (현재 규모 무시 가능) |
| 9 | 필터 status 포함 범위 불일치 | M | 하 | — (의도 확인만) |

---

## 5. 결론

지시서는 **구현 준비 완료** 상태입니다. 주요 미결정 사항 4건이 모두 확정되어 지시서 v1.2에 반영 완료.

남은 구현 시 주의사항:
- login/page.tsx 리팩토링 후 카카오 OAuth 플로우 수동 테스트 필수 (의견 D)
- kst.ts에 월 단위 유틸 추가 필요 (의견 C — 작업 6 구현 시 자연 추가)
- 정산 후 환불 차액은 현재 규모에서 무시 가능 (의견 K)
