-- AmplifyHub — baseline schema for the hand-created AI Coach tables.
--
-- WHY THIS EXISTS (audit finding M3 — migration reproducibility):
-- coaching_sessions, coach_messages, and coach_documents were originally
-- created by hand in the Supabase dashboard. 20260711204600_coach_tables_rls.sql
-- documents that gap and only ALTERs them, which means a fresh
-- `supabase db reset` fails the moment it reaches that file. This migration
-- is deliberately timestamped 20260711204500 — sorting just BEFORE the RLS
-- migration — so a fresh database now builds end to end from the repo alone.
--
-- SOURCE OF TRUTH: the column list below is a 1:1 capture of the LIVE
-- production schema (information_schema.columns, captured 2026-07-22 via
-- Supabase Studio). Primary keys are `id` on each table, matching every code
-- path in coach-store.js (insert/update/eq/upsert by id).
--
-- SAFE TO RUN: every statement is idempotent (IF NOT EXISTS). On the
-- already-provisioned production database this whole file is a no-op.
-- Because it sorts before migrations that are already applied remotely,
-- pushing it requires the out-of-order flag:
--
--   supabase db push --linked --include-all
--
-- Note: the legacy, empty `coach_sessions` table that exists remotely is NOT
-- recreated here on purpose — no code references it.

create table if not exists public.coaching_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  title text not null,
  score integer,
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  turns integer not null default 0,
  scenario text,
  persona text,
  difficulty text,
  coach_style text,
  goal text,
  feedback_report jsonb,
  scores jsonb,
  status text default 'active'
);

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  kind text not null default 'text',
  content text not null,
  meta jsonb default '{}'::jsonb,
  ts timestamptz not null default timezone('utc', now())
);

create table if not exists public.coach_documents (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  size integer not null,
  mime text,
  kind text not null,
  extract text,
  added_at timestamptz not null default timezone('utc', now())
);

-- Chat history is always read per session ordered by time
-- (coach-store.js getMessages: eq session_id, order ts). Additive.
create index if not exists coach_messages_session_ts_idx
  on public.coach_messages (session_id, ts);

-- ── VERIFY ─────────────────────────────────────────────────────────────────
-- On a FRESH stack: `supabase db reset` must now run every migration through
-- 20260722160000 without error, and:
--   select table_name, column_name, data_type
--   from information_schema.columns
--   where table_schema='public'
--     and table_name in ('coaching_sessions','coach_messages','coach_documents')
--   order by table_name, ordinal_position;
-- must match the live capture this file was generated from.
--
-- On PRODUCTION: `supabase db push --linked --include-all` reports this
-- migration as applied with zero schema changes.
