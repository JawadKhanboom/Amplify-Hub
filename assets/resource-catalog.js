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
