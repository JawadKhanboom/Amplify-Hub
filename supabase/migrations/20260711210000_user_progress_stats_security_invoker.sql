-- AmplifyHub — make user_progress_stats honor caller RLS (if it's a view)
--
-- WHY: coach-store.js reads user_progress_stats filtered by .eq('user_id',
-- uid), but that filter is client-side only. If user_progress_stats is a
-- Postgres VIEW aggregating coaching_sessions, it runs with the VIEW
-- OWNER's privileges by default and can BYPASS the RLS added in the
-- coach_tables_rls migration — exposing every user's stats to every other
-- user regardless of the .eq() filter.
--
-- This migration is a no-op if user_progress_stats is a table rather than a
-- view (guarded below), so it's safe to apply either way.

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_progress_stats'
      and c.relkind in ('v', 'm') -- ordinary view or materialized view
  ) then
    execute 'alter view public.user_progress_stats set (security_invoker = true)';
  end if;
end $$;

-- ── VERIFY ─────────────────────────────────────────────────────────────────
-- select relname, reloptions
-- from pg_class
-- where relname = 'user_progress_stats';
-- -- reloptions should include security_invoker=true if it's a view.
