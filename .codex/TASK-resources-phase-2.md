# TASK — Resource Library, Phase 2: user activity (bookmarks, ratings, recents, downloads)

Read `.codex/AMPLIFYHUB-CONSTRAINTS.md` first. Branch: `codex/resources-phase-2` off
current `origin/main`. One PR.

## Background
The Practical Resource Library is a 4-phase build. **Phase 1 shipped and merged**
(PR #6): 25 original SDR resources, a static catalog at `assets/resource-catalog.js` as
the single source of truth, a rebuilt public `resources.html`, a reusable
`resource.html` detail page, 50 pre-generated committed downloads, and the
`resource_catalog` Supabase table (public read of `active AND status='reviewed'` only,
client writes revoked).

Phase 1 deliberately **stubbed** bookmark and rating as sign-in prompts. Phase 2 makes
them real. Phases 3 (interview-prep rewrite) and 4 (AI Coach interview mode) are
separate, later tasks — **do not start them here.**

## Verified current state (checked against the live DB and working tree — trust this)
- Neither `user_resource_activity` nor `user_interview_prep` exists yet. Phase 2 is
  entirely unstarted.
- **`public.resource_catalog.id` is `text`, NOT uuid.** Its primary key is
  `resource_catalog_pkey PRIMARY KEY (id)`. Any FK referencing it must be `text`.
- Full `resource_catalog` shape: `id text` (PK), `title text`, `category text`,
  `skill text`, `difficulty text`, `duration_minutes int`, `summary text`,
  `objectives jsonb`, `content jsonb`, `example jsonb`, `safe_practice text`,
  `related_label text`, `related_route text`, `downloads jsonb`, `review_date date`,
  `status text`, `active boolean`.
- Existing user tables that already follow the house RLS pattern, use them as reference:
  `user_preferences`, `user_lesson_progress`, `user_challenge_assignments`.

### The stubs you are replacing
`resource.html` lines ~273–289:
```js
var bookmarkBtn = el('button','tb','🔖 Bookmark');
...
var saveNote = el('div','save-note'); saveNote.style.display='none';
saveNote.appendChild(document.createTextNode('Saving, synced history, and ratings are coming with accounts. '));
...
function promptSignIn(){ saveNote.style.display='block'; toast('Sign in to save — coming soon.'); }
bookmarkBtn.addEventListener('click', promptSignIn);
usefulBtn.addEventListener('click', promptSignIn);
```
Signed-out users must keep getting the sign-in prompt. Only signed-in users get real
persistence.

`resources.html:133` also advertises the future state:
`"Reading and downloads are free and open. Sign in later to bookmark and sync."`
Update this copy once the feature is real.

### Legacy localStorage migration — exact field map
`interview-prep.html:224` defines:
```js
const PORTFOLIO_KEY='amplifyHub_sdrPortfolio';
const fields=['Opener','Objections','Rejection','Routine','Why'];
```
The stored object shape is:
```js
{ Opener: string, Objections: string, Rejection: string,
  Routine: string, Why: string,
  firstCallDone: boolean,      // mirrors the challenge button's .done class
  updatedAt: number }          // Date.now() epoch ms
```
Migration rule: **fill empty cloud fields only** — never overwrite a non-empty server
value with local data. Write a `legacy_migrated_at` marker so it runs exactly once per
user.

## Deliverables

### 1. Migration — `user_resource_activity`
One row per (user, resource). Suggested columns:
- `user_id uuid not null references auth.users(id) on delete cascade`
- `resource_id text not null references public.resource_catalog(id) on delete cascade`
  — **text**, per the verified schema above
- `bookmarked boolean not null default false`
- `rating` — the UI is a single "useful" affordance, so a nullable boolean
  (`helpful boolean`) models it better than a 1–5 int. Pick one and be consistent with
  the UI; don't invent a star rating that has no interface.
- `last_viewed_at timestamptz`
- `download_count int not null default 0`
- `created_at` / `updated_at timestamptz not null default now()`
- Primary key `(user_id, resource_id)`
- Index on `user_id` (and any FK you add)

### 2. Migration — `user_interview_prep`
One row per user, holding the five portfolio fields plus:
- `first_call_done boolean not null default false`
- `legacy_migrated_at timestamptz` (the one-time-migration marker)
- `updated_at timestamptz not null default now()`
- `user_id uuid primary key references auth.users(id) on delete cascade`
  (mirrors `user_preferences`, which is 1:1 per user)

### 3. RLS on both tables
Owner-scoped select/insert/update/delete using `(select auth.uid()) = user_id`.
No anonymous access.

### 4. Wire the UI
- `resource.html`: real bookmark toggle + "useful" rating for signed-in users, reading
  and writing `user_resource_activity`. Preserve the sign-in prompt for signed-out.
- Record `last_viewed_at` on detail-page view and increment `download_count` on download.
- `resources.html`: surface bookmarked / recently-viewed for signed-in users, and update
  the stale "sign in later" copy.
- Follow the existing data-access style — look at how `coach-store.js` wraps Supabase
  calls before inventing a new pattern.

### 5. Tests
Extend `sales-mindset-app/scripts/qa-resources.mjs` (run with `npm run qa:resources`).
Cover at minimum: signed-out still sees the prompt and writes nothing; signed-in
bookmark round-trips; the legacy migration fills only empty fields and doesn't re-run.

## Acceptance criteria
- [ ] Both migrations apply cleanly; RLS enabled with owner-scoped policies on both
- [ ] Supabase security + performance advisors report **no new** warnings (every FK has
      a covering index; policies use `(select auth.uid())`)
- [ ] Signed-out behaviour is unchanged (still prompts, persists nothing)
- [ ] Signed-in bookmark/rating/recents persist across reload and across devices
- [ ] Legacy `amplifyHub_sdrPortfolio` migrates once, fills empty fields only, sets
      `legacy_migrated_at`
- [ ] `npm run qa:resources` passes with new coverage; full `build-and-qa` CI green
- [ ] No new external origins (CSP), no CDN links, no deletions

## Out of scope
Phase 3 (`interview-prep.html` rewrite), Phase 4 (AI Coach interview mode), any change
to `coach-chat`, and any edit to resource **content** (the 25 items are in editorial
review — `status='draft'`; don't flip statuses).

## Open question for the owner — ask, don't guess
The rating UI is currently a single "useful" button. If a 1–5 star rating is wanted
instead, that's a UI change too. Confirm before modelling it as an int.
