/*!
 * AmplifyHub shared user-stats helper.
 *
 * Single source of truth for the REAL, per-user numbers shown on the Profile,
 * Progress, and Dashboard pages. Every value returned here is traced to a
 * stored record the signed-in user owns:
 *   - user_preferences        → display name, username, bio, goals, timezone
 *   - user_lesson_progress    → lessons completed, Journey %, this-week lessons
 *   - coaching_sessions       → AI Coach sessions, overall + per-skill scores
 *   - user_challenge_assignments → challenges completed, XP earned
 *   - challenge_catalog       → titles for the activity timeline
 * plus the local `amplifyHub_journeyProgress` cache as an offline fallback.
 *
 * There are NO invented metrics: no real-world call counts, no confidence
 * score, no XP beyond challenge XP, no resource bookmarks. A brand-new
 * account resolves to zeros everywhere.
 *
 * All queries rely on Supabase Row-Level Security (each table's policy limits
 * rows to auth.uid()), so the client only ever receives its own data.
 */
(function (global) {
  'use strict';

  var TOTAL_LESSONS = (global.AmplifyJourneyProgress && global.AmplifyJourneyProgress.TOTAL_LESSONS) || 36;
  var MODULE_MAP = (global.AmplifyJourneyProgress && global.AmplifyJourneyProgress.MODULE_MAP) || [];

  var SKILL_LABELS = {
    opening: 'Opening', discovery: 'Discovery', objection: 'Objection Handling',
    objections: 'Objection Handling', communication: 'Communication', rapport: 'Rapport',
    closing: 'Closing', qualifying: 'Qualifying', tonality: 'Tonality', relevance: 'Relevance'
  };

  function client() {
    try {
      if (typeof supabaseClient !== 'undefined') return supabaseClient;
      return global.supabaseClient || null;
    } catch (e) { return null; }
  }

  function titleCase(key) {
    return String(key || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // Returns a YYYY-MM-DD day key in the user's timezone. Falls back to the
  // browser timezone if the stored value is not a valid IANA zone.
  function dayKey(date, tz) {
    var d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    } catch (e) {
      return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    }
  }

  function todayKey(tz) { return dayKey(new Date(), tz); }

  // Consecutive-day streak ending today (or yesterday) from a set of day keys.
  function computeStreak(daySet, tz) {
    if (!daySet.size) return 0;
    var cursor = new Date();
    var today = dayKey(cursor, tz);
    if (!daySet.has(today)) {
      cursor.setDate(cursor.getDate() - 1);
      if (!daySet.has(dayKey(cursor, tz))) return 0;
    }
    var streak = 0;
    while (daySet.has(dayKey(cursor, tz))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function isModuleComplete(moduleIndex, completedSet) {
    if (!MODULE_MAP[moduleIndex]) return false;
    var count = MODULE_MAP[moduleIndex][1];
    for (var l = 0; l < count; l += 1) {
      if (!completedSet.has('m' + moduleIndex + 'l' + l)) return false;
    }
    return true;
  }
  function moduleIndexOf(lessonId) {
    var match = /^m(\d+)l\d+$/.exec(lessonId || '');
    return match ? parseInt(match[1], 10) : -1;
  }

  function localLessons() {
    try {
      if (global.AmplifyJourneyProgress) return global.AmplifyJourneyProgress.readProgress();
    } catch (e) {}
    return { completedLessons: [], lessonMeta: {} };
  }

  async function fetchUser(api) {
    try {
      var res = await api.auth.getUser();
      return res && res.data ? res.data.user : null;
    } catch (e) { return null; }
  }

  // Each source is fetched independently so one failing table (or an offline
  // client) degrades that source only, rather than blanking the whole page.
  async function safeSelect(api, table, columns) {
    try {
      var res = await api.from(table).select(columns);
      if (res.error) return { data: [], error: res.error };
      return { data: res.data || [], error: null };
    } catch (e) { return { data: [], error: e }; }
  }

  function buildAchievements(t) {
    return [
      { id: 'first-lesson', icon: '🌱', name: 'First Lesson', req: 'Complete your first lesson', earned: t.lessonsCompleted >= 1 },
      { id: 'five-lessons', icon: '📚', name: 'Five Lessons', req: 'Complete 5 lessons', earned: t.lessonsCompleted >= 5 },
      { id: 'module-master', icon: '🎓', name: 'Module Master', req: 'Finish every lesson in one module', earned: t.moduleComplete },
      { id: 'ai-explorer', icon: '🤖', name: 'AI Explorer', req: 'Finish an AI Coach session', earned: t.coachSessions >= 1 },
      { id: 'sharp-scorer', icon: '🎯', name: 'Sharp Scorer', req: 'Score 8+/10 in a Coach session', earned: t.bestScore != null && t.bestScore >= 8 },
      { id: 'first-challenge', icon: '⚡', name: 'First Challenge', req: 'Complete a daily challenge', earned: t.challengesCompleted >= 1 },
      { id: 'streak-3', icon: '🔥', name: '3-Day Streak', req: 'Practice 3 days in a row', earned: t.streak >= 3 },
      { id: 'streak-7', icon: '🏅', name: '7-Day Streak', req: 'Practice 7 days in a row', earned: t.streak >= 7 }
    ];
  }

  async function load() {
    var api = client();
    var result = {
      ok: false, offline: false, authenticated: false,
      profile: { name: '', username: '', bio: '', initial: '?', email: '', joinedAt: null },
      prefs: { xpVisibility: true, weeklyGoalLessons: 5, timezone: null },
      totals: {
        xp: 0, lessonsCompleted: 0, totalLessons: TOTAL_LESSONS, journeyPct: 0, currentModuleName: '',
        coachSessions: 0, roleplaySessions: 0, scoredSessions: 0, avgScore: null, bestScore: null,
        challengesCompleted: 0, streak: 0, thisWeekLessons: 0, moduleComplete: false
      },
      skills: [], achievements: [], timeline: [], goals: []
    };

    if (!api) { result.offline = true; result.achievements = buildAchievements(result.totals); return result; }

    var user = await fetchUser(api);
    if (!user) { result.achievements = buildAchievements(result.totals); return result; }
    result.authenticated = true;
    result.profile.email = user.email || '';
    result.profile.joinedAt = user.created_at || null;
    var metaName = user.user_metadata && user.user_metadata.full_name ? user.user_metadata.full_name : '';

    // Fetch every source in parallel; each is independently fault-tolerant.
    var prefsReq = (async function () {
      try {
        var res = await api.from('user_preferences').select('full_name,username,bio,timezone,weekly_goal_lessons,xp_visibility').eq('user_id', user.id).maybeSingle();
        return res && res.data ? res.data : null;
      } catch (e) { return null; }
    })();
    var lessonsReq = safeSelect(api, 'user_lesson_progress', 'lesson_id,completed_at,metadata,updated_at');
    var sessionsReq = safeSelect(api, 'coaching_sessions', 'id,mode,title,score,turns,scores,status,started_at,ended_at');
    var challengeReq = safeSelect(api, 'user_challenge_assignments', 'challenge_id,status,xp_awarded,assignment_date,completed_at,tier');
    var catalogReq = safeSelect(api, 'challenge_catalog', 'id,title,skill');

    var prefs = await prefsReq;
    var lessonsRes = await lessonsReq;
    var sessionsRes = await sessionsReq;
    var challengeRes = await challengeReq;
    var catalogRes = await catalogReq;

    // If every remote source errored, the client is effectively offline.
    result.offline = !!(lessonsRes.error && sessionsRes.error && challengeRes.error);

    // ── Profile / preferences ──
    var name = (prefs && prefs.full_name) || metaName || '';
    result.profile.name = name;
    result.profile.username = (prefs && prefs.username) || '';
    result.profile.bio = (prefs && prefs.bio) || '';
    result.profile.initial = (name || result.profile.email || '?').trim().charAt(0).toUpperCase() || '?';
    result.prefs.xpVisibility = !prefs || prefs.xp_visibility !== false;
    result.prefs.weeklyGoalLessons = prefs && prefs.weekly_goal_lessons ? prefs.weekly_goal_lessons : 5;
    var tz = prefs && prefs.timezone ? prefs.timezone : null;
    // A stored display label (e.g. "(GMT+5:00) …") is not a valid IANA zone; probe and drop it.
    try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); } catch (e) { tz = undefined; }
    result.prefs.timezone = tz || null;

    var activityDays = new Set();

    // ── Lessons (cloud unioned with local cache) ──
    var local = localLessons();
    var completedSet = new Set(Array.isArray(local.completedLessons) ? local.completedLessons : []);
    var lessonTimes = {}; // lessonId -> ms timestamp
    Object.keys(local.lessonMeta || {}).forEach(function (id) {
      var m = local.lessonMeta[id];
      if (m && m.completedAt) lessonTimes[id] = m.completedAt;
    });
    (lessonsRes.data || []).forEach(function (row) {
      if (row.completed_at) {
        completedSet.add(row.lesson_id);
        lessonTimes[row.lesson_id] = new Date(row.completed_at).getTime();
      }
    });
    var t = result.totals;
    t.lessonsCompleted = completedSet.size;
    t.journeyPct = Math.round((completedSet.size / TOTAL_LESSONS) * 100);
    for (var m = 0; m < MODULE_MAP.length; m += 1) {
      if (isModuleComplete(m, completedSet)) { t.moduleComplete = true; }
    }
    // current module = first not-yet-complete module
    t.currentModuleName = MODULE_MAP.length ? MODULE_MAP[MODULE_MAP.length - 1][0] : '';
    for (var mm = 0; mm < MODULE_MAP.length; mm += 1) {
      if (!isModuleComplete(mm, completedSet)) { t.currentModuleName = MODULE_MAP[mm][0]; break; }
    }
    var weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    Object.keys(lessonTimes).forEach(function (id) {
      if (completedSet.has(id)) {
        var ts = lessonTimes[id];
        activityDays.add(dayKey(new Date(ts), tz));
        if (ts >= weekAgo) t.thisWeekLessons += 1;
        result.timeline.push({
          kind: 'lesson', icon: '📖', ts: ts,
          text: 'Completed a lesson in ' + (MODULE_MAP[moduleIndexOf(id)] ? MODULE_MAP[moduleIndexOf(id)][0] : 'your Journey')
        });
      }
    });

    // ── Coach sessions ──
    var sessions = sessionsRes.data || [];
    var completedSessions = sessions.filter(function (s) { return s.status === 'completed' || s.ended_at; });
    t.coachSessions = completedSessions.length;
    t.roleplaySessions = completedSessions.filter(function (s) { return s.mode === 'roleplay'; }).length;
    var scored = completedSessions.filter(function (s) { return s.score !== null && s.score !== undefined; });
    t.scoredSessions = scored.length;
    if (scored.length) {
      var sum = scored.reduce(function (a, s) { return a + Number(s.score); }, 0);
      t.avgScore = Math.round((sum / scored.length) * 10) / 10;
      t.bestScore = scored.reduce(function (a, s) { return Math.max(a, Number(s.score)); }, 0);
    }
    // Per-skill averages from the `scores` jsonb.
    var skillAgg = {};
    completedSessions.forEach(function (s) {
      var sc = s.scores;
      if (!sc || typeof sc !== 'object') return;
      Object.keys(sc).forEach(function (key) {
        var v = Number(sc[key]);
        if (!isFinite(v)) return;
        if (!skillAgg[key]) skillAgg[key] = { sum: 0, n: 0 };
        skillAgg[key].sum += v; skillAgg[key].n += 1;
      });
    });
    result.skills = Object.keys(skillAgg).map(function (key) {
      var avg = skillAgg[key].sum / skillAgg[key].n;
      return { key: key, label: SKILL_LABELS[key] || titleCase(key), avg: Math.round(avg * 10) / 10, pct: Math.max(0, Math.min(100, Math.round(avg * 10))) };
    }).sort(function (a, b) { return b.avg - a.avg; });
    completedSessions.forEach(function (s) {
      var ts = new Date(s.ended_at || s.started_at).getTime();
      if (!isNaN(ts)) {
        activityDays.add(dayKey(new Date(ts), tz));
        result.timeline.push({
          kind: 'coach', icon: '🎭', ts: ts,
          text: 'Practiced ' + (s.mode === 'ask' ? 'with the AI Coach' : (s.mode === 'roleplay' ? 'a roleplay' : (s.mode || 'a session'))) +
            (s.score != null ? ' — scored ' + s.score + '/10' : '')
        });
      }
    });

    // ── Challenges ──
    var catalogMap = {};
    (catalogRes.data || []).forEach(function (c) { catalogMap[c.id] = c.title; });
    var challengeCompleted = (challengeRes.data || []).filter(function (a) { return a.status === 'completed'; });
    t.challengesCompleted = challengeCompleted.length;
    t.xp = challengeCompleted.reduce(function (a, c) { return a + (Number(c.xp_awarded) || 0); }, 0);
    challengeCompleted.forEach(function (a) {
      var ts = a.completed_at ? new Date(a.completed_at).getTime() : (a.assignment_date ? new Date(a.assignment_date + 'T12:00:00').getTime() : null);
      if (ts) {
        activityDays.add(dayKey(new Date(ts), tz));
        result.timeline.push({
          kind: 'challenge', icon: '⚡', ts: ts,
          text: 'Completed the challenge "' + (catalogMap[a.challenge_id] || 'Daily challenge') + '"' + (a.xp_awarded ? ' (+' + a.xp_awarded + ' XP)' : '')
        });
      }
    });

    // ── Derived ──
    activityDays.delete(null);
    t.streak = computeStreak(activityDays, tz);
    result.timeline.sort(function (a, b) { return b.ts - a.ts; });
    result.achievements = buildAchievements(t);
    result.goals = [
      { id: 'journey', name: 'Complete your Journey', current: t.lessonsCompleted, target: TOTAL_LESSONS, pct: t.journeyPct, valueText: t.lessonsCompleted + ' / ' + TOTAL_LESSONS + ' lessons' },
      { id: 'weekly', name: 'Weekly lessons (last 7 days)', current: t.thisWeekLessons, target: result.prefs.weeklyGoalLessons,
        pct: Math.max(0, Math.min(100, Math.round((t.thisWeekLessons / Math.max(1, result.prefs.weeklyGoalLessons)) * 100))),
        valueText: t.thisWeekLessons + ' / ' + result.prefs.weeklyGoalLessons }
    ];
    result.ok = true;
    return result;
  }

  global.AmplifyUserStats = { load: load, SKILL_LABELS: SKILL_LABELS };
})(typeof window !== 'undefined' ? window : globalThis);
