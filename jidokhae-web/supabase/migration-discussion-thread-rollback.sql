-- migration-discussion-thread-rollback.sql
drop table if exists public.app_notifications;
drop table if exists public.answer_reactions;
drop table if exists public.answer_replies;
drop table if exists public.topic_answers;
drop table if exists public.discussion_topics;
drop function if exists public.is_curator();
