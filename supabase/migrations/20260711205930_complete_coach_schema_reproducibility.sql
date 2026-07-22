-- AmplifyHub - complete AI Coach schema reproducibility.
--
-- This migration is intentionally ordered after coaching session metadata
-- and before the existing user_progress_stats security migration.
--
-- Production-safe:
-- - Existing correct objects are left unchanged.
-- - Missing objects are created for fresh database rebuilds.

-- Restore coach_messages.session_id -> coaching_sessions.id.
do $migration$
declare
  v_session_attnum smallint;
  v_id_attnum smallint;
  v_fk record;
begin
  select attnum
    into v_session_attnum
  from pg_catalog.pg_attribute
  where attrelid = 'public.coach_messages'::regclass
    and attname = 'session_id'
    and not attisdropped;

  select attnum
    into v_id_attnum
  from pg_catalog.pg_attribute
  where attrelid = 'public.coaching_sessions'::regclass
    and attname = 'id'
    and not attisdropped;

  if v_session_attnum is null or v_id_attnum is null then
    raise exception 'Required Coach relationship columns are missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.contype = 'f'
      and c.conrelid = 'public.coach_messages'::regclass
      and c.confrelid = 'public.coaching_sessions'::regclass
      and c.conkey = array[v_session_attnum]::smallint[]
      and c.confkey = array[v_id_attnum]::smallint[]
      and c.confdeltype = 'c'
  ) then
    for v_fk in
      select c.conname
      from pg_catalog.pg_constraint c
      where c.contype = 'f'
        and c.conrelid = 'public.coach_messages'::regclass
        and c.conkey = array[v_session_attnum]::smallint[]
    loop
      execute format(
        'alter table public.coach_messages drop constraint %I',
        v_fk.conname
      );
    end loop;

    alter table public.coach_messages
      add constraint coach_messages_session_id_fkey
      foreign key (session_id)
      references public.coaching_sessions(id)
      on delete cascade;
  end if;
end;
$migration$;

-- Restore production indexes.
create index if not exists idx_coach_documents_user_id
  on public.coach_documents (user_id);

create index if not exists idx_coach_messages_session_id
  on public.coach_messages (session_id);

create index if not exists idx_coach_messages_user_id
  on public.coach_messages (user_id);

create index if not exists idx_coaching_sessions_user_id
  on public.coaching_sessions (user_id);

-- Create the progress view only when it is missing.
do $migration$
declare
  v_relkind text;
begin
  select c.relkind::text
    into v_relkind
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n
    on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'user_progress_stats';

  if v_relkind is null then
    execute $view$
      create view public.user_progress_stats
      with (security_invoker = true)
      as
      select
        s.user_id,
        count(*) filter (
          where s.mode = 'roleplay'
            and s.status = 'completed'
        ) as total_sessions,
        round(
          avg((s.scores ->> 'opening')::numeric)
          filter (where s.scores is not null),
          1
        ) as avg_opening,
        round(
          avg((s.scores ->> 'discovery')::numeric)
          filter (where s.scores is not null),
          1
        ) as avg_discovery,
        round(
          avg((s.scores ->> 'objection')::numeric)
          filter (where s.scores is not null),
          1
        ) as avg_objection,
        round(
          avg((s.scores ->> 'communication')::numeric)
          filter (where s.scores is not null),
          1
        ) as avg_communication,
        round(
          avg(s.score) filter (where s.score is not null),
          1
        ) as avg_overall,
        count(distinct s.scenario)
          filter (where s.scenario is not null) as scenarios_tried,
        max(s.started_at) as last_practiced_at,
        (
          select s2.scenario
          from public.coaching_sessions s2
          where s2.user_id = s.user_id
            and s2.scenario is not null
          group by s2.scenario
          order by count(*) desc
          limit 1
        ) as most_practiced_scenario
      from public.coaching_sessions s
      group by s.user_id
    $view$;
  elsif v_relkind <> 'v' then
    raise exception
      'public.user_progress_stats exists with unexpected relation kind: %',
      v_relkind;
  end if;
end;
$migration$;
