# AmplifyHub Demo Video — Full Production Script

Two deliverables from one shoot: a 16:9 long-form demo (~100-130s) and a 9:16
vertical teaser (<60s, re-cropped from the same footage — not separately
generated).

## What this document is for
Everything Codex needs to fire **every Higgsfield generation** (video clips +
narration) in one pass, with no further creative decisions required. It is
NOT a finished video. Two steps stay manual and are marked clearly below —
they cannot be automated with the tools currently connected.

## The emotional core (why this script is written the way it is)
Surface topic: a tour of AmplifyHub's features. The actual thing the video is
about: the fear of picking up the phone as a new SDR with no one safe to
practice on first. Every beat below serves that, not a feature list.

## Visual system — two modes, never mixed
- **Mode A (real product):** actual ShareX screen recordings. No border, flat
  neutral color grade. This is the substance of the video.
- **Mode B (generated):** Higgsfield clips only. Letterboxed (black bars top
  and bottom) and a distinct, warmer grade. This is the emotional bookend —
  hook and outro only. The letterboxing is the visual signal that tells the
  viewer "this is the feeling," not "this is the product."
- Brand palette, locked across every Mode B generation so they read as one
  video: dark navy background, gold `#FFD54A` accent, green accent, warm
  orange accent. No text, no logos, no readable UI in any generated clip —
  those would clash with the real product footage.

---

## SCENE 1 — HOOK (Mode B) — ~6s — MANUAL: none, fully generatable

**Higgsfield generation — fire this first:**
```
model: kling3_0_turbo
duration: 5s, aspect: 16:9
prompt: "Fast energetic motion graphic: a glowing neural network pattern
whipping into a sharp geometric logo-mark reveal, dark navy background,
warm gold and green light streaks, quick camera whip, 2-3 punchy light
bursts, high-energy cinematic tech style, no text"
```
Est. cost: ~7.5 credits. Run `get_cost` before submitting to confirm current
pricing.

**Narration — 2 generation-ready lines (ElevenLabs, cloned voice, V2 model,
Stability lowered, Similarity ~70%, Style Exaggeration up slightly):**
```
Line 1: "I built an AI that lets you fail a HUNDRED cold calls..."
Line 2: "...before you ever pick up a real phone."
```
Generate each line 2-3 times, keep every take.

---

## SCENE 2 — DASHBOARD (Mode A) — ~12s — MANUAL: record this clip

Not generatable — this is your real signed-in dashboard. Shot list (already
covered in Task 2 of our recording plan): land on `dashboard.html`, hold 2s,
slowly move to the milestone ring, hover 1s, move to the Journey list, hover
on a completed module, hover on the in-progress one, hold 2s, stop.

**Narration — 3 lines:**
```
Line 1: "This is AmplifyHub."
Line 2: "Every lesson. Every rep. Every session — tracked automatically."
Line 3: "You don't manage your progress here. It manages itself, so you
can just... show up."
```

---

## SCENE 3 — JOURNEY / LESSON (Mode A) — ~18s — MANUAL: record 3 clips

Not generatable. Shot list: (a) Journey overview, scroll the lesson path,
don't click anything, (b) open one lesson, scroll its content, show the
"Mark as Complete" button, (c) scroll to "Practice with AI Coach," hover the
button, click it — cut before the next page loads.

**Narration — 4 lines:**
```
Line 1: "Every skill is broken into real, ordered lessons..."
Line 2: "...not a video dump you'll never finish."
Line 3: "Finish one, and the next unlocks."
Line 4: "But reading about a cold call, and actually being ON one — two
completely different things."
```

---

## SCENE 4 — AI COACH, the hero segment (Mode A) — ~28s — MANUAL: record 4 clips

Not generatable — this is the real AI Coach conversation, the single most
important piece of footage in the video. Shot list: (a) land on
`coach-home.html`, show the 4 mode cards, hover "Roleplay" 2s, click, (b)
pick a scenario/persona, click "Start Session," (c) **the actual
conversation** — type a real opening line, wait for the AI response, type one
realistic objection reply, wait again, minimum 2-3 exchanges, (d) end the
session, show the generated feedback report, scroll slowly.

Deliberately keep narration light during the conversation clip itself — let
the real exchange play with reduced VO. Isaac's pacing rule applies here
directly: don't cut every second of silence, some pauses are worth letting
breathe.

**Narration — 4 lines (leave gaps for the on-screen conversation to play under minimal or no VO):**
```
Line 1: "So we built an AI that actually picks up."
Line 2: "Pick a scenario — a skeptical CFO, a rushed gatekeeper, whatever
call scares you most."
Line 3: "Then just... call them."
Line 4: "Every call ends with real feedback — not a grade. A breakdown of
what actually worked."
```

---

## SCENE 5 — CHALLENGES + RESOURCES (Mode A) — ~13s — MANUAL: record 2 clips

Not generatable. Shot list: (a) Challenges page, show the 3 daily challenges,
hover one to show the XP reward, (b) Resources page, show the library grid
(40 resources), open one, briefly show the bookmark button.

**Narration — 3 lines:**
```
Line 1: "Daily challenges keep you sharp."
Line 2: "And when you need a script, a template, a cheat sheet — forty of
them are already sitting there."
Line 3: "Ready."
```

---

## SCENE 6 — OUTRO (Mode B) — ~6s — MANUAL: none, fully generatable

A bookend callback to the hook — same visual language, calmer/resolved
instead of urgent. Reuses the "hundred calls" line from Scene 1 to close the
emotional loop.

**Higgsfield generation:**
```
model: kling3_0_turbo
duration: 5s, aspect: 16:9
prompt: "Calm resolved motion graphic: the same glowing neural network
logo-mark from before, now settled and steady, gentle slow pulse, dark
navy background, warm gold and green glow, soft light bloom, no whip
pans, peaceful confident energy, no text"
```
Est. cost: ~7.5 credits.

**Narration — 2 lines:**
```
Line 1: "A hundred failed calls in here..."
Line 2: "...so your first REAL one isn't."
```
Optional final line, short and flat: `"AmplifyHub. Start practicing."`

---

## Full Higgsfield generation manifest (everything Codex fires in one pass)

| # | Type | Scene | Est. cost |
|---|---|---|---|
| 1 | Video — hook | Scene 1 | ~7.5cr |
| 2 | Video — outro | Scene 6 | ~7.5cr |
| 3 | Video — B-roll: connection (chat bubbles linking) | reusable cutaway | ~7.5cr |
| 4 | Video — B-roll: progress ring filling | reusable cutaway | ~7.5cr |
| 5 | Video — B-roll: sound-wave rings | reusable cutaway | ~7.5cr |
| 6-23 | Audio — 18 narration lines × 2-3 takes each | all scenes | ~4-5cr total |

**Total estimate: ~42-43 credits** of your 110 available. Confirm each with
`get_cost` before submitting — leaves comfortable buffer for regenerations
(some lines will need many takes to land right, per the ElevenLabs/Higgsfield
technique already established).

B-roll clips 3-5 aren't pinned to a single scene — drop them as short cutaway
transitions between the Mode A scenes wherever a hard cut feels abrupt.

---

## What's still manual, no way around it

1. **Record 9 raw clips** (Scenes 2, 3×3, 4×4, 5×2) with ShareX — 60fps,
   1920×1080, cursor visible, no audio track, 2-3s buffer before/after each
   action, one file per beat. Full ShareX settings already configured.
2. **Assemble in DaVinci Resolve**: import voiceover → trim → music bed →
   cut visuals to match → zoom/keyframe with eased curves → captions (3
   roles: key-line captions, punch-moment center text, in-scene text) →
   overlays/transitions → sound design (whoosh/riser/impact, judged with
   other tracks muted) → one color-grade pass last, applied differently to
   Mode A vs Mode B footage per the visual system above.
3. **9:16 recut**: free manual re-crop of the finished 16:9 edit — hook +
   AI Coach + outro is the tightest high-impact subset for the vertical cut.
   Do not use Higgsfield's Shorts Studio AI-restyle — cost-prohibitive
   relative to the credit budget above.

If you'd rather trade the real product footage for a fully-automatable
alternative: Higgsfield's `explainer_video` tool can generate a complete
narrated non-photoreal explainer end-to-end with no manual recording or
editing step. That's a genuinely different creative direction — illustrated/
animated visuals instead of your real UI — not a drop-in replacement for this
script. Flagging it honestly since it's the only path that matches "one
script, fully finished video," but everything in this plan so far has been
built around showing the real product, which that path abandons.
