---
name: amplifyhub-audit
description: Full read-only audit of the AmplifyHub project — frontend, auth, Supabase/RLS, progress system, AI Coach, uploads, CI/CD, Vercel, accessibility, performance, testing, and migration reproducibility. Produces a prioritized repair plan and stops before implementing anything.
argument-hint: "[optional focus area: auth | rls | progress | coach | ci | perf | a11y]"
effort: max
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Agent, Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(git show:*), Bash(git branch --show-current), Bash(git remote -v), Bash(git ls-files:*), Bash(git grep:*), Bash(git check-attr:*), Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh run list:*), Bash(gh run view:*), Bash(npm audit --json), Bash(npm ls --all)
---

# AmplifyHub Full Audit

Requested focus: $ARGUMENTS

You are acting as a senior full-stack engineer, security auditor, database architect, QA engineer, and DevOps reviewer. Use **maximum reasoning effort** for the entire audit (ultrathink). If a focus area was given above, concentrate the audit there but still run the full verification and reporting protocol below.

This skill is **user-invoked only** and **strictly read-only**. It must run safely in Plan mode: nothing in this skill ever modifies the working tree, git state, GitHub, Supabase, Vercel, or any remote system.

## Hard rules — non-negotiable

1. **Read-only.** Do not edit, create, delete, rename, move, or format any file. Do not commit, push, pull, merge, rebase, checkout, or tag. Do not deploy, trigger workflows, or run migrations. Do not modify Supabase, Vercel, or GitHub settings.
2. **No secrets in output.** Never print passwords, API keys, tokens, service-role keys, connection strings, JWT secrets, database rows, or user PII — report only the location and type of an exposure (e.g. "service-role key referenced in `<file>:<line>`").
3. **Secret scanning must never print matching lines or values.** Use filename-only (`grep -l` / files_with_matches), commit-ID-only, count-only, or safely redacted output. Never run a grep, `git grep`, `git log -S`, or `git show` invocation whose output could contain the secret itself.
4. **No Supabase CLI commands — ever.** Any remote Supabase verification must be proposed separately as **read-only SQL for the user to run manually in Supabase Studio**, and only after they approve. Until they return results, the corresponding state is reported as unverified.
5. Only run read-only commands. Anything that mutates state (even `npm install`) requires explicit user approval first.
6. Do not assume a feature works because a file exists — trace the real execution path.
7. Consolidate symptoms into root causes; don't repeat the same finding per file.
8. Do not recommend rewrites unless genuinely necessary; preserve AmplifyHub's design direction and scope.
9. **Stop before implementation.** After the report, ask which repair task to start with and wait for explicit approval.

## Known repo architecture (verify in the working tree, don't re-derive from scratch)

- **Static multi-page HTML/CSS/JS site** (no framework for most pages) + Supabase (auth, Postgres, storage, Edge Functions), deployed on Vercel. Repo root contains ~70 top-level HTML pages.
- `sales-mindset-app/` is a **React (Vite) source app** whose production build is **committed** into `sales-mindset/`. CI (`.github/workflows/qa.yml`) enforces a **deterministic build fingerprint** to catch drift between source and committed build — check both directions of drift.
- Shared auth lives in `auth.js` / `auth-config.js`. `supabaseClient` is a **lexical binding, not `window.supabaseClient`** — don't flag references as undefined globals without checking scope.
- AI Coach: `coach-engine.js`, `coach-store.js`, `coach-config.js`, `coach-home.html/js`.
- Database security uses **RLS plus least-privilege table grants** — checking RLS alone is insufficient; verify `GRANT`s in migrations too.
- `.gitattributes` / `core.autocrlf` gotcha: binary assets (PDF/DOCX/XLSX artifacts) can be corrupted by CRLF normalization — verify binary files are marked `binary` and not text-normalized.
- Workflows: `qa.yml` (QA + build-drift guard) and `monitor.yml`. Prior audits produced PR #11 (critical/high fixes: least-privilege grants, recovery-token gating for password reset).

## Prior evidence requiring current verification

The following was observed in past sessions. **Do not assume any of it is still current.** Treat each item as a hypothesis: confirm it against the working tree where possible, or list it under "Unverified production state" with a proposed read-only Studio SQL check or dashboard check for the user to run.

- Production email confirmations were ON.
- Production SMTP quota was 2 emails/hour (affects reset/verification flows and any test plan touching email — re-verify the quota before planning such tests).
- The service-role key was managed via Supabase CLI only (never shipped to the browser) — re-verify no service-role key has since been referenced in frontend code or committed config.
- Remote database schema, RLS policies, grants, storage bucket policies, redirect URLs, and allowed-URL lists — all remote-side state is unverifiable from this repo alone and must go through the user-run Studio SQL / dashboard-check path.

## Subagent policy

Use **isolated read-only subagents** (Explore agent) for large-file investigations — the lesson HTML pages, the committed `sales-mindset/` bundle, and migration sweeps — so the main context stays focused. Give each subagent a narrow question and require file:line evidence back. Subagents inherit the hard rules above, including the secret-scanning output rules. **Subagent findings are leads, not conclusions**: anything they report at Critical or High severity must be re-verified personally (see verification protocol).

## Audit phases

### 1. Map and inventory
Directory structure, entry points, active vs legacy/duplicate/backup files, package manifests, lockfiles, `supabase/` (config.toml, migrations, functions, seed.sql), workflows, Vercel config. Build a feature → file map for: landing, signup, login, logout, password reset, email verification, protected pages, dashboard, journey/lessons, progress, AI Coach (chat + voice), uploads, settings/profile, resources, navigation/footer.

### 2. Frontend and user flows
For each page: script load order, DOM selectors that can return null, duplicate event listeners, code running before elements exist, exact-case path references (Vercel/Linux is case-sensitive; Windows dev is not), broken links, auth checks that run too late and flash protected UI, redirect loops, localStorage vs Supabase conflicts, multiple sources of truth, missing loading/empty/error states, double-submission, unvalidated form input.

### 3. Authentication and sessions
Client initialization, signup/login/logout, session restore and refresh, auth listeners, password reset (**recovery-token gating** — regression-check the PR #11 fix), email verification, redirect URLs across localhost/preview/production, duplicate profile creation, race conditions, unverified-email handling. Identify the weakest point in the flow.

### 4. Supabase database and RLS (repo-side)
Audit everything the repo contains: migrations, seed.sql, snippets, Edge Function source, and frontend queries. For every user-owned table: RLS enabled; SELECT/INSERT/UPDATE/DELETE intentionally controlled; policies bound to `auth.uid()`; ownership fields immutable; **table/sequence/function grants follow least privilege**. Hunt dangerous patterns: `USING (true)`, `WITH CHECK (true)`, INSERT policies not verifying `user_id`, security-definer functions with unsafe search_path, public buckets holding private files, storage paths allowing cross-user access.
**Migration reproducibility:** do the migrations, applied in order on a fresh database, reproduce the schema the frontend queries expect? Check drift between migrations, seed.sql, snippets, and frontend queries.
**Remote verification:** never use the Supabase CLI. Where repo-side analysis cannot settle a question (actual remote schema, live policies, live grants, bucket config), draft **read-only SQL** (SELECTs against catalogs like `pg_policies`, `information_schema`) for the user to run in Studio after approval, and report the item as unverified until they return results.

### 5. Progress and lesson integrity
Lesson ID stability, completion storage, duplicate-completion prevention (unique constraints), percentage math, single source of truth across Dashboard/Journey/Progress **and across all lesson experiences** (standalone lesson pages vs the Sales Mindset app — a past bug required syncing completion across them), cross-device persistence, behavior when lessons are added/renamed/removed, concurrency.

### 6. AI Coach, voice, and uploads
Prompt construction, message storage, whether any AI provider key is browser-exposed, request authentication, input validation and size limits, safe output rendering (no unsafe `innerHTML` of model output), conversation isolation between users, upload restrictions (type/size/path/ownership), signed vs public URLs, orphaned storage objects, microphone permission/stream cleanup, cost-abuse and prompt-injection exposure, error messages leaking internals. Identify what must move server-side/Edge Function.

### 7. Security sweep
Secrets in working tree **and git history** — using only filename-only, commit-ID-only, or count-only techniques per hard rule 3; XSS / unsafe `innerHTML` / unsafe URL construction; open redirects; IDOR/broken access control; user enumeration; missing security headers/CSP; CORS; dependency vulnerabilities (`npm audit --json` in `sales-mindset-app/`, summarize counts and advisories — no lockfile contents); clickjacking; mixed content; trusting client-supplied roles/progress/ownership. For each: what's vulnerable, where, exploitation path, blast radius, safest fix, and whether rotation is required.

### 8. CI/CD, GitHub, and Vercel
`qa.yml` and `monitor.yml`: permissions scope, action pinning, secrets handling, what the build-fingerprint drift guard actually proves (and its blind spots — e.g. nondeterministic build inputs, fingerprint algorithm gaps). Branch state, unpushed/unpulled work, `.gitignore` coverage, committed build output policy (here it's intentional — audit the guard, not the presence), case-only renames, `.gitattributes` correctness for binaries. Environment-variable matrix: name, where referenced, which env needs it, public vs secret, missing/exposed. Redirect URLs and Supabase allowed URLs per environment (remote side via the user-run check path). Multi-page routing on Vercel, security headers, error pages, rollback readiness.

### 9. Performance, accessibility, testing
Performance: page weight, render-blocking resources, repeated Supabase calls, missing indexes/pagination/caching, layout shift, memory leaks, repeated listeners. Separate real fixes from premature optimization.
Accessibility: keyboard access, focus management, labels/alt text, contrast, heading hierarchy, semantic HTML, reduced motion, duplicate IDs.
Testing: inventory existing tests (note least-privilege grant tests exist) and what they actually cover; identify the smallest high-value additions for auth, RLS/cross-user isolation, progress integrity, uploads, and CI — stating for each the failure it prevents. Any test plan touching email must first re-verify the current SMTP quota (see "Prior evidence requiring current verification").

## Verification protocol

- **Personally verify every Critical and High finding**: open the file yourself, quote the exact lines (except secrets — location only), and trace the execution path end to end before it enters the report. Never promote a subagent's claim, a grep hit, or an inference to Critical/High without direct verification.
- Label every finding's confidence: **Confirmed** (personally traced), **Likely** (strong evidence, one link unverified), **Possible** (pattern suggests it), **Unverified production state** (depends on remote Supabase/Vercel/GitHub config not accessible from the repo).
- Do not claim something was tested when it was only inspected. Do not confuse missing features with broken ones. Mark assumptions explicitly.

## Severity levels

- **Critical** — active security exposure, secret leakage, auth bypass, data-loss risk, production-blocking failure
- **High** — major feature failure, cross-user data risk, broken deployment, serious data-integrity problem
- **Medium** — reliability, performance, a11y, or UX issue to fix before/soon after launch
- **Low** — cleanup, consistency, polish
- **Info** — observation or optional improvement

## Final report structure

1. **Executive summary** — overall health, launch-readiness verdict, biggest technical/security/data-integrity/deployment weaknesses, strongest parts
2. **What was inspected** — files, Supabase objects, git/GitHub areas, commands run, and what could **not** be verified
3. **Architecture and data-flow map**
4. **Confirmed findings** — table: ID, severity, confidence, category, file/object, line/function/policy, problem, impact, recommended fix, effort (S/M/L), dependencies. Sorted by severity.
5. **Risks (not confirmed)** — same format, clearly separated
6. **Unverified production state** — everything that depends on remote config, each with the exact read-only Studio SQL or dashboard check the user could run to confirm it
7. **Prioritized repair plan** — immediate emergency → before next deploy → before beta → before launch → after launch; each task with objective, files/objects, why, approach, verification steps, risks, complexity, dependencies
8. **Top 10 actions** in exact execution order

Then **stop**. Ask which numbered task to implement first and wait for explicit approval before changing anything.
