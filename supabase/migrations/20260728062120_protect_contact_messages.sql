-- Route public contact submissions through the Turnstile-protected
-- submit-contact Edge Function. Browsers must no longer write directly to the
-- contact_messages table.

drop policy if exists "Anyone can leave a message"
  on public.contact_messages;

revoke all privileges on public.contact_messages
  from public, anon, authenticated, service_role;
grant insert on public.contact_messages to service_role;

-- Preserve the existing three-per-hour email limit while normalizing email
-- addresses and serializing concurrent requests for the same address.
create or replace function public.contact_messages_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  new.email := lower(btrim(new.email));

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('contact:' || new.email, 0)
  );

  select count(*)
  into recent_count
  from public.contact_messages
  where lower(email) = new.email
    and created_at > pg_catalog.now() - interval '1 hour';

  if recent_count >= 3 then
    raise exception
      'Too many messages from this email address in a short time. Please wait before sending another.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.contact_messages_rate_limit()
  from public, anon, authenticated, service_role;

comment on table public.contact_messages is
  'Turnstile-verified contact submissions. Inserts are restricted to the submit-contact Edge Function service role.';
comment on function public.contact_messages_rate_limit() is
  'Trigger-only anti-flood guard. Normalizes email and serializes the three-submissions-per-hour limit.';
