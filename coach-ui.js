// AmplifyHub AI Coach — Live Chat View UI Controller.
// Updates DOM interactions to natively handle async database rows.

(function CoachUI() {
  'use strict';

  // ── SCROLL REVEAL ──
  const obs = new IntersectionObserver(es => {
    es.forEach((e, i) => { if (e.isIntersecting) setTimeout(() => e.target.classList.add('v'), i * 80) });
  }, { threshold: .1 });
  document.querySelectorAll('.fu').forEach(el => obs.observe(el));

  // ── PERF BARS ──
  const pObs = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.querySelectorAll('.perf-fill').forEach(f => f.style.width = f.dataset.w + '%');
      pObs.unobserve(e.target);
    });
  }, { threshold: .3 });
  if (document.querySelector('.perf-card')) pObs.observe(document.querySelector('.perf-card'));

  // ── DOM Refs ──
  const chatMsgs = document.getElementById('chatMsgs');
  const chatInput = document.getElementById('chatInput');
  const escapeHtml = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── Message Rendering ──
  function addUserMsg(text) {
    if (!chatMsgs) return;
    const d = document.createElement('div');
    d.className = 'msg user';
    d.innerHTML = `<div class="msg-av u-a">J</div><div class="msg-bub">${escapeHtml(text)}</div>`;
    chatMsgs.appendChild(d);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  const SPEED_DELAY = {
    instant: { base: 150, jitter: 100 },
    natural: { base: 1200, jitter: 600 },
    slow: { base: 2400, jitter: 900 }
  };

  async function addAiMessage(html) {
    if (!chatMsgs) return;
    const typing = document.createElement('div');
    typing.className = 'msg ai';
    typing.innerHTML = `<div class="msg-av ai-a">🤖</div><div class="typing"><span></span><span></span><span></span></div>`;
    chatMsgs.appendChild(typing);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;

    let speedKey = 'natural';
    try {
      const prefs = await CoachStore.getPreferences();
      if (prefs && SPEED_DELAY[prefs.response_speed]) speedKey = prefs.response_speed;
    } catch (e) { /* fall back to natural pacing */ }
    const { base, jitter } = SPEED_DELAY[speedKey];

    setTimeout(() => {
      typing.remove();
      const d = document.createElement('div');
      d.className = 'msg ai';
      d.innerHTML = `<div class="msg-av ai-a">🤖</div><div class="msg-bub">${html}</div>`;
      chatMsgs.appendChild(d);
      chatMsgs.scrollTop = chatMsgs.scrollHeight;
      animatePerf();
    }, base + Math.random() * jitter);
  }

  // Engine Event Listeners
  CoachEngine.on('message', m => addAiMessage(m.html));
  CoachEngine.on('mode', m => addAiMessage(m.intro));

  // ── Send Pipeline ──
  function sendMessage() {
    if (!chatInput) return;
    const val = chatInput.value.trim();
    if (!val) return;
    addUserMsg(val);
    chatInput.value = '';
    CoachEngine.send(val);
  }
  
  if (document.getElementById('sendBtn')) {
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  }

  document.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => { if (chatInput) { chatInput.value = chip.textContent; sendMessage(); } });
  });

  // Practice Modes
  document.querySelectorAll('.mode').forEach(m => {
    m.addEventListener('click', () => {
      document.querySelectorAll('.mode').forEach(x => x.classList.remove('active'));
      m.classList.add('active');
      CoachEngine.setMode(m.dataset.mode);
      if (m.dataset.mode === 'voice' && micBtn) setTimeout(() => micBtn.click(), 1300);
      if (m.dataset.mode === 'script' && fileInput) setTimeout(() => fileInput.click(), 1300);
    });
  });

  // ── Session Controls ──
  function currentScore() {
    const vals = [...document.querySelectorAll('.perf-val')].map(v => parseInt(v.textContent));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  
  if (document.getElementById('clearBtn')) {
    document.getElementById('clearBtn').addEventListener('click', () => {
      if (chatMsgs) chatMsgs.innerHTML = '';
      addAiMessage(CoachConfig.local.clearReply);
    });
  }
  
  if (document.getElementById('saveBtn')) {
    document.getElementById('saveBtn').addEventListener('click', async () => {
      const s = await CoachStore.activeSession();
      if (s) await CoachStore.saveSession({ id: s.id, score: Math.round(currentScore()) });
      await renderHistory();
      const btn = document.getElementById('saveBtn');
      btn.textContent = 'Saved ✓'; btn.style.color = 'var(--green)';
      setTimeout(() => { btn.textContent = 'Save'; btn.style.color = ''; }, 2000);
    });
  }
  
  if (document.getElementById('endBtn')) {
    document.getElementById('endBtn').addEventListener('click', () => {
      CoachEngine.endSession(currentScore());
      addAiMessage(CoachConfig.local.endReply);
      renderHistory();
    });
  }
  
  if (document.getElementById('startBtn')) {
    document.getElementById('startBtn').addEventListener('click', () => {
      if (chatInput) chatInput.value = 'Start roleplay';
      sendMessage();
      if (chatMsgs) chatMsgs.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function animatePerf() {
    document.querySelectorAll('.perf-fill').forEach(f => {
      const base = parseInt(f.dataset.w);
      const nudge = (Math.random() - 0.4) * 6;
      const nv = Math.min(98, Math.max(20, base + nudge));
      f.style.width = nv + '%';
      const pct = f.closest('.perf-item').querySelector('.perf-val');
      if (pct) pct.textContent = Math.round(nv) + '%';
    });
  }

  // History Log Hydration
  async function renderHistory() {
    const sessionHistory = await CoachStore.listSessions();
    const sessions = sessionHistory.filter(s => s.turns > 0);
    if (!sessions.length) return;
    const card = document.querySelector('.hist-card');
    if (!card) return;
    card.querySelectorAll('.hist-item').forEach(el => el.remove());
    sessions.slice(0, 6).forEach(s => {
      const row = document.createElement('div');
      row.className = 'hist-item';
      row.innerHTML = `<div class="hist-date">${fmtDay(s.started_at || s.startedAt)}</div>
        <div class="hist-info"><h4>${escapeHtml(s.title || 'Practice Session')}</h4><p>${s.turns} turns${s.ended_at ? '' : ' · in progress'}</p></div>
        <div class="hist-score">${s.score != null ? s.score : '—'}</div>`;
      card.appendChild(row);
    });
  }

  // Conversation Trail RESTORE
  async function restoreConversation() {
    const s = await CoachStore.activeSession();
    if (!s || s.ended_at) return;
    const msgs = await CoachStore.getMessages(s.id);
    if (!chatMsgs) return;
    msgs.forEach(m => {
      if (m.role === 'user' && m.kind === 'voice') { renderVoiceBubble(null, (m.meta && m.meta.duration) || 3); return; }
      const d = document.createElement('div');
      d.className = 'msg ' + (m.role === 'user' ? 'user' : 'ai');
      const av = m.role === 'user' ? '<div class="msg-av u-a">J</div>' : '<div class="msg-av ai-a">🤖</div>';
      const body = m.role === 'user' ? escapeHtml(m.content) : m.content;
      d.innerHTML = `${av}<div class="msg-bub">${body}</div>`;
      chatMsgs.appendChild(d);
    });
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  // ── VOICE RECORDING (Async wrappers) ──
  const micBtn = document.getElementById('micBtn');
  const recBar = document.getElementById('recBar');
  const chatInputRow = document.getElementById('chatInputRow');
  const recTime = document.getElementById('recTime');
  const recWave = document.getElementById('recWave');
  const voiceModeBtn = document.getElementById('voiceModeBtn');

  let mediaRecorder, audioChunks = [], recStream, recSeconds = 0, recTimer;
  let voiceModeOn = false;

  if (recWave) {
    for (let i = 0; i < 40; i++) {
      const b = document.createElement('div');
      b.className = 'rec-bar-el';
      b.style.height = (Math.random() * 18 + 4) + 'px';
      b.style.animationDelay = (Math.random() * .8) + 's';
      recWave.appendChild(b);
    }
  }

  function fmtTime(s) { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; }

  async function startRecording() {
    try {
      recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(recStream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        finishVoice(URL.createObjectURL(blob), recSeconds);
        recStream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      recSeconds = 0;
      if (recBar) recBar.classList.add('show');
      if (chatInputRow) chatInputRow.style.display = 'none';
      if (micBtn) micBtn.classList.add('rec-active');
      recTimer = setInterval(() => { recSeconds++; if (recTime) recTime.textContent = fmtTime(recSeconds); }, 1000);
    } catch (err) { simulateRecording(); }
  }

  function simulateRecording() {
    if (recBar) recBar.classList.add('show');
    if (chatInputRow) chatInputRow.style.display = 'none';
    if (micBtn) micBtn.classList.add('rec-active');
    recSeconds = 0;
    recTimer = setInterval(() => { recSeconds++; if (recTime) recTime.textContent = fmtTime(recSeconds); }, 1000);
    mediaRecorder = { simulated: true };
  }

  function stopRecording() {
    clearInterval(recTimer);
    if (recBar) recBar.classList.remove('show');
    if (chatInputRow) chatInputRow.style.display = 'flex';
    if (micBtn) micBtn.classList.remove('rec-active');
    if (mediaRecorder && mediaRecorder.simulated) finishVoice(null, recSeconds || 3);
    else if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  }

  function cancelRecording() {
    clearInterval(recTimer);
    if (recBar) recBar.classList.remove('show');
    if (chatInputRow) chatInputRow.style.display = 'flex';
    if (micBtn) micBtn.classList.remove('rec-active');
    if (mediaRecorder && !mediaRecorder.simulated && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = () => recStream.getTracks().forEach(t => t.stop());
      mediaRecorder.stop();
    }
  }

  function renderVoiceBubble(url, duration) {
    if (!chatMsgs) return;
    const d = document.createElement('div');
    d.className = 'msg user';
    d.innerHTML = `<div class="msg-av u-a">J</div><div><div class="voice-bub"><button class="voice-play">▶</button><div class="voice-wf"></div><span class="voice-dur">${fmtTime(duration)}</span></div></div>`;
    chatMsgs.appendChild(d);
    const wf = d.querySelector('.voice-wf');
    for (let i = 0; i < 22; i++) {
      const b = document.createElement('div');
      b.className = 'vwf-bar';
      b.style.height = (Math.random() * 14 + 3) + 'px';
      wf.appendChild(b);
    }
    const playBtn = d.querySelector('.voice-play');
    const audioEl = url ? new Audio(url) : null;
    playBtn.addEventListener('click', () => {
      if (audioEl) {
        if (audioEl.paused) { audioEl.play(); playBtn.textContent = '❚❚'; }
        else { audioEl.pause(); playBtn.textContent = '▶'; }
        audioEl.onended = () => playBtn.textContent = '▶';
      } else {
        playBtn.textContent = '❚❚';
        setTimeout(() => playBtn.textContent = '▶', duration * 1000);
      }
    });
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  function finishVoice(url, duration) {
    renderVoiceBubble(url, duration);
    CoachEngine.handleVoice({ url, duration });
  }

  if (micBtn) {
    micBtn.addEventListener('click', startRecording);
    document.getElementById('recStop').addEventListener('click', stopRecording);
    document.getElementById('recCancel').addEventListener('click', cancelRecording);
  }

  if (voiceModeBtn) {
    voiceModeBtn.addEventListener('click', () => {
      voiceModeOn = !voiceModeOn;
      voiceModeBtn.style.color = voiceModeOn ? 'var(--green)' : '';
      voiceModeBtn.style.borderColor = voiceModeOn ? 'rgba(0,230,150,.3)' : '';
      voiceModeBtn.textContent = voiceModeOn ? '🎙 Voice Mode ON' : '🎙 Voice Mode';
      if (voiceModeOn) addAiMessage(CoachConfig.local.voiceModeReply);
    });
  }

  // ── DOCUMENT UPLOAD ──
  const fileInput = document.getElementById('fileInput');
  const attachBtn = document.getElementById('attachBtn');
  const uploadZone = document.getElementById('uploadZone');
  const docsList = document.getElementById('docsList');

  function docIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return '📕';
    if (ext === 'doc' || ext === 'docx') return '📘';
    return '📄';
  }
  
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function handleFiles(files) {
    [...files].forEach(async file => {
      if (!/\.(pdf|docx?|txt)$/i.test(file.name)) return;
      if (file.size > CoachConfig.limits.maxDocMB * 1024 * 1024) return;
      
      const doc = await CoachStore.addDoc({ name: file.name, size: file.size, mime: file.type });
      if (/\.txt$/i.test(file.name)) {
        const r = new FileReader();
        r.onload = async () => await CoachStore.updateDoc(doc.id, { extract: String(r.result).slice(0, 20000) });
        r.readAsText(file);
      }
      await renderDocsList();
      addDocMessage(file);
      CoachEngine.handleDocument(doc);
    });
  }

  async function renderDocsList() {
    if (!docsList) return;
    const docs = await CoachStore.listDocs();
    if (!docs.length) {
      docsList.innerHTML = '<div class="doc-empty">No documents uploaded yet.</div>';
      return;
    }
    docsList.innerHTML = docs.map(f => `
      <div class="doc-row">
        <div class="doc-row-ic">${docIcon(f.name)}</div>
        <div class="doc-row-info"><div class="doc-row-name">${escapeHtml(f.name)}</div><div class="doc-row-meta">${formatSize(f.size)} · Reviewed</div></div>
      </div>`).join('');
  }

  function addDocMessage(file) {
    if (!chatMsgs) return;
    const d = document.createElement('div');
    d.className = 'msg user';
    d.innerHTML = `<div class="msg-av u-a">J</div><div><div class="doc-bub"><div class="doc-ic">${docIcon(file.name)}</div><div><div class="doc-name">${escapeHtml(file.name)}</div><div class="doc-meta">${formatSize(file.size)}</div><div class="doc-status">✓ Uploaded</div></div></div></div>`;
    chatMsgs.appendChild(d);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  if (attachBtn) attachBtn.addEventListener('click', () => fileInput.click());
  if (uploadZone) {
    uploadZone.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', e => handleFiles(e.target.files));
    ['dragover', 'dragleave', 'drop'].forEach(evt => {
      uploadZone.addEventListener(evt, e => {
        e.preventDefault();
        if (evt === 'dragover') uploadZone.classList.add('drag');
        if (evt === 'dragleave' || evt === 'drop') uploadZone.classList.remove('drag');
        if (evt === 'drop') handleFiles(e.dataTransfer.files);
      });
    });
  }

  // ── INIT HYDRATION ──
  async function initUI() {
    await renderDocsList();
    await renderHistory();
    await restoreConversation();
  }
  initUI();
})();