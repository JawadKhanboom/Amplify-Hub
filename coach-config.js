// AmplifyHub AI Coach — configuration.
// Load order (see AI-COACH-ARCHITECTURE.md):
// coach-config.js -> coach-store.js -> coach-engine.js -> coach-ui.js
// RULE: no secrets in this file, ever. API keys live only in Supabase Edge
// Function secrets; the client talks to the coach-chat proxy, never to OpenAI.

const CoachConfig = {
  version: 1,

  // 'local' = rule-based provider (no network). Flip to 'remote' when the
  // coach-chat Edge Function is deployed (Phase 3) — no other change needed.
  provider: 'remote',

  remote: {
    // Hardcode the URL to eliminate potential variable issues
    endpoint: () => "https://dsuahpcqrrlbudomjrye.supabase.co/functions/v1/coach-chat",
    modelHint: 'gemini-2.5-flash',
    historyWindow: 20
  },

  limits: { maxSessions: 50, maxTurnsStored: 200, maxDocMB: 5, minFeedbackTurns: 4 },

  // Training scenarios — step 1 of the 2-step card pick (scenario, then
  // persona). Each has a measurable goal and success indicators shown on
  // the card and used to grade the end-of-session feedback report. Add a
  // scenario here and it appears as a card automatically.
  scenarios: {
    cold_call: {
      label: 'Cold Call', icon: '📞',
      goal: 'Book a discovery meeting.',
      successIndicators: [
        'Strong opening (hook in first 15 seconds)',
        'Clear reason for calling (value proposition)',
        'Handles objections without arguing',
        'Creates next step (meeting booked or follow-up scheduled)'
      ]
    },
    discovery: {
      label: 'Discovery', icon: '🎯',
      goal: 'Understand prospect pain and qualify the opportunity.',
      successIndicators: [
        'Asks open-ended questions (who, what, why, how)',
        'Identifies specific business problems',
        'Understands impact (cost, time, revenue)',
        'Qualifies opportunity (budget, authority, need, timeline)'
      ]
    },
    objection_handling: {
      label: 'Objection Handling', icon: '🛡',
      goal: 'Respond effectively to resistance without being pushy.',
      successIndicators: [
        'Does not argue or get defensive',
        'Acknowledges concern empathetically',
        'Asks clarifying questions to understand root cause',
        'Provides relevant response or alternative'
      ]
    },
    closing: {
      label: 'Closing', icon: '📅',
      goal: 'Move prospect toward commitment or clear next action.',
      successIndicators: [
        'Confirms value and alignment',
        'Addresses final concerns proactively',
        'Creates clear next action (meeting, demo, proposal)',
        'Does not accept vague "let me think about it"'
      ]
    }
  },

  // Roleplay personas — step 2 of the card pick. Difficulty (from Settings)
  // tunes how intense each persona's resistance is; it does NOT change
  // which persona shows up. Keyed by a stable id used everywhere (cards,
  // sessions, and the matching PERSONAS map in index.ts).
  personas: {
    skeptical_dm:      { label: 'Skeptical Decision-Maker', icon: '🧐', desc: 'A busy VP who questions ROI and challenges assumptions. Prove your value fast.' },
    gatekeeper:        { label: 'Gatekeeper', icon: '🛂', desc: 'The assistant screening your call. Give them a real reason to put you through.' },
    warm_inbound:      { label: 'Warm Inbound Lead', icon: '🔥', desc: 'They downloaded your content and are open to talking — but expect real discovery, not a pitch.' },
    curious_evaluator: { label: 'Curious Evaluator', icon: '🔍', desc: 'Researching options, not ready to buy. Tests how well you actually know the problem.' },
    budget_buyer:      { label: 'Budget-Conscious Buyer', icon: '💰', desc: 'Likes the solution but worried about cost, timing, and internal approval.' },
    technical_buyer:   { label: 'Technical Buyer', icon: '⚙️', desc: 'Wants proof it works — features, integrations, implementation details.' },
    existing_customer: { label: 'Existing Customer Considering Alternatives', icon: '🔄', desc: 'Already has a vendor. Needs real, specific differentiation to switch.' }
  },

  storageKeys: {
    root: 'amplifyHub_coach_v1',
    msgs: id => `amplifyHub_coach_msgs_${id}`
  },

  // Practice modes. `intro` is shown when the mode is selected; `system` is
  // the prompt seed the RemoteProvider/Edge Function will use in Phase 3.
  modes: {
    roleplay:   { label: 'AI Roleplay',        intro: "Great — let's run a full cold call roleplay. I'll be a busy shop owner. Give me your best opening line. Go! 🎭",
                  system: 'You are a realistic cold-call prospect. Stay in character; escalate difficulty gradually; break character only to coach when asked.' },
    live:       { label: 'Live Cold Call',     intro: 'Live coaching mode activated 📞 I\'ll give you real-time feedback as you speak. Start when ready.',
                  system: 'You are a live sales coach giving terse, real-time feedback on each utterance.' },
    objections: { label: 'Objection Practice', intro: "Objection mode 🛡 I'll throw the toughest objections at you. Ready? Here's the first one: *'We already have someone who handles this.'*",
                  system: 'You fire common cold-call objections one at a time and grade each response.' },
    script:     { label: 'Script Review',      intro: 'Send me your cold call script and I\'ll give you a full breakdown — what works, what to cut, and how to make it convert. 📝',
                  system: 'You review cold-call scripts line by line using the uploaded document extract in context.' },
    voice:      { label: 'Voice Analysis',     intro: "Voice analysis is active 🎙 I'll analyze your tone, pacing, and confidence level. Start speaking naturally.",
                  system: 'You analyze transcribed speech for tone, pacing and confidence.' },
    review:     { label: 'Performance Review', intro: 'Opening your weekly performance review 📊 Let me pull up your data from the last 7 days...',
                  system: 'You summarize the user\'s recent session metrics and prescribe next steps.' },
    ask:        { label: 'Ask Coach',          intro: '',
                  system: 'You are a practical AI sales coach for beginner SDRs. Answer questions about cold calling, handling objections, openers, closing, mindset, and career growth. Be direct, actionable, and encouraging.' }
  },

  // Content for the LocalRuleProvider (today's brain, extracted verbatim).
  local: {
    replies: [
      { match: /\b(hi|hello|hey)\b/, text: "Hey! Let's get straight to it. Give me your opening line like I'm a real prospect. Don't overthink it — just dial. 📞" },
      { match: /(roleplay|practice)/, text: "Perfect. I'm now playing the owner of *Peak Shine Auto Detailing* in Dallas. It's a Tuesday at 10am. I just picked up the phone. What do you say? 🎭" },
      { match: /script/, text: 'Send me your script and I\'ll break it down line by line — what grabs attention, what kills momentum, and exactly what to change.' },
      { match: /(objection|not interested)/, text: `<span class="hi">Good instinct pivoting there.</span> When they say "not interested", never defend — instead, agree and redirect. Try: <em>"Totally fair — most of my clients said the same thing before they saw the numbers. Quick question..."</em> See how that lands.` },
      { match: /(tip|advice|help)/, text: "Here's today's top tip: <span class='hi'>silence is your secret weapon.</span> After your opening line, stop talking. Let the prospect fill the silence. Most callers rush to fill it — top performers let it breathe. 🎯" },
      { match: /confiden/, text: "Confidence isn't about sounding perfect — it's about <span class='hi'>caring less about the outcome and more about the conversation.</span> Your last session score was 88%. You're already there. Just trust the process." },
      { match: /thank/, text: "That's what I'm here for 🤖 Keep going — consistency beats perfection every time. What do you want to work on next?" }
    ],
    fallbacks: [
      `I like where you're going with that. Let me push back though — what would you say if the prospect replied: <em>"We already have a vendor, not looking to change."</em>`,
      `<span class="hi">Good energy.</span> Now try it again but this time, lead with a question instead of a statement. See if it changes the prospect's response.`,
      `That's solid. Your pacing is improving from last session. One thing — watch your filler words. Count how many times you say "um" or "like" in a full call.`,
      `Here's what I noticed: you front-load your pitch too early. Try holding back the offer until you've asked at least 2 discovery questions. It changes everything.`,
      `Nice. Now let's push further — how would you handle it if they said: <em>"Just send me an email"</em>? That's the real test.`
    ],
    voiceReply: "Got your voice message 🎙 — <span class='hi'>tone sounded confident</span> and your pacing was solid. Want me to break down the delivery in detail, or keep practicing?",
    docReply: name => `I reviewed <span class="hi">${name}</span> 📄 — solid structure overall. Your opening is strong, but the objection-handling section could use 2-3 more responses for common pushback. Want me to suggest specific lines to add?`,
    clearReply: "Session cleared. Let's start fresh — what do you want to practice?",
    endReply: "Session saved 💾 Great work today, Jawad. Your confidence score for this session: <span class='hi'>88/100</span>. See you tomorrow — consistency is everything.",
    voiceModeReply: "Voice Mode is on 🎙 Tap the mic anytime to record your pitch out loud — I'll listen and give you feedback on delivery, not just words."
  }
};
