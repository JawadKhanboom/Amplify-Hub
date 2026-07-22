-- AmplifyHub — owner-approved database cleanup and grant harmonization.
--
-- Three changes, each verified against the live-state capture of 2026-07-22
-- (Studio, read-only) and explicitly approved by the project owner:
--
--   1. DROP the legacy, EMPTY public.coach_sessions table (guarded).
--   2. Consolidate the duplicate owner-scoped RLS policies on the coach
--      tables into ONE canonical policy each, using the recommended
--      (select auth.uid()) form (initPlan-cached, faster at scale).
--   3. Exact least-privilege grants on the older tables, matching the
--      pattern already applied to resource_catalog, user_lesson_progress,
--      and contact_messages — stripping the legacy default REFERENCES/
--      TRIGGER/TRUNCATE(/everything-for-anon) privileges the audit flagged.
--
-- WHAT THIS DOES NOT TOUCH:
--   - public.coaching_sessions — the REAL sessions table (has live rows).
--     Only its duplicate policy and grants are tidied; data and access are
--     preserved for the row owner exactly as before.
--   - resource_catalog, user_lesson_progress, contact_messages — already
--     exact-least-privilege from their own migrations.
--   - The security-definer challenge/quota functions: they run as their
--     owner, so role grants below don't affect them.
--
-- SAFE TO RUN: idempotent; policy drop+recreate is atomic per statement;
-- revoke/grant are repeat-safe. On a FRESH database (db reset) the guarded
-- drop is skipped (table never exists there) and everything else applies
-- identically, so local and production converge on the same end state.

-- ── 1. Legacy table: drop ONLY if it exists and is empty ───────────────────
-- public.coach_sessions is a hand-created leftover superseded by
-- coaching_sessions. Live check 2026-07-22: RLS on, owner-scoped policy,
-- 0 rows, zero code references. The guard makes this migration refuse to
-- run rather than ever drop a table that unexpectedly gained data.
do $$
declare
  v_rows integer;
begin
  if to_regclass('public.coach_sessions') is not null then
    execute 'select count(*) from public.coach_sessions' into v_rows;
    if v_rows = 0 then
      execute 'drop table public.coach_sessions';
    else
      raise exception 'public.coach_sessions unexpectedly contains % row(s) — refusing to drop. Investigate before re-running.', v_rows;
    end if;
  end if;
end $$;

-- ── 2. One canonical owner policy per coach table ──────────────────────────
-- The live DB carried TWO equivalent ALL policies per table (a migration-
-- created `auth.uid() = user_id` one and a dashboard-created
-- `(select auth.uid()) = user_id` one). Both are dropped and a single
-- canonical policy is recreated so fresh databases and production end up
-- byte-identical. Access semantics are unchanged: owner-only, all commands.

drop policy if exists "Users manage own coaching sessions" on public.coaching_sessions;
drop policy if exists "Users can manage their own sessions" on public.coaching_sessions;
create policy "Users manage own coaching sessions" on public.coaching_sessions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own coach messages" on public.coach_messages;
drop policy if exists "Users can manage their own messages" on public.coach_messages;
create policy "Users manage own coach messages" on public.coach_messages
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own coach documents" on public.coach_documents;
drop policy if exists "Users can manage their own documents" on public.coach_documents;
create policy "Users manage own coach documents" on public.coach_documents
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ── 3. Exact least-privilege grants ────────────────────────────────────────
-- Postgres checks table GRANTs before RLS is ever evaluated (see
-- 20260721140000_grant_user_lesson_progress_privileges.sql for the full
-- explanation). RLS already neutralized the legacy broad grants, but the
-- grant matrix should MATCH intent, not merely be neutralized.
--
-- Per-table intent, from real code paths:
--   coach tables      → authenticated CRUD on own rows (coach-store.js);
--                       cascade cleanup runs via FK, needs no grant.
--   user_preferences  → authenticated select/upsert (settings, CoachStore).
--   user_progress_stats (VIEW, security_invoker) → authenticated SELECT only.
--   challenge_catalog / user_challenge_* → authenticated SELECT only; every
--                       write goes through the security-definer RPCs.
--   service_role      → nothing: no server-side code queries these directly
--                       (delete-account uses the Auth admin API + cascades).

revoke all privileges on public.coaching_sessions from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.coaching_sessions to authenticated;

revoke all privileges on public.coach_messages from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.coach_messages to authenticated;

revoke all privileges on public.coach_documents from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.coach_documents to authenticated;

revoke all privileges on public.user_preferences from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.user_preferences to authenticated;

revoke all privileges on public.user_progress_stats from public, anon, authenticated, service_role;
grant select on public.user_progress_stats to authenticated;

revoke all privileges on public.challenge_catalog from public, anon, authenticated, service_role;
grant select on public.challenge_catalog to authenticated;

revoke all privileges on public.user_challenge_assignments from public, anon, authenticated, service_role;
grant select on public.user_challenge_assignments to authenticated;

revoke all privileges on public.user_challenge_feedback from public, anon, authenticated, service_role;
grant select on public.user_challenge_feedback to authenticated;

-- ── VERIFY ─────────────────────────────────────────────────────────────────
-- 1. Legacy table gone:
--    select to_regclass('public.coach_sessions');            -- expect NULL
-- 2. Exactly one policy per coach table, using (select auth.uid()):
--    select tablename, policyname, cmd from pg_policies
--    where schemaname='public'
--      and tablename in ('coaching_sessions','coach_messages','coach_documents');
-- 3. Grants match intent (no anon rows at all for these tables):
--    select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type)
--    from information_schema.role_table_grants
--    where table_schema='public' and grantee in ('anon','authenticated','service_role','PUBLIC')
--      and table_name in ('coaching_sessions','coach_messages','coach_documents',
--                         'user_preferences','user_progress_stats','challenge_catalog',
--                         'user_challenge_assignments','user_challenge_feedback')
--    group by 1,2 order by 1,2;
-- 4. App still works signed in: dashboard loads sessions, coach chat sends,
--    settings save, challenges load. Signed out: everything above 401s/empty.
