// AmplifyHub AI Coach — Live Supabase Database Data Layer.
// Replaces the old synchronous localStorage data engine.
// All shapes match your PostgreSQL database definitions 1:1.

const CoachStore = (() => {
  const K = CoachConfig.storageKeys;
  let currentActiveSessionId = null;
  const listeners = [];

  // Defaults mirror the initial state already baked into settings.html, so a
  // user who has never saved settings still sees/gets sensible values.
  const DEFAULT_PREFS = {
    full_name: '', username: '', bio: '',
    accent_color: '#FFD54A', font_size: 15, compact_mode: false, animations: true,
    difficulty: 'medium', response_speed: 'natural', feedback_detail: 'detailed',
    conversation_style: 'professional', practice_language: 'english',
    daily_goal_minutes: 20, weekly_goal_lessons: 5, xp_visibility: true, streak_reminder: true,
    challenge_difficulty: 'balanced', learning_pace: 'steady',
    ui_language: 'English (US)', timezone: '(GMT+5:00) Islamabad, Karachi',
    date_format: 'MM/DD/YYYY', time_format: '12-hour',
    profile_visibility: 'public'
  };
  let cachedPrefs = null;

  async function getUid() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error || !user) {
      console.error("CoachStore: Auth session missing. Data access halted.");
      return null;
    }
    return user.id;
  }

  async function listSessions() {
    const uid = await getUid();
    if (!uid) return [];
    const { data, error } = await supabaseClient
      .from('coaching_sessions')
      .select('*')
      .order('started_at', { ascending: false });
    if (error) {
      console.error("Error fetching coaching sessions:", error.message);
      return [];
    }
    return data;
  }

  async function activeSession() {
    if (!currentActiveSessionId) return null;
    const { data, error } = await supabaseClient
      .from('coaching_sessions')
      .select('*')
      .eq('id', currentActiveSessionId)
      .maybeSingle();
    if (error) {
      console.error("Error fetching active session:", error.message);
      return null;
    }
    return data;
  }

  async function saveSession(patch) {
    const uid = await getUid();
    if (!uid) return null;
    const isNew = !patch.id;
    const sessionId = patch.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7));

    // Send defaults only when CREATING. For updates, send only the fields the
    // caller actually provided — a partial patch like {id, score} must not
    // clobber an existing row's mode/title/turns back to defaults.
    const sessionData = { id: sessionId, user_id: uid };

    if (isNew) {
      sessionData.mode = patch.mode || 'roleplay';
      sessionData.title = patch.title || 'AI Training Session';
      sessionData.score = patch.score !== undefined ? patch.score : null;
      sessionData.turns = patch.turns || 0;
    } else {
      if (patch.mode !== undefined) sessionData.mode = patch.mode;
      if (patch.title !== undefined) sessionData.title = patch.title;
      if (patch.score !== undefined) sessionData.score = patch.score;
      if (patch.turns !== undefined) sessionData.turns = patch.turns;
    }

    // Roleplay metadata — columns added by assets/coaching_sessions_metadata.sql
    // (run that migration first, or these writes will fail).
    if (patch.scenario !== undefined) sessionData.scenario = patch.scenario;
    if (patch.persona !== undefined) sessionData.persona = patch.persona;
    if (patch.difficulty !== undefined) sessionData.difficulty = patch.difficulty;
    if (patch.coachStyle !== undefined) sessionData.coach_style = patch.coachStyle;
    if (patch.goal !== undefined) sessionData.goal = patch.goal;
    if (patch.status !== undefined) sessionData.status = patch.status;

    if (patch.endedAt) sessionData.ended_at = new Date(patch.endedAt).toISOString();

    const { data, error } = await supabaseClient
      .from('coaching_sessions')
      .upsert(sessionData)
      .select()
      .single();

    if (error) {
      console.error("Error saving coaching session:", error.message);
      return null;
    }
    currentActiveSessionId = data.id;
    triggerChange();
    return data;
  }

  async function endActiveSession(opts) {
    if (!currentActiveSessionId) return null;
    // Persist whatever the end-of-session flow provides: completion status,
    // final score, and the AI feedback report + per-skill scores (jsonb).
    const updateData = { ended_at: new Date().toISOString() };
    if (opts && opts.score !== undefined) updateData.score = opts.score;
    if (opts && opts.status !== undefined) updateData.status = opts.status;
    if (opts && opts.feedbackReport !== undefined) updateData.feedback_report = opts.feedbackReport;
    if (opts && opts.scores !== undefined) updateData.scores = opts.scores;

    const { data, error } = await supabaseClient
      .from('coaching_sessions')
      .update(updateData)
      .eq('id', currentActiveSessionId)
      .select()
      .single();

    if (error) {
      console.error("Error ending active session:", error.message);
      return null;
    }
    currentActiveSessionId = null;
    triggerChange();
    return data;
  }

  async function getSessionById(id) {
    if (!id) return null;
    const { data, error } = await supabaseClient
      .from('coaching_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error("Error fetching session by id:", error.message);
      return null;
    }
    return data;
  }

  async function getProgressStats() {
    const uid = await getUid();
    if (!uid) return null;
    const { data, error } = await supabaseClient
      .from('user_progress_stats')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) {
      console.error("Error loading progress stats:", error.message);
      return null;
    }
    return data;
  }

  async function getMessages(sessionId) {
    if (!sessionId) return [];
    const { data, error } = await supabaseClient
      .from('coach_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true });
    if (error) {
      console.error("Error loading chat context trail:", error.message);
      return [];
    }
    return data;
  }

  async function appendMessage(sessionId, msg) {
    const uid = await getUid();
    if (!uid || !sessionId) return null;
    const messagePayload = {
      session_id: sessionId,
      user_id: uid,
      role: msg.role,
      kind: msg.kind || 'text',
      content: msg.content,
      meta: msg.meta || {}
    };

    const { data, error } = await supabaseClient
      .from('coach_messages')
      .insert(messagePayload)
      .select()
      .single();

    if (error) {
      console.error("Failed to append message turn record:", error.message);
      return null;
    }

    const history = await getMessages(sessionId);
    await supabaseClient
      .from('coaching_sessions')
      .update({ turns: history.length })
      .eq('id', sessionId);

    triggerChange();
    return data;
  }

  async function listDocs() {
    const uid = await getUid();
    if (!uid) return [];
    const { data, error } = await supabaseClient
      .from('coach_documents')
      .select('*')
      .order('added_at', { ascending: false });
    if (error) {
      console.error("Error listing documents:", error.message);
      return [];
    }
    return data;
  }

  async function addDoc(meta) {
    const uid = await getUid();
    if (!uid) return null;
    const docId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const docPayload = {
      id: docId,
      user_id: uid,
      name: meta.name,
      size: meta.size,
      mime: meta.mime || null,
      kind: meta.kind || 'resume',
      extract: meta.extract || null
    };

    const { data, error } = await supabaseClient
      .from('coach_documents')
      .insert(docPayload)
      .select()
      .single();

    if (error) {
      console.error("Error creating document registry metadata:", error.message);
      return null;
    }
    return data;
  }

  async function updateDoc(id, patch) {
    if (!id) return null;
    const { data, error } = await supabaseClient
      .from('coach_documents')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error("Error updating text extraction index:", error.message);
      return null;
    }
    return data;
  }

  async function getPreferences(forceRefresh) {
    if (cachedPrefs && !forceRefresh) return cachedPrefs;
    const uid = await getUid();
    if (!uid) return { ...DEFAULT_PREFS };
    const { data, error } = await supabaseClient
      .from('user_preferences')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) {
      console.error("Error loading preferences:", error.message);
      return { ...DEFAULT_PREFS };
    }
    cachedPrefs = { ...DEFAULT_PREFS, ...(data || {}) };
    return cachedPrefs;
  }

  async function savePreferences(patch) {
    const uid = await getUid();
    if (!uid) return null;
    const payload = { ...patch, user_id: uid, updated_at: new Date().toISOString() };

    const { data, error } = await supabaseClient
      .from('user_preferences')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      console.error("Error saving preferences:", error.message);
      return null;
    }
    cachedPrefs = { ...DEFAULT_PREFS, ...data };
    triggerChange();
    return cachedPrefs;
  }

  function getUserContext() {
    let journey = null;
    try { journey = JSON.parse(localStorage.getItem(K.journey)); } catch (e) {}
    return {
      journey: journey ? {
        module: journey.currentModuleName,
        progress: journey.overallProgress,
        lessonsCompleted: journey.lessonsCompleted
      } : null
    };
  }

  function onChange(fn) { listeners.push(fn); }
  function triggerChange() { listeners.forEach(fn => fn()); }

  return { 
    listSessions, activeSession, saveSession, endActiveSession, getSessionById,
    getMessages, appendMessage, listDocs, addDoc, updateDoc, 
    getUserContext, onChange, getPreferences, savePreferences,
    getProgressStats
  };
})();