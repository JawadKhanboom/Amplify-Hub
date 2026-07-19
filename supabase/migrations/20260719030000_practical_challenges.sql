-- AmplifyHub practical challenges: cloud lesson progress, curated catalog,
-- deterministic daily assignments, hybrid verification, personal XP, and feedback.

create extension if not exists pgcrypto;

create table if not exists public.user_lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null check (lesson_id ~ '^m[0-9]+l[0-9]+$'),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.user_lesson_progress enable row level security;
drop policy if exists "Users manage own lesson progress" on public.user_lesson_progress;
create policy "Users manage own lesson progress" on public.user_lesson_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.challenge_catalog (
  id text primary key,
  title text not null,
  description text not null,
  skill text not null check (skill in ('mindset','prospecting','script','opening','discovery','objections','booking_followup','improvement')),
  call_context text not null check (call_context in ('cold_call','discovery_call','follow_up','offline_preparation','real_world_optional')),
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  tier text not null check (tier in ('quick','core','stretch')),
  estimated_minutes integer not null check (estimated_minutes between 3 and 30),
  xp integer not null check (xp between 10 and 500),
  verification_type text not null check (verification_type in ('reflection','work_sample','lesson','coach')),
  verification_config jsonb not null default '{}'::jsonb,
  action_url text not null,
  objectives jsonb not null default '[]'::jsonb,
  example_text text not null default '',
  source_note text not null default '',
  reviewed_on date not null default current_date,
  active boolean not null default true
);

alter table public.challenge_catalog enable row level security;
drop policy if exists "Authenticated users read active challenges" on public.challenge_catalog;
create policy "Authenticated users read active challenges" on public.challenge_catalog
  for select to authenticated using (active = true);
revoke insert, update, delete on public.challenge_catalog from anon, authenticated;

create table if not exists public.user_challenge_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id text not null references public.challenge_catalog(id),
  assignment_date date not null,
  tier text not null check (tier in ('quick','core','stretch')),
  status text not null default 'assigned' check (status in ('assigned','in_progress','completed','replaced')),
  progress_current integer not null default 0 check (progress_current >= 0),
  progress_target integer not null default 1 check (progress_target > 0),
  evidence jsonb not null default '{}'::jsonb,
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  replacement_reason text,
  created_at timestamptz not null default now()
);

create unique index if not exists one_active_challenge_per_tier
  on public.user_challenge_assignments (user_id, assignment_date, tier)
  where status <> 'replaced';
create index if not exists challenge_assignment_history_idx
  on public.user_challenge_assignments (user_id, assignment_date desc, assigned_at desc);

alter table public.user_challenge_assignments enable row level security;
drop policy if exists "Users read own challenge assignments" on public.user_challenge_assignments;
create policy "Users read own challenge assignments" on public.user_challenge_assignments
  for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.user_challenge_assignments from anon, authenticated;

create table if not exists public.user_challenge_feedback (
  assignment_id uuid primary key references public.user_challenge_assignments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  helpful boolean not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reason is null or char_length(reason) <= 500)
);

alter table public.user_challenge_feedback enable row level security;
drop policy if exists "Users read own challenge feedback" on public.user_challenge_feedback;
create policy "Users read own challenge feedback" on public.user_challenge_feedback
  for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.user_challenge_feedback from anon, authenticated;

-- Normalize legacy display labels into machine-safe IANA timezone values.
update public.user_preferences set timezone = case timezone
  when '(GMT+5:00) Islamabad, Karachi' then 'Asia/Karachi'
  when '(GMT-5:00) New York' then 'America/New_York'
  when '(GMT+0:00) London' then 'Europe/London'
  when '(GMT+10:00) Sydney' then 'Australia/Sydney'
  else timezone end;
alter table public.user_preferences alter column timezone set default 'Asia/Karachi';

insert into public.challenge_catalog
  (id,title,description,skill,call_context,difficulty,tier,estimated_minutes,xp,verification_type,verification_config,action_url,objectives,example_text,source_note)
values
('mindset-reframe-rejections','Reframe Three Rejections','Turn three common rejections into neutral learning signals and write the next behavior you would test.','mindset','offline_preparation','easy','quick',5,40,'reflection','{}','challenges.html','["Name three rejection moments","Write a neutral lesson from each","Choose one behavior to test"]','Instead of “I am bad at this,” write “My opener did not create relevance yet; I will test a specific reason for calling.”','AmplifyHub Sales Mindset exercises'),
('mindset-minimum-day','Define Your Minimum Viable Day','Create the smallest practice commitment you can keep even on a difficult day.','mindset','offline_preparation','easy','core',10,60,'work_sample','{}','challenges.html','["Choose a realistic minimum","Include calls or AI practice","Define when you will do it"]','On a difficult day I will complete one five-minute AI drill before lunch.','AmplifyHub Sales Mindset lesson 6'),
('mindset-call-block','Complete a Call-Block Reflection','Run an optional real or AI call block, then record patterns without including prospect details.','mindset','real_world_optional','medium','stretch',20,100,'reflection','{"real_world_optional":true}','coach-home.html#roleplay','["Complete an AI or real call block","Record only totals and patterns","Choose one adjustment"]','I completed five AI calls. I rushed two openings, so next time I will pause after stating the reason for calling.','AmplifyHub 10-call block exercise'),
('prospecting-simple-icp','Build a Simple ICP','Define a usable ideal-customer profile using observable company and role criteria.','prospecting','offline_preparation','easy','quick',5,40,'work_sample','{}','challenges.html','["Choose an industry","Choose a company-size signal","Name the likely buyer role"]','Independent dental clinics with 5–20 staff; owner or practice manager; visible need for lead follow-up.','AmplifyHub Finding Prospects lesson 1'),
('prospecting-qualify-five','Qualify Five Practice Prospects','Apply the same five-point qualification checklist to five fictional or public companies without storing personal contact data.','prospecting','offline_preparation','medium','core',12,70,'work_sample','{}','challenges.html','["Score five companies","Use the same criteria","Explain the strongest fit"]','Score only company-level fit, trigger, need, timing, and role relevance.','AmplifyHub Finding Prospects lesson 2'),
('prospecting-signal-relevance','Turn One Signal into Relevance','Convert one safe public business signal into a relevant reason for calling and a focused question.','prospecting','cold_call','medium','stretch',18,110,'work_sample','{}','challenges.html','["Identify a public company signal","Connect it to a plausible problem","Ask one non-leading question"]','Hiring five SDRs may signal a ramp-time challenge. Ask how the team is keeping onboarding consistent.','AmplifyHub ACA and OCQ exercises'),
('script-feature-to-problem','Rewrite a Feature Pitch','Rewrite a feature-led pitch as a specific problem statement that a buyer can recognize.','script','offline_preparation','easy','quick',5,40,'work_sample','{}','challenges.html','["Identify the feature claim","Name the buyer problem","Remove unsupported results"]','Replace “AI-powered platform” with the operational problem it helps the buyer investigate.','AmplifyHub Value Audit exercise'),
('script-thirty-second','Build a 30-Second Call Structure','Write a flexible structure containing identity, reason, relevance, and one clear next question.','script','cold_call','medium','core',12,75,'work_sample','{}','challenges.html','["State who you are","Give a specific reason","Finish with one question"]','Use a structure rather than a word-for-word script so you can respond naturally.','Salesforce prospecting tasks and AmplifyHub script module'),
('script-remove-generic','Remove Three Generic Phrases','Audit a practice script and replace three generic phrases with concrete buyer language.','script','offline_preparation','hard','stretch',18,115,'work_sample','{}','challenges.html','["Find three vague phrases","Replace each with observable language","Read the revision aloud"]','Replace “grow your business” with the specific workflow, delay, or risk being discussed.','AmplifyHub Building Your Script exercises'),
('opening-twenty-seconds','Deliver a 20-Second Opener','Complete a roleplay and earn an opening score of at least 6/10.','opening','cold_call','medium','quick',5,60,'coach','{"mode":"roleplay","min_turns":4,"score_key":"opening","min_skill_score":6}','coach-home.html#roleplay','["Open with clarity","Establish relevance quickly","Complete the feedback report"]','Aim for clarity and relevance, not speed alone.','Gong cold-call opening research'),
('opening-three-versions','Create Three Openers for One Prospect','Write three distinct relevant openers for the same fictional prospect without changing the facts.','opening','offline_preparation','medium','core',12,75,'work_sample','{}','challenges.html','["Keep one prospect context","Create three approaches","Choose the most credible version"]','Try a trigger-led, problem-led, and permission-based version.','AmplifyHub Three Openers challenge'),
('opening-gatekeeper','Pass the Gatekeeper Drill','Complete a roleplay while remaining respectful, transparent, and concise with a gatekeeper.','opening','cold_call','hard','stretch',18,130,'coach','{"mode":"roleplay","min_turns":6,"min_score":6}','coach-home.html#roleplay','["Ask for help directly","Do not deceive or pressure","Complete at least six turns"]','Treat the gatekeeper as a person and potential ally, not an obstacle.','HubSpot mock-call formats and AmplifyHub gatekeeper lesson'),
('discovery-five-questions','Build Five Targeted Questions','Write five questions for a scheduled discovery call covering situation, problem, impact, goal, and next step.','discovery','discovery_call','easy','quick',5,45,'work_sample','{}','challenges.html','["Cover five discovery areas","Avoid yes/no wording","Keep questions relevant"]','Use this only for a scheduled discovery conversation, not as a cold-call interrogation.','Gong discovery research and AmplifyHub discovery module'),
('discovery-follow-up-ladder','Use a Two-Level Follow-Up Ladder','Start with one answer and write two natural follow-up questions that move from fact to impact.','discovery','discovery_call','medium','core',12,80,'work_sample','{}','challenges.html','["Begin with a plausible answer","Ask for an example","Explore the impact"]','If response time is slow, ask when it happens, then what that delay changes for the team.','AmplifyHub discovery follow-up exercises'),
('discovery-listening-call','Complete a Listening-Focused Discovery Call','Complete an AI roleplay with at least six turns and a discovery score of 6/10 or better.','discovery','discovery_call','hard','stretch',20,140,'coach','{"mode":"roleplay","min_turns":6,"score_key":"discovery","min_skill_score":6}','coach-home.html#roleplay','["Ask targeted questions","Respond to the answers","Complete the feedback report"]','Do not ask a checklist mechanically; follow the prospect’s answers.','Gong discovery-call analysis'),
('objections-top-five','Top-Five Objection Sprint','Practice common dismissive and situational objections in AI roleplay and earn 6/10 for objection handling.','objections','cold_call','medium','quick',5,65,'coach','{"mode":"roleplay","min_turns":4,"score_key":"objection","min_skill_score":6}','coach-home.html#roleplay','["Acknowledge before responding","Ask a useful follow-up","Complete feedback"]','Practice not interested, wrong person, no budget, product fit, and a hang-up recovery mindset.','Gong 300M-call objection research'),
('objections-two-consecutive','Handle Two Consecutive Objections','Stay composed through at least six roleplay turns and handle resistance without arguing.','objections','cold_call','hard','core',15,100,'coach','{"mode":"roleplay","min_turns":6,"score_key":"objection","min_skill_score":6}','coach-home.html#roleplay','["Handle two moments of resistance","Validate concerns","Avoid pressure or fabricated claims"]','Use a pause, acknowledgment, clarification, and an appropriate next question.','HubSpot hot-seat roleplay format'),
('objections-respect-no','Respectfully Exit After a Firm No','Write a response that distinguishes a reflex objection from a repeated firm refusal and exits professionally.','objections','cold_call','medium','stretch',18,110,'work_sample','{}','challenges.html','["Acknowledge the refusal","Avoid another pressure attempt","Close respectfully"]','Thank them for being direct, confirm you will not continue, and end the interaction professionally.','HubSpot objection ethics and AmplifyHub objection module'),
('booking-interest-cta','Use an Interest-Based CTA','Complete a roleplay and make a low-pressure next-step request tied to the value discussed.','booking_followup','cold_call','medium','quick',5,65,'coach','{"mode":"roleplay","min_turns":4,"min_score":6}','coach-home.html#roleplay','["Tie the CTA to relevance","Ask for interest before logistics","Complete feedback"]','Ask whether it makes sense to explore the issue further before forcing calendar logistics.','Gong CTA research'),
('booking-two-times','Offer Two Specific Times','Write a natural booking transition and two concrete time options after interest is established.','booking_followup','follow_up','easy','core',10,65,'work_sample','{}','challenges.html','["Confirm interest first","Offer two times","State what happens next"]','Would Tuesday afternoon or Wednesday morning be easier for a 20-minute follow-up?','AmplifyHub Booking Appointments lesson'),
('followup-three-touch','Write a Three-Touch Follow-Up','Create a concise three-touch sequence where each message adds a different useful angle.','booking_followup','follow_up','hard','stretch',20,130,'work_sample','{}','challenges.html','["Use three distinct value angles","Include clear timing","End with a respectful close"]','Use a recap, a relevant insight, and a final permission-to-close message.','AmplifyHub Follow-up module'),
('improvement-full-roleplay','Complete a Full Roleplay','Finish one AI roleplay with at least six turns and generate a feedback report.','improvement','cold_call','medium','quick',5,70,'coach','{"mode":"roleplay","min_turns":6}','coach-home.html#roleplay','["Complete six or more turns","End the session","Generate feedback"]','Choose any scenario that matches the skill you currently need.','HubSpot mock-call guidance'),
('improvement-beat-score','Improve Your Coach Score','Complete a roleplay and improve your overall score by at least one point, or reach 6/10 on your first scored session.','improvement','cold_call','hard','core',15,140,'coach','{"mode":"roleplay","min_turns":6,"improvement":true,"first_score_min":6}','coach-home.html#roleplay','["Review the previous report","Practice one weakness","Improve by one point"]','Focus on one recommendation instead of trying to fix everything at once.','Deliberate feedback loop using AmplifyHub Coach scores'),
('improvement-next-action','Turn Feedback into One Next Action','Review a recent practice report and write one behavior you will use in the next session.','improvement','offline_preparation','easy','stretch',15,90,'reflection','{}','coach-home.html#history','["Review one report","Choose one behavior","Define when you will practice it"]','In my next roleplay I will pause after each objection before asking a clarifying question.','AmplifyHub AI Coach feedback workflow')
on conflict (id) do update set
  title=excluded.title, description=excluded.description, skill=excluded.skill,
  call_context=excluded.call_context, difficulty=excluded.difficulty, tier=excluded.tier,
  estimated_minutes=excluded.estimated_minutes, xp=excluded.xp,
  verification_type=excluded.verification_type, verification_config=excluded.verification_config,
  action_url=excluded.action_url, objectives=excluded.objectives,
  example_text=excluded.example_text, source_note=excluded.source_note,
  reviewed_on=excluded.reviewed_on;

create or replace function private.challenge_local_date(p_user_id uuid)
returns date language plpgsql stable security definer set search_path = '' as $$
declare v_tz text;
begin
  select timezone into v_tz from public.user_preferences where user_id = p_user_id;
  v_tz := coalesce(v_tz, 'Asia/Karachi');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then v_tz := 'UTC'; end if;
  return (pg_catalog.now() at time zone v_tz)::date;
end $$;

create or replace function private.challenge_focus_skill(p_user_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_scores jsonb; v_skill text; v_done integer;
begin
  select scores into v_scores from public.coaching_sessions
  where user_id=p_user_id and scores is not null order by coalesce(ended_at,started_at) desc limit 1;
  if v_scores is not null then
    select case key when 'objection' then 'objections' when 'communication' then 'improvement' else key end
      into v_skill from jsonb_each_text(v_scores)
      where value ~ '^[0-9]+(\.[0-9]+)?$' order by value::numeric limit 1;
    if v_skill is not null then return v_skill; end if;
  end if;
  select count(*) into v_done from public.user_lesson_progress where user_id=p_user_id and completed_at is not null;
  return case when v_done<8 then 'mindset' when v_done<11 then 'prospecting'
    when v_done<15 then 'script' when v_done<19 then 'opening'
    when v_done<23 then 'discovery' when v_done<28 then 'objections'
    when v_done<32 then 'booking_followup' else 'improvement' end;
end $$;

create or replace function public.get_or_assign_daily_challenges()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid:=auth.uid(); v_date date; v_focus text; v_pref text; v_tier text; v_id text;
  v_result jsonb; v_completed integer; v_xp integer; v_streak integer:=0; v_day date;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  v_date:=private.challenge_local_date(v_user);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||v_date::text,0));
  v_focus:=private.challenge_focus_skill(v_user);
  select coalesce(challenge_difficulty,'balanced') into v_pref from public.user_preferences where user_id=v_user;
  v_pref:=coalesce(v_pref,'balanced');

  foreach v_tier in array array['quick','core','stretch'] loop
    if not exists(select 1 from public.user_challenge_assignments where user_id=v_user and assignment_date=v_date and tier=v_tier and status<>'replaced') then
      select c.id into v_id from public.challenge_catalog c
      where c.active and c.tier=v_tier
        and (v_pref='hard' or (v_pref='balanced' and c.difficulty in ('easy','medium')) or (v_pref='easy' and c.difficulty='easy'))
        and not exists(select 1 from public.user_challenge_assignments a where a.user_id=v_user and a.challenge_id=c.id and a.assignment_date>=v_date-6)
      order by (c.skill=v_focus) desc, md5(v_user::text||v_date::text||c.id) limit 1;
      if v_id is null then
        select c.id into v_id from public.challenge_catalog c where c.active and c.tier=v_tier
          and not exists(select 1 from public.user_challenge_assignments a where a.user_id=v_user and a.challenge_id=c.id and a.assignment_date=v_date and a.status<>'replaced')
        order by (c.skill=v_focus) desc, md5(v_user::text||v_date::text||c.id) limit 1;
      end if;
      if v_id is not null then
        insert into public.user_challenge_assignments(user_id,challenge_id,assignment_date,tier)
        values(v_user,v_id,v_date,v_tier);
      end if;
    end if;
    v_id:=null;
  end loop;

  select count(*),coalesce(sum(xp_awarded),0) into v_completed,v_xp
  from public.user_challenge_assignments where user_id=v_user and assignment_date=v_date and status='completed';
  v_day:=v_date;
  loop
    exit when not exists(select 1 from public.user_challenge_assignments where user_id=v_user and assignment_date=v_day and status='completed');
    v_streak:=v_streak+1; v_day:=v_day-1;
  end loop;

  select jsonb_build_object(
    'date',v_date,'focusSkill',v_focus,
    'summary',jsonb_build_object('completed',v_completed,'total',3,'todayXp',v_xp,'streak',v_streak),
    'assignments',coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'date',a.assignment_date,'tier',a.tier,'status',a.status,
      'progressCurrent',a.progress_current,'progressTarget',a.progress_target,
      'evidence',a.evidence,'assignedAt',a.assigned_at,'startedAt',a.started_at,
      'completedAt',a.completed_at,'xpAwarded',a.xp_awarded,
      'challenge',to_jsonb(c)-'source_note'-'reviewed_on') order by case a.tier when 'quick' then 1 when 'core' then 2 else 3 end)
      from public.user_challenge_assignments a join public.challenge_catalog c on c.id=a.challenge_id
      where a.user_id=v_user and a.assignment_date=v_date and a.status<>'replaced'),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(x order by x.assignment_date desc,x.assigned_at desc) from (
      select a.id,a.assignment_date,a.status,a.completed_at,a.xp_awarded,a.evidence,a.assigned_at,
        jsonb_build_object('id',c.id,'title',c.title,'skill',c.skill,'tier',c.tier,'xp',c.xp) challenge
      from public.user_challenge_assignments a join public.challenge_catalog c on c.id=a.challenge_id
      where a.user_id=v_user and a.assignment_date<v_date and a.assignment_date>=v_date-30 and a.status<>'replaced'
      limit 90) x),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.start_challenge(p_assignment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_route text; v_status text;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  update public.user_challenge_assignments set status='in_progress',started_at=coalesce(started_at,now())
  where id=p_assignment_id and user_id=v_user and status='assigned';
  select c.action_url,a.status into v_route,v_status from public.user_challenge_assignments a
  join public.challenge_catalog c on c.id=a.challenge_id where a.id=p_assignment_id and a.user_id=v_user;
  if v_route is null or v_status='replaced' then raise exception 'Challenge not found' using errcode='22023'; end if;
  return jsonb_build_object('route',v_route,'status',v_status);
end $$;

create or replace function public.submit_challenge(p_assignment_id uuid,p_evidence jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid:=auth.uid(); v_a public.user_challenge_assignments%rowtype; v_c public.challenge_catalog%rowtype;
  v_text text; v_ok boolean:=false; v_after numeric; v_before numeric;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_a from public.user_challenge_assignments where id=p_assignment_id and user_id=v_user for update;
  if not found or v_a.status='replaced' then raise exception 'Challenge not found' using errcode='22023'; end if;
  if v_a.status='completed' then return jsonb_build_object('status','completed','xpAwarded',v_a.xp_awarded,'alreadyCompleted',true); end if;
  select * into v_c from public.challenge_catalog where id=v_a.challenge_id and active;

  if v_c.verification_type in ('reflection','work_sample') then
    v_text:=btrim(coalesce(p_evidence->>'text',''));
    if char_length(v_text) between 30 and 1000 then v_ok:=true; end if;
    if not v_ok then raise exception 'Evidence must contain 30 to 1000 characters' using errcode='22023'; end if;
  elsif v_c.verification_type='lesson' then
    select exists(select 1 from public.user_lesson_progress where user_id=v_user
      and lesson_id=v_c.verification_config->>'lesson_id' and completed_at is not null) into v_ok;
  elsif v_c.verification_type='coach' then
    if coalesce((v_c.verification_config->>'improvement')::boolean,false) then
      select max(score) into v_before from public.coaching_sessions where user_id=v_user and score is not null and coalesce(ended_at,started_at)<v_a.assigned_at;
      select max(score) into v_after from public.coaching_sessions where user_id=v_user and score is not null and coalesce(ended_at,started_at)>=v_a.assigned_at and mode=coalesce(v_c.verification_config->>'mode',mode) and turns>=coalesce((v_c.verification_config->>'min_turns')::integer,1);
      v_ok:=v_after is not null and ((v_before is null and v_after>=coalesce((v_c.verification_config->>'first_score_min')::numeric,6)) or v_after>=v_before+1);
    else
      select exists(select 1 from public.coaching_sessions s where s.user_id=v_user
        and coalesce(s.ended_at,s.started_at)>=v_a.assigned_at and s.ended_at is not null
        and (v_c.verification_config->>'mode' is null or s.mode=v_c.verification_config->>'mode')
        and s.turns>=coalesce((v_c.verification_config->>'min_turns')::integer,1)
        and (v_c.verification_config->>'min_score' is null or s.score>=((v_c.verification_config->>'min_score')::numeric))
        and (v_c.verification_config->>'score_key' is null or coalesce((s.scores->>(v_c.verification_config->>'score_key'))::numeric,0)>=coalesce((v_c.verification_config->>'min_skill_score')::numeric,0))) into v_ok;
    end if;
  end if;
  if not v_ok then raise exception 'Challenge requirements are not complete yet' using errcode='22023'; end if;

  update public.user_challenge_assignments set status='completed',progress_current=progress_target,
    evidence=case when v_c.verification_type in ('reflection','work_sample') then jsonb_build_object('text',v_text) else '{}'::jsonb end,
    completed_at=now(),xp_awarded=v_c.xp where id=v_a.id;
  return jsonb_build_object('status','completed','xpAwarded',v_c.xp,'alreadyCompleted',false);
end $$;

create or replace function public.replace_challenge(p_assignment_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_a public.user_challenge_assignments%rowtype; v_new text; v_count integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_reason not in ('not relevant','too difficult','too long','requires resources I do not have') then raise exception 'Invalid replacement reason' using errcode='22023'; end if;
  select * into v_a from public.user_challenge_assignments where id=p_assignment_id and user_id=v_user for update;
  if not found or v_a.status in ('completed','replaced') then raise exception 'Challenge cannot be replaced' using errcode='22023'; end if;
  select count(*) into v_count from public.user_challenge_assignments where user_id=v_user and assignment_date=v_a.assignment_date and status='replaced';
  if v_count>=1 then raise exception 'Daily replacement already used' using errcode='22023'; end if;
  update public.user_challenge_assignments set status='replaced',replacement_reason=p_reason where id=v_a.id;
  select c.id into v_new from public.challenge_catalog c where c.active and c.tier=v_a.tier and c.id<>v_a.challenge_id
    and not exists(select 1 from public.user_challenge_assignments x where x.user_id=v_user and x.challenge_id=c.id and x.assignment_date>=v_a.assignment_date-6)
  order by md5(v_user::text||v_a.assignment_date::text||c.id||'replacement') limit 1;
  if v_new is null then select c.id into v_new from public.challenge_catalog c where c.active and c.tier=v_a.tier and c.id<>v_a.challenge_id order by md5(v_user::text||c.id) limit 1; end if;
  if v_new is null then raise exception 'No replacement available' using errcode='22023'; end if;
  insert into public.user_challenge_assignments(user_id,challenge_id,assignment_date,tier) values(v_user,v_new,v_a.assignment_date,v_a.tier);
  return public.get_or_assign_daily_challenges();
end $$;

create or replace function public.rate_challenge(p_assignment_id uuid,p_helpful boolean,p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_reason is not null and char_length(p_reason)>500 then raise exception 'Feedback is too long' using errcode='22023'; end if;
  if not exists(select 1 from public.user_challenge_assignments where id=p_assignment_id and user_id=v_user and status='completed') then raise exception 'Completed challenge not found' using errcode='22023'; end if;
  insert into public.user_challenge_feedback(assignment_id,user_id,helpful,reason)
  values(p_assignment_id,v_user,p_helpful,nullif(btrim(p_reason),''))
  on conflict(assignment_id) do update set helpful=excluded.helpful,reason=excluded.reason,updated_at=now();
  return jsonb_build_object('saved',true);
end $$;

revoke all on function public.get_or_assign_daily_challenges() from public,anon;
revoke all on function public.start_challenge(uuid) from public,anon;
revoke all on function public.submit_challenge(uuid,jsonb) from public,anon;
revoke all on function public.replace_challenge(uuid,text) from public,anon;
revoke all on function public.rate_challenge(uuid,boolean,text) from public,anon;
grant execute on function public.get_or_assign_daily_challenges() to authenticated;
grant execute on function public.start_challenge(uuid) to authenticated;
grant execute on function public.submit_challenge(uuid,jsonb) to authenticated;
grant execute on function public.replace_challenge(uuid,text) to authenticated;
grant execute on function public.rate_challenge(uuid,boolean,text) to authenticated;
