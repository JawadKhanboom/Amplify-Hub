-- AmplifyHub — contact_messages: make the contact form real.
--
-- WHY THIS EXISTS:
-- contact.html's submit handler previously did preventDefault() and showed
-- "Message sent" without sending anything — every message was silently
-- discarded while the page promised a 24-48h response. This table is the
-- write-only mailbox the form now inserts into.
--
-- SECURITY MODEL — write-only mailbox:
-- - INSERT-only for anon + authenticated. There is deliberately no SELECT/
--   UPDATE/DELETE policy or grant for either role: a visitor can leave a
--   message but nobody can read the mailbox through the Data API. Messages
--   are read by the owner in Supabase Studio (or a future admin surface
--   using service_role, which is granted nothing here and bypasses RLS
--   anyway).
-- - The INSERT policy's WITH CHECK (true) is intentional, not an oversight:
--   this is a public contact form with no ownership column, so there is no
--   auth.uid() to bind. Abuse containment comes from the CHECK constraints
--   (length caps), the client-side honeypot, and PostgREST/auth rate limits.
-- - Exact least privilege (same pattern as resource_catalog and
--   user_lesson_progress): revoke everything first — including the
--   REFERENCES/TRIGGER/TRUNCATE privileges this project grants to PUBLIC by
--   default on new tables — then grant back only INSERT.
--
-- SAFE TO RUN: idempotent — create if not exists + drop-and-recreate policy.

create extension if not exists pgcrypto;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254 and position('@' in email) > 1),
  subject text not null default '' check (char_length(subject) <= 200),
  message text not null check (char_length(btrim(message)) between 10 and 4000),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

drop policy if exists "Anyone can leave a message" on public.contact_messages;
create policy "Anyone can leave a message" on public.contact_messages
  for insert to anon, authenticated
  with check (true);

revoke all privileges on public.contact_messages from public, anon, authenticated, service_role;
grant insert on public.contact_messages to anon, authenticated;

-- ── VERIFY ─────────────────────────────────────────────────────────────────
-- Grants: expect exactly anon/INSERT and authenticated/INSERT, nothing else.
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'contact_messages'
--   order by grantee, privilege_type;
-- RLS: expect true.
--   select relrowsecurity from pg_class where relname = 'contact_messages';
-- API behavior: an anon INSERT with valid lengths succeeds (201); any anon
-- SELECT fails with permission denied (42501) before RLS is even evaluated.
