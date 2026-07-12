-- ============================================================================
-- AmplifyHub — coaching_sessions metadata columns
-- Run this ONCE in Supabase → SQL Editor, BEFORE using the updated
-- coach-store.js (which now writes these columns).
--
-- WHY: the roleplay flow saves scenario/persona/difficulty/goal/status when a
-- session starts, and the end-of-session flow saves the feedback report and
-- per-skill scores. The Progress page ("View Report") and the feedback grader
-- read them back. Until these columns exist, that data was silently dropped.
--
-- SAFE TO RUN: only ADDs nullable columns (idempotent via IF NOT EXISTS).
-- No data is touched; existing rows simply have NULL for the new columns.
-- ============================================================================

alter table public.coaching_sessions
  add column if not exists scenario        text,
  add column if not exists persona         text,
  add column if not exists difficulty      text,
  add column if not exists coach_style     text,
  add column if not exists goal            text,
  add column if not exists status          text,
  add column if not exists feedback_report jsonb,
  add column if not exists scores          jsonb;

-- ── VERIFY ─────────────────────────────────────────────────────────────────
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'coaching_sessions'
-- order by ordinal_position;
