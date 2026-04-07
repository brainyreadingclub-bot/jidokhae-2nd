---
name: 서브에이전트 API 연동 크로스체크
description: 서브에이전트가 만든 컴포넌트의 API 요청/응답 필드가 실제 API와 일치하는지 확인 필수
type: feedback
---

서브에이전트가 생성한 클라이언트 컴포넌트가 API를 호출할 때, 응답 필드명이 실제 API와 일치하는지 크로스체크해야 한다.

**Why:** ConfirmTransferButton과 MarkRefundedButton에서 `data.error`를 읽었으나, 실제 API는 `data.message`로 응답. 프로덕션에서 에러 메시지가 항상 기본값으로 표시됨.

**How to apply:** 서브에이전트가 API 호출 컴포넌트를 생성한 후, 해당 API route의 NextResponse.json() 응답 형태와 컴포넌트의 `data.xxx` 접근 필드가 일치하는지 grep으로 확인.
