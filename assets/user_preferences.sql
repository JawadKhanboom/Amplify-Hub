-- Run this once in Supabase → SQL Editor.
-- Backs every field on the Settings page (Account, Appearance, AI Coach,
-- Learning, Language & Region, Privacy). One row per user.

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Account
  full_name text default '',
  username text default '',
  bio text default '',

  -- Appearance
  accent_color text default '#FFD54A',
  font_size int default 15,
  compact_mode boolean default false,
  animations boolean default true,

  -- AI Coach
  difficulty text default 'medium',
  response_speed text default 'natural',
  feedback_detail text default 'detailed',
  conversation_style text default 'professional',
  practice_language text default 'english',

  -- Learning
  daily_goal_minutes int default 20,
  weekly_goal_lessons int default 5,
  xp_visibility boolean default true,
  streak_reminder boolean default true,
  challenge_difficulty text default 'balanced',
  learning_pace text default 'steady',

  -- Language & Region
  ui_language text default 'English (US)',
  timezone text default '(GMT+5:00) Islamabad, Karachi',
  date_format text default 'MM/DD/YYYY',
  time_format text default '12-hour',

  -- Privacy
  profile_visibility text default 'public',

  updated_at timestamptz default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists "Users manage own preferences" on public.user_preferences;
create policy "Users manage own preferences"
  on public.user_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
