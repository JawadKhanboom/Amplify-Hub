# AmplifyHub — AI Coach Architecture
*Lead Architect design doc · 2026-07-05 · Status: Phase 1 implemented, Phases 2–5 designed*

---

## 1. Current project analysis

**Stack:** Static multi-page vanilla HTML/CSS/JS. No framework, no bundler, no build step. Each page is self-contained (inline CSS + inline script). This is a strength for this product stage — zero tooling friction — and the architecture below deliberately preserves it.

**Existing shared-module convention (the pattern to follow):**
```
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="auth-config.js">   <!-- global supabaseClient -->
<script src="auth.js">          <!-- global auth helpers -->
<script>requireAuth();</script>
```
Plain script files exposing globals, loaded in documented order. `auth.js` proves this works: one file, reused by 8+ pages.

**Existing state convention:** localStorage under `amplifyHub_*` keys. The canonical example is `amplifyHub_journeyProgress` (written by journey.html):
```json
{ "completedLessons": ["m0l0", ...], "overallProgress": 12, "lessonsCompleted": 5,
  "totalLessons": 41, "currentModuleName": "Sales Mindset", "updatedAt": 1751700000000 }
```
Dashboard, progress, and challenges all *read* this key to derive new-user vs active-user state, and listen to `storage` events for cross-tab sync. **The AI Coach must plug into this same contract.**

**ai-coach.html today:** The UI is complete and good — modes grid, chat with typing indicator, prompt chips, MediaRecorder voice capture (with simulated fallback), drag-drop document upload, history/performance/feedback panels. But all intelligence is a ~350-line inline script: a keyword-matching reply function, hardcoded history, fake Save button, nothing persisted. **The UI stays; the inline brain becomes a real architecture.**

---

## 2. How the AI Coach fits the existing structure

The coach becomes the product's **practice engine**, consuming journey state and producing performance data:

```
journey.html ──writes──▶ amplifyHub_journeyProgress ──read──▶ AI Coach (context: current module, progress)
AI Coach ──writes──▶ amplifyHub_coach_v1 (sessions/scores) ──read──▶ dashboard / progress / challenges (Phase 2)
```

No page redesigns. The coach reads what exists and writes new namespaced keys that other pages *may* consume later.

## 3. Reusable components (new modules)

Four script-tag modules, same pattern as `auth.js`, loaded in order by ai-coach.html:

| File | Responsibility | Depends on |
|---|---|---|
| `coach-config.js` | Modes, prompts/reply content, storage key names, provider selection, limits. **Never secrets.** | — |
| `coach-store.js` | Data layer: sessions, messages, docs, user context. localStorage today, Supabase tomorrow, **same interface**. | config |
| `coach-engine.js` | Conversation orchestration + **provider abstraction** (`LocalRuleProvider` now, `RemoteProvider` for OpenAI). Event emitter. | config, store |
| `coach-ui.js` | Controller: binds existing DOM ids to engine/store. All previous inline behavior lives here, unchanged visually. | all above |

Separation rule: **ui never talks to a provider; engine never touches the DOM; store never knows about chat semantics.** Any layer can be replaced independently (e.g., swap store to Supabase without touching ui).

## 4. Data flow

```
user types / taps chip / records voice / drops file
        │
   coach-ui.js  ── render user bubble, escape input
        │ engine.send(text) / handleVoice(rec) / handleDocument(meta)
   coach-engine.js ── builds context {mode, journey progress, doc extracts, history window}
        │ provider.send({messages, mode, context})
   Provider ── LocalRuleProvider (rules, instant)  |  RemoteProvider (Edge Function → OpenAI, streamed)
        │ reply
   coach-engine.js ── emits 'message' event · updates turn count/metrics
        │                                  └── coach-store.js persists both turns + session summary
   coach-ui.js ── renders coach bubble, nudges performance bars, refreshes history card
```

Everything the UI shows flows through engine events — so when streaming arrives (Phase 3), only the provider changes; ui already renders on events.

## 5. localStorage ↔ Supabase compatibility

**localStorage schema (live now):**
- `amplifyHub_coach_v1` → `{ sessions:[{id,mode,title,startedAt,endedAt,turns,score}], activeSessionId, docs:[{id,name,size,mime,addedAt,extract?}] }` (sessions capped at 50, newest first)
- `amplifyHub_coach_msgs_<sessionId>` → `[{role:'user'|'coach', kind:'text'|'voice'|'doc', content, meta?, ts}]` (capped at 200/session; per-session keys so appends don't rewrite everything)

**Supabase schema (Phase 2 — mirrors the above 1:1):**
```sql
create table coach_sessions  (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users,
  mode text, title text, started_at timestamptz default now(), ended_at timestamptz, turns int default 0, score int);
create table coach_messages  (id bigint generated always as identity primary key, session_id uuid references coach_sessions on delete cascade,
  user_id uuid not null, role text, kind text default 'text', content text, meta jsonb, created_at timestamptz default now());
create table coach_documents (id uuid primary key default gen_random_uuid(), user_id uuid not null,
  name text, size int, mime text, storage_path text, extract text, created_at timestamptz default now());
-- RLS on all three: enable row level security; policy: auth.uid() = user_id (select/insert/update/delete)
-- Storage buckets: coach-docs (uploads), coach-voice (recordings) — same RLS principle via storage policies
```
**Migration path:** `coach-store.js` is an interface (`init, listSessions, saveSession, appendMessage, getMessages, addDoc, getUserContext, onChange`). Phase 2 adds a `SupabaseStore` implementing the same interface + a one-time `syncLocalToRemote()` on first login; `CoachStore` becomes a facade choosing local vs remote by session presence. No caller changes.

## 6. Future OpenAI integration (no hardcoded keys — ever)

**Rule: the API key never exists in client code.** Browser → **Supabase Edge Function `coach-chat`** → OpenAI. The function holds `OPENAI_API_KEY` in Supabase secrets, validates the caller's Supabase JWT (already available via `supabaseClient.auth`), applies the mode's system prompt server-side (so prompts can't be tampered with), and streams SSE back.

`RemoteProvider` (already stubbed in coach-engine.js) posts:
```json
{ "mode": "roleplay", "model_hint": "gpt-4o-mini", "messages": [...last 20 turns...],
  "context": { "journey": "Opening the Call, 34%", "doc_extract": "..." } }
```
Provider-agnostic by design: the Edge Function speaks the OpenAI-compatible chat format, so switching to Anthropic/other later is a server-side env change only. Flip `CoachConfig.provider` from `'local'` to `'remote'` to activate — one line.

## 7. Future voice support

Current MediaRecorder capture + waveform UI is kept as-is. Pipeline evolves in place:
- **Now (Phase 1):** blob captured → engine.handleVoice → canned coach acknowledgment (existing behavior), turn persisted as `kind:'voice'`.
- **Phase 4:** blob → upload to `coach-voice` bucket → Edge Function `coach-transcribe` (Whisper) → transcript enters the *same* text pipeline (`engine.send(transcript, {kind:'voice'})`) → optional TTS reply via `coach-speak` function. Dev fallback: Web Speech API.
Interface seam already exists: `engine.handleVoice(recording)` — only its internals change.

## 8. Future document upload support

Current upload UI/drag-drop kept as-is. Pipeline:
- **Now:** file validated → metadata stored in `docs` → `.txt` content extracted client-side (FileReader) and saved as `extract` → canned review reply.
- **Phase 5:** `.pdf`/`.docx` extraction via lazy-loaded CDN libs (pdf.js / mammoth) or server-side in an Edge Function; extract chunked and injected into provider context when mode = `script` (RAG-lite — no vector DB needed at this scale; a single script fits in context).
Seam: `engine.handleDocument(file)` — internals change, callers don't.

## 9. Files modified (complete list)

| File | Change | Why |
|---|---|---|
| **`coach-config.js`** *(new)* | Config, modes, reply content | Single place to tune the coach; no secrets |
| **`coach-store.js`** *(new)* | Data layer | Persistence + Supabase-ready interface |
| **`coach-engine.js`** *(new)* | Engine + providers | Decouples brain from UI; OpenAI seam |
| **`coach-ui.js`** *(new)* | DOM controller | Absorbs the old inline script; zero visual change |
| **`ai-coach.html`** | Inline `<script>` block replaced by 4 script tags. **No markup/CSS touched.** | Wires page to the modules |
| `AI-COACH-ARCHITECTURE.md` *(new)* | This document | — |

Untouched (deliberately): all other pages, auth files, styling. Phase 2 *optionally* lets dashboard.html read `amplifyHub_coach_v1` for its activity feed — additive, later.

## 10. Recommended architecture & phasing

The layered plan above is the recommendation: **config → store → engine(providers) → ui**, no build step, secrets server-side only.

- **Phase 1 (done, this commit):** Extract inline brain into the 4 modules. LocalRuleProvider preserves today's behavior byte-for-byte. Real persistence: sessions, messages, docs metadata survive reload; Save/End actually save; history card shows real sessions once they exist (demo rows remain for brand-new users, matching the site's `only-new` philosophy). User input is now HTML-escaped (XSS hygiene).
- **Phase 2:** Supabase tables + RLS + `SupabaseStore` + local→remote migration; dashboard/progress read coach stats.
- **Phase 3:** `coach-chat` Edge Function + `RemoteProvider` streaming; real rubric-based scoring replaces the demo nudge.
- **Phase 4:** Voice STT/TTS (Whisper via Edge Function).
- **Phase 5:** PDF/DOCX extraction + doc-aware script review.

Each phase is independently shippable and touches only the seams named above.
