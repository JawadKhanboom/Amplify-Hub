# TASK — quick wins (small, mechanical, verifiable)

Read `.codex/AMPLIFYHUB-CONSTRAINTS.md` first. Branch: `codex/quick-wins` off current
`origin/main`. One PR. These are independent of the Resources Phase 2 task and can run
in parallel — they touch different files.

## 1. Add covering indexes for two unindexed foreign keys
Supabase's performance advisor flags both. New migration:
- `public.user_challenge_assignments.challenge_id`
- `public.user_challenge_feedback.user_id`

## 2. Rewrite four RLS policies to avoid per-row `auth.uid()`
These four re-evaluate `auth.uid()` for **every row** instead of once per query.
Replace bare `auth.uid()` with `(select auth.uid())` in the policies on:
- `public.user_preferences`
- `public.user_lesson_progress`
- `public.user_challenge_assignments`
- `public.user_challenge_feedback`

Behaviour must be identical — this is purely a query-plan optimisation. Preserve each
policy's existing name, command, and roles.

Note: `coach_documents`, `coach_messages`, and `coaching_sessions` are reported to carry
**duplicate** owner-scoped ALL policies (one using `auth.uid()`, one using
`(select auth.uid())`). Verify against the live DB. If a genuine duplicate exists,
**report it — do not drop anything** (no deletions without the owner's approval).

## 3. Add Open Graph tags to `book-appointments.html`
It's the only user-facing page missing them. Copy the pattern from a neighbouring page
(e.g. `resources.html`). The `og:image` **must be an absolute URL** — relative paths
break link previews, which is why the existing pages use absolute.

## Acceptance criteria
- [ ] Advisors report no new warnings, and the two unindexed-FK warnings are gone
- [ ] The four `auth_rls_initplan` warnings are gone
- [ ] No policy changes semantics — same name, command, roles, and effective access
- [ ] `book-appointments.html` has complete OG tags with an absolute `og:image`
- [ ] `build-and-qa` CI green
- [ ] Nothing deleted

## Explicitly NOT in scope
- `resource_catalog_category_idx` shows `idx_scan = 0`, but the table only has 25 rows,
  so Postgres would prefer a seq scan regardless. It is **not** proof the index is
  useless. Leave it.
- Leaked-password protection is a Supabase Pro feature and unavailable on this plan.
