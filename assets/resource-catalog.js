/*
 * AmplifyHub Practical Resource Library — static, version-controlled catalog.
 *
 * This file is the single source of truth for the browser (resources.html,
 * resource.html), the download generators (scripts/generate-resource-files.mjs),
 * and the Supabase seed migration (scripts/generate-resource-migration.mjs).
 * Keep those consumers in sync by regenerating after any edit here.
 *
 * DRAFT CONTENT: every entry is a first draft written for human editorial
 * review. Do not describe this content as professionally reviewed until a
 * reviewer sets `status` to 'reviewed'.
 *
 * Section shape used by all renderers/generators:
 *   { type:'paragraph', heading?, text }
 *   { type:'steps'|'list', heading, items:[string] }
 *   { type:'table', heading, columns:[string], rows:[[string]] }
 *   { type:'fields', heading, items:[string] }        // fill-in labels
 * Worksheet resources may add `sheet:{ columns:[], rows:[[...]], blankRows:N }`.
 */
(function (root) {
  'use strict';

  var REVIEW_DATE = '2026-07-19';

  var CATEGORY_META = {
    script: { label: 'Script', plural: 'Scripts', icon: '📝' },
    template: { label: 'Template', plural: 'Templates', icon: '📋' },
    cheatsheet: { label: 'Cheat Sheet', plural: 'Cheat Sheets', icon: '⚡' },
    worksheet: { label: 'Worksheet', plural: 'Worksheets', icon: '📓' },
    interview: { label: 'Interview Prep', plural: 'Interview Prep', icon: '🎤' }
  };

  var RESOURCES = [
    /* ---------------------------------------------------------------- SCRIPTS */
    {
      id: 'scripts-permission-opener',
      status: 'reviewed',
      title: 'Permission-Based Cold Call Opener',
      category: 'script',
      skill: 'opening',
      difficulty: 'beginner',
      duration: 6,
      summary: 'A short, honest opener that asks for a few seconds of attention before you explain why you called, so the conversation starts with consent instead of a pitch.',
      objectives: [
        'Introduce yourself and your company clearly',
        'Ask permission before continuing',
        'Give a specific, honest reason for the call',
        'End with one open question that invites a real answer'
      ],
      sections: [
        { type: 'steps', heading: 'How to use it', items: [
          'Read the four beats out loud until they feel natural: identity, permission, reason, question.',
          'Replace the bracketed placeholders with your own company and a real, specific reason for calling.',
          'Practice the opener five times before your first live call of the day.',
          'If the prospect says now is not a good time, offer to be brief or to call back — do not push past a clear no.'
        ]},
        { type: 'list', heading: 'The four beats', items: [
          'Identity: "Hi [name], this is [you] with [company]."',
          'Permission: "Can I borrow 30 seconds to tell you why I called, and then you can decide if it is worth continuing?"',
          'Reason: one specific, honest sentence about why you are calling this person.',
          'Question: an open question that lets them react in their own words.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"Hi Jordan, this is Sam with Northlight. Can I borrow 30 seconds to tell you why I called, and then you can decide if it is worth continuing? … Thanks. I work with operations leads at mid-size logistics firms, and most tell me onboarding new drivers still runs on spreadsheets. Before I assume that is true for you — how are you handling that today?"'
      },
      safePractice: 'Never claim a referral, prior meeting, or relationship that did not happen. If the prospect says it is a bad time, respect it and offer to reconnect. Rehearse with the AI Coach, not with real prospects you have not researched.',
      related: { label: 'Practice this opener with the AI Coach', route: 'coach-home.html#roleplay' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-30-second-structure',
      status: 'reviewed',
      title: '30-Second Call Structure',
      category: 'script',
      skill: 'opening',
      difficulty: 'intermediate',
      duration: 8,
      summary: 'A flexible spoken structure — not a word-for-word script — that keeps your first 30 seconds clear: who you are, why you are calling, why it might matter to them, and one question.',
      objectives: [
        'Deliver identity, reason, relevance, and a question in about 30 seconds',
        'Sound like a structure you can adapt, not a memorised paragraph',
        'Lead with a buyer problem instead of a product feature',
        'Hand the conversation back with a genuine question'
      ],
      sections: [
        { type: 'steps', heading: 'Build your version', items: [
          'Write one sentence of identity: your name and company.',
          'Write one honest reason you are calling this type of person.',
          'Write one relevance line: a problem people in this role often recognise.',
          'Write one open question that checks whether the problem is real for them.',
          'Read all four aloud and time yourself — aim for 25 to 35 seconds.'
        ]},
        { type: 'table', heading: 'Structure at a glance', columns: ['Beat', 'Goal', 'Length'], rows: [
          ['Identity', 'Remove confusion about who is calling', '~4 sec'],
          ['Reason', 'Be honest about why you called', '~6 sec'],
          ['Relevance', 'Connect to a problem they may have', '~10 sec'],
          ['Question', 'Give control back to the prospect', '~6 sec']
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"Hi Priya, Sam from Northlight. I called because we help support teams that are getting more tickets than they can answer without adding headcount. Support leads often tell me weekend coverage is where things slip. Is that something your team runs into, or have you already solved it?"'
      },
      safePractice: 'Use a structure you can adapt in the moment rather than reciting a script; robotic delivery breaks trust. Do not invent statistics or results. If they answer that the problem does not apply, believe them and move on.',
      related: { label: 'Build your own script in the Journey', route: 'building-script-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-gatekeeper-approach',
      status: 'reviewed',
      title: 'Respectful Gatekeeper Approach',
      category: 'script',
      skill: 'opening',
      difficulty: 'intermediate',
      duration: 7,
      summary: 'A transparent way to speak with a receptionist or assistant that treats them as a person and a potential ally, asks for help directly, and never uses deception to get past them.',
      objectives: [
        'Greet the gatekeeper and ask for help directly',
        'Be transparent about who you are and why you called',
        'Accept their answer gracefully, including no',
        'Leave a professional impression even if you do not get through'
      ],
      sections: [
        { type: 'list', heading: 'Principles', items: [
          'Be honest: never pretend to be a customer, a friend, or a returning caller.',
          'Be brief: state who you are and what you are hoping to do in one breath.',
          'Ask for guidance: gatekeepers often know the best person and the best time.',
          'Be gracious: thank them regardless of the outcome.'
        ]},
        { type: 'steps', heading: 'A simple flow', items: [
          'Warm greeting and your name and company.',
          'Honest reason: "I am hoping to reach whoever looks after [area] — am I in the right place?"',
          'If asked what it is about, give a plain one-line answer.',
          'If it is not a good time, ask when would be better and thank them.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"Hi, this is Sam calling from Northlight. I am trying to reach whoever looks after driver scheduling, and I am guessing you would know better than I would. Could you point me to the right person, and is there a good time to catch them?"'
      },
      safePractice: 'Do not use tricks, false urgency, or claims of an existing relationship to get past a gatekeeper. Honesty here protects your reputation and theirs. If they decline, accept it politely.',
      related: { label: 'Practice openings with the AI Coach', route: 'coach-home.html#roleplay' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-objection-conversation',
      status: 'reviewed',
      title: 'Top-Five Objection Conversation',
      category: 'script',
      skill: 'objections',
      difficulty: 'intermediate',
      duration: 10,
      summary: 'Calm, non-pushy responses to the five objections beginners hear most — not interested, bad time, send an email, who are you, and we already have something — built on acknowledge, clarify, and offer a next step.',
      objectives: [
        'Acknowledge the objection before responding',
        'Ask one clarifying question instead of arguing',
        'Offer a low-pressure next step',
        'Recognise a firm no and exit respectfully'
      ],
      sections: [
        { type: 'table', heading: 'Five common objections', columns: ['You hear', 'Acknowledge', 'Then ask or offer'], rows: [
          ['"Not interested."', 'That is fair, thanks for being direct.', 'Ask one question about the reason, or offer to close out if it is a firm no.'],
          ['"Bad time."', 'Completely understand.', 'Offer a specific alternative time to call back.'],
          ['"Just send an email."', 'Happy to.', 'Ask one question so the email is actually relevant.'],
          ['"Who are you / how did you get my number?"', 'Reasonable question.', 'Answer honestly and briefly, then give your reason for calling.'],
          ['"We already have a solution."', 'That makes sense.', 'Ask what is working well and what they would change.']
        ]},
        { type: 'list', heading: 'The pattern behind every response', items: [
          'Acknowledge the concern genuinely, without sarcasm.',
          'Ask a clarifying question or offer a small, easy next step.',
          'Listen to the answer and respond to what they actually said.',
          'If the no is firm and repeated, thank them and end the call.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: 'Prospect: "Not interested." You: "That is fair, thanks for being direct. Can I ask — is it that the timing is off, or that this kind of thing just is not a priority right now?" If they say it is genuinely not a priority, respond: "Understood, I will not keep you. Thanks for the honesty."'
      },
      safePractice: 'These are conversation starters, not tricks to wear someone down. A reflex objection is worth one honest question; a firm, repeated no is a stop sign. Never imply consequences, guilt, or false scarcity to keep someone on the phone.',
      related: { label: 'Drill objections with the AI Coach', route: 'coach-home.html#roleplay' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-interest-based-close',
      status: 'reviewed',
      title: 'Interest-Based Meeting Close',
      category: 'script',
      skill: 'booking',
      difficulty: 'intermediate',
      duration: 7,
      summary: 'A way to ask for a meeting that checks for genuine interest first, ties the next step to something the prospect actually said, and offers two concrete times only after interest is real.',
      objectives: [
        'Confirm interest before asking for calendar time',
        'Tie the meeting to a problem the prospect named',
        'Offer two specific time options',
        'State clearly what will happen in the meeting'
      ],
      sections: [
        { type: 'steps', heading: 'The close in four steps', items: [
          'Summarise the relevant thing they said in one sentence.',
          'Ask an interest question: "Is that worth 20 minutes to look at properly?"',
          'Only if yes, offer two specific times.',
          'Confirm what the meeting will cover so there are no surprises.'
        ]},
        { type: 'list', heading: 'Interest checks that are not pushy', items: [
          '"Would it make sense to explore that further, or is it not a priority right now?"',
          '"Is this worth a short follow-up, or should I leave it here?"',
          '"Do you want me to put something together, or is now not the time?"'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"You mentioned weekend coverage is where tickets slip. Would it be worth 20 minutes to look at that properly — or is it not a priority right now? … Great. Would Tuesday afternoon or Wednesday morning suit you better? I will keep it focused on the coverage question, and you can decide whether it is worth going further."'
      },
      safePractice: 'Ask for interest before logistics; pressuring for a calendar slot after a soft no damages trust. Do not promise outcomes you cannot guarantee, and never cite customers, results, or "similar teams" you do not actually have. If they are not interested, thank them and leave the door open without pushing.',
      related: { label: 'Learn appointment setting in the Journey', route: 'book-appointments.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },

    {
      id: 'scripts-referral-opener',
      status: 'reviewed',
      title: 'Honest Referral Opener',
      category: 'script',
      skill: 'opening',
      difficulty: 'beginner',
      duration: 6,
      summary: 'An opener for when a real person pointed you toward this prospect — it names the connection honestly, explains why they thought of them, and hands control back with one question.',
      objectives: [
        'Name a genuine connection without overstating it',
        'Explain the specific reason you were pointed here',
        'Keep the borrowed trust intact by being honest',
        'End with a question that lets the prospect react'
      ],
      sections: [
        { type: 'steps', heading: 'The four beats', items: [
          'Name the person and how you know them, exactly as it happened.',
          'Say why that person thought this prospect was worth a conversation.',
          'Give one honest sentence about what you do for people in their role.',
          'Ask whether the reason still fits, instead of assuming it does.'
        ]},
        { type: 'list', heading: 'Keep it truthful', items: [
          'Only use a referral if the person actually agreed to be named.',
          'Do not upgrade "we spoke once" into "they are a close contact".',
          'If the connection is thin, say so — thin but honest beats warm but false.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"Hi Priya, this is Sam with Northlight. Dana Okafor on your ops team mentioned you when we talked last week — she thought driver scheduling might be worth a quick conversation with you specifically. I work with ops leads who are scaling headcount faster than their tools. Is scheduling actually a pain point for you, or did Dana catch it wrong?"'
      },
      safePractice: 'Never claim a referral, introduction, or relationship that did not happen — it is the fastest way to lose a prospect and your own credibility. If the person only agreed to be mentioned in general terms, keep it general. If the prospect says the reason does not fit, believe them and move on.',
      related: { label: 'Practice openings with the AI Coach', route: 'coach-home.html#roleplay' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-callback-voicemail',
      status: 'reviewed',
      title: 'Voicemail That Earns a Callback',
      category: 'script',
      skill: 'opening',
      difficulty: 'beginner',
      duration: 5,
      summary: 'A short voicemail structure — under twenty seconds — that gives a real reason to call back without hype, false urgency, or a mystery you refuse to explain.',
      objectives: [
        'Leave a voicemail the prospect can act on',
        'State a specific, honest reason for the call',
        'Make the callback easy with a clear number',
        'Avoid pressure tactics that damage trust'
      ],
      sections: [
        { type: 'steps', heading: 'Say it in this order', items: [
          'Your name and company, spoken slowly.',
          'One honest sentence about why you called this person.',
          'What a callback would cover, so it is not a mystery.',
          'Your number, said twice and clearly, then a short thank you.'
        ]},
        { type: 'table', heading: 'What to avoid', columns: ['Tempting line', 'Why to drop it'], rows: [
          ['"Call me back urgently."', 'Fake urgency reads as a trick and erodes trust.'],
          ['"I have something important for you."', 'A withheld mystery feels manipulative, not intriguing.'],
          ['"You will want to hear this."', 'You are deciding for them what they want.']
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"Hi Jordan, this is Sam with Northlight — that is S-A-M. I called because I saw your team is hiring support reps, and weekend coverage is usually where things get tight when you scale. If it is worth a short conversation I can walk you through how two similar teams handled it — no pressure either way. My number is 555-0142, again 555-0142. Thanks Jordan."'
      },
      safePractice: 'One voicemail per attempt is plenty — stacking messages feels like pressure. Never imply a prior conversation that did not happen, and never leave a deliberately vague message designed to force a callback. If they never call back, that is an answer too.',
      related: { label: 'Practice voicemails with the AI Coach', route: 'coach-home.html#roleplay' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-pattern-interrupt-opener',
      status: 'reviewed',
      title: 'Gentle Pattern-Interrupt Opener',
      category: 'script',
      skill: 'opening',
      difficulty: 'intermediate',
      duration: 7,
      summary: 'A way to open with a guarded prospect that breaks the auto-pilot "no" by being unexpectedly honest about the call, rather than using a gimmick or a trick question.',
      objectives: [
        'Acknowledge the cold call honestly up front',
        'Give the prospect a genuine reason to stay on',
        'Lower defenses with candor, not manipulation',
        'Offer an easy exit so staying is their choice'
      ],
      sections: [
        { type: 'list', heading: 'The honest interrupt', items: [
          'Name it: "This is a cold call — I will be quick and you can hang up any time."',
          'Earn the next ten seconds with one specific, relevant reason.',
          'Ask permission to continue instead of barreling ahead.',
          'If they say no, thank them and end the call cleanly.'
        ]},
        { type: 'paragraph', heading: 'Why candor works', text: 'Guarded prospects expect a rehearsed pitch and are ready to decline it. Naming the call for what it is breaks that script and treats them like an adult, which often buys a few real seconds of attention. The goal is not to trap them into listening — it is to make staying an easy, informed choice.' }
      ],
      example: {
        title: 'Worked example',
        text: '"Hi Alex — I will be honest, this is a cold call, so feel free to hang up. I called because your job posting mentioned onboarding delays, and that is the exact thing I help ops teams shorten. Can I take thirty seconds to explain why I thought of you, and then you decide if it is worth continuing?"'
      },
      safePractice: 'Honesty is the point — do not turn "pattern interrupt" into a bag of tricks like fake wrong numbers or pretending to know them. Always give a real exit and honor it the moment they take it. Candor earns attention; deception destroys it.',
      related: { label: 'Study openings in the Journey', route: 'opening-call-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-reconnect-dormant-lead',
      status: 'reviewed',
      title: 'Reconnect a Dormant Lead',
      category: 'script',
      skill: 'follow-up',
      difficulty: 'intermediate',
      duration: 8,
      summary: 'A call for reaching someone who went quiet months ago — it references the past honestly, gives them an easy way to say the timing changed, and never guilt-trips them for going dark.',
      objectives: [
        'Reference the earlier conversation accurately',
        'Give a real reason you are reaching out now',
        'Make it easy to restart or to close the loop',
        'Avoid any guilt about the silence'
      ],
      sections: [
        { type: 'steps', heading: 'How to reopen', items: [
          'Remind them who you are and when you last spoke.',
          'Name what changed that makes now worth a call — a new feature, a trigger event, a promised follow-up.',
          'Offer a genuine choice: pick this back up, or close it out for now.',
          'Whatever they choose, thank them and respect it.'
        ]},
        { type: 'list', heading: 'Reasons that justify a reconnect', items: [
          'You said you would circle back at a specific time, and that time is now.',
          'Something changed on their side (funding, hiring, a launch).',
          'Something changed on your side that directly addresses what they cared about.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"Hi Priya, Sam from Northlight — we spoke back in the spring about weekend support coverage, and you asked me to check back once your headcount plan was set. I saw you are hiring again, so this felt like the right time. Totally fine if the priority has shifted — do you want to pick this up, or should I close it out for now?"'
      },
      safePractice: 'Never guilt someone for going quiet ("I never heard back from you…") — silence is a normal, acceptable answer. Only claim a promised follow-up if it genuinely happened. Give a clean way to end the thread, and take a second no as final.',
      related: { label: 'Learn follow-up in the Journey', route: 'follow-up-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-trigger-event-opener',
      status: 'reviewed',
      title: 'Trigger-Event Opener',
      category: 'script',
      skill: 'prospecting',
      difficulty: 'intermediate',
      duration: 7,
      summary: 'An opener built around a public event — funding, hiring, a launch, a leadership change — that connects the event to a plausible problem without pretending to know more than you do.',
      objectives: [
        'Reference a real, public trigger event',
        'Connect it to a problem the event often creates',
        'Stay tentative — you are guessing, and you say so',
        'Invite the prospect to confirm or correct you'
      ],
      sections: [
        { type: 'table', heading: 'Event to plausible problem', columns: ['Trigger event', 'Problem it often creates'], rows: [
          ['New funding round', 'Pressure to scale the team and process fast'],
          ['Hiring a lot of one role', 'Onboarding and ramp become the bottleneck'],
          ['New product launch', 'Support and sales volume spike unpredictably'],
          ['New leader in the function', 'Reviewing tools and looking for quick wins']
        ]},
        { type: 'list', heading: 'Keep it a hypothesis', items: [
          'Say "I could be wrong" — because you might be.',
          'Ask them to confirm the problem, do not assert it.',
          'Use only public information; never imply insider knowledge.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"Hi Marco, Sam with Northlight. I saw the announcement that you raised your Series A — congratulations. Usually when teams your size raise, the next few months are a scramble to add people without the process breaking. I could be off base, but is scaling the team cleanly something on your plate right now, or is that already handled?"'
      },
      safePractice: 'Reference only public, business-level information — never personal details or anything that suggests you have been digging where you should not. Present the connection as a guess the prospect can correct, not a fact. If your read is wrong, thank them and move on rather than arguing for your theory.',
      related: { label: 'Learn prospecting in the Journey', route: 'finding-prospects-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-linkedin-to-call-bridge',
      status: 'reviewed',
      title: 'LinkedIn-to-Call Bridge',
      category: 'script',
      skill: 'prospecting',
      difficulty: 'beginner',
      duration: 6,
      summary: 'An opener for calling someone you have interacted with on LinkedIn — it references the online context truthfully and moves to a call without pretending the connection is closer than it is.',
      objectives: [
        'Reference the real online interaction accurately',
        'Explain why a call is worth more than more messages',
        'Keep the prospect in control of the shift',
        'Avoid overstating a light online connection'
      ],
      sections: [
        { type: 'steps', heading: 'Bridge in four beats', items: [
          'Name the specific interaction: a comment, a shared post, an accepted connection.',
          'Say why you are moving to a call rather than another message.',
          'Give one relevant reason the conversation could help them.',
          'Ask if now is a fair time or if you should suggest another.'
        ]},
        { type: 'list', heading: 'Honest framing of light connections', items: [
          '"We are connected on LinkedIn" is true; "we know each other" usually is not.',
          'A single accepted request is not a relationship — do not treat it as one.',
          'If they do not remember you, accept that gracefully and re-introduce yourself.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"Hi Dana, Sam here — we connected on LinkedIn after your post about support ticket backlogs a couple weeks ago. I figured a quick call would be more useful than trading messages. I work with support leads on exactly that backlog problem. Is now a fair moment for two minutes, or should I catch you another time?"'
      },
      safePractice: 'Only reference interactions that actually happened, and describe them at their true weight — a like is not a conversation. Do not use LinkedIn data to imply you have researched them personally beyond what they posted publicly. If they do not recall you, re-introduce yourself honestly instead of insisting on a bond.',
      related: { label: 'Build a prospect list in the Journey', route: 'finding-prospects-2.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-discovery-call-opening',
      status: 'reviewed',
      title: 'First Five Minutes of a Discovery Call',
      category: 'script',
      skill: 'discovery',
      difficulty: 'intermediate',
      duration: 9,
      summary: 'A structure for opening a booked discovery call so the prospect knows the plan, agrees to it, and does most of the talking — instead of sitting through a premature pitch.',
      objectives: [
        'Set a clear agenda and get agreement to it',
        'Confirm how much time you actually have',
        'Earn the right to ask questions before pitching',
        'Hand the floor to the prospect early'
      ],
      sections: [
        { type: 'steps', heading: 'Open in this order', items: [
          'Thank them and restate why the meeting is happening, in one line.',
          'Propose a simple agenda and ask if it works for them.',
          'Confirm the time you have so you can pace the call.',
          'Ask an opening question and then listen more than you talk.'
        ]},
        { type: 'list', heading: 'Agreement checks', items: [
          '"Does that agenda work, or is there something you want to add?"',
          '"Do we still have the full 30 minutes, or should I be tighter?"',
          '"Mind if I start with a couple of questions before I explain anything?"'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"Thanks for making time, Priya. My understanding is we are here because weekend coverage has been slipping — is that right? I was thinking we spend most of this on your side of it, then I will show only what is actually relevant, and we decide together on a next step. Does that work? And do we still have the full half hour? Great — mind if I start with a few questions?"'
      },
      safePractice: 'Do not skip straight to a pitch because you are nervous about the silence — a discovery call the prospect did not shape feels like an ambush. Only restate the meeting reason if it is accurate. If they have less time than expected, adjust honestly rather than rushing them.',
      related: { label: 'Learn discovery in the Journey', route: 'discovery-questions-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-not-interested-recovery',
      status: 'reviewed',
      title: '"Not Interested" Recovery',
      category: 'script',
      skill: 'objections',
      difficulty: 'intermediate',
      duration: 7,
      summary: 'A calm response to a reflex "not interested" that acknowledges it, asks one honest question to learn what is behind it, and knows when the no is real enough to stop.',
      objectives: [
        'Acknowledge the objection without arguing',
        'Ask one question to understand the real reason',
        'Offer a small, relevant next step if there is interest',
        'Recognise a firm no and exit respectfully'
      ],
      sections: [
        { type: 'steps', heading: 'The recovery in three moves', items: [
          'Acknowledge genuinely: "That is fair, thanks for being direct."',
          'Ask one clarifying question to separate a reflex from a real no.',
          'If a door opens, offer one small next step; if not, thank them and end.'
        ]},
        { type: 'list', heading: 'Questions that respect the person', items: [
          '"Is it the timing, or is this just not something you deal with?"',
          '"Fair enough — out of interest, is it a priority thing or a fit thing?"',
          '"Understood. Would it help if I checked back another time, or should I leave it?"'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: 'Prospect: "Not interested." You: "That is fair, thanks for being direct. Can I ask — is it that the timing is off, or that this kind of thing is not a priority right now?" Prospect: "Just not a priority this quarter." You: "Understood. I will not chase you — would a check-in next quarter be welcome, or would you rather I close this out?"'
      },
      safePractice: 'One honest question after a "not interested" is fair; a second push after a clear, repeated no is not. Never imply the prospect is making a mistake or use guilt to keep them talking. A firm no is a complete answer — thank them and end the call.',
      related: { label: 'Drill objections in the Journey', route: 'objection-handling-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-send-me-an-email-redirect',
      status: 'reviewed',
      title: '"Send Me an Email" Redirect',
      category: 'script',
      skill: 'objections',
      difficulty: 'beginner',
      duration: 5,
      summary: 'A response to "just send me an email" that agrees happily, then asks one question so the email is actually relevant — without refusing to send it or turning it into a fight.',
      objectives: [
        'Agree to send the email without resistance',
        'Ask one question so the email is worth reading',
        'Set a light, optional next touch',
        'Accept that an email request can be a polite exit'
      ],
      sections: [
        { type: 'steps', heading: 'Redirect in three beats', items: [
          'Say yes immediately — "Happy to."',
          'Ask one question so you send something relevant, not generic.',
          'Offer a small optional follow-up so the email is not a dead end.'
        ]},
        { type: 'paragraph', heading: 'Read the request honestly', text: 'Sometimes "send me an email" means "I am mildly curious," and sometimes it means "this is how I end calls politely." Both are fine. Ask your one question; if the answer is thin, send a short, genuinely useful email and let them come back on their own terms rather than pushing for a call they did not offer.' }
      ],
      example: {
        title: 'Worked example',
        text: '"Happy to send that over. So I do not send you a generic overview — is weekend coverage the part that is actually painful, or is it more the onboarding side? … Got it, I will keep the email focused on coverage. If it is useful, reply and I will share how two teams handled it. If not, no worries at all."'
      },
      safePractice: 'Always send the email you promised — refusing to send one unless they book a call is a bait-and-switch that burns trust. Keep it short and relevant, never mark it "urgent," and do not follow a single email with a barrage. If they do not reply, that is a legitimate answer.',
      related: { label: 'Drill objections in the Journey', route: 'objection-handling-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-pricing-objection-hold',
      status: 'reviewed',
      title: 'Holding Steady on a Price Objection',
      category: 'script',
      skill: 'objections',
      difficulty: 'advanced',
      duration: 9,
      summary: 'A response to "it is too expensive" that stays calm, understands what is behind the concern, and reconnects price to value honestly — without discounting on reflex or overpromising.',
      objectives: [
        'Acknowledge the price concern without panic',
        'Find out what "too expensive" actually means',
        'Reconnect cost to value the prospect named',
        'Hold your price honestly, or say you cannot help'
      ],
      sections: [
        { type: 'list', heading: 'What "too expensive" can mean', items: [
          'Compared to a competitor or their current tool.',
          'More than the budget they have this quarter.',
          'They are not yet convinced the value is worth it.'
        ]},
        { type: 'steps', heading: 'Hold steady in three moves', items: [
          'Acknowledge: "That is a fair thing to raise."',
          'Ask which kind of "expensive" it is, so you address the real one.',
          'Reconnect price to the specific problem and impact they described earlier.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"That is a fair thing to raise. Can I ask — is it more than you expected compared to what you use now, or more than there is room for this quarter? … Budget this quarter. Understood. Earlier you said a bad coverage week costs you overtime and missed pickups — if that is the real cost, it might be worth revisiting when budget frees up. I would rather do that than discount into something that does not fit."'
      },
      safePractice: 'Do not reflexively discount to save a deal — it teaches the buyer your price is negotiable fiction and can trap you in a bad fit. Never invent ROI figures or cite results you cannot back up. If the value genuinely is not there for them, it is honest to say so and step back.',
      related: { label: 'Drill objections in the Journey', route: 'objection-handling-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-competitor-displacement-opener',
      status: 'reviewed',
      title: 'Respectful Competitor-in-Place Opener',
      category: 'script',
      skill: 'objections',
      difficulty: 'advanced',
      duration: 8,
      summary: 'An approach for prospects who already use a competitor — it respects their current choice, asks what is and is not working, and offers a specific difference instead of trash-talking the incumbent.',
      objectives: [
        'Respect the prospect\'s existing decision',
        'Learn what works and what they would change',
        'Offer one concrete, honest point of difference',
        'Never disparage the competitor'
      ],
      sections: [
        { type: 'steps', heading: 'Approach in four beats', items: [
          'Acknowledge they already have a solution — no surprise, no judgment.',
          'Ask what is working well before anything else.',
          'Ask the one thing they would change if they could.',
          'Only if there is a real gap, offer one specific difference you can stand behind.'
        ]},
        { type: 'list', heading: 'Talk about them, not the competitor', items: [
          'Never call the incumbent bad — it insults their choice and your credibility.',
          'Anchor on the change they named, not on a feature war.',
          'If they are genuinely happy, thank them and leave the door open.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"You are already using Meridian — good tool, I am not here to knock it. Out of curiosity, what is working well with it for you? … And if you could change one thing about it, what would it be? … The reporting delay you mentioned is actually the one area we are built differently, so that might be worth a look. If everything is fine as-is, though, I will not try to talk you out of a setup that works."'
      },
      safePractice: 'Never disparage a competitor or imply the prospect made a poor choice — it damages trust and often backfires. Only claim a difference you can genuinely deliver and demonstrate. If the prospect is satisfied with what they have, respect that and leave without pressure.',
      related: { label: 'Drill objections in the Journey', route: 'objection-handling-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-second-attempt-callback',
      status: 'reviewed',
      title: 'Second-Attempt Callback',
      category: 'script',
      skill: 'follow-up',
      difficulty: 'beginner',
      duration: 5,
      summary: 'A script for your second call after a missed first one — it references the earlier attempt lightly, gives a fresh reason to talk, and does not scold them for not answering.',
      objectives: [
        'Reference the earlier attempt without pressure',
        'Lead with a reason, not a complaint',
        'Offer an easy way to talk now or later',
        'Keep the tone patient and low-key'
      ],
      sections: [
        { type: 'list', heading: 'How to reference attempt one', items: [
          '"I tried you earlier this week" is fine; "you did not pick up" is not.',
          'Assume they were busy, not avoiding you — usually true, always kinder.',
          'Lead with the reason for calling, not the fact that you called before.'
        ]},
        { type: 'steps', heading: 'Structure the callback', items: [
          'Re-introduce yourself briefly — they may not remember the first attempt.',
          'Give the one relevant reason for the call.',
          'Offer to be quick now or to find a better time.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"Hi Jordan, Sam with Northlight again — I tried you earlier in the week, figured the timing was just busy. I called because weekend coverage tends to get harder as support teams grow, and I help with exactly that. Happy to be quick now if it is a decent moment, or I can catch you another time — whichever is easier for you."'
      },
      safePractice: 'Do not let a second attempt carry any edge of "why did you not call me back" — the prospect owes you nothing. Keep attempts spaced and reasonable; repeated rapid calls read as pressure. If the second attempt goes nowhere, treat that as a signal, not a reason to try five more times.',
      related: { label: 'Learn follow-up in the Journey', route: 'follow-up-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-event-followup-call',
      status: 'reviewed',
      title: 'Event or Webinar Follow-Up Call',
      category: 'script',
      skill: 'follow-up',
      difficulty: 'intermediate',
      duration: 7,
      summary: 'A call for following up with someone after they attended an event or webinar — it references what they showed up for, connects it to a relevant next step, and respects that attending is not the same as buying.',
      objectives: [
        'Reference the specific event they attended',
        'Connect their attendance to a plausible interest',
        'Offer a next step that matches that interest',
        'Avoid treating attendance as a commitment'
      ],
      sections: [
        { type: 'steps', heading: 'Follow up in four beats', items: [
          'Name the event and thank them for attending or registering.',
          'Reference the topic or session as the reason you are calling.',
          'Ask an open question about whether the topic is a live issue for them.',
          'Offer a next step sized to their actual interest, not your hope.'
        ]},
        { type: 'list', heading: 'Keep attendance in perspective', items: [
          'Registering for a webinar is curiosity, not intent to buy.',
          'They may have attended for one narrow reason — ask, do not assume.',
          'A "just browsing" answer is legitimate; leave a friendly door open.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"Hi Marco, Sam from Northlight — thanks for joining our session on scaling support last Thursday. I am reaching out to the folks who came because the coverage part tends to be a real, current headache. Is that something you are actually wrestling with right now, or were you mostly there for the hiring section? … Got it — then the piece worth sharing is probably X. Want me to send it, or set up a short call?"'
      },
      safePractice: 'Attending an event is a small signal, not permission to hard-sell — treat it as a reason to ask, not to assume. Reference only the event they actually joined. If they were there out of general curiosity, offer something useful and let them decide the pace.',
      related: { label: 'Learn follow-up in the Journey', route: 'follow-up-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-inbound-lead-qualifying',
      status: 'reviewed',
      title: 'Warm Inbound-Lead Qualifying Call',
      category: 'script',
      skill: 'discovery',
      difficulty: 'beginner',
      duration: 7,
      summary: 'A call for someone who reached out or requested information — it thanks them, understands what prompted the interest, and qualifies gently without interrogating a warm hand.',
      objectives: [
        'Thank the lead and confirm what they were after',
        'Understand what prompted them to reach out',
        'Qualify with open questions, not a checklist',
        'Match the next step to their real readiness'
      ],
      sections: [
        { type: 'steps', heading: 'Open a warm lead well', items: [
          'Thank them for reaching out and confirm what they downloaded or asked about.',
          'Ask what prompted them to look now — the answer shapes everything.',
          'Ask one or two open questions to understand their situation.',
          'Suggest a next step that fits how ready they actually are.'
        ]},
        { type: 'list', heading: 'Qualify without interrogating', items: [
          'A warm lead expects a conversation, not a rapid-fire form.',
          'Lead with "what prompted this?" before "what is your budget?"',
          'Let them volunteer detail; follow their thread rather than a rigid script.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"Hi Dana, thanks for grabbing our coverage guide — I wanted to reach out personally. Out of curiosity, what made you look into this now? … Makes sense, the new depots would do it. How are you handling weekend scheduling across them today? … Got it. Depending on where you are, the useful next step is either a short walkthrough or just a couple of resources — which feels right for you?"'
      },
      safePractice: 'A warm lead is still a person deciding at their own pace, not a closed deal — do not treat inbound interest as a green light to push. Qualify with genuine curiosity rather than a scripted interrogation, and offer the lighter next step if they are early. Respect a "just researching" answer.',
      related: { label: 'Learn discovery in the Journey', route: 'discovery-questions-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'scripts-meeting-confirmation',
      status: 'reviewed',
      title: 'Meeting Confirmation & No-Show Prevention',
      category: 'script',
      skill: 'booking',
      difficulty: 'beginner',
      duration: 6,
      summary: 'A short confirmation touch — call or message — that locks in a booked meeting by restating the value, the time, and an easy way to reschedule, so no-shows drop without nagging.',
      objectives: [
        'Restate the meeting time and what it will cover',
        'Remind them of the value they will get',
        'Make rescheduling easy and guilt-free',
        'Reduce no-shows without pressure'
      ],
      sections: [
        { type: 'steps', heading: 'Confirm in three parts', items: [
          'Restate the day, time, and how long it will take.',
          'Remind them of the one useful thing they will walk away with.',
          'Offer an easy reschedule path in case something comes up.'
        ]},
        { type: 'list', heading: 'Why this lowers no-shows', items: [
          'A concrete, valuable reason to attend beats a bare calendar hold.',
          'An easy reschedule option turns a would-be no-show into a new time.',
          'A friendly tone makes them more likely to actually show up.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: '"Hi Jordan — just confirming our 20 minutes on Wednesday at 10:00. I will show you how two teams your size handled weekend coverage, so you leave with at least one idea you can use whether or not we work together. If something comes up, no problem at all — just reply and we will find another slot. Looking forward to it."'
      },
      safePractice: 'A confirmation should reassure, not pressure — never guilt someone into keeping a meeting or imply they owe you attendance. Only promise value you can actually deliver in the meeting. Always make rescheduling genuinely easy; a moved meeting is a far better outcome than a resentful attendee.',
      related: { label: 'Learn appointment setting in the Journey', route: 'book-appointments.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    /* -------------------------------------------------------------- TEMPLATES */
    {
      id: 'templates-three-touch-followup',
      status: 'reviewed',
      title: 'Three-Touch Follow-Up Sequence',
      category: 'template',
      skill: 'follow-up',
      difficulty: 'beginner',
      duration: 9,
      summary: 'A short, respectful three-message follow-up where each touch adds a different useful angle — a recap, a relevant insight, and a permission-to-close — instead of repeating "just checking in".',
      objectives: [
        'Write three follow-ups that each add new value',
        'Space the messages out with clear timing',
        'Reference something specific from the call',
        'End the sequence with a respectful close'
      ],
      sections: [
        { type: 'table', heading: 'The sequence', columns: ['Touch', 'Timing', 'Angle'], rows: [
          ['1 — Recap', 'Same day', 'Thank them, recap what you discussed, restate the next step.'],
          ['2 — Insight', '2–3 days later', 'Share one relevant, genuinely useful idea or resource.'],
          ['3 — Permission to close', '4–5 days later', 'Ask if you should keep this open or close it out for now.']
        ]},
        { type: 'fields', heading: 'Fill in before sending', items: [
          'Prospect name and role',
          'The specific problem or comment from the call',
          'The one insight or resource for touch 2',
          'The clear next step you are proposing'
        ]}
      ],
      example: {
        title: 'Worked example (Touch 3)',
        text: '"Hi Jordan — I do not want to clutter your inbox, so this is my last note for now. If the driver-scheduling issue is still worth a look, I am happy to set up 20 minutes. If the timing is not right, no problem at all — just let me know and I will close this out. Either answer is helpful."'
      },
      safePractice: 'Follow up to be useful, not to pressure. Do not send daily messages or imply urgency that is not real. Always give the prospect an easy way to say "not now" and honour it.',
      related: { label: 'See follow-up lessons in the Journey', route: 'follow-up-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'templates-voicemail-email-pair',
      status: 'reviewed',
      title: 'Voicemail + Email Pair',
      category: 'template',
      skill: 'follow-up',
      difficulty: 'beginner',
      duration: 6,
      summary: 'A matched voicemail and email you can leave together so the two reinforce each other — a short spoken message that names your reason, and an email that makes the next step easy.',
      objectives: [
        'Leave a voicemail under 20 seconds',
        'Send an email that matches the voicemail',
        'Give one clear, low-effort next step',
        'Avoid repeating the exact same words in both'
      ],
      sections: [
        { type: 'list', heading: 'Voicemail (under 20 seconds)', items: [
          'Name and company.',
          'One honest reason you called.',
          'Say you will send a short email so they have it in writing.',
          'Leave your name and number slowly, once.'
        ]},
        { type: 'fields', heading: 'Email fields to fill in', items: [
          'Subject line referencing your reason for calling',
          'One-line recap of the voicemail',
          'The specific problem you help with',
          'A single, easy next step (reply yes/no or pick a time)'
        ]}
      ],
      example: {
        title: 'Worked example (voicemail)',
        text: '"Hi Priya, Sam with Northlight. I called about weekend support coverage — I saw you are hiring for your support team, so the timing seemed relevant. I will send a short email so you have it in writing, no pressure to call back. My number is 555-0142, again 555-0142. Thanks Priya."'
      },
      safePractice: 'Keep both messages honest and easy to ignore. Do not mark emails "urgent" or imply a prior conversation that did not happen. One voicemail and one email per attempt is plenty — avoid flooding.',
      related: { label: 'Practice voicemails with the AI Coach', route: 'coach-home.html#roleplay' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'templates-prospect-research-brief',
      status: 'reviewed',
      title: 'Prospect Research Brief',
      category: 'template',
      skill: 'prospecting',
      difficulty: 'beginner',
      duration: 10,
      summary: 'A one-page brief you fill in before calling, using only public, business-level information, so you can open with genuine relevance instead of a generic pitch.',
      objectives: [
        'Capture the company and role you are calling',
        'Note one public business signal worth referencing',
        'Turn that signal into a plausible problem',
        'Write one relevant opening question'
      ],
      sections: [
        { type: 'fields', heading: 'Brief fields', items: [
          'Company name and what they do (one line)',
          'Role you are trying to reach',
          'One public signal (hiring, expansion, product launch, news)',
          'A plausible problem that signal might create',
          'Your relevant opening question',
          'Notes: anything that would make the call more respectful and specific'
        ]},
        { type: 'paragraph', heading: 'Where to look (public only)', text: 'Company website, public job posts, press releases, and public social posts are enough. Do not collect or store personal contact details, private data, or anything that is not meant to be public.' }
      ],
      example: {
        title: 'Worked example',
        text: 'Company: regional courier, 40 staff. Role: operations lead. Signal: public job post for five new drivers. Plausible problem: onboarding and scheduling get harder as the team grows quickly. Opening question: "As you add drivers, how are you keeping scheduling consistent?"'
      },
      safePractice: 'Use only public, business-level information. Never store personal phone numbers, home addresses, or private details in this brief. Research to be relevant, not intrusive.',
      related: { label: 'Learn prospecting in the Journey', route: 'finding-prospects-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'templates-icp-template',
      status: 'reviewed',
      title: 'Ideal Customer Profile (ICP) Template',
      category: 'template',
      skill: 'prospecting',
      difficulty: 'beginner',
      duration: 10,
      summary: 'A fill-in template for defining who you should be calling, based on observable company and role criteria, so your list is focused instead of "anyone with a phone".',
      objectives: [
        'Define the industry and company size you serve best',
        'Name the roles most likely to care',
        'List observable signals that suggest a fit',
        'Note who is usually not a fit, and why'
      ],
      sections: [
        { type: 'fields', heading: 'Define your ICP', items: [
          'Industry or vertical',
          'Company size signal (staff count, locations, revenue band if public)',
          'Primary buyer role and one likely influencer',
          'Two or three observable "good fit" signals',
          'Two "not a fit" signals to help you disqualify quickly'
        ]},
        { type: 'list', heading: 'What makes a criterion usable', items: [
          'It is observable from public information, not a guess about intent.',
          'It helps you say no as clearly as it helps you say yes.',
          'It is specific enough that two people would sort the same company the same way.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: 'Industry: independent logistics and courier firms. Size: 20–100 staff, 2+ depots. Buyer: operations lead or owner. Good-fit signals: hiring drivers, multiple locations, visible manual scheduling. Not a fit: single-person operations, or enterprises with a dedicated ops platform already in place.'
      },
      safePractice: 'An ICP is a focusing tool, not a stereotype. Base it on observable business criteria, never on personal or protected characteristics. Revisit it as you learn who you actually help.',
      related: { label: 'Learn to build a prospect list', route: 'finding-prospects-2.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'templates-call-block-plan',
      status: 'reviewed',
      title: 'Call-Block Preparation Plan',
      category: 'template',
      skill: 'planning',
      difficulty: 'beginner',
      duration: 8,
      summary: 'A simple planning grid for a focused block of calls: who you will call, why, what you want to happen, and a space to record the real outcome — so practice stays deliberate.',
      objectives: [
        'Plan a realistic number of calls for one focused block',
        'Set one clear intention for the block',
        'Record real outcomes without prospect personal data',
        'Choose one adjustment for next time'
      ],
      sections: [
        { type: 'paragraph', heading: 'How to use it', text: 'Before a call block, fill in the plan rows with the companies and roles you will call and your reason for each. During or after, record only the outcome and a short note. Afterward, write one thing you will change next time.' },
        { type: 'table', heading: 'Plan grid', columns: ['#', 'Company / role', 'Reason for calling', 'Goal', 'Outcome', 'Note'], rows: [
          ['1', 'Regional courier / ops lead', 'Public driver-hiring signal', 'Reach ops lead', '', ''],
          ['2', '', '', '', '', '']
        ]}
      ],
      example: {
        title: 'Worked example (block intention)',
        text: 'Intention for this block: "Pause for a full second after my opener before asking my question." Calls planned: 8. Outcome recorded per call: reached / voicemail / not now / booked. One adjustment after: "I rushed two openers — slow the first sentence."'
      },
      safePractice: 'Record only company-level notes and outcomes. Do not log personal contact details or anything a prospect shared in confidence. This plan is for your practice, not a contact database.',
      related: { label: 'Turn a plan into a daily challenge', route: 'challenges.html' },
      downloads: [{ format: 'pdf' }, { format: 'xlsx' }],
      sheet: {
        columns: ['#', 'Company / role', 'Reason for calling', 'Goal', 'Outcome', 'Note'],
        rows: [['1', 'Regional courier / ops lead', 'Public driver-hiring signal', 'Reach ops lead', '', '']],
        blankRows: 11
      }
    },

    /* ------------------------------------------------------------ CHEAT SHEETS */
    {
      id: 'cheatsheets-cold-call-flow',
      status: 'reviewed',
      title: 'Cold-Call Flow Cheat Sheet',
      category: 'cheatsheet',
      skill: 'opening',
      difficulty: 'beginner',
      duration: 5,
      summary: 'A one-glance map of a cold call from hello to next step, so you always know which stage you are in and what the goal of that stage is.',
      objectives: [
        'Recognise the five stages of a cold call',
        'Know the single goal of each stage',
        'Keep moving without rushing the prospect',
        'Exit gracefully at any stage'
      ],
      sections: [
        { type: 'table', heading: 'The flow', columns: ['Stage', 'Goal', 'One prompt'], rows: [
          ['Open', 'Earn a few seconds', 'Identity + permission + reason'],
          ['Relevance', 'Connect to a real problem', '"A lot of teams like yours run into…"'],
          ['Question', 'Learn if it applies', '"Is that something you deal with?"'],
          ['Next step', 'Propose something small', '"Worth 20 minutes to look at?"'],
          ['Close out', 'Leave a good impression', 'Thank them, confirm or step back']
        ]},
        { type: 'list', heading: 'Reminders', items: [
          'One goal per stage — do not try to close in the opener.',
          'A question beats a monologue at every stage.',
          'A firm no ends the flow; thank them and move on.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: 'Open: "Hi Jordan, Sam with Northlight — can I borrow 30 seconds?" Relevance: "Teams your size tell me weekend coverage slips." Question: "Does that happen to you?" Next step: "Worth 20 minutes to see how two others fixed it?" Close out: "Thanks either way."'
      },
      safePractice: 'This is a map, not a script to force. Let the prospect skip or end stages. Do not fabricate the relevance line — only claim patterns you can honestly stand behind.',
      related: { label: 'Practice the full flow with the AI Coach', route: 'coach-home.html#roleplay' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'cheatsheets-top-five-objections',
      status: 'reviewed',
      title: 'Top-Five Objections Cheat Sheet',
      category: 'cheatsheet',
      skill: 'objections',
      difficulty: 'beginner',
      duration: 5,
      summary: 'A quick-reference card for the five objections you will hear most, each with a calm acknowledgement and one honest follow-up, so you are never caught silent.',
      objectives: [
        'Recall a calm response to five common objections',
        'Acknowledge before you respond',
        'Ask one honest question instead of arguing',
        'Spot the difference between a reflex and a firm no'
      ],
      sections: [
        { type: 'table', heading: 'Quick responses', columns: ['Objection', 'Say this', 'Then'], rows: [
          ['Not interested', '"Fair enough, thanks for being direct."', 'One question about the reason.'],
          ['Bad time', '"Totally understand."', 'Offer a specific callback time.'],
          ['Send an email', '"Happy to."', 'Ask one thing to make it relevant.'],
          ['No budget', '"Makes sense."', 'Ask what would need to change for it to matter.'],
          ['Already sorted', '"Good to hear."', 'Ask what is working and what they would improve.']
        ]},
        { type: 'list', heading: 'Rules of the road', items: [
          'Never sigh, argue, or imply they are making a mistake.',
          'One honest question is fine; a second push after a firm no is not.',
          'If they repeat the no, thank them and end the call.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: 'Prospect: "No budget." You: "Makes sense — most teams are careful right now. Out of interest, what would need to change for something like this to be worth a look?" If the answer is "nothing this year," respond: "Understood, thanks for the honesty — I will not chase you."'
      },
      safePractice: 'Handling an objection means understanding it, not overpowering it. Do not use guilt, false deadlines, or scare tactics. Respect a firm no the first time it is clearly a firm no.',
      related: { label: 'Study objection handling in the Journey', route: 'objection-handling-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'cheatsheets-discovery-question-map',
      status: 'reviewed',
      title: 'Discovery Question Map',
      category: 'cheatsheet',
      skill: 'discovery',
      difficulty: 'intermediate',
      duration: 6,
      summary: 'A map of open questions across five areas — situation, problem, impact, goal, and next step — for a scheduled discovery conversation, so you explore instead of interrogate.',
      objectives: [
        'Cover five discovery areas with open questions',
        'Move from facts to impact naturally',
        'Avoid yes/no and leading questions',
        'Follow the prospect rather than a checklist'
      ],
      sections: [
        { type: 'table', heading: 'The map', columns: ['Area', 'Example question'], rows: [
          ['Situation', '"How is this handled today?"'],
          ['Problem', '"Where does that tend to break down?"'],
          ['Impact', '"When it breaks, what does it cost you in time or stress?"'],
          ['Goal', '"What would good look like six months from now?"'],
          ['Next step', '"What would make it worth exploring further?"']
        ]},
        { type: 'list', heading: 'Use it well', items: [
          'This is for a booked discovery call, not a cold-call interrogation.',
          'Ask one question, then actually listen and follow the answer.',
          'You do not need every question — depth beats coverage.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: 'Situation: "How do you schedule drivers now?" → "Spreadsheets." Problem: "Where does that get painful?" → "Last-minute changes." Impact: "What does a bad week cost you?" → "Overtime and missed pickups." That thread is worth more than firing all five questions in order.'
      },
      safePractice: 'Discovery is a conversation, not a checklist to power through. Do not use it to trap someone with leading questions. Only use it when a discovery call is actually scheduled and welcome.',
      related: { label: 'Learn discovery in the Journey', route: 'discovery-questions-1.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'cheatsheets-tonality-guide',
      status: 'reviewed',
      title: 'Tonality Guide',
      category: 'cheatsheet',
      skill: 'communication',
      difficulty: 'beginner',
      duration: 5,
      summary: 'A short guide to how you sound on a call — pace, warmth, and confidence — with simple adjustments you can practice, because tone often matters more than the exact words.',
      objectives: [
        'Slow your pace at the start of a call',
        'Sound warm and calm rather than rushed',
        'Use a curious tone for questions',
        'Notice and reset your tone when nerves rise'
      ],
      sections: [
        { type: 'table', heading: 'Adjustments', columns: ['If you tend to…', 'Try this'], rows: [
          ['Talk fast when nervous', 'Pause a full second after your opener.'],
          ['Sound flat or scripted', 'Smile before you speak; it changes your voice.'],
          ['Rise in pitch on questions', 'Let questions land softly and then stay quiet.'],
          ['Fill silence quickly', 'Count to two after asking; let them answer.']
        ]},
        { type: 'list', heading: 'Practice ideas', items: [
          'Record yourself reading your opener and listen back once.',
          'Practice one call standing up to steady your breathing.',
          'Pick one tonality goal per call block, not five.'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: 'Goal for today: "Pause after my opening question." On call three you catch yourself rushing, take a breath, and slow the next sentence. That single reset is the whole exercise — one adjustment, practised repeatedly.'
      },
      safePractice: 'Tonality is about being clear and human, not about manipulating emotions. Do not use fake urgency or pressure in your voice. Practice tone with recordings or the AI Coach, not by experimenting on unsuspecting prospects.',
      related: { label: 'Practice delivery with the AI Coach', route: 'coach-home.html#roleplay' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'cheatsheets-booking-followup-checklist',
      status: 'reviewed',
      title: 'Booking & Follow-Up Checklist',
      category: 'cheatsheet',
      skill: 'booking',
      difficulty: 'beginner',
      duration: 5,
      summary: 'A tick-through checklist for the moments around booking a meeting and following up, so nothing basic slips — confirming interest, sending details, and closing the loop.',
      objectives: [
        'Confirm interest before booking',
        'Capture the essentials of the meeting',
        'Send a clear confirmation',
        'Follow up in a way that adds value'
      ],
      sections: [
        { type: 'list', heading: 'Before you hang up', items: [
          'Confirmed genuine interest, not just politeness.',
          'Agreed a specific day and time.',
          'Said what the meeting will cover and how long it will take.',
          'Repeated the details back to check them.'
        ]},
        { type: 'list', heading: 'After the call', items: [
          'Sent a short confirmation with day, time, and topic.',
          'Included one line of relevant context, not a sales pitch.',
          'Set your own reminder to prepare.',
          'Planned a single, useful follow-up if they go quiet.'
        ]}
      ],
      example: {
        title: 'Worked example (confirmation)',
        text: '"Thanks Jordan — confirming Wednesday 10:00 for 20 minutes on driver scheduling. I will show you how two similar teams handle last-minute changes, and you can decide if it is worth going further. Talk then."'
      },
      safePractice: 'Confirm meetings you actually agreed to; do not "book" someone who was only being polite. Keep confirmations honest and brief. One well-timed follow-up beats repeated chasing.',
      related: { label: 'Learn appointment setting in the Journey', route: 'book-appointments.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },

    /* -------------------------------------------------------------- WORKSHEETS */
    {
      id: 'worksheets-script-personalization-canvas',
      status: 'reviewed',
      title: 'Script Personalization Canvas',
      category: 'worksheet',
      skill: 'script',
      difficulty: 'beginner',
      duration: 12,
      summary: 'A structured canvas that turns a generic script into your own words for one specific type of prospect, filling in identity, reason, relevance, question, and likely objection.',
      objectives: [
        'Adapt each part of an opener to one prospect type',
        'Replace generic phrases with concrete language',
        'Prepare for the most likely objection',
        'Produce a script you can actually say aloud'
      ],
      sections: [
        { type: 'paragraph', heading: 'How to use it', text: 'Pick one prospect type. Fill each row in your own words, then read the whole thing aloud and revise anything that sounds robotic. Keep it as a structure you can adapt, not a paragraph to memorise.' },
        { type: 'table', heading: 'Canvas', columns: ['Part', 'Your words'], rows: [
          ['Identity (name + company)', ''],
          ['Reason for calling (honest)', ''],
          ['Relevance (problem they may have)', ''],
          ['Question (open, non-leading)', ''],
          ['Most likely objection + calm reply', '']
        ]}
      ],
      example: {
        title: 'Worked example (Relevance row)',
        text: 'Generic: "We help businesses grow." Personalised: "Ops leads at courier firms your size tell me last-minute driver changes cause missed pickups." The second version names a real, observable problem the prospect can recognise.'
      },
      safePractice: 'Personalise with honest, observable details — never invent a shared connection or a fake result. Read it aloud so it sounds like you, not a telemarketer. Test it with the AI Coach before using it live.',
      related: { label: 'Build your script in the Journey', route: 'building-script-2.html' },
      downloads: [{ format: 'pdf' }, { format: 'xlsx' }],
      sheet: {
        columns: ['Part', 'Your words'],
        rows: [
          ['Identity (name + company)', ''],
          ['Reason for calling (honest)', ''],
          ['Relevance (problem they may have)', ''],
          ['Question (open, non-leading)', ''],
          ['Most likely objection + calm reply', '']
        ],
        blankRows: 3
      }
    },
    {
      id: 'worksheets-prospect-qualification-sheet',
      status: 'reviewed',
      title: 'Prospect Qualification Sheet',
      category: 'worksheet',
      skill: 'prospecting',
      difficulty: 'intermediate',
      duration: 12,
      summary: 'A scoring sheet that applies the same five criteria to every prospect — fit, trigger, need, timing, and reachable role — so you spend your energy on the best opportunities.',
      objectives: [
        'Score prospects against consistent criteria',
        'Compare opportunities fairly',
        'Disqualify weak fits quickly and kindly',
        'Explain why your top prospect is strongest'
      ],
      sections: [
        { type: 'paragraph', heading: 'How to score', text: 'Rate each criterion 0–2 (0 = no, 1 = maybe, 2 = clear yes) using public information. Add the column for a simple total out of 10. Use the same rules for every prospect so the scores mean something.' },
        { type: 'table', heading: 'Scoring grid', columns: ['Prospect (company / role)', 'Fit', 'Trigger', 'Need', 'Timing', 'Role', 'Total'], rows: [
          ['Regional courier / ops lead', '2', '2', '1', '1', '2', '8'],
          ['', '', '', '', '', '', '']
        ]}
      ],
      example: {
        title: 'Worked example',
        text: 'Fit 2 (matches ICP), Trigger 2 (public driver-hiring post), Need 1 (likely but unconfirmed), Timing 1 (unknown), Role 2 (ops lead is reachable) = 8/10. A prospect scoring 3/10 goes to the bottom of the list, not the top.'
      },
      safePractice: 'Score on observable business criteria only — never on personal or protected characteristics. Qualification helps you focus and disqualify respectfully; it is not a reason to treat lower scores rudely.',
      related: { label: 'Learn qualification in the Journey', route: 'finding-prospects-3.html' },
      downloads: [{ format: 'pdf' }, { format: 'xlsx' }],
      sheet: {
        columns: ['Prospect (company / role)', 'Fit', 'Trigger', 'Need', 'Timing', 'Role', 'Total'],
        rows: [['Regional courier / ops lead', '2', '2', '1', '1', '2', '8']],
        blankRows: 11
      }
    },
    {
      id: 'worksheets-rejection-log',
      status: 'reviewed',
      title: 'Rejection Log',
      category: 'worksheet',
      skill: 'mindset',
      difficulty: 'beginner',
      duration: 8,
      summary: 'A simple log that turns rejections into data: what happened, what you said, how they responded, and one neutral lesson — so a hard call becomes something you can learn from.',
      objectives: [
        'Record rejections without self-criticism',
        'Separate what happened from what it means',
        'Extract one neutral lesson per entry',
        'Spot patterns across a week'
      ],
      sections: [
        { type: 'paragraph', heading: 'How to use it', text: 'After a rejection, jot a short, factual entry. Keep the lesson neutral and behaviour-focused ("my opener was vague") rather than personal ("I am bad at this"). Review the log weekly to spot patterns.' },
        { type: 'table', heading: 'Log', columns: ['Date', 'What happened', 'What I said', 'Their response', 'Neutral lesson', 'Next test'], rows: [
          ['2026-07-19', 'Hung up after opener', 'Long intro, no question', 'Not interested', 'Opener was too long', 'Cut to one reason + question'],
          ['', '', '', '', '', '']
        ]}
      ],
      example: {
        title: 'Worked example (reframe)',
        text: 'Instead of "I am terrible at cold calls," write: "My opener ran 40 seconds before I asked anything. Next test: reason plus question in under 15 seconds." Same call, but now it points to a specific, fixable behaviour.'
      },
      safePractice: 'Record only your own actions and general outcomes — no prospect names, numbers, or private details. This log is a learning tool, not a place to store personal data or to punish yourself.',
      related: { label: 'Build rejection resilience in the Journey', route: 'sales-mindset-2.html' },
      downloads: [{ format: 'pdf' }, { format: 'xlsx' }],
      sheet: {
        columns: ['Date', 'What happened', 'What I said', 'Their response', 'Neutral lesson', 'Next test'],
        rows: [['2026-07-19', 'Hung up after opener', 'Long intro, no question', 'Not interested', 'Opener was too long', 'Cut to one reason + question']],
        blankRows: 11
      }
    },
    {
      id: 'worksheets-roleplay-scorecard',
      status: 'reviewed',
      title: 'Roleplay Scorecard',
      category: 'worksheet',
      skill: 'improvement',
      difficulty: 'intermediate',
      duration: 10,
      summary: 'A scorecard for rating a practice roleplay across clarity, relevance, listening, objection handling, and next step — so feedback is specific and you can track improvement over time.',
      objectives: [
        'Rate a roleplay on five concrete skills',
        'Give yourself one specific strength and one fix',
        'Track scores across sessions',
        'Choose a single focus for next time'
      ],
      sections: [
        { type: 'paragraph', heading: 'How to score', text: 'After a roleplay (with the AI Coach or a peer), rate each skill 1–5 and write one sentence of evidence. Pick exactly one thing to keep and one to change. Focus on one change per session.' },
        { type: 'table', heading: 'Scorecard', columns: ['Skill', 'Score (1–5)', 'Evidence / note'], rows: [
          ['Clarity of opener', '', ''],
          ['Relevance to prospect', '', ''],
          ['Listening & follow-up', '', ''],
          ['Objection handling', '', ''],
          ['Clear next step', '', '']
        ]}
      ],
      example: {
        title: 'Worked example',
        text: 'Clarity 4 ("opener was tight"), Relevance 3 ("problem line was generic"), Listening 2 ("talked over the answer"), Objections 3, Next step 4. Keep: tight opener. Change next time: pause and let the prospect finish before responding.'
      },
      safePractice: 'Score to learn, not to judge yourself harshly. Use it on practice roleplays, not to critique real prospects. One honest fix per session beats a long list you cannot act on.',
      related: { label: 'Run a scored roleplay with the AI Coach', route: 'coach-home.html#roleplay' },
      downloads: [{ format: 'pdf' }, { format: 'xlsx' }],
      sheet: {
        columns: ['Skill', 'Score (1-5)', 'Evidence / note'],
        rows: [
          ['Clarity of opener', '', ''],
          ['Relevance to prospect', '', ''],
          ['Listening & follow-up', '', ''],
          ['Objection handling', '', ''],
          ['Clear next step', '', '']
        ],
        blankRows: 2
      }
    },
    {
      id: 'worksheets-weekly-improvement-review',
      status: 'reviewed',
      title: 'Weekly Improvement Review',
      category: 'worksheet',
      skill: 'improvement',
      difficulty: 'beginner',
      duration: 10,
      summary: 'A short weekly review that captures what you practised, what improved, what got in the way, and the one thing you will focus on next week — to keep progress deliberate.',
      objectives: [
        'Summarise a week of practice honestly',
        'Name one clear improvement',
        'Identify one obstacle and a response to it',
        'Set a single focus for the next week'
      ],
      sections: [
        { type: 'fields', heading: 'This week', items: [
          'What I practised most (calls, roleplays, lessons)',
          'One thing that clearly improved',
          'One thing that got in the way',
          'What I will do differently about that obstacle',
          'My single focus for next week'
        ]},
        { type: 'table', heading: 'Simple weekly tracker', columns: ['Metric', 'This week', 'Note'], rows: [
          ['Practice sessions completed', '', ''],
          ['Roleplays completed', '', ''],
          ['Lessons completed', '', ''],
          ['Focus skill', '', '']
        ]}
      ],
      example: {
        title: 'Worked example (focus)',
        text: 'Improved: "openers feel more natural." Obstacle: "I skipped practice on busy days." Response: "attach one five-minute roleplay to my morning coffee." Next week focus: "pausing after questions." One focus is enough to actually move.'
      },
      safePractice: 'Review your own effort and behaviours, not vanity metrics or prospect data. Be honest but kind — the point is steady progress, not a perfect week. Keep only one focus so it is achievable.',
      related: { label: 'See your real progress', route: 'progress.html' },
      downloads: [{ format: 'pdf' }, { format: 'xlsx' }],
      sheet: {
        columns: ['Metric', 'This week', 'Note'],
        rows: [
          ['Practice sessions completed', '', ''],
          ['Roleplays completed', '', ''],
          ['Lessons completed', '', ''],
          ['Focus skill', '', '']
        ],
        blankRows: 4
      }
    },

    /* --------------------------------------------------------- INTERVIEW PREP */
    {
      id: 'interview-common-question-planner',
      status: 'reviewed',
      title: 'Common-Question Answer Planner',
      category: 'interview',
      skill: 'interview',
      difficulty: 'beginner',
      duration: 15,
      summary: 'A planner for drafting honest, structured answers to the SDR interview questions you are most likely to face, so you sound prepared without sounding rehearsed.',
      objectives: [
        'Draft answers to common SDR interview questions',
        'Keep answers honest and specific',
        'Structure each answer so it is easy to follow',
        'Practice out loud before the interview'
      ],
      sections: [
        { type: 'list', heading: 'Questions to prepare', items: [
          '"Why do you want to be an SDR?"',
          '"How do you handle rejection?"',
          '"Walk me through how you would research a prospect."',
          '"Tell me about a time you were persistent."',
          '"What do you know about our company and who we sell to?"'
        ]},
        { type: 'fields', heading: 'For each question, plan', items: [
          'One honest sentence that answers directly',
          'One specific example or detail that supports it',
          'One sentence connecting it to the SDR role',
          'A note of anything you must not overstate'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: 'Q: "How do you handle rejection?" Direct: "I treat it as information, not a verdict." Support: "In practice roleplays I keep a short log and adjust one thing each time." Connection: "That habit is exactly what daily prospecting needs." Honest note: keep it to practice experience — do not imply a sales job you have not held.'
      },
      safePractice: 'Prepare honest answers, not a script that inflates your experience. If you have practised rather than worked in a sales role, say so plainly — genuine preparation is a strength. The AI Coach can flag anything that sounds overstated.',
      related: { label: 'Draft answers in Interview Prep', route: 'interview-prep.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'interview-star-story-builder',
      status: 'reviewed',
      title: 'STAR Story Builder',
      category: 'interview',
      skill: 'interview',
      difficulty: 'beginner',
      duration: 15,
      summary: 'A builder for turning real experiences into clear STAR stories (Situation, Task, Action, Result) you can use for behavioural interview questions, drawn from genuine examples.',
      objectives: [
        'Structure a real experience into STAR',
        'Keep the story concise and specific',
        'Focus on your own actions',
        'State an honest, concrete result'
      ],
      sections: [
        { type: 'table', heading: 'STAR at a glance', columns: ['Part', 'What to include'], rows: [
          ['Situation', 'A brief, real context (one or two sentences).'],
          ['Task', 'What you were responsible for.'],
          ['Action', 'The specific steps you personally took.'],
          ['Result', 'What actually happened, honestly stated.']
        ]},
        { type: 'fields', heading: 'Build one story', items: [
          'Situation (real context)',
          'Task (your responsibility)',
          'Action (what you did, step by step)',
          'Result (honest outcome, with a number if you have one)'
        ]}
      ],
      example: {
        title: 'Worked example',
        text: 'Situation: "I set a goal to get comfortable with cold-call openers." Task: "Practise daily for two weeks." Action: "I ran a short roleplay each morning and logged one fix per session." Result: "By the end I could open in under 15 seconds without notes." A practice story is valid — keep it true.'
      },
      safePractice: 'Use real experiences — study, volunteering, part-time work, or dedicated practice all count. Never invent a job, a result, or a metric. If a number is an estimate, say "about". Honest, modest stories beat impressive fiction.',
      related: { label: 'Save your stories in Interview Prep', route: 'interview-prep.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'interview-30-60-90-plan',
      status: 'reviewed',
      title: '30/60/90-Day Plan',
      category: 'interview',
      skill: 'interview',
      difficulty: 'intermediate',
      duration: 15,
      summary: 'A template for a realistic first-90-days plan you can talk through in an interview — learning the product and market first, then building activity, then improving results.',
      objectives: [
        'Show a sensible ramp from learning to results',
        'Set realistic, modest early goals',
        'Focus first on learning, not big numbers',
        'Demonstrate ownership of your own development'
      ],
      sections: [
        { type: 'table', heading: 'The plan', columns: ['Phase', 'Main focus', 'Example goals'], rows: [
          ['First 30 days', 'Learn', 'Product, ICP, tools, shadow calls, first practice calls.'],
          ['Days 31–60', 'Build activity', 'Consistent daily outreach, refine opener, ask for feedback.'],
          ['Days 61–90', 'Improve results', 'Raise quality, book meetings, review what is working.']
        ]},
        { type: 'fields', heading: 'Draft your version', items: [
          'One learning goal for the first 30 days',
          'One activity habit for days 31–60',
          'One quality or results goal for days 61–90',
          'How you will ask for and use feedback throughout'
        ]}
      ],
      example: {
        title: 'Worked example (30-day goal)',
        text: '"In my first 30 days I want to know the product well enough to explain the top three problems it solves in plain language, and to have completed a set of practice calls with feedback." Modest, specific, and focused on learning — exactly what a hiring manager hopes to hear.'
      },
      safePractice: 'Keep early targets realistic; over-promising specific numbers you cannot control can backfire. Frame the plan around learning and effort, which you can control, rather than guaranteed results. Adjust it to the actual role.',
      related: { label: 'Plan your ramp in Interview Prep', route: 'interview-prep.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'interview-cold-call-audition-prep',
      status: 'reviewed',
      title: 'Cold-Call Audition Preparation',
      category: 'interview',
      skill: 'interview',
      difficulty: 'intermediate',
      duration: 15,
      summary: 'Preparation for the live mock cold call many SDR interviews include: what they are assessing, how to prepare an adaptable opener, and how to stay composed when the "prospect" pushes back.',
      objectives: [
        'Understand what a mock-call assessor looks for',
        'Prepare an adaptable opener and one question',
        'Stay calm through an objection',
        'Debrief your own performance honestly'
      ],
      sections: [
        { type: 'list', heading: 'What they usually assess', items: [
          'Can you open clearly and get to the point?',
          'Do you ask a question and listen, or just pitch?',
          'How do you react to a "not interested"?',
          'Are you coachable when they give feedback?'
        ]},
        { type: 'steps', heading: 'Prepare in four steps', items: [
          'Write a short, adaptable opener you can say naturally.',
          'Prepare one open question and one calm objection response.',
          'Run the mock with the AI Coach audition track twice.',
          'Debrief: one thing you did well, one thing to adjust.'
        ]}
      ],
      example: {
        title: 'Worked example (composure)',
        text: 'Assessor: "I am not interested." You: "That is fair — can I ask one quick thing and then let you go? Is it the timing, or just not a fit right now?" Staying curious and calm under a brush-off usually scores higher than a perfect script.'
      },
      safePractice: 'Show your real ability rather than a memorised performance; assessors can tell. If you are nervous, it is fine to say so briefly and continue. Do not fabricate experience during the mock — being coachable matters more than sounding polished.',
      related: { label: 'Practise the audition with the AI Coach', route: 'coach-home.html#roleplay' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    },
    {
      id: 'interview-day-checklist-portfolio',
      status: 'reviewed',
      title: 'Interview-Day Checklist & Portfolio',
      category: 'interview',
      skill: 'interview',
      difficulty: 'beginner',
      duration: 12,
      summary: 'A checklist for the day of the interview plus a simple portfolio outline — your prepared answers, stories, plan, and practice evidence — so you walk in organised and calm.',
      objectives: [
        'Prepare everything you need the day before',
        'Arrive calm and on time',
        'Bring a simple portfolio of your preparation',
        'Have thoughtful questions ready to ask'
      ],
      sections: [
        { type: 'list', heading: 'Day-before checklist', items: [
          'Confirm time, format, and who you are meeting.',
          'Re-read your prepared answers and STAR stories once.',
          'Test your tech if it is a video interview.',
          'Prepare two genuine questions to ask them.',
          'Get a good night of sleep — cramming rarely helps.'
        ]},
        { type: 'list', heading: 'Simple portfolio to bring', items: [
          'Your prepared answers to common questions.',
          'Two STAR stories.',
          'Your 30/60/90-day plan.',
          'A note on the company and who they sell to.',
          'Evidence of practice (roleplay scores, a rejection log summary).'
        ]}
      ],
      example: {
        title: 'Worked example (questions to ask)',
        text: 'Good questions to ask: "What does a strong first 90 days look like here?" and "How does the team give SDRs feedback?" They show you think about growth and coachability, and they give you real information to decide if the role fits you.'
      },
      safePractice: 'Bring genuine preparation, not fabricated results. A portfolio of honest practice evidence is impressive precisely because it is real. If you do not know an answer in the interview, it is fine to say so and explain how you would find out.',
      related: { label: 'Assemble your portfolio in Interview Prep', route: 'interview-prep.html' },
      downloads: [{ format: 'pdf' }, { format: 'docx' }]
    }
  ];

  // Publication gate: a resource is publicly visible only when it is BOTH
  // active and editorially reviewed. `status` defaults to 'draft' here so a
  // new entry can never leak into the public UI just by being active; a human
  // reviewer flips an entry to status:'reviewed' after the editorial pass.
  RESOURCES.forEach(function (r) {
    if (r.status !== 'reviewed') r.status = 'draft';
    if (r.active === undefined) r.active = true;
  });

  function isPublished(r) { return !!r && r.active === true && r.status === 'reviewed'; }

  function countBy(list) {
    var counts = {};
    for (var key in CATEGORY_META) { if (Object.prototype.hasOwnProperty.call(CATEGORY_META, key)) counts[key] = 0; }
    list.forEach(function (r) { counts[r.category] = (counts[r.category] || 0) + 1; });
    return counts;
  }

  var API = {
    reviewDate: REVIEW_DATE,
    categoryMeta: CATEGORY_META,
    resources: RESOURCES,
    isPublished: isPublished,
    published: function () { return RESOURCES.filter(isPublished); },
    byId: function (id) {
      for (var i = 0; i < RESOURCES.length; i++) { if (RESOURCES[i].id === id) return RESOURCES[i]; }
      return null;
    },
    categoryCounts: function () { return countBy(RESOURCES); },
    publishedCounts: function () { return countBy(RESOURCES.filter(isPublished)); }
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
  root.ResourceCatalog = API;
})(typeof window !== 'undefined' ? window : globalThis);
