-- Anti-flood: cap a single email to 3 contact-form messages per hour.
-- Complements the existing length CHECKs + client honeypot. SECURITY DEFINER so
-- it can count rows even though anon has no SELECT on the table; search_path is
-- locked to '' and every object is schema-qualified. Trigger functions are not
-- exposed as PostgREST RPCs, and EXECUTE is revoked from client roles anyway.
--
-- NOTE: applied directly to the linked project on 2026-07-25 and back-filled
-- into the repo afterwards so local and remote migration history match.
create or replace function public.contact_messages_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.contact_messages
  where email = new.email
    and created_at > now() - interval '1 hour';

  if recent_count >= 3 then
    raise exception 'Too many messages from this email address in a short time. Please wait before sending another.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.contact_messages_rate_limit() from public, anon, authenticated;

drop trigger if exists contact_messages_rate_limit on public.contact_messages;
create trigger contact_messages_rate_limit
  before insert on public.contact_messages
  for each row
  execute function public.contact_messages_rate_limit();
