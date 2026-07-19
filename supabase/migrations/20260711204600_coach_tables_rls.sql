-- AmplifyHub — Row-Level Security for the AI Coach tables
--
-- WHY THIS EXISTS:
-- coach-store.js reads/writes coaching_sessions, coach_messages, and
-- coach_documents DIRECTLY from the browser using the public anon key, and
-- does NOT filter those queries by user_id client-side. Without RLS, any
-- logged-in user could read or modify every other user's sessions,
-- messages, and documents. user_preferences already has RLS (see the prior
-- migration); this closes the gap for the other three tables.
--
-- NOTE: this migration assumes coaching_sessions, coach_messages, and
-- coach_documents already exist. They were created by hand in the Supabase
-- dashboard (Table Editor) rather than via a tracked migration, so this file
-- only adds RLS to them — it does not define their columns. If you ever
-- rebuild this project from scratch, you'll need to recreate those three
-- tables' schemas before this migration will apply cleanly.
--
-- SAFE TO RUN: it does not create or drop tables and does not touch data.
-- It only (a) turns RLS on and (b) (re)creates an owner-only access policy.
-- Every statement is idempotent — running it twice is harmless.

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

-- ── VERIFY ─────────────────────────────────────────────────────────────────
-- After applying, confirm every table below shows rowsecurity = true:
--
--   select tablename, rowsecurity
--   from pg_tables
--   where schemaname = 'public'
--     and tablename in ('coaching_sessions','coach_messages',
--                       'coach_documents','user_preferences');
