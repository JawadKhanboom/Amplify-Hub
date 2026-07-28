-- Harden the authenticated SECURITY DEFINER APIs without granting clients
-- direct write access to protected challenge or quota tables.

-- These helpers accept an arbitrary user UUID and are implementation details.
-- Public RPCs owned by postgres can still call them after client execution is
-- revoked.
revoke all on function private.challenge_local_date(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.challenge_focus_skill(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.submit_challenge(
  p_assignment_id uuid,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_a public.user_challenge_assignments%rowtype;
  v_c public.challenge_catalog%rowtype;
  v_text text;
  v_ok boolean := false;
  v_after numeric;
  v_before numeric;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_evidence is null or pg_catalog.pg_column_size(p_evidence) > 8192 then
    raise exception 'Evidence payload is invalid' using errcode = '22023';
  end if;

  select *
  into v_a
  from public.user_challenge_assignments
  where id = p_assignment_id
    and user_id = v_user
  for update;

  if not found or v_a.status = 'replaced' then
    raise exception 'Challenge not found' using errcode = '22023';
  end if;

  if v_a.status = 'completed' then
    return jsonb_build_object(
      'status', 'completed',
      'xpAwarded', v_a.xp_awarded,
      'alreadyCompleted', true
    );
  end if;

  select *
  into v_c
  from public.challenge_catalog
  where id = v_a.challenge_id
    and active;

  if v_c.verification_type in ('reflection', 'work_sample') then
    v_text := btrim(coalesce(p_evidence ->> 'text', ''));
    if char_length(v_text) between 30 and 1000 then
      v_ok := true;
    end if;
    if not v_ok then
      raise exception 'Evidence must contain 30 to 1000 characters' using errcode = '22023';
    end if;
  elsif v_c.verification_type = 'lesson' then
    select exists(
      select 1
      from public.user_lesson_progress
      where user_id = v_user
        and lesson_id = v_c.verification_config ->> 'lesson_id'
        and completed_at is not null
    )
    into v_ok;
  elsif v_c.verification_type = 'coach' then
    if coalesce((v_c.verification_config ->> 'improvement')::boolean, false) then
      select max(score)
      into v_before
      from public.coaching_sessions
      where user_id = v_user
        and score is not null
        and coalesce(ended_at, started_at) < v_a.assigned_at;

      select max(score)
      into v_after
      from public.coaching_sessions
      where user_id = v_user
        and score is not null
        and coalesce(ended_at, started_at) >= v_a.assigned_at
        and mode = coalesce(v_c.verification_config ->> 'mode', mode)
        and turns >= coalesce((v_c.verification_config ->> 'min_turns')::integer, 1);

      v_ok := v_after is not null
        and (
          (
            v_before is null
            and v_after >= coalesce(
              (v_c.verification_config ->> 'first_score_min')::numeric,
              6
            )
          )
          or v_after >= v_before + 1
        );
    else
      select exists(
        select 1
        from public.coaching_sessions s
        where s.user_id = v_user
          and coalesce(s.ended_at, s.started_at) >= v_a.assigned_at
          and s.ended_at is not null
          and (
            v_c.verification_config ->> 'mode' is null
            or s.mode = v_c.verification_config ->> 'mode'
          )
          and s.turns >= coalesce(
            (v_c.verification_config ->> 'min_turns')::integer,
            1
          )
          and (
            v_c.verification_config ->> 'min_score' is null
            or s.score >= (
              (v_c.verification_config ->> 'min_score')::numeric
            )
          )
          and (
            v_c.verification_config ->> 'score_key' is null
            or coalesce(
              (
                s.scores ->> (v_c.verification_config ->> 'score_key')
              )::numeric,
              0
            ) >= coalesce(
              (v_c.verification_config ->> 'min_skill_score')::numeric,
              0
            )
          )
      )
      into v_ok;
    end if;
  end if;

  if not v_ok then
    raise exception 'Challenge requirements are not complete yet' using errcode = '22023';
  end if;

  update public.user_challenge_assignments
  set status = 'completed',
      progress_current = progress_target,
      evidence = case
        when v_c.verification_type in ('reflection', 'work_sample')
          then jsonb_build_object('text', v_text)
        else '{}'::jsonb
      end,
      completed_at = now(),
      xp_awarded = v_c.xp
  where id = v_a.id
    and user_id = v_user;

  return jsonb_build_object(
    'status', 'completed',
    'xpAwarded', v_c.xp,
    'alreadyCompleted', false
  );
end;
$$;

create or replace function public.replace_challenge(
  p_assignment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_a public.user_challenge_assignments%rowtype;
  v_new text;
  v_count integer;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_reason is null
    or p_reason not in (
      'not relevant',
      'too difficult',
      'too long',
      'requires resources I do not have'
    )
  then
    raise exception 'Invalid replacement reason' using errcode = '22023';
  end if;

  select *
  into v_a
  from public.user_challenge_assignments
  where id = p_assignment_id
    and user_id = v_user
  for update;

  if not found or v_a.status in ('completed', 'replaced') then
    raise exception 'Challenge cannot be replaced' using errcode = '22023';
  end if;

  -- Serialize replacements across all three assignment rows for this user/day.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user::text || ':' || v_a.assignment_date::text || ':replacement',
      0
    )
  );

  select count(*)
  into v_count
  from public.user_challenge_assignments
  where user_id = v_user
    and assignment_date = v_a.assignment_date
    and status = 'replaced';

  if v_count >= 1 then
    raise exception 'Daily replacement already used' using errcode = '22023';
  end if;

  update public.user_challenge_assignments
  set status = 'replaced',
      replacement_reason = p_reason
  where id = v_a.id
    and user_id = v_user;

  select c.id
  into v_new
  from public.challenge_catalog c
  where c.active
    and c.tier = v_a.tier
    and c.id <> v_a.challenge_id
    and not exists(
      select 1
      from public.user_challenge_assignments x
      where x.user_id = v_user
        and x.challenge_id = c.id
        and x.assignment_date >= v_a.assignment_date - 6
    )
  order by md5(
    v_user::text || v_a.assignment_date::text || c.id || 'replacement'
  )
  limit 1;

  if v_new is null then
    select c.id
    into v_new
    from public.challenge_catalog c
    where c.active
      and c.tier = v_a.tier
      and c.id <> v_a.challenge_id
    order by md5(v_user::text || c.id)
    limit 1;
  end if;

  if v_new is null then
    raise exception 'No replacement available' using errcode = '22023';
  end if;

  insert into public.user_challenge_assignments(
    user_id,
    challenge_id,
    assignment_date,
    tier
  )
  values (
    v_user,
    v_new,
    v_a.assignment_date,
    v_a.tier
  );

  return public.get_or_assign_daily_challenges();
end;
$$;

create or replace function public.rate_challenge(
  p_assignment_id uuid,
  p_helpful boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_helpful is null then
    raise exception 'Helpful value is required' using errcode = '22023';
  end if;

  if p_reason is not null and char_length(p_reason) > 500 then
    raise exception 'Feedback is too long' using errcode = '22023';
  end if;

  if not exists(
    select 1
    from public.user_challenge_assignments
    where id = p_assignment_id
      and user_id = v_user
      and status = 'completed'
  )
  then
    raise exception 'Completed challenge not found' using errcode = '22023';
  end if;

  insert into public.user_challenge_feedback(
    assignment_id,
    user_id,
    helpful,
    reason
  )
  values (
    p_assignment_id,
    v_user,
    p_helpful,
    nullif(btrim(p_reason), '')
  )
  on conflict (assignment_id) do update
  set helpful = excluded.helpful,
      reason = excluded.reason,
      updated_at = now()
  where public.user_challenge_feedback.user_id = v_user;

  return jsonb_build_object('saved', true);
end;
$$;

-- Reassert the intended public API surface. These functions remain
-- authenticated SECURITY DEFINER endpoints because direct client writes to
-- the protected tables are deliberately revoked.
revoke all on function public.consume_coach_quota(text) from public, anon;
revoke all on function public.get_or_assign_daily_challenges() from public, anon;
revoke all on function public.start_challenge(uuid) from public, anon;
revoke all on function public.submit_challenge(uuid, jsonb) from public, anon;
revoke all on function public.replace_challenge(uuid, text) from public, anon;
revoke all on function public.rate_challenge(uuid, boolean, text) from public, anon;

grant execute on function public.consume_coach_quota(text) to authenticated;
grant execute on function public.get_or_assign_daily_challenges() to authenticated;
grant execute on function public.start_challenge(uuid) to authenticated;
grant execute on function public.submit_challenge(uuid, jsonb) to authenticated;
grant execute on function public.replace_challenge(uuid, text) to authenticated;
grant execute on function public.rate_challenge(uuid, boolean, text) to authenticated;

comment on function public.consume_coach_quota(text) is
  'Intentional authenticated SECURITY DEFINER API. Uses auth.uid(), validates the quota bucket, and reads or writes only the caller quota row.';
comment on function public.get_or_assign_daily_challenges() is
  'Intentional authenticated SECURITY DEFINER API. Uses auth.uid() and scopes assignments, progress, coaching data, and history to the caller.';
comment on function public.start_challenge(uuid) is
  'Intentional authenticated SECURITY DEFINER API. Starts only an assignment owned by auth.uid().';
comment on function public.submit_challenge(uuid, jsonb) is
  'Intentional authenticated SECURITY DEFINER API. Validates evidence and completes only an assignment owned by auth.uid().';
comment on function public.replace_challenge(uuid, text) is
  'Intentional authenticated SECURITY DEFINER API. Replaces only a caller-owned assignment and serializes the daily replacement limit.';
comment on function public.rate_challenge(uuid, boolean, text) is
  'Intentional authenticated SECURITY DEFINER API. Rates only a completed assignment owned by auth.uid().';
