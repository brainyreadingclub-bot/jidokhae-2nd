---
name: 카카오톡 인앱 / 외부 브라우저 / 하이드레이션
description: 카카오톡 인앱에서 OAuth/결제는 정상 동작하므로 건드리지 말 것. "외부 브라우저로 유도" 패턴은 세션이 끊겨 최악의 UX. Client Component에서 navigator 접근은 하이드레이션 불일치 유발
type: feedback
---

세 가지 모바일 환경 함정 — 각각이 별개의 함정이지만 한 세션(2026-03-18)에서 동시에 만났음.

**Rule 1 — 카카오톡 인앱 브라우저 OAuth/결제는 정상이므로 건드리지 말 것.**

**Why:**
M6 WP6-1 모바일 호환성 검토 중 "카카오톡 인앱 → 카카오 OAuth 안 될 거다", "결제 리다이렉트 실패할 거다"라는 가정으로 "외부 브라우저에서 열기" 배너 + "외부 브라우저에서 결제하기" 버튼을 추가했다가 전부 롤백. 카카오 OAuth는 카카오톡 자체 브라우저이니 오히려 잘 됨. 결제는 이미 TossPayments Webhook 백업이 있어 redirect 실패 시에도 처리됨.

**How to apply:**
- 카카오톡 인앱 분기 코드 추가 전에 실제 동작을 한 번 확인할 것
- 기존 코드에 이미 대응 메커니즘(Webhook, 멱등성 등)이 있는지 먼저 확인할 것
- "이론적 위험" 대응을 추가하면서 멀쩡한 흐름을 깨지 않도록

---

**Rule 2 — "외부 브라우저로 유도" 패턴 금지 — 세션이 끊긴다.**

**Why:**
"외부 브라우저에서 결제하기" 버튼을 추가했다가, 외부 브라우저에는 로그인 세션이 없어 로그인부터 다시 시작해야 함을 깨달았다. 인앱에서 외부로 보내는 순간 OAuth 쿠키 컨텍스트가 사라진다.

**How to apply:**
- 모바일 인앱 → 외부 브라우저 유도 패턴은 결제·로그인이 필요한 어떤 흐름에도 쓰지 말 것
- 인앱 한계가 의심되면 인앱 안에서 해결 가능한지 먼저 검토 (대부분 가능)

---

**Rule 3 — Client Component에서 `navigator`/`window` 접근은 하이드레이션 불일치 유발.**

**Why:**
카카오톡 인앱 감지 로직 (`navigator.userAgent.includes('KAKAOTALK')`)을 Client Component에 넣었더니 서버 렌더링(navigator 없음 → false) vs 클라이언트(카카오톡 → true) 결과가 달라 React 하이드레이션 경고가 떴다.

**How to apply:**
- Client Component(`'use client'`) 안에서 `navigator`/`window` 직접 접근 시 `useEffect`로 감싸 클라이언트 전용으로 만들 것
- 서버에서도 의미 있는 기본값을 가지도록 코드 작성. 서버 false / 클라이언트 true의 자연스러운 분기는 `useState(false) + useEffect(() => set(true))` 패턴
