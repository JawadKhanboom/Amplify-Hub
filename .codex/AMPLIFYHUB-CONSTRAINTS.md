# AmplifyHub — repo constraints (read before any task)

Applies to every task in this repo. Breaking any of these breaks production.

## Architecture
- **Static multi-page site** at the repo root: ~70 hand-written `.html` files, each with
  inline `<script>` blocks. There is **no build step for the root HTML** — files are
  served as-is by Vercel (`cleanUrls: true`, so `/dashboard` serves `dashboard.html`).
- `sales-mindset-app/` is a separate **Vite/React app** (the lesson player). All npm
  scripts live there, not at the repo root. There is no root `package.json`.
- Backend is **Supabase** (project ref `dsuahpcqrrlbudomjrye`): Postgres + Auth +
  Storage + two Edge Functions.

## Hard rules

### 1. CSP is ENFORCED — no new external origins
`vercel.json` sends a real `Content-Security-Policy` (not report-only). The only
allowed external origins are Google Fonts and the Supabase project URL. **Do not add
any CDN script, stylesheet, font, or image.** Anything you add must be self-hosted or
inlined, or the page silently breaks in production.

### 2. supabase-js is self-hosted — never link a CDN
Loaded from `assets/vendor/supabase-2.110.8.min.js`. A CI guard verifies the vendored
copy matches the pinned package. Do not swap it for a CDN URL or bump it casually.

### 3. `supabaseClient` is a lexical const, NOT `window.supabaseClient`
`auth-config.js` declares `const supabaseClient = supabase.createClient(...)`. It is a
top-level lexical binding, so `window.supabaseClient` is **undefined**. Reference it
bare, and feature-detect with `typeof supabaseClient !== 'undefined'`.

### 4. Never delete anything without asking the owner
Standing rule. Some orphan files/tables are kept deliberately. Flag removal candidates
with evidence; do not act on them.

### 5. Don't touch the `coach-chat` edge function
`supabase/functions/coach-chat/` holds the Gemini API key, request validation, rate
limiting, and CORS allowlist. It is security-sensitive and out of scope unless a task
explicitly says otherwise.

## Database conventions
- Migrations live in `supabase/migrations/` named `<UTC timestamp>_<snake_case>.sql`.
- **Every** user-data table has RLS enabled with owner-scoped policies. House pattern:
  ```sql
  user_id uuid not null references auth.users(id) on delete cascade
  ```
  and policies keyed on the user. All FKs to `auth.users` cascade on delete.
- Use `(select auth.uid())` in policy expressions, **not** bare `auth.uid()` — the bare
  form re-evaluates per row and Supabase's performance advisor flags it.
- Add a covering index for every foreign key (the advisor flags missing ones).
- Client-side writes to catalog/content tables are revoked; only user-owned rows are
  client-writable.

## Verification (CI: `build-and-qa` must stay green)
Run from `sales-mindset-app/`:
- `npm run typecheck`, `npm run build`
- QA suites: `qa`, `qa:resources`, `qa:progress`, `qa:progress-sync`, `qa:challenges`,
  `qa:profile-progress`, `qa:account-trust`, `qa:coach-security`, `qa:ui-polish`,
  `qa:booking`
- If you touch `sales-mindset-app/`, the **committed bundle guard** will fail unless you
  rebuild and commit the output. Windows minifier quirk: emits hybrid escaped-`\r` +
  raw-LF inside template literals.
- After editing the resource catalog: `npm run generate:resources` **and**
  `npm run generate:resource-migration`.

## Workflow
- **One branch per agent.** Never work on a branch another agent is using.
- Branch off current `origin/main`. One PR per phase/task.
- Only owned or properly licensed assets — a prior copyright strike came from reused
  third-party media.
