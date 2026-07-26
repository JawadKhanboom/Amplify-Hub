-- AmplifyHub Resource Library Phase 2: per-user resource activity and
-- one-time migration of the legacy interview-prep portfolio.
--
-- The resource catalog uses a text primary key, so resource_id must also be
-- text. Both user-owned tables use exact least-privilege grants plus RLS.

create table if not exists public.user_resource_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id text not null references public.resource_catalog(id) on delete cascade,
  bookmarked boolean not null default false,
  helpful boolean,
  last_viewed_at timestamptz,
  download_count integer not null default 0
    constraint user_resource_activity_download_count_nonnegative
    check (download_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

-- The composite primary key already covers the user_id foreign key. This
-- separate index covers resource_id for FK checks and catalog-row deletion.
create index if not exists user_resource_activity_resource_id_idx
  on public.user_resource_activity (resource_id);

create index if not exists user_resource_activity_recent_idx
  on public.user_resource_activity (user_id, last_viewed_at desc)
  where last_viewed_at is not null;

create index if not exists user_resource_activity_bookmarked_idx
  on public.user_resource_activity (user_id, updated_at desc)
  where bookmarked = true;

alter table public.user_resource_activity enable row level security;

drop policy if exists "Users manage own resource activity"
  on public.user_resource_activity;
create policy "Users manage own resource activity"
  on public.user_resource_activity
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all privileges on public.user_resource_activity
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.user_resource_activity
  to authenticated;

create table if not exists public.user_interview_prep (
  user_id uuid primary key references auth.users(id) on delete cascade,
  opener text not null default '',
  objections text not null default '',
  rejection text not null default '',
  routine text not null default '',
  why text not null default '',
  first_call_done boolean not null default false,
  legacy_migrated_at timestamptz,
  updated_at timestamptz not null default now()
);

-- user_interview_prep's primary key is also the covering index for its
-- user_id foreign key.
alter table public.user_interview_prep enable row level security;

drop policy if exists "Users manage own interview prep"
  on public.user_interview_prep;
create policy "Users manage own interview prep"
  on public.user_interview_prep
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all privileges on public.user_interview_prep
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.user_interview_prep
  to authenticated;

-- Incrementing a counter with a client-side read followed by an update loses
-- increments when two devices download concurrently. This single statement is
-- atomic and remains owner-scoped because it runs as the invoking user.
create or replace function public.record_resource_download(p_resource_id text)
returns public.user_resource_activity
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_activity public.user_resource_activity;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_resource_id is null or pg_catalog.btrim(p_resource_id) = '' then
    raise exception 'Resource ID is required' using errcode = '22023';
  end if;

  insert into public.user_resource_activity (
    user_id,
    resource_id,
    download_count
  )
  values (
    v_user_id,
    p_resource_id,
    1
  )
  on conflict (user_id, resource_id) do update
    set download_count = public.user_resource_activity.download_count + 1,
        updated_at = pg_catalog.now()
  returning * into v_activity;

  return v_activity;
end;
$function$;

revoke all privileges on function public.record_resource_download(text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_resource_download(text)
  to authenticated;

-- Atomically claims and migrates the browser-wide legacy portfolio for the
-- authenticated user. The conflict UPDATE runs only while the marker is null,
-- so concurrent tabs cannot migrate twice. Existing non-blank cloud text wins;
-- first_call_done is monotonic because the legacy UI cannot undo completion.
create or replace function public.migrate_legacy_interview_prep(
  p_opener text,
  p_objections text,
  p_rejection text,
  p_routine text,
  p_why text,
  p_first_call_done boolean,
  p_legacy_updated_at timestamptz
)
returns public.user_interview_prep
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_prep public.user_interview_prep;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.user_interview_prep as existing (
    user_id,
    opener,
    objections,
    rejection,
    routine,
    why,
    first_call_done,
    legacy_migrated_at,
    updated_at
  )
  values (
    v_user_id,
    coalesce(p_opener, ''),
    coalesce(p_objections, ''),
    coalesce(p_rejection, ''),
    coalesce(p_routine, ''),
    coalesce(p_why, ''),
    coalesce(p_first_call_done, false),
    pg_catalog.now(),
    coalesce(p_legacy_updated_at, pg_catalog.now())
  )
  on conflict (user_id) do update
    set opener = case
          when pg_catalog.btrim(existing.opener) = '' then excluded.opener
          else existing.opener
        end,
        objections = case
          when pg_catalog.btrim(existing.objections) = '' then excluded.objections
          else existing.objections
        end,
        rejection = case
          when pg_catalog.btrim(existing.rejection) = '' then excluded.rejection
          else existing.rejection
        end,
        routine = case
          when pg_catalog.btrim(existing.routine) = '' then excluded.routine
          else existing.routine
        end,
        why = case
          when pg_catalog.btrim(existing.why) = '' then excluded.why
          else existing.why
        end,
        first_call_done = existing.first_call_done or excluded.first_call_done,
        legacy_migrated_at = pg_catalog.now(),
        updated_at = greatest(existing.updated_at, excluded.updated_at)
    where existing.legacy_migrated_at is null
  returning * into v_prep;

  -- ON CONFLICT ... WHERE returns no row after a completed migration. Return
  -- the existing owner row so repeated calls are harmless and deterministic.
  if v_prep.user_id is null then
    select *
      into v_prep
      from public.user_interview_prep
     where user_id = v_user_id;
  end if;

  return v_prep;
end;
$function$;

revoke all privileges on function public.migrate_legacy_interview_prep(
  text,
  text,
  text,
  text,
  text,
  boolean,
  timestamptz
)
  from public, anon, authenticated, service_role;
grant execute on function public.migrate_legacy_interview_prep(
  text,
  text,
  text,
  text,
  text,
  boolean,
  timestamptz
)
  to authenticated;

comment on function public.record_resource_download(text) is
  'Atomically increments the authenticated user download count for one resource.';

comment on function public.migrate_legacy_interview_prep(
  text,
  text,
  text,
  text,
  text,
  boolean,
  timestamptz
) is
  'Migrates one authenticated user legacy interview portfolio once, filling only empty cloud fields.';
