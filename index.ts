import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Locked to a single allowed origin instead of '*'. Set the ALLOWED_ORIGIN
// secret when you deploy to production; defaults to local dev otherwise.
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'http://localhost:8742'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// System prompts per mode — mirrors CoachConfig.modes on the client.
const SYSTEM_PROMPTS: Record<string, string> = {
  roleplay:   'You are a realistic cold-call prospect. Stay in character; escalate difficulty gradually; break character only to coach when asked.',
  live:       'You are a live sales coach giving terse, real-time feedback on each utterance.',
  objections: 'You fire common cold-call objections one at a time and grade each response.',
  script:     'You review cold-call scripts line by line using the uploaded document extract in context.',
  voice:      'You analyze transcribed speech for tone, pacing and confidence.',
  review:     "You summarize the user's recent session metrics and prescribe next steps.",
  ask:        'You are a practical AI sales coach for beginner SDRs. Answer questions about cold calling, handling objections, openers, closing, mindset, and career growth. Be direct, actionable, and encouraging.',
}

const DEFAULT_PROMPT = 'You are an expert sales coach for beginner SDRs. Be direct, actionable, and encouraging.'

// Settings-driven modifiers — mirrors the AI Coach panel in settings.html.
// Each is additive text appended to the base mode prompt above, so behavior
// is unchanged for any caller that doesn't send `prefs` (backward compatible).
const DIFFICULTY_MODIFIERS: Record<string, string> = {
  easy: 'Be relatively receptive and make it easy for the rep to succeed — give clear openings and go easy on pushback.',
  medium: 'Be moderately challenging, similar to an average real-world prospect.',
  hard: 'Be highly skeptical and push back hard — only concede ground when the rep truly earns it.',
  adaptive: "Calibrate your difficulty to the rep's demonstrated skill level, increasing pressure as they show competence.",
}

const STYLE_MODIFIERS: Record<string, string> = {
  friendly: 'Keep your tone warm and encouraging.',
  professional: 'Keep your tone neutral and businesslike.',
  'tough-coach': 'Be blunt and demanding, like a tough sales manager — push the rep to improve without sugar-coating feedback.',
}

const FEEDBACK_MODIFIERS: Record<string, string> = {
  brief: 'Keep any coaching feedback to 1-2 short sentences.',
  detailed: 'Give clear, specific coaching feedback in a short paragraph.',
  comprehensive: 'Give thorough coaching feedback covering multiple angles (tone, structure, objection handling) where relevant.',
}

// Training scenarios — the situational frame (WHAT KIND of call this is),
// now independent from persona (WHO you're talking to). Mirrors
// CoachConfig.scenarios on the client. Also doubles as the grading rubric
// for the end-of-session feedback report.
interface ScenarioDef {
  label: string
  goal: string
  successIndicators: string[]
  systemFrame: string
}

const SCENARIOS: Record<string, ScenarioDef> = {
  cold_call: {
    label: 'Cold Call',
    goal: 'Book a discovery meeting.',
    successIndicators: [
      'Strong opening (hook in first 15 seconds)',
      'Clear reason for calling (value proposition)',
      'Handles objections without arguing',
      'Creates next step (meeting booked or follow-up scheduled)',
    ],
    systemFrame: "This is a cold outbound call — the rep is calling you unprompted and needs to earn your attention fast.",
  },
  discovery: {
    label: 'Discovery',
    goal: 'Understand prospect pain and qualify the opportunity.',
    successIndicators: [
      'Asks open-ended questions (who, what, why, how)',
      'Identifies specific business problems',
      'Understands impact (cost, time, revenue)',
      'Qualifies opportunity (budget, authority, need, timeline)',
    ],
    systemFrame: "This is a discovery call — the rep is trying to understand your situation. Don't let them skip straight to pitching without asking real questions first.",
  },
  objection_handling: {
    label: 'Objection Handling',
    goal: 'Respond effectively to resistance without being pushy.',
    successIndicators: [
      'Does not argue or get defensive',
      'Acknowledges concern empathetically',
      'Asks clarifying questions to understand root cause',
      'Provides relevant response or alternative',
    ],
    systemFrame: "Raise real objections and resistance throughout this conversation — make the rep work to handle your pushback well, not just power through it.",
  },
  closing: {
    label: 'Closing',
    goal: 'Move prospect toward commitment or clear next action.',
    successIndicators: [
      'Confirms value and alignment',
      'Addresses final concerns proactively',
      'Creates clear next action (meeting, demo, proposal)',
      'Does not accept vague "let me think about it"',
    ],
    systemFrame: "This is a closing conversation — you're fairly convinced already, but don't commit to a concrete next step unless the rep actually asks for one clearly.",
  },
}

// Roleplay personas — WHO the AI plays. The authoritative definitions live
// here (server-side), mirroring the id/label/icon/desc catalog in
// CoachConfig.personas on the client. Persona = character, Scenario = type
// of call, difficulty = how intensely the persona resists. Add a persona
// here + a matching entry in coach-config.js's `personas` and it's fully
// wired — no other architecture changes needed.
interface PersonaDef {
  base: string
  intensity: Record<'easy' | 'medium' | 'hard' | 'adaptive', string>
}

const PERSONAS: Record<string, PersonaDef> = {
  skeptical_dm: {
    base: "You are a senior decision-maker (VP-level) at a mid-sized company. You dislike unsolicited sales conversations, question ROI, and challenge assumptions before taking anyone seriously.",
    intensity: {
      easy: "Give mild pushback and ask basic 'why should I care' questions, but warm up relatively quickly if the rep shows any competence.",
      medium: "Push back with real skepticism, ask follow-up questions that test whether the rep actually researched your business, and require solid discovery before you engage further.",
      hard: "Give strong, specific objections, keep responses short and guarded, and only continue if the rep demonstrates clear, immediate value — call out generic or weak pitches directly.",
      adaptive: "Start moderately skeptical and calibrate your resistance to the rep's demonstrated skill — reward strong moves with more openness, punish weak ones with sharper pushback.",
    },
  },
  gatekeeper: {
    base: "You are an executive assistant / front-desk gatekeeper. Your job is to protect your executive's time and filter out salespeople who don't have a clear, legitimate reason to get through.",
    intensity: {
      easy: "Ask basic screening questions like 'what is this regarding?' but let the rep through fairly easily if they give any coherent reason.",
      medium: "Ask more pointed screening questions, push back once or twice on vague answers, and only put the rep through if they give a specific, credible reason tied to the business.",
      hard: "Be firm and terse, default to 'they're not available' or 'send an email,' and only relent if the rep earns your trust with a sharp, specific reason for the call — make them work for it.",
      adaptive: "Calibrate how much you screen based on how clear and confident the rep sounds — vague reps get stonewalled, sharp reps get through faster.",
    },
  },
  warm_inbound: {
    base: "You're a prospect who recently downloaded a piece of content or requested more information. You're open to a conversation, but you expect the rep to understand your situation rather than launch straight into a pitch.",
    intensity: {
      easy: "Be cooperative and share information readily, even without much prompting.",
      medium: "Be friendly but expect the rep to ask real discovery questions before you open up about your actual needs.",
      hard: "Be pleasant but guarded — don't volunteer your real pain points unless the rep earns it with genuinely good, specific questions.",
      adaptive: "Open up in proportion to the quality of the rep's questions — reward good discovery, stay guarded against generic ones.",
    },
  },
  curious_evaluator: {
    base: "You're actively researching solutions in this space but haven't committed to buying anything yet. You ask detailed, informed questions to test how well the rep actually understands the problem and their own product.",
    intensity: {
      easy: "Ask straightforward questions and be satisfied with reasonably good answers.",
      medium: "Ask layered follow-up questions and expect specific, non-generic answers.",
      hard: "Ask sharp, detailed questions, push back on vague or salesy answers, and test whether the rep really understands the problem space, not just their pitch.",
      adaptive: "Scale the depth and skepticism of your questions to match the rep's demonstrated expertise.",
    },
  },
  budget_buyer: {
    base: "You're interested in solving your problem, but cost, timing, and internal approval are real concerns for you. You need to justify this spend to others.",
    intensity: {
      easy: "Raise mild concerns about cost and timing but be fairly easy to reassure.",
      medium: "Push back on price more firmly and ask about ROI, payment terms, and what the approval process would look like.",
      hard: "Be tough on price, bring up budget constraints repeatedly, ask for discounts or justification, and don't move forward until the rep clearly ties cost to value.",
      adaptive: "Calibrate your budget resistance to how well the rep builds and defends value throughout the conversation.",
    },
  },
  technical_buyer: {
    base: "You evaluate solutions primarily through a technical lens — implementation, integrations, security, and whether it will actually work with your existing systems.",
    intensity: {
      easy: "Ask basic technical questions and accept reasonably confident answers.",
      medium: "Ask more specific implementation and integration questions, and push back if answers feel vague or overly high-level.",
      hard: "Ask detailed, technical questions, press for specifics on integrations and edge cases, and call out any hand-wavy or non-technical answers.",
      adaptive: "Scale technical scrutiny to the rep's demonstrated technical fluency.",
    },
  },
  existing_customer: {
    base: "You're currently using a competitor's solution and are being pitched an alternative. You compare everything to what you already have and need real, specific differentiation to consider switching.",
    intensity: {
      easy: "Mention your current vendor but be reasonably open to hearing how this is different.",
      medium: "Compare the rep's pitch directly against your current vendor and ask for specific points of differentiation.",
      hard: "Be skeptical of switching costs and risk, push hard on 'why is this actually better,' and don't concede unless the rep gives concrete, specific advantages over your current solution.",
      adaptive: "Calibrate your resistance to switching based on how compelling and specific the rep's differentiation is.",
    },
  },
}

function buildSystemInstruction(mode: string, prefs: any): string {
  // Persona-driven roleplay: persona = WHO, scenario = WHAT KIND of call,
  // difficulty = HOW intensely the persona resists. Difficulty never
  // changes which persona appears.
  if (mode === 'roleplay' && prefs && prefs.persona && PERSONAS[prefs.persona]) {
    const persona = PERSONAS[prefs.persona]
    const scenario = prefs.scenario && SCENARIOS[prefs.scenario] ? SCENARIOS[prefs.scenario] : null
    const diff: 'easy' | 'medium' | 'hard' | 'adaptive' = persona.intensity[prefs.difficulty as 'easy' | 'medium' | 'hard' | 'adaptive'] ? prefs.difficulty : 'medium'

    const parts = [persona.base]
    if (scenario) parts.push(scenario.systemFrame)
    parts.push(persona.intensity[diff])
    if (prefs.style && STYLE_MODIFIERS[prefs.style]) parts.push(STYLE_MODIFIERS[prefs.style])
    if (prefs.feedbackDetail && FEEDBACK_MODIFIERS[prefs.feedbackDetail]) parts.push(FEEDBACK_MODIFIERS[prefs.feedbackDetail])
    if (prefs.language && prefs.language !== 'english') parts.push(`Respond in ${prefs.language}.`)
    parts.push('Keep your responses short — 1 to 3 sentences maximum, like a real person on a phone call. Never write long paragraphs.Stay fully in character as this persona. Only break character to give brief coaching feedback if the rep explicitly asks for it.')
    return parts.join(' ')
  }

  const base = SYSTEM_PROMPTS[mode] || DEFAULT_PROMPT
  if (!prefs) return base

  const parts = [base]
  if (prefs.difficulty && DIFFICULTY_MODIFIERS[prefs.difficulty]) parts.push(DIFFICULTY_MODIFIERS[prefs.difficulty])
  if (prefs.style && STYLE_MODIFIERS[prefs.style]) parts.push(STYLE_MODIFIERS[prefs.style])
  if (prefs.feedbackDetail && FEEDBACK_MODIFIERS[prefs.feedbackDetail]) parts.push(FEEDBACK_MODIFIERS[prefs.feedbackDetail])
  if (prefs.language && prefs.language !== 'english') parts.push(`Respond in ${prefs.language}.`)

  return parts.join(' ')
}

// ── End-of-session feedback report ──────────────────────────────────────
// A structurally distinct request: instead of staying in character, Gemini
// steps OUT of character to grade the whole transcript against the
// scenario's success indicators, using response_schema so the score fields
// are reliably parseable JSON instead of freeform text we'd have to scrape.

const FEEDBACK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    openingScore: { type: 'INTEGER', description: '1-10 score for how well the rep opened the conversation.' },
    discoveryScore: { type: 'INTEGER', description: '1-10 score for how well the rep asked questions and uncovered needs/pain.' },
    objectionScore: { type: 'INTEGER', description: '1-10 score for how well the rep handled resistance/objections.' },
    communicationScore: { type: 'INTEGER', description: '1-10 score for tone, clarity, confidence, and listening skills.' },
    strengths: { type: 'ARRAY', items: { type: 'STRING' }, description: '2-3 specific things the rep did well, with concrete examples from the conversation.' },
    weaknesses: { type: 'ARRAY', items: { type: 'STRING' }, description: '2-3 specific areas that need improvement, with concrete examples from the conversation.' },
    recommendations: { type: 'ARRAY', items: { type: 'STRING' }, description: '1-2 actionable next steps the rep should practice.' },
  },
  required: ['openingScore', 'discoveryScore', 'objectionScore', 'communicationScore', 'strengths', 'weaknesses', 'recommendations'],
}

function buildFeedbackInstruction(prefs: any): string {
  const scenario = prefs && prefs.scenario && SCENARIOS[prefs.scenario] ? SCENARIOS[prefs.scenario] : null
  const persona = prefs && prefs.persona && PERSONAS[prefs.persona] ? prefs.persona : null

  const parts = [
    "You are an expert sales coach reviewing a completed roleplay transcript between a trainee SDR (role 'user') and an AI prospect (role 'model'). Step out of character completely — you are now grading the SDR's performance, not playing the prospect.",
  ]
  if (scenario) {
    parts.push(`Scenario: ${scenario.label}. Goal: ${scenario.goal}`)
    parts.push('Grade against these success indicators: ' + scenario.successIndicators.join('; ') + '.')
  }
  if (persona) parts.push(`The AI was playing: ${persona}.`)
  if (prefs && prefs.goal && !scenario) parts.push(`Goal: ${prefs.goal}`)

  parts.push('Score each category 1-10. Be honest and specific — cite concrete moments from the transcript in your strengths, weaknesses, and recommendations rather than generic advice. If the transcript is too short to assess a category fairly, still give your best-estimate score but keep the related feedback brief and say so.')
  return parts.join(' ')
}

async function generateFeedback(messages: { role: string; content: string }[], prefs: any, apiKey: string) {
  const transcript = messages
    .map(m => `${m.role === 'coach' ? 'PROSPECT' : 'SDR'}: ${m.content}`)
    .join('\n')

  const systemInstruction = buildFeedbackInstruction(prefs)

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: `Transcript:\n${transcript}` }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: FEEDBACK_SCHEMA,
        },
      }),
    }
  )

  const data = await response.json()
  if (!response.ok) {
    throw new Error(`Google API Error: ${data.error?.message || response.statusText}`)
  }

  const candidate = data.candidates && data.candidates[0]
  const raw = candidate?.content?.parts?.[0]?.text
  if (!raw) {
    console.error('coach-chat: Gemini returned no usable content for feedback. finishReason:', candidate?.finishReason, 'promptFeedback:', data.promptFeedback)
    throw new Error('The AI did not return a usable feedback report — please try again.')
  }
  return JSON.parse(raw)
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // verify_jwt = true (config.toml) only checks that the token is a validly
  // signed Supabase JWT — the public anon key satisfies that too. Resolving
  // the caller here confirms it's an actual logged-in user, not just anyone
  // holding the anon key.
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { messages, mode, prefs, action } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    // Minimal debug trace — mode/action/count only, never message content.
    console.log(`coach-chat: action=${action || 'chat'} mode=${mode} msgCount=${messages?.length ?? 0}`)

    if (!apiKey) {
      throw new Error('Missing Gemini API Key! Please add it to your Supabase secrets.')
    }

    // ── End-of-session feedback report (structured JSON, not chat) ──
    if (action === 'feedback') {
      const report = await generateFeedback(messages, prefs, apiKey)
      return new Response(JSON.stringify({ report }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Normal chat turn (unchanged) ──
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'coach' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const systemInstruction = buildSystemInstruction(mode, prefs)

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(`Google API Error: ${data.error?.message || response.statusText}`)
    }

    const candidate = data.candidates && data.candidates[0]
    const replyText = candidate?.content?.parts?.[0]?.text

    if (!replyText) {
      console.error('coach-chat: Gemini returned no usable content. finishReason:', candidate?.finishReason, 'promptFeedback:', data.promptFeedback)
      throw new Error('The AI returned an empty response — please try again.')
    }

    return new Response(JSON.stringify({ html: replyText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
