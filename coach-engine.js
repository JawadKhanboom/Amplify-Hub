// AmplifyHub AI Coach — conversation engine + provider abstraction.
const CoachEngine = (() => {
  const handlers = {};
  let mode = 'roleplay';
  let provider = null;

  function on(evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); }
  function emit(evt, data) { (handlers[evt] || []).forEach(fn => fn(data)); }

  class CoachApiError extends Error {
    constructor(message, status, code, retryAfter) {
      super(message);
      this.name = 'CoachApiError';
      this.status = status;
      this.code = code || 'COACH_REQUEST_FAILED';
      this.retryAfter = retryAfter || null;
    }
  }

  async function apiError(res) {
    let data = {};
    try { data = await res.json(); } catch (_) {}
    const retryAfter = Number(data.retryAfter || res.headers.get('Retry-After')) || null;
    return new CoachApiError('Coach request failed', res.status, data.code, retryAfter);
  }

  function userMessageForError(error, fallback) {
    if (error && error.status === 429) {
      const seconds = Math.max(1, Number(error.retryAfter) || 60);
      const minutes = Math.ceil(seconds / 60);
      return `You're practicing quickly. Please wait about ${minutes} minute${minutes === 1 ? '' : 's'} before trying again.`;
    }
    if (error && (error.status === 400 || error.status === 413)) {
      return 'That request was too large or could not be processed. Shorten it and try again.';
    }
    return fallback || 'The AI Coach is temporarily unavailable. Please try again shortly.';
  }

  // Both calls authenticate as the logged-in user, never the public anon key.
  // getSession() (from auth.js) returns the current Supabase session, whose
  // access_token is the short-lived JWT that identifies *this* user to the
  // Edge Function — the anon key can't be swapped in for it by a caller.
  async function authHeaders() {
    const { data, error } = await supabaseClient.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if (error || !token) throw new Error('Not authenticated');
    return {
      'Content-Type': 'application/json',
      'apikey': supabaseClient.supabaseKey,
      'Authorization': `Bearer ${token}`
    };
  }

  const RemoteProvider = {
    id: 'remote',
    async send({ messages, mode, context, prefs }) {
      const url = CoachConfig.remote.endpoint();
      const res = await fetch(url, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          mode,
          prefs,
          messages: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!res.ok) {
        throw await apiError(res);
      }
      const data = await res.json();
      return { html: data.html };
    },

    async getFeedback({ messages, scenario, persona, difficulty, style, goal }) {
      const url = CoachConfig.remote.endpoint();
      const res = await fetch(url, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          action: 'feedback',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          prefs: { scenario, persona, difficulty, style, goal }
        })
      });

      if (!res.ok) {
        throw await apiError(res);
      }
      const data = await res.json();
      return data.report;
    }
  };

  provider = RemoteProvider;

  // ── Main text turn ──
  async function send(text, opts) {
    let s = await CoachStore.activeSession();
    if (!s) {
      s = await CoachStore.saveSession({ mode });
    }

    const kind = (opts && opts.kind) || 'text';

    // Wait for the database insert to finish before proceeding
    const saved = await CoachStore.appendMessage(s.id, { role: 'user', kind, content: text });
    if (!saved) {
      console.error('CoachEngine: failed to save user message — aborting turn instead of sending stale context.');
      emit('message', { role: 'coach', html: "Hmm, that didn't save — try sending it again in a moment." });
      return;
    }

    emit('thinking', {});

    try {
      // Wait for the database to return the updated history array
      const messages = await CoachStore.getMessages(s.id);
      const settings = await CoachStore.getPreferences();

      const reply = await provider.send({
        // historyWindow caps how many turns are sent per request so cost/latency
        // don't grow unbounded as a session gets long.
        messages: messages.slice(-CoachConfig.remote.historyWindow),
        mode,
        context: CoachStore.getUserContext(),
        prefs: {
          difficulty: settings.difficulty,
          style: settings.conversation_style,
          feedbackDetail: settings.feedback_detail,
          language: settings.practice_language,
          persona: (opts && opts.persona) || undefined,
          scenario: (opts && opts.scenario) || undefined
        }
      });

      if (!reply || !reply.html) {
        throw new Error('Empty reply from provider');
      }

      // Wait for the AI reply to be saved before displaying
      await CoachStore.appendMessage(s.id, { role: 'coach', content: reply.html });
      emit('message', { role: 'coach', html: reply.html });

    } catch (err) {
      console.error('CoachEngine: turn failed —', err && err.code ? err.code : 'unknown');
      emit('message', { role: 'coach', html: userMessageForError(err, 'Hmm, I lost my train of thought — try that again in a moment.') });
    }
  }

  // ── Voice turn (Phase 4) ──
  async function handleVoice(rec) {
    let s = await CoachStore.activeSession();
    await CoachStore.appendMessage(s.id, { role: 'user', kind: 'voice', content: '[voice message]', meta: { duration: rec.duration } });
    const html = CoachConfig.local.voiceReply;
    await CoachStore.appendMessage(s.id, { role: 'coach', content: html });
    setTimeout(() => emit('message', { role: 'coach', html }), 700);
  }

  // ── Document turn (Phase 5) ──
  async function handleDocument(doc) {
    let s = await CoachStore.activeSession();
    await CoachStore.appendMessage(s.id, { role: 'user', kind: 'doc', content: `[document] ${doc.name}`, meta: { docId: doc.id, size: doc.size } });
    const html = CoachConfig.local.docReply(doc.name);
    await CoachStore.appendMessage(s.id, { role: 'coach', content: html });
    setTimeout(() => emit('message', { role: 'coach', html }), 1000);
  }

  async function endSession(score) {
    const s = await CoachStore.endActiveSession({ score: score == null ? null : Math.round(score) });
    emit('ended', s);
    return s;
  }

  // ── End-of-session feedback report ──
  async function getFeedback(sessionId) {
    const session = await CoachStore.activeSession();
    const messages = await CoachStore.getMessages(sessionId);
    const settings = await CoachStore.getPreferences();

    return provider.getFeedback({
      messages,
      scenario: session && session.scenario,
      persona: session && session.persona,
      difficulty: (session && session.difficulty) || settings.difficulty,
      style: (session && session.coach_style) || settings.conversation_style,
      goal: session && session.goal
    });
  }

  return {
    on,
    setMode: (m) => { mode = m; emit('mode', { mode: m, intro: CoachConfig.modes[m].intro }); },
    send,
    handleVoice,
    handleDocument,
    endSession,
    getFeedback,
    getMode: () => mode,
    providerId: () => provider.id,
    userMessageForError
  };
})();
