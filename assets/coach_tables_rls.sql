-- ============================================================================
-- AmplifyHub — Row-Level Security for the AI Coach tables
-- Run this ONCE in Supabase → SQL Editor.
--
-- WHY THIS EXISTS:
-- coach-store.js reads/writes these tables DIRECTLY from the browser using the
-- public anon key. Without RLS, any logged-in user could read or modify every
-- other user's sessions, messages, and documents. user_preferences already has
-- RLS (assets/user_preferences.sql); these three tables did not have a
-- committed policy file. This closes that gap.
--
-- SAFE TO RUN: it does not create or drop tables and does not touch data.
-- It only (a) turns RLS on and (b) (re)creates an owner-only access policy.
-- Every statement is idempotent — running it twice is harmless.
-- ============================================================================

-- ── coaching_sessions ──────────────────────────────────────────────────────
alter table public.coaching_sessions enable row level security;

drop policy if exists "Users manage own coaching sessions" on public.coaching_sessions;
create policy "Users manage own coaching sessions"
  on public.coaching_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── coach_messages ─────────────────────────────────────────────────────────
alter table public.coach_messages enable row level security;

drop policy if exists "Users manage own coach messages" on public.coach_messages;
create policy "Users manage own coach messages"
  on public.coach_messages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── coach_documents ────────────────────────────────────────────────────────
alter table public.coach_documents enable row level security;

drop policy if exists "Users manage own coach documents" on public.coach_documents;
create policy "Users manage own coach documents"
  on public.coach_documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── user_progress_stats (VIEW) ─────────────────────────────────────────────
-- coach-store.js reads this with .eq('user_id', uid). If it is a VIEW that
-- aggregates coaching_sessions, note that a Postgres view runs with the
-- VIEW OWNER's privileges by default and can therefore BYPASS the RLS above,
-- potentially exposing stats computed across ALL users' rows. On Postgres 15+
-- make the view honour the caller's RLS instead:
--
--   alter view public.user_progress_stats set (security_invoker = true);
--
-- (Left commented because it errors if the object is a table, not a view.
--  Uncomment and run only if user_progress_stats is a view.)

-- ── VERIFY ─────────────────────────────────────────────────────────────────
-- After running, confirm every table below shows rowsecurity = true:
--
--   select tablename, rowsecurity
--   from pg_tables
--   where schemaname = 'public'
--     and tablename in ('coaching_sessions','coach_messages',
--                       'coach_documents','user_preferences');
