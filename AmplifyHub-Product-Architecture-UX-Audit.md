# AmplifyHub — Product, Architecture & UX Audit

*Prepared as Product Manager / SaaS Architect / UX Auditor review · July 2026*

Scope: full read of the website codebase (~30 HTML pages, shared `auth.js`/`coach-*.js` modules) and the Supabase project (edge function `coach-chat`, `user_preferences.sql`, `config.toml`). This is a review, not a rewrite — every recommendation below is scoped to fit your existing static HTML/Supabase architecture with no framework migration and no new tooling.

---

## Executive Summary

AmplifyHub's core bet — pairing a structured beginner curriculum with a real LLM-powered roleplay coach — is further along than the internal architecture doc suggests. The AI Coach isn't a "Phase 1 local rules" prototype anymore; it's already live on Google Gemini 2.5 Flash through a Supabase Edge Function, with persona/scenario/difficulty controls and structured JSON-graded feedback. That's a genuinely strong, hard-to-copy differentiator for a beginner-focused product, and it's the best-engineered part of the codebase.

Two things need attention before this goes in front of real users, and neither is a big lift:

1. **The AI Coach endpoint is open to the entire internet, unauthenticated.** `verify_jwt = false` plus wide-open CORS plus a client that sends the public anon key instead of the user's real session token means anyone who finds the URL can burn your Gemini budget indefinitely, with no login required. This is the single highest-priority fix.
2. **Progress tracking — an explicit MVP feature — isn't actually tracked anywhere durable.** Journey progress and the Interview Prep portfolio live only in browser `localStorage`. A student who studies on their phone and opens the site on a laptop sees zero history. Clearing browser data erases it permanently. Meanwhile the AI Coach data sits properly in Supabase with row-level security. The product has two data architectures living side by side.

Everything else is in good shape for an MVP: the auth flow, the dashboard's new-vs-returning-user states, and the AI Coach's technical design are all solid. The rest of this document details what's working, what's risky, and a concrete 30-day plan that fixes the two issues above first, then closes the gap between what the landing page promises (a "personalized journey") and what the product currently delivers.

---

## 1. Full Project Audit

### What's working well

The shared-module convention is the strongest architectural decision in the codebase. `auth-config.js` → `auth.js` → `requireAuth()` is loaded in the same order on every protected page (dashboard, journey, progress, interview-prep, profile, settings, coach-home), and it's genuinely reused rather than copy-pasted per page. The AI Coach follows the identical pattern one layer deeper: `coach-config.js` (data/config, no secrets) → `coach-store.js` (Supabase data layer) → `coach-engine.js` (conversation orchestration + provider abstraction) → `coach-ui.js` (DOM controller). This is a clean separation for a no-build-step static site — each layer can be swapped without touching the others, which is exactly what let the team move from local rule-based replies to a real Gemini backend without touching the UI code at all.

The dashboard is well-built: skeleton loading states, distinct CSS-driven "new user" vs. "active user" presentations, animated counters, and a real activity feed pulled live from `coaching_sessions`. The signup flow correctly branches on whether Supabase email confirmation is on or off, which is an easy thing to get wrong and wasn't.

The AI Coach's server-side design is more sophisticated than a typical MVP roleplay feature: persona (who), scenario (what kind of call), and difficulty (how hard) are three independent, composable dimensions, and end-of-session feedback uses a structured JSON schema (`FEEDBACK_SCHEMA`) so scores are reliably parseable rather than scraped from free text. That's a real product advantage, covered more in Section 6.

### What's weak

There is no CSS file anywhere in the project — every one of the ~30 HTML pages ships its own complete `<style>` block, each redefining its own `:root` color tokens, resets, animation keyframes, and responsive breakpoints. At the current page count this hasn't caused a functional bug, but it's already visible as drift: the marketing pages use `--accent:#FFC700` while the app shell (dashboard, coach-home) uses `--accent:#FFD54A` — a small but real brand inconsistency from the exact duplication this creates.

The learning curriculum is defined entirely inline inside `journey.html`'s `<script>` block: 10 modules, ~41 lessons, with names, durations, and XP values hardcoded in a JS array. Only Module 1 ("Sales Mindset," 8 lessons) has actual content pages built. Modules 2 through 10 — Finding Prospects, Building Your Script, Opening the Call, Discovery Questions, Objection Handling, Booking Appointments, Follow-up, Live Practice, Mastery — exist only as locked entries with real-sounding names and descriptions. The UI presents a 10-module curriculum as if it's real and waiting; only 10% of it currently exists.

Non-functional UI is present in a couple of places: the "G Google" and "🍎 Apple" buttons on both sign-in and sign-up have no click handlers or OAuth wiring at all — they're inert. `settings.html` calls `supabaseClient.functions.invoke('delete-account')` on account deletion, but the only Edge Function in the project is `coach-chat`; that call will fail in production today.

### What's risky

**The `coach-chat` Edge Function has no authentication.** This is covered in depth in Section 2, but it belongs in this list because it's the single biggest risk in the codebase: an unauthenticated, wide-open CORS endpoint sitting in front of a paid LLM API.

**Split data architecture.** AI Coach sessions, messages, documents, and preferences live in Supabase Postgres with RLS (`auth.uid() = user_id`) — durable, per-account, cross-device. Journey progress (`amplifyHub_journeyProgress`) and the Interview Prep portfolio live only in `localStorage`, keyed to nothing but the browser. The dashboard actually stitches both together at render time (Supabase for coach stats, localStorage for the journey progress ring), which works today but means there are two sources of truth with no reconciliation logic — easy to drift, and the localStorage half is invisible to you as the operator (no way to see aggregate journey completion across users without instrumenting it).

**The onboarding quiz collects and discards data.** The landing page's 4-question modal ("What brings you here / experience level / biggest challenge / #1 goal") is well-built — accessible, keyboard-navigable, focus-trapped — but the `answers` object it builds lives only in a local JS closure. It's never sent to signup, never persisted, never used anywhere. The modal's final screen says "Your personalized cold calling journey is ready," which isn't true yet — nothing downstream reads those answers.

### What will create problems later

Documentation drift: `AI-COACH-ARCHITECTURE.md` describes the current state as "Phase 1 implemented, Phases 2–5 designed," but the actual code is already well into what the doc calls Phase 3 (Supabase persistence *and* a live LLM Edge Function). If this doc is the onboarding reference for the next person (or the next AI assistant) who touches this code, they'll under-estimate what's already built and may re-architect something that already works. Worth a 15-minute doc update.

The CSS duplication and inline-per-page curriculum data will get more expensive to maintain with every module you add — not urgent now, but worth a light shared-stylesheet pass once the page count or design stabilizes, rather than before.

---

## 2. Architecture Review — AI Coach

**Is this architecture scalable? Yes, structurally.** The config → store → engine (providers) → ui layering is the right shape: `coach-store.js` can be swapped or extended without `coach-ui.js` knowing, and `coach-engine.js`'s `RemoteProvider` abstraction means switching from Gemini to OpenAI or Anthropic later is a server-side Edge Function change, not a client rewrite. This is good architecture for a no-build-step static site — keep this pattern for anything new you add to the coach.

**What should stay:** the four-file separation (config/store/engine/ui), the persona/scenario/difficulty composability, the structured JSON feedback schema, and the RLS-protected Supabase tables for sessions/messages/docs/preferences. Don't refactor any of this before launch — it's sound.

**What should change, before anything else:**

**1. Lock down the `coach-chat` Edge Function.** Three compounding issues make this endpoint effectively public:
- `supabase/config.toml` sets `verify_jwt = false` for this function, so Supabase performs no JWT check before invoking it.
- The client (`coach-engine.js`) sends `supabaseClient.supabaseKey` — the public anon/publishable key — as both the `apikey` and `Authorization: Bearer` headers, instead of the logged-in user's actual session `access_token`. Even if `verify_jwt` were re-enabled, this wouldn't identify the calling user.
- `corsHeaders` sets `Access-Control-Allow-Origin: '*'`.

Combined, anyone who opens devtools, copies the URL out of `coach-config.js`, and scripts a loop against it gets unlimited, free, unauthenticated access to your Gemini quota — no signup, no login, no rate limit. This is not a theoretical risk; it's the kind of endpoint that gets found and abused within days of getting any traffic or GitHub visibility. Fix: forward `session.access_token` from the authenticated client instead of the anon key, re-enable `verify_jwt` (or manually validate the JWT inside the function and derive `user_id` from it), and restrict CORS to your real origin.

**2. Enforce the limits you've already configured but never applied.** `CoachConfig.remote.historyWindow: 20` exists but `coach-engine.js`'s `send()` fetches the *entire* message history for a session via `CoachStore.getMessages(s.id)` with no slicing — every turn in a long session re-sends the full transcript to Gemini, growing cost and eventually risking a context-length error. Similarly, `CoachConfig.limits.minFeedbackTurns` is defined but never checked before `getFeedback()` runs — a 1-message exchange can currently get a fabricated, confidently-scored performance report.

**3. Add a basic per-user rate limit** (even a simple counter row per user per hour) before generating a reply — this matters more once #1 is fixed and traffic is real, to keep one enthusiastic user from accidentally running up a large bill in a single session.

**Mistakes to avoid — you've already made the first one, so this is really "mistakes to fix before you scale":** the mistake most teams make when wiring an LLM behind Supabase isn't a modeling mistake, it's exactly this — treating the anon key as if it authenticates the user, and leaving `verify_jwt` off "for now" during development and forgetting to turn it back on. Everything else about the integration (provider abstraction, system-prompt composition server-side so prompts can't be tampered with client-side, structured output schema for grading) is done correctly and is worth keeping as the template for any future model swap.

---

## 3. UX Audit — First Experience Walkthrough

**Landing page.** Strong: repeated, low-friction CTAs (nav, hero, closing "mega" button), a well-animated hero, and a 4-question onboarding quiz that feels personal. The gap: because the quiz answers are discarded (Section 1), a user who spends 30–45 seconds thoughtfully answering "I'm an experienced pro wanting advanced strategies" gets funneled into the exact same beginner-only Module 1 as someone who answered "brand new." For a brand whose whole promise is confidence and personalization, this is a first-contact trust gap — worth either wiring the answers into something real (even just pre-selecting AI Coach difficulty/persona) or softening the "personalized journey is ready" copy until it is.

**Signup.** Low friction, good defensive handling of both Supabase email-confirmation states. The dead Google/Apple buttons are a real risk here specifically — a new, nervous user (the target persona) clicking a button that visibly does nothing reads as "this site is broken," not "this feature is coming soon." Remove them or wire them before launch; don't ship inert buttons on the highest-trust page in the funnel.

**Dashboard.** Good first-run experience — the empty/new-user state is deliberately designed, not an afterthought. No action needed here.

**Journey.** This is the likeliest drop-off point. A motivated user who completes all 8 lessons of Module 1 in one sitting (very plausible — it's designed to be fast) hits Module 2, "Finding Prospects," which is shown as unlocked-and-real but has no content behind it. That's the worst possible moment for a wall — right at peak engagement, right after a completion high. Section 4 and the roadmap address this with a "coming soon" treatment as a stopgap.

**AI Coach.** The best part of the experience — real conversational roleplay with a persona that stays in character, plus a graded feedback report at the end. This is where the product's differentiation actually shows up experientially, not just architecturally. No UX complaints here; if anything, it's currently under-marketed relative to how good it is (Section 6).

**Interview Prep.** Portfolio-building is a smart, distinctive feature for this audience (career changers and students specifically need something to show in interviews) but shares the same durability problem as Journey progress — it's `localStorage`-only, so a portfolio built on one device doesn't follow the user anywhere else.

**Missing step, overall:** there's no moment where the onboarding quiz, the AI Coach's persona/scenario picker, and the Journey curriculum actually talk to each other. Each is well-built in isolation; none currently hands context to the next. Connecting even one of these seams (quiz → default coach difficulty, or first-lesson-complete → coach nudge) would meaningfully increase the feeling of a guided system rather than three separate features under one login.

---

## 4. Product Prioritization

### Build Before Launch (high impact, low effort, necessary)

- Lock down `coach-chat`: real user auth, restricted CORS, basic rate limit. *(Section 2 — this is the one non-negotiable item.)*
- Apply the already-configured `historyWindow` truncation and `minFeedbackTurns` check server-side — near-zero effort, direct cost control.
- Migrate Journey progress and Interview Prep portfolio data from `localStorage` into Supabase tables, mirroring the exact RLS pattern already proven on `coach_*` tables. This is the second-highest-priority item — it directly protects the "Progress Tracking" feature you've already committed to shipping.
- Either wire the onboarding quiz answers into something real on signup, or soften the "personalized journey" promise in the copy — pick one, don't ship the current mismatch.
- Remove or hide the non-functional Google/Apple sign-in buttons.
- Build a minimal `delete-account` Edge Function, or hide that control until it exists.
- Add a "coming soon" treatment to locked Journey modules 2–10 instead of implying full content exists behind the lock icon.
- Fix the broken footer link (`cold-calling-guide.html` → `cold-calling.html`) and unify the accent color token between marketing and app shell.

### Build After Launch (can wait)

- Full lesson content for Modules 2–10 (largest single effort in the product — sequence this after you've validated that Module 1 + AI Coach retains users at all).
- Voice STT/TTS and PDF/DOCX script upload parsing — both are already scoped as Phase 4/5 in your own architecture doc; the seams (`engine.handleVoice`, `engine.handleDocument`) are already built to receive them.
- Real Google/Apple OAuth, once you've decided it's worth the setup relative to email signup conversion data.
- A shared CSS/component layer — only worth the refactor once page count or design churn actually makes the duplication painful; not before.
- Deeper badge/achievement logic backed by real thresholds (currently reasonable client-side heuristics in `dashboard.html`).

### Do Not Build

- Community, leaderboards, or peer messaging — you've already ruled this out, and nothing in the current architecture makes it cheap; it would require new data models, moderation, and RLS design from scratch.
- A second/switchable LLM provider — you have one working provider (Gemini via the Edge Function abstraction). Don't spend effort on configurability nobody has asked for yet; the abstraction already in `coach-engine.js` means this stays cheap to add later if you ever need it.
- A CMS or admin authoring tool for lesson content — premature with 1 of 10 modules built. Hardcoded HTML lesson pages are the right amount of tooling at this scale.
- A native mobile app — the product is a responsive web app on Supabase; nothing in your usage or stack suggests native is the constraint right now.

---

## 5. Next 30-Day Roadmap

**Week 1 — Technical priorities**
Lock down `coach-chat` (real session JWT instead of anon key, CORS restricted to your production origin, `verify_jwt` re-enabled or manually validated, basic per-user rate limiting). Apply `historyWindow` truncation and `minFeedbackTurns` enforcement server-side. Begin the Journey-progress and Interview-Prep-portfolio migration into Supabase, reusing the existing `coach_*` RLS policy pattern (`auth.uid() = user_id`) — keep `localStorage` as an optimistic local cache but make Supabase the source of truth, with a one-time sync-on-login step. Build or stub `delete-account`. Fix the broken footer link and unify the accent color token.

**Week 2 — Product improvements**
Wire onboarding quiz answers into a real `user_preferences` write on signup (even a minimal version — persona/difficulty defaults for the AI Coach is enough to make the promise true), or adjust the modal's closing copy if you decide not to. Remove or clearly label the non-functional social buttons. Add "coming soon" treatment to locked Journey modules so the wall at the end of Module 1 reads as anticipation, not a dead end. Add minimum-turn guardrails to the AI Coach's "End & Score" flow so scores can't be generated from trivially short sessions.

**Week 3 — Testing and user feedback**
Run moderated walkthroughs with 5–10 people who actually match the target persona (university students, career changers, first-year SDRs) through the full path: Landing → Signup → Dashboard → Lesson 1 → AI Coach roleplay → Interview Prep. Watch specifically for drop-off at the onboarding quiz, confusion about locked modules, and whether users understand what the AI Coach's score actually means. Load-test the now-locked-down `coach-chat` endpoint to confirm the auth fix didn't break real concurrent usage. Instrument a basic funnel: signup → first lesson complete → first AI Coach session → second AI Coach session (a solid proxy for day-1 retention).

**Week 4 — Launch preparation**
Final copy pass — remove the "Building in public — MVP launching soon" footer badge if you're actually going live, verify `og:image` and metadata are current. Align the client-side password minimum (8 characters) with the Supabase auth config (currently 6) so the two don't silently disagree. Confirm production auth redirect URLs are set correctly in the hosted Supabase project (the `config.toml` you have is the local-dev config, not production — worth a direct check in the dashboard). Confirm RLS is enabled and correct on the new journey/portfolio tables, matching the `coach_*` pattern. Soft-launch to a small list and watch Gemini API spend and Supabase usage daily for the first week — this is exactly the period where an unlocked-down endpoint would have hurt most, so it doubles as your confirmation that Week 1's fix is holding.

---

## 6. Competitor Thinking

**Vs. traditional sales training platforms (cohort courses, bootcamps):** these are typically calendar-bound, human-coached, and expensive. AmplifyHub's advantage is availability — unlimited on-demand AI roleplay practice, at 2am before a real interview, at a fraction of the cost of a cohort program. This is a real structural advantage, not just a pricing one.

**Vs. AI roleplay / sales-practice SaaS tools:** most existing tools in this category are sold to sales managers for teams of reps who already have the job. AmplifyHub's differentiation is targeting people *before* they have the job — students and career changers — with a structured learning path that leads into the roleplay, not just a bare practice tool assuming baseline competence.

**Vs. passive SDR learning content (video courses, blogs, YouTube):** these have no feedback loop. AmplifyHub's structured, JSON-graded feedback report (opening/discovery/objection/communication scores, cited strengths and weaknesses from the actual transcript) is a genuinely differentiated, hard-to-copy mechanic — most competitors offering "practice mode" don't grade with this level of specificity.

**What's unnecessary:** don't expand toward a full sales-enablement suite — CRM integration, dialers, team analytics. That's a different, more expensive, more complex market than beginner training, and nothing about your current traction or stack points toward needing it.

**What could become the real advantage:** the persona × scenario × difficulty composability plus the structured feedback report is more sophisticated than what most "practice mode" competitors ship today. Once Modules 2–10 exist, the graded feedback loop — not the lesson content itself — is the mechanic worth building your retention and word-of-mouth story around, since it's the piece a content-only competitor can't trivially replicate.

---

## Specific Next Actions (this week)

1. Change `verify_jwt` back on (or add manual JWT validation) for the `coach-chat` function, and change the client to forward the user's real `session.access_token` instead of the anon key. Restrict CORS to your production origin.
2. Add a hard slice to the last `historyWindow` messages before calling Gemini, and a minimum-turn check before generating a feedback report.
3. Stand up Supabase tables for journey progress and portfolio data, matching the `coach_*` RLS policy exactly, and point `journey.html`/`interview-prep.html` at them instead of (or in addition to, as a cache) `localStorage`.
4. Decide: wire the onboarding quiz into a real preference write, or soften its closing copy. Either is a small change; the current mismatch is the only bad option.
5. Remove the dead Google/Apple buttons from sign-in/sign-up until they're real.
6. Fix the footer link typo and unify the `--accent` color value between the marketing site and the app shell.
