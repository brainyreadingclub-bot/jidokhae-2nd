-- ============================================================
-- 롤백 — migration-topics-publish-button.sql 되돌리기
-- ============================================================
--
-- 🔴 코드를 먼저 되돌린다(git revert). 그다음 아래를 **상황을 보고** 고른다.
--   대부분은 SQL을 하나도 안 돌려도 된다 — 이 파일은 「무엇을 되돌릴 필요가 없는지」를 적어 둔 것이기도 하다.
--
-- 🔴 코드를 옛 화면(main)으로 되돌리기 **전에** 작성 중 발제부터 처리한다.
--   옛 화면은 published_at을 모르고 **전부 회원에게 보여 준다.** 공개하지 않은 작성 중 발제가
--   되돌리는 순간 회원에게 그대로 나간다(알림은 안 간다). 먼저 확인하고, 내보내면 안 되는 것은
--   발제문 관리 화면에서 지우거나 「발제 공개하기」로 공개해 둔다.
SELECT t.id, m.title AS meeting_title, t.topic_no, t.title,
       t.created_at AT TIME ZONE 'Asia/Seoul' AS created_kst
  FROM public.discussion_topics t
  JOIN public.meetings m ON m.id = t.meeting_id
 WHERE t.published_at IS NULL
 ORDER BY t.created_at;


-- ── B 되돌리기: 하지 않는다 ──
--   B는 「옛 화면으로 등록해 이미 회원에게 보였던 발제」의 published_at을 채운 것이다.
--   되돌려 비우면 새 코드에서는 그 발제가 숨고, 옛 코드에서는 원래부터 보인다 — 어느 쪽도 이득이 없다.


-- ── C 되돌리기: 보통 하지 않는다 ──
--   앱은 discussion_topics를 service_role로만 읽어 이 정책을 안 탄다(main 포함). 좁힌 채 둬도
--   옛 화면·새 화면 모두 그대로 동작하고, 풀면 작성 중이 anon 키로 읽힌다.
--   굳이 되돌려야 하면(정책 때문이라고 확인된 오류가 있을 때만) 아래 주석을 풀어 실행한다.
-- DROP POLICY IF EXISTS "topics readable by authenticated" ON public.discussion_topics;
-- CREATE POLICY "topics readable by authenticated"
--   ON public.discussion_topics FOR SELECT TO authenticated USING (true);


-- ── A 되돌리기: 10분 묶음 알림 방식(a0f007d)으로 돌아갈 때만 ──
--   main(옛 화면)으로 돌아가는 경우에는 **다시 켜지 않는다** — 옛 화면은 1건마다 바로 알림을 보내고
--   published_at을 안 채우므로 예약 작업이 할 일이 없다.
--   「등록 = 바로 공개 + 10분 묶음」 코드로 돌아갈 때만 migration-topics-notify.sql의 ③(함수)과
--   ④(예약 작업)를 그 파일에서 **각각 따로** 다시 실행한다. 여기 복사하지 않는다(두 곳에 두면 한쪽만 고쳐진다).
