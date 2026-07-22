// AmplifyHub AI Coach — Homepage async controller.
// Maps interface workflows cleanly to async Supabase DB hooks.
 
const CoachHome = (function () {
  'use strict';
 
  const MODES = {
    ask:       { view: 'askView',       label: 'Ask Coach' },
    roleplay:  { view: 'roleplayView',  label: 'Roleplay' },
    documents: { view: 'docsView',      label: 'Document Review' },
    progress:  { view: 'progressView',  label: 'Progress' }
  };
  const HOME_VIEW = 'hubView';
 
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
 
  const activeSessions = {};
  let docKind = 'resume';
 
  // ─────────────────────────────────────────────
  // ROUTING
  // ─────────────────────────────────────────────
  async function route() {
    const key = (location.hash.replace(/^#\/?/, '') || 'home');
    const valid = MODES[key] ? key : 'home';
 
    $(HOME_VIEW).classList.toggle('active', valid === 'home');
    Object.entries(MODES).forEach(([k, m]) =>
      $(m.view).classList.toggle('active', k === valid));
 
    if (valid === 'ask') await restoreAskSession();
    if (valid === 'progress') await renderProgress();
    if (valid === 'documents') await renderDocs();
    window.scrollTo(0, 0);
    $('sb').classList.remove('open');
  }
 
  function go(key) { location.hash = key === 'home' ? '' : key; }
 
  // ─────────────────────────────────────────────
  // Shared Async UI Elements
  // ─────────────────────────────────────────────
  async function ensureSession(mode, title) {
    const existingId = activeSessions[mode];
    if (existingId) {
      const history = await CoachStore.listSessions();
      const found = history.find(s => s.id === existingId);
      if (found) return found;
    }
    const s = await CoachStore.saveSession({ mode, title });
    activeSessions[mode] = s.id;
    return s;
  }
 
  function appendBubble(threadEl, role, content) {
    const empty = threadEl.querySelector('.empty');
    if (empty) empty.remove();
    const d = document.createElement('div');
    d.className = 'tmsg ' + (role === 'user' ? 'user' : 'ai');
    const av = document.createElement('div');
    av.className = 'tav ' + (role === 'user' ? 'u' : 'a');
    av.textContent = role === 'user' ? 'J' : '🤖';
    const bubble = document.createElement('div');
    bubble.className = 'bub';
    // Conversation content is untrusted, including text returned by the AI.
    // textContent prevents it from ever being interpreted as executable HTML.
    bubble.textContent = String(content ?? '');
    d.append(av, bubble);
    threadEl.appendChild(d);
    threadEl.scrollTop = threadEl.scrollHeight;
  }

  function appendTranscriptMessage(container, role, content) {
    const isUser = role === 'user';
    const row = document.createElement('div');
    row.className = 'tx-msg ' + (isUser ? 'user' : 'ai');
    const avatar = document.createElement('div');
    avatar.className = 'tx-av ' + (isUser ? 'u' : 'a');
    avatar.textContent = isUser ? 'J' : '🤖';
    const bubble = document.createElement('div');
    bubble.className = 'tx-bub';
    bubble.textContent = String(content ?? '');
    row.append(avatar, bubble);
    container.appendChild(row);
  }
 
  function showTyping(threadEl) {
    if (threadEl.querySelector('.typing-msg')) return;
    const d = document.createElement('div');
    d.className = 'tmsg ai typing-msg';
    d.innerHTML = '<div class="tav a">🤖</div><div class="typing"><span></span><span></span><span></span></div>';
    threadEl.appendChild(d);
    threadEl.scrollTop = threadEl.scrollHeight;
  }
  
  function removeTyping(threadEl) {
    const t = threadEl.querySelector('.typing-msg');
    if (t) t.remove();
  }
 
  // ─────────────────────────────────────────────
  // Feedback report rendering — shared by the live End Session flow and
  // the Progress page's "View Report" link (both call this same function).
  // ─────────────────────────────────────────────
  function scoreClass(v) {
    if (v >= 7) return 'good';
    if (v >= 4) return 'mid';
    return 'low';
  }
 
  function renderFeedbackReport(report, meta) {
    const metaText = [meta && meta.personaLabel, meta && meta.scenarioLabel].filter(Boolean).join(' — ');
    $('fbMeta').textContent = metaText;
 
    const scoreDefs = [
      ['openingScore', 'Opening'],
      ['discoveryScore', 'Discovery'],
      ['objectionScore', 'Objection Handling'],
      ['communicationScore', 'Communication']
    ];
    $('fbScores').innerHTML = scoreDefs.map(([key, label]) => {
      const v = report && report[key];
      const has = typeof v === 'number';
      return `<div class="fb-score-card"><div class="fb-score-v ${has ? scoreClass(v) : ''}">${has ? v + '/10' : '—'}</div><div class="fb-score-l">${label}</div></div>`;
    }).join('');
 
    const list = (items, empty) => (items && items.length ? items.map(s => `<li>${esc(s)}</li>`).join('') : `<li>${empty}</li>`);
    $('fbStrengths').innerHTML = list(report && report.strengths, 'No specific strengths captured.');
    $('fbWeaknesses').innerHTML = list(report && report.weaknesses, 'No specific weaknesses captured.');
    $('fbRecommendations').innerHTML = list(report && report.recommendations, 'Keep practicing consistently.');
  }
 
  function resetRoleplayToStart() {
    activeSessions.roleplay = null;
    $('rpPractice').style.display = 'none';
    $('fbReport').style.display = 'none';
    $('fbLoading').style.display = 'none';
    const personaStep = $('personaStep'), scenarioStep = $('scenarioStep');
    if (personaStep) personaStep.style.display = 'none';
    if (scenarioStep) scenarioStep.style.display = 'block';
  }
 
  let rpStatusTimer = null;
  function showRpStatus(msg, autoHideMs) {
    const note = $('rpStatusNote');
    if (!note) return;
    $('rpStatusText').textContent = msg;
    note.style.display = 'flex';
    clearTimeout(rpStatusTimer);
    if (autoHideMs) rpStatusTimer = setTimeout(() => { note.style.display = 'none'; }, autoHideMs);
  }
  function hideRpStatus() {
    const note = $('rpStatusNote');
    if (note) note.style.display = 'none';
  }
 
  async function restoreAskSession() {
    const thread = $('askThread');
    thread.innerHTML = '';
    const history = await CoachStore.listSessions();
    const sess = history.find(s => s.mode === 'ask');
    if (sess) {
      const msgs = await CoachStore.getMessages(sess.id);
      if (msgs.length) {
        msgs.forEach(m => appendBubble(thread, m.role === 'user' ? 'user' : 'coach', m.content));
        return;
      }
    }
    thread.innerHTML = '<div class="empty">Ask any sales question to start chatting.</div>';
  }
 
  // ─────────────────────────────────────────────
  // MODE 1 — ASK COACH
  // ─────────────────────────────────────────────
  function initAsk() {
    const input = $('askInput'), thread = $('askThread');
 
    CoachEngine.on('thinking', () => {
      if (CoachEngine.getMode() !== 'ask') return;
      showTyping(thread);
    });
    CoachEngine.on('message', m => {
      if (CoachEngine.getMode() !== 'ask') return;
      removeTyping(thread);
      appendBubble(thread, 'ai', m.html);
    });
 
    async function prepareAskSession() {
      const active = await CoachStore.activeSession();
      if (active && active.mode === 'ask' && !active.ended_at) {
        if (CoachEngine.getMode() !== 'ask') CoachEngine.setMode('ask');
        return;
      }
      const history = await CoachStore.listSessions();
      const askSess = history.find(s => s.mode === 'ask' && !s.ended_at);
      if (askSess) {
        await CoachStore.saveSession({ id: askSess.id });
      } else if (active && !active.ended_at) {
        await CoachStore.endActiveSession();
      }
      CoachEngine.setMode('ask');
    }
 
    // Guards against duplicate sends if Enter/click fires twice before the
    // in-flight request resolves — input.value isn't cleared until after an
    // await, so a fast double-trigger would otherwise send the same text twice.
    let askSending = false;
    async function submit() {
      const t = input.value.trim();
      if (!t || askSending) return;
      askSending = true;
      $('askSend').disabled = true;
      await prepareAskSession();
      appendBubble(thread, 'user', t);
      input.value = '';
      input.style.height = '';
      try {
        await CoachEngine.send(t);
      } finally {
        askSending = false;
        $('askSend').disabled = false;
      }
    }
 
    $('askSend').addEventListener('click', submit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });
    input.addEventListener('input', () => {
      input.style.height = '';
      input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    });
    document.querySelectorAll('#askView .q-chip').forEach(chip =>
      chip.addEventListener('click', () => { input.value = chip.dataset.q || chip.textContent; submit(); }));
  }
 
  // ─────────────────────────────────────────────
  // MODE 2 — ROLEPLAY
  // ─────────────────────────────────────────────
  function initRoleplay() {
    const thread = $('rpThread'), input = $('rpInput');
    const scenarioGrid = $('scenarioGrid'), personaGrid = $('scenGrid');
    let activeScenarioId = null;
    let activePersonaId = null;
 
    function renderScenarioCards() {
      scenarioGrid.innerHTML = Object.entries(CoachConfig.scenarios).map(([id, s]) => `
        <div class="scen-card" data-scenario="${id}">
          <span class="scen-emoji">${s.icon}</span>
          <div class="scen-name">${esc(s.label)}</div>
          <div class="scen-desc">Goal: ${esc(s.goal)}</div>
        </div>`).join('');
      scenarioGrid.querySelectorAll('.scen-card').forEach(card =>
        card.addEventListener('click', () => {
          activeScenarioId = card.dataset.scenario;
          $('scenarioStep').style.display = 'none';
          $('personaStep').style.display = 'block';
        }));
    }
 
    function renderPersonaCards() {
      personaGrid.innerHTML = Object.entries(CoachConfig.personas).map(([id, p]) => `
        <div class="scen-card" data-persona="${id}">
          <span class="scen-emoji">${p.icon}</span>
          <div class="scen-name">${esc(p.label)}</div>
          <div class="scen-desc">${esc(p.desc)}</div>
        </div>`).join('');
      personaGrid.querySelectorAll('.scen-card').forEach(card =>
        card.addEventListener('click', () => startPractice(activeScenarioId, card.dataset.persona)));
    }
 
    async function startPractice(scenarioId, personaId) {
      const scenario = CoachConfig.scenarios[scenarioId], persona = CoachConfig.personas[personaId];
      if (!scenario || !persona) return;
 
      hideRpStatus();
      if (activeSessions.roleplay) await CoachStore.endActiveSession({ status: 'abandoned' });
 
      const prefs = await CoachStore.getPreferences();
      const s = await CoachStore.saveSession({
        mode: 'roleplay',
        title: `${persona.label} — ${scenario.label}`,
        scenario: scenarioId,
        persona: personaId,
        difficulty: prefs.difficulty,
        coachStyle: prefs.conversation_style,
        goal: scenario.goal,
        status: 'active'
      });
      if (!s) {
        showRpStatus("Couldn't start the session — please try again in a moment.", 6000);
        return;
      }
      activeSessions.roleplay = s.id;
      activePersonaId = personaId;
      CoachEngine.setMode('roleplay');
 
      $('rpScenarioBadge').textContent = scenario.label;
      $('rpPersonaBadge').textContent = persona.label;
      $('rpGoalNote').textContent = `Goal: ${scenario.goal}`;
      const diffLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard', adaptive: 'Adaptive' }[prefs.difficulty] || 'Medium';
      $('rpDifficultyNote').textContent = `Difficulty: ${diffLabel} (change this in Settings → AI Coach)`;
 
      thread.innerHTML = '<div class="empty">Session ready. Send your opening line to begin practicing.</div>';
      $('scenarioStep').style.display = 'none';
      $('personaStep').style.display = 'none';
      $('fbReport').style.display = 'none';
      $('fbLoading').style.display = 'none';
      $('rpPractice').style.display = 'flex';
      const endBtn = $('rpEndBtn');
      endBtn.disabled = false;
      endBtn.textContent = 'End Session';
      input.focus();
    }
 
    CoachEngine.on('thinking', () => {
      if (CoachEngine.getMode() !== 'roleplay') return;
      showTyping(thread);
    });
    CoachEngine.on('message', m => {
      if (CoachEngine.getMode() !== 'roleplay') return;
      removeTyping(thread);
      appendBubble(thread, 'ai', m.html);
    });
 
    renderScenarioCards();
    renderPersonaCards();
 
    // Re-assert mode before every send: CoachEngine.mode is a single global
    // shared with Ask Coach, so if the user visited Ask in between (which
    // flips it to 'ask'), the next roleplay turn would otherwise be sent
    // with the wrong mode and lose its persona/scenario system prompt.
    // Also guards against duplicate sends the same way Ask Coach does.
    let rpSending = false;
    async function submit() {
      const t = input.value.trim();
      if (!t || !activeSessions.roleplay || rpSending) return;
      if (CoachEngine.getMode() !== 'roleplay') CoachEngine.setMode('roleplay');
      rpSending = true;
      $('rpSend').disabled = true;
      appendBubble(thread, 'user', t);
      input.value = '';
      try {
        await CoachEngine.send(t, { persona: activePersonaId, scenario: activeScenarioId });
      } finally {
        rpSending = false;
        $('rpSend').disabled = false;
      }
    }
    $('rpSend').addEventListener('click', submit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });
 
    $('scenarioBack').addEventListener('click', () => {
      $('personaStep').style.display = 'none';
      $('scenarioStep').style.display = 'block';
    });
 
    $('rpBack').addEventListener('click', async () => {
      if (activeSessions.roleplay) await CoachStore.endActiveSession({ status: 'abandoned' });
      resetRoleplayToStart();
    });
 
    $('rpEndBtn').addEventListener('click', async () => {
      const sessionId = activeSessions.roleplay;
      if (!sessionId) return;
      const btn = $('rpEndBtn');
      btn.disabled = true;
      btn.textContent = 'Checking…';
 
      const msgs = await CoachStore.getMessages(sessionId);
      const userTurns = msgs.filter(m => m.role === 'user').length;
      const minTurns = CoachConfig.limits.minFeedbackTurns || 4;
 
      if (userTurns < minTurns) {
        await CoachStore.endActiveSession({ status: 'abandoned' });
        resetRoleplayToStart();
        showRpStatus(`Session ended — send at least ${minTurns} messages next time to unlock a feedback report (you sent ${userTurns}).`, 6000);
        return;
      }
 
      $('rpPractice').style.display = 'none';
      $('fbLoading').style.display = 'block';
 
      try {
        const report = await CoachEngine.getFeedback(sessionId);
        const scores = {
          opening: report.openingScore,
          discovery: report.discoveryScore,
          objection: report.objectionScore,
          communication: report.communicationScore
        };
        const nums = [report.openingScore, report.discoveryScore, report.objectionScore, report.communicationScore]
          .filter(n => typeof n === 'number');
        const avgScore = nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
 
        await CoachStore.endActiveSession({ status: 'completed', score: avgScore, feedbackReport: report, scores });
 
        $('fbLoading').style.display = 'none';
        const scenario = CoachConfig.scenarios[activeScenarioId];
        const persona = CoachConfig.personas[activePersonaId];
        renderFeedbackReport(report, { scenarioLabel: scenario && scenario.label, personaLabel: persona && persona.label });
        $('fbReport').style.display = 'flex';
        activeSessions.roleplay = null;
      } catch (err) {
        console.error(err);
        await CoachStore.endActiveSession({ status: 'abandoned' });
        $('fbLoading').style.display = 'none';
        resetRoleplayToStart();
        showRpStatus(CoachEngine.userMessageForError(err, "Couldn't generate your feedback report right now — your conversation was still saved. Try again next session."), 6000);
      }
    });
 
    $('fbAgainBtn').addEventListener('click', () => resetRoleplayToStart());
  }
 
  // ─────────────────────────────────────────────
  // MODE 3 — DOCUMENT REVIEW
  // ─────────────────────────────────────────────
  const DOC_KINDS = { resume: 'Resume', email: 'Cold Email', script: 'Cold Call Script' };
 
  function initDocuments() {
    const fileInput = $('docFile'), zone = $('docZone');
    // Document Review is "coming soon": the uploader markup was removed, so
    // there is nothing to wire. Guard prevents a null addEventListener crash.
    if (!fileInput || !zone) return;
 
    document.querySelectorAll('#docsView .doc-type').forEach(t =>
      t.addEventListener('click', () => {
        document.querySelectorAll('#docsView .doc-type').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        docKind = t.dataset.kind;
        $('docZoneLabel').textContent = `Upload your ${DOC_KINDS[docKind]}`;
      }));
 
    async function handleFiles(files) {
      for (const file of files) {
        if (!/\.(pdf|docx?|txt)$/i.test(file.name)) continue;
        if (file.size > CoachConfig.limits.maxDocMB * 1024 * 1024) continue;
        await CoachStore.addDoc({ name: file.name, size: file.size, mime: file.type, kind: docKind });
      }
      await renderDocs();
    }
 
    zone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => { handleFiles(e.target.files); fileInput.value = ''; });
    ['dragover', 'dragleave', 'drop'].forEach(evt =>
      zone.addEventListener(evt, e => {
        e.preventDefault();
        if (evt === 'dragover') zone.classList.add('drag');
        else zone.classList.remove('drag');
        if (evt === 'drop') handleFiles(e.dataTransfer.files);
      }));
  }
 
  function docIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return '📕';
    if (ext === 'doc' || ext === 'docx') return '📘';
    return '📄';
  }
  
  function fmtSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }
 
  async function renderDocs() {
    const list = $('docList');
    // Document Review is "coming soon": the list was removed from the page.
    // Skip the render — and the CoachStore.listDocs() DB read — when absent.
    if (!list) return;
    const docs = await CoachStore.listDocs();
    if (!docs.length) {
      list.innerHTML = '<div class="empty">No documents yet. Upload a resume, cold email, or script above.</div>';
      return;
    }
    list.innerHTML = docs.map(d => `
      <div class="doc-row">
        <div class="doc-row-ic">${docIcon(d.name)}</div>
        <div class="doc-row-info">
          <div class="doc-row-name">${esc(d.name)}</div>
          <div class="doc-row-meta">${DOC_KINDS[d.kind] || 'Document'} · ${fmtSize(d.size)}</div>
        </div>
        <div class="doc-tag">Pending review</div>
      </div>`).join('');
  }
 
  // ─────────────────────────────────────────────
  // MODE 4 — PROGRESS
  // ─────────────────────────────────────────────
  function fmtDay(ts) {
    const d = new Date(ts), now = new Date();
    const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 864e5);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  const MODE_LABEL = { ask: 'Ask Coach', roleplay: 'Roleplay', docreview: 'Document Review' };
 
  function calcStreak(sessions) {
    // Count consecutive calendar days (in user's local timezone) ending today
    const completedDays = new Set(
      sessions
        .filter(s => s.ended_at)
        .map(s => new Date(s.ended_at).toLocaleDateString())
    );
    let streak = 0;
    const d = new Date();
    while (true) {
      if (completedDays.has(d.toLocaleDateString())) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }
 
  function skillBarHTML(label, val) {
    const has = val !== null && val !== undefined && !isNaN(parseFloat(val));
    const v = has ? parseFloat(val) : 0;
    const pct = Math.round((v / 10) * 100);
    const cls = v >= 7 ? '' : v >= 4 ? 'mid' : 'low';
    const color = v >= 7 ? 'var(--green)' : v >= 4 ? 'var(--warm)' : 'var(--red)';
    return `
      <div class="skill-row">
        <span class="skill-label">${label}</span>
        <div class="skill-track"><div class="skill-fill ${cls}" style="width:${has ? pct : 0}%;background:${color}"></div></div>
        <span class="skill-val" style="color:${has ? color : 'var(--muted)'}">${has ? v + '/10' : '—'}</span>
      </div>`;
  }
 
  async function renderProgress() {
    const [sessionHistory, docs, stats] = await Promise.all([
      CoachStore.listSessions(),
      CoachStore.listDocs(),
      CoachStore.getProgressStats()
    ]);
 
    const sessions = sessionHistory.filter(s => s.turns > 0);
    const questions = sessions.filter(s => s.mode === 'ask').reduce((n, s) => n + s.turns, 0);
 
    $('statSessions').textContent = sessions.length;
    $('statQuestions').textContent = questions;
    $('statDocs').textContent = docs.length;
    $('statOverall').textContent = stats && stats.avg_overall ? stats.avg_overall : '—';
 
    // Skill breakdown card
    const skillCard = $('skillCard');
    if (stats && stats.total_sessions > 0) {
      skillCard.style.display = 'block';
 
      // Streak
      const streak = calcStreak(sessions);
      const streakRow = $('streakRow');
      if (streak > 0) {
        streakRow.style.display = 'flex';
        $('streakVal').textContent = `🔥 ${streak}-day streak — keep it going!`;
      } else {
        streakRow.style.display = 'none';
      }
 
      // Skill bars
      const skillDefs = [
        ['Opening', stats.avg_opening],
        ['Discovery', stats.avg_discovery],
        ['Objection Handling', stats.avg_objection],
        ['Communication', stats.avg_communication]
      ];
      $('skillBars').innerHTML = skillDefs.map(([l, v]) => skillBarHTML(l, v)).join('');
 
      // Weakest skill highlight
      const scored = skillDefs.filter(([, v]) => v !== null && v !== undefined && !isNaN(parseFloat(v)));
      if (scored.length) {
        const weakest = scored.reduce((a, b) => parseFloat(a[1]) < parseFloat(b[1]) ? a : b);
        $('weakestTag').innerHTML = `<div class="weakest-tag">⚠️ Weakest area: ${weakest[0]} (${weakest[1]}/10) — focus your next session here</div>`;
      } else {
        $('weakestTag').innerHTML = '';
      }
 
      // Sub-label with most-practiced scenario
      const scenarioKey = stats.most_practiced_scenario;
      const scenarioName = CoachConfig.scenarios && CoachConfig.scenarios[scenarioKey]
        ? CoachConfig.scenarios[scenarioKey].label
        : scenarioKey;
      $('skillCardSub').textContent = `${stats.total_sessions} completed session${stats.total_sessions === 1 ? '' : 's'}${scenarioName ? ' · Most practiced: ' + scenarioName : ''}`;
    } else {
      skillCard.style.display = 'none';
    }
 
    // Session list
    const list = $('sessList');
    if (!sessions.length) {
      list.innerHTML = '<div class="empty">No coaching sessions yet. Start with <a href="#ask">Ask Coach</a> or <a href="#roleplay">Roleplay</a>.</div>';
      return;
    }
    list.innerHTML = sessions.slice(0, 20).map(s => {
      const hasReport = !!s.feedback_report;
      const hasMessages = s.turns > 0;
      const links = [
        hasReport ? `<a href="#roleplay" class="view-report-link" data-session-id="${s.id}">View Report →</a>` : '',
        hasMessages ? `<a href="#" class="view-transcript-link" data-session-id="${s.id}" data-session-title="${esc(s.title || '')}">View Transcript</a>` : ''
      ].filter(Boolean).join('');
      return `
        <div class="sess-row">
          <div class="sess-date">${fmtDay(s.started_at || s.startedAt)}</div>
          <div class="sess-info">
            <h4>${esc(s.title || MODE_LABEL[s.mode] || 'Session')}</h4>
            <p>${MODE_LABEL[s.mode] || s.mode} · ${s.turns} ${s.turns === 1 ? 'entry' : 'entries'}${s.ended_at ? '' : ' · active'}</p>
            ${links ? `<div class="sess-links">${links}</div>` : ''}
          </div>
          <div class="sess-score">${s.score != null ? s.score : '—'}</div>
        </div>`;
    }).join('');
  }
 
  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────
  function init() {
    const obs = new IntersectionObserver(es =>
      es.forEach((e, i) => { if (e.isIntersecting) setTimeout(() => e.target.classList.add('v'), i * 70); }),
      { threshold: .08 });
    document.querySelectorAll('.fu').forEach(el => obs.observe(el));
 
    document.querySelectorAll('[data-go]').forEach(el =>
      el.addEventListener('click', e => { e.preventDefault(); go(el.dataset.go); }));
 
    initAsk();
    initRoleplay();
    initDocuments();
 
    // Transcript modal
    const transcriptModal = $('transcriptModal');
    $('transcriptClose').addEventListener('click', () => transcriptModal.classList.remove('open'));
    transcriptModal.addEventListener('click', e => { if (e.target === transcriptModal) transcriptModal.classList.remove('open'); });
 
    // Delegated handler for both "View Report" and "View Transcript" links
    $('sessList').addEventListener('click', async e => {
      // View Report
      const reportLink = e.target.closest('.view-report-link');
      if (reportLink) {
        e.preventDefault();
        const session = await CoachStore.getSessionById(reportLink.dataset.sessionId);
        if (!session || !session.feedback_report) return;
        go('roleplay');
        const scenarioStep = $('scenarioStep'), personaStep = $('personaStep');
        if (scenarioStep) scenarioStep.style.display = 'none';
        if (personaStep) personaStep.style.display = 'none';
        $('rpPractice').style.display = 'none';
        $('fbLoading').style.display = 'none';
        const scenario = CoachConfig.scenarios && CoachConfig.scenarios[session.scenario];
        const persona = CoachConfig.personas && CoachConfig.personas[session.persona];
        renderFeedbackReport(session.feedback_report, {
          scenarioLabel: (scenario && scenario.label) || session.scenario,
          personaLabel: (persona && persona.label) || session.persona
        });
        $('fbReport').style.display = 'flex';
        return;
      }
 
      // View Transcript
      const txLink = e.target.closest('.view-transcript-link');
      if (txLink) {
        e.preventDefault();
        const sessionId = txLink.dataset.sessionId;
        const title = txLink.dataset.sessionTitle || 'Session Transcript';
        $('transcriptTitle').textContent = title;
        $('transcriptBody').innerHTML = '<div class="tx-empty">Loading…</div>';
        transcriptModal.classList.add('open');
        const msgs = await CoachStore.getMessages(sessionId);
        if (!msgs.length) {
          $('transcriptBody').innerHTML = '<div class="tx-empty">No messages found for this session.</div>';
          return;
        }
        const transcriptBody = $('transcriptBody');
        transcriptBody.replaceChildren();
        msgs.forEach(m => appendTranscriptMessage(transcriptBody, m.role, m.content));
      }
    });
 
    $('mobBtn').addEventListener('click', () => $('sb').classList.add('open'));
    $('sbX').addEventListener('click', () => $('sb').classList.remove('open'));
 
    window.addEventListener('hashchange', route);
    route();
  }
 
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
 
  return { go, _security: { appendBubble, appendTranscriptMessage, renderFeedbackReport } };
})();
