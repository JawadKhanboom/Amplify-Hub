-- Phase 2 of Supabase audit: descriptive COMMENT ON for tables, columns, views, functions.
-- No structural/data changes. Safe, additive metadata only.
--
-- NOTE: applied directly to the linked project on 2026-07-25 and back-filled
-- into the repo afterwards so local and remote migration history match.

-- Tables
COMMENT ON TABLE public.coaching_sessions IS 'AI roleplay coaching session: mode, scenario, persona, scores and feedback report for one practice conversation. Written/read by the coach-chat edge function and the practice UI.';
COMMENT ON TABLE public.coach_messages IS 'Individual chat turns (user/assistant) within a coaching_sessions roleplay. Written by the coach-chat edge function, read by the session transcript UI.';
COMMENT ON TABLE public.coach_documents IS 'User-uploaded documents used as extra context for the AI Coach (name, mime, extracted text). Currently empty; feature may be unreleased.';
COMMENT ON TABLE public.user_preferences IS 'Per-user app settings and profile fields (theme, goals, difficulty, timezone, etc), one row per auth user. Read/written by the settings UI.';
COMMENT ON TABLE public.user_lesson_progress IS 'Tracks which lessons (lesson_id like m1l2) a user has completed and when. Read/written by the lessons UI.';
COMMENT ON TABLE public.challenge_catalog IS 'Catalog of daily-challenge definitions (skill, tier, difficulty, verification rules). Read by get_or_assign_daily_challenges() to assign challenges.';
COMMENT ON TABLE public.user_challenge_assignments IS 'Daily challenge assignments per user (status, progress, xp_awarded). Written by the challenge RPCs (get_or_assign_daily_challenges, start_challenge, submit_challenge, replace_challenge).';
COMMENT ON TABLE public.user_challenge_feedback IS 'Thumbs up/down plus optional reason a user gives on a completed challenge. Written by rate_challenge().';
COMMENT ON TABLE public.resource_catalog IS 'Library of scripts/templates/cheatsheets/worksheets shown to users. Publicly readable when active and reviewed.';
COMMENT ON TABLE public.contact_messages IS 'Contact-form submissions (name, email, subject, message). Open INSERT for anonymous visitors from the public contact form.';
COMMENT ON TABLE private.coach_api_usage IS 'Rate-limit ledger for the AI Coach quota (chat/feedback buckets). Written/read only via consume_coach_quota(); no direct table access (RLS enabled, no policies).';

-- Columns (non-obvious ones only)
COMMENT ON COLUMN public.coaching_sessions.scores IS 'Per-category numeric scores (opening, discovery, objection, communication) captured at session end, keyed by category name.';
COMMENT ON COLUMN public.coaching_sessions.feedback_report IS 'Structured AI-generated feedback for the session (freeform jsonb from the coach-chat function).';
COMMENT ON COLUMN public.coaching_sessions.turns IS 'Count of conversational turns exchanged in this session.';
COMMENT ON COLUMN public.coach_messages.kind IS 'Message content type, e.g. text (default); extend for other message kinds as needed.';
COMMENT ON COLUMN public.coach_messages.meta IS 'Freeform per-message metadata from the coach-chat function.';
COMMENT ON COLUMN public.user_preferences.timezone IS 'IANA timezone used to compute "today" for daily challenges (private.challenge_local_date); defaults to Asia/Karachi.';
COMMENT ON COLUMN public.user_lesson_progress.lesson_id IS 'Lesson identifier, format mXlY (module X, lesson Y); enforced by CHECK constraint.';
COMMENT ON COLUMN public.challenge_catalog.tier IS 'Challenge grouping shown per day: quick, core, or stretch; one active assignment per tier per day.';
COMMENT ON COLUMN public.challenge_catalog.verification_config IS 'Per-challenge parameters consumed by submit_challenge() to verify completion (e.g. lesson_id, min_score, mode).';
COMMENT ON COLUMN public.challenge_catalog.verification_type IS 'How submit_challenge() verifies this challenge: reflection, work_sample, lesson, or coach.';
COMMENT ON COLUMN public.user_challenge_assignments.evidence IS 'User-submitted proof of completion (freeform text or verification payload), set by submit_challenge().';
COMMENT ON COLUMN public.user_challenge_assignments.status IS 'assigned -> in_progress -> completed, or replaced if swapped via replace_challenge().';
COMMENT ON COLUMN public.resource_catalog.status IS 'draft or reviewed; only reviewed + active resources are publicly readable (see RLS policy).';
COMMENT ON COLUMN private.coach_api_usage.bucket IS 'Quota bucket this request counted against: chat or feedback.';

-- View
COMMENT ON VIEW public.user_progress_stats IS 'Per-user aggregate coaching stats (avg scores by category, total sessions, most-practiced scenario) derived from coaching_sessions. Used by the progress/dashboard UI.';

-- Functions (public RPCs missing descriptions; consume_coach_quota already documented)
COMMENT ON FUNCTION public.get_or_assign_daily_challenges() IS 'Returns the caller''s daily challenge set (quick/core/stretch), assigning new ones from challenge_catalog if not already assigned today; also computes completion summary and streak. Called via RPC from the challenges UI.';
COMMENT ON FUNCTION public.rate_challenge(p_assignment_id uuid, p_helpful boolean, p_reason text) IS 'Records helpful/not-helpful feedback (with optional reason) on a completed challenge assignment, upserted into user_challenge_feedback. Called via RPC from the challenge detail UI.';
COMMENT ON FUNCTION public.replace_challenge(p_assignment_id uuid, p_reason text) IS 'Swaps the caller''s current-tier challenge for a different one (max once per day), marking the old assignment replaced. Called via RPC from the challenges UI.';
COMMENT ON FUNCTION public.start_challenge(p_assignment_id uuid) IS 'Marks a challenge assignment in_progress and returns its action_url route. Called via RPC when a user begins a challenge.';
COMMENT ON FUNCTION public.submit_challenge(p_assignment_id uuid, p_evidence jsonb) IS 'Verifies a challenge''s completion criteria (reflection/work_sample/lesson/coach) and marks it completed with XP awarded. Called via RPC when a user submits proof.';
COMMENT ON FUNCTION private.challenge_focus_skill(p_user_id uuid) IS 'Infers the user''s weakest coaching skill from their latest session scores (fallback: lesson progress count) to bias which challenge is prioritized.';
COMMENT ON FUNCTION private.challenge_local_date(p_user_id uuid) IS 'Computes "today" in the user''s preferred timezone (user_preferences.timezone), falling back to Asia/Karachi then UTC.';
