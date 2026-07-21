/*!
 * AmplifyHub shared journey-progress helper.
 * Single source of truth for reading/writing `amplifyHub_journeyProgress` in
 * localStorage from the standalone HTML lesson pages. Mirrors the schema and
 * summary-field algorithm used by sales-mindset-app/src/progress.ts so the
 * React app and the static lesson pages stay compatible.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'amplifyHub_journeyProgress';

  var MODULE_MAP = [
    ['Sales Mindset', 8],
    ['Finding Prospects', 3],
    ['Building Your Script', 4],
    ['Opening the Call', 4],
    ['Discovery Questions', 4],
    ['Objection Handling', 5],
    ['Booking Appointments', 1],
    ['Follow-up', 3],
    ['Live Practice', 4],
    ['Mastery', 4]
  ];

  var TOTAL_LESSONS = MODULE_MAP.reduce(function (sum, entry) { return sum + entry[1]; }, 0);

  function lid(moduleIndex, lessonIndex) {
    return 'm' + moduleIndex + 'l' + lessonIndex;
  }

  function emptyStore() {
    return { completedLessons: [], lessonMeta: {} };
  }

  // Reads the raw store and normalizes it so callers always get a safe shape,
  // even if localStorage has corrupt JSON or an older/partial schema.
  function readProgress() {
    var raw;
    try {
      raw = global.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return emptyStore();
    }
    if (!raw) return emptyStore();

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('Unable to read journey progress (corrupt JSON).', e);
      return emptyStore();
    }
    if (!parsed || typeof parsed !== 'object') return emptyStore();

    var completedLessons = Array.isArray(parsed.completedLessons)
      ? parsed.completedLessons.filter(function (item) { return typeof item === 'string'; })
      : [];
    var lessonMeta = (parsed.lessonMeta && typeof parsed.lessonMeta === 'object' && !Array.isArray(parsed.lessonMeta))
      ? parsed.lessonMeta
      : {};

    return {
      completedLessons: completedLessons,
      lessonMeta: lessonMeta,
      overallProgress: typeof parsed.overallProgress === 'number' ? parsed.overallProgress : undefined,
      lessonsCompleted: typeof parsed.lessonsCompleted === 'number' ? parsed.lessonsCompleted : undefined,
      totalLessons: typeof parsed.totalLessons === 'number' ? parsed.totalLessons : undefined,
      currentModuleName: typeof parsed.currentModuleName === 'string' ? parsed.currentModuleName : undefined,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : undefined
    };
  }

  function computeCurrentModuleName(completedSet) {
    var currentModuleName = MODULE_MAP[MODULE_MAP.length - 1][0];
    for (var m = 0; m < MODULE_MAP.length; m += 1) {
      var lessonCount = MODULE_MAP[m][1];
      var moduleComplete = true;
      for (var l = 0; l < lessonCount; l += 1) {
        if (!completedSet.has(lid(m, l))) { moduleComplete = false; break; }
      }
      if (!moduleComplete) { currentModuleName = MODULE_MAP[m][0]; break; }
    }
    return currentModuleName;
  }

  // Recomputes every summary field from scratch and persists the full store.
  // completedLessons/lessonMeta are always written back in full so a save
  // from one lesson can never drop data written by another lesson.
  function writeProgress(completedLessons, lessonMeta) {
    var completedSet = new Set(completedLessons);
    var store = {
      completedLessons: Array.from(completedSet),
      overallProgress: Math.round((completedSet.size / TOTAL_LESSONS) * 100),
      lessonsCompleted: completedSet.size,
      totalLessons: TOTAL_LESSONS,
      currentModuleName: computeCurrentModuleName(completedSet),
      lessonMeta: lessonMeta || {},
      updatedAt: Date.now()
    };
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      console.error('Unable to save journey progress.', e);
    }
    return store;
  }

  // Marks a lesson complete, merging in optional meta (mins/quizScore/etc).
  // Preserves every other lesson's completedLessons + lessonMeta entry, and
  // is idempotent: calling it again for an already-completed lesson keeps
  // the original completedAt and simply refreshes the other meta fields.
  function markLessonComplete(moduleIndex, lessonIndex, meta) {
    var store = readProgress();
    var completedSet = new Set(store.completedLessons);
    var id = lid(moduleIndex, lessonIndex);
    var lessonMeta = store.lessonMeta || {};
    var existingMeta = lessonMeta[id] || {};

    completedSet.add(id);
    lessonMeta[id] = Object.assign({}, existingMeta, meta || {}, {
      completedAt: existingMeta.completedAt || Date.now()
    });

    return writeProgress(Array.from(completedSet), lessonMeta);
  }

  // Updates lessonMeta (e.g. a quiz score) without marking the lesson
  // complete and without touching any other lesson's data.
  function recordLessonMeta(moduleIndex, lessonIndex, meta) {
    var store = readProgress();
    var id = lid(moduleIndex, lessonIndex);
    var lessonMeta = store.lessonMeta || {};
    lessonMeta[id] = Object.assign({}, lessonMeta[id] || {}, meta || {});
    return writeProgress(store.completedLessons, lessonMeta);
  }

  function isLessonComplete(moduleIndex, lessonIndex) {
    var store = readProgress();
    return store.completedLessons.indexOf(lid(moduleIndex, lessonIndex)) !== -1;
  }

  function getCloudClient() {
    try {
      if (typeof supabaseClient !== 'undefined') return supabaseClient;
      return global.supabaseClient || null;
    } catch (e) { return null; }
  }

  async function getCloudUser(client) {
    if (!client || !client.auth) return null;
    var result = await client.auth.getUser();
    return result && result.data ? result.data.user : null;
  }

  async function syncLessonToCloud(id, meta, completed) {
    try {
      var client = getCloudClient();
      var user = await getCloudUser(client);
      if (!user) return false;
      var payload = {
        user_id: user.id,
        lesson_id: id,
        metadata: meta || {},
        updated_at: new Date().toISOString()
      };
      if (completed) payload.completed_at = new Date((meta && meta.completedAt) || Date.now()).toISOString();
      var result = await client.from('user_lesson_progress').upsert(payload, { onConflict: 'user_id,lesson_id' });
      if (result.error) throw result.error;
      return true;
    } catch (e) {
      console.warn('Lesson progress will sync when the connection is available.');
      return false;
    }
  }

  // Merges the browser cache with Supabase after sign-in. Completion is a
  // union, so an older browser can never erase lessons completed elsewhere.
  // Guarded against overlapping calls (e.g. a page-load sync and an
  // 'online' retry firing close together) — a second call while one is
  // already running just returns the current local state instead of
  // starting a redundant network round trip.
  var syncInProgress = false;
  async function syncWithCloud() {
    if (syncInProgress) return readProgress();
    syncInProgress = true;
    try {
      var client = getCloudClient();
      var user = await getCloudUser(client);
      if (!user) return readProgress();
      var cloudResult = await client.from('user_lesson_progress').select('lesson_id,completed_at,metadata,updated_at');
      if (cloudResult.error) throw cloudResult.error;

      var local = readProgress();
      var completed = new Set(local.completedLessons || []);
      var metadata = Object.assign({}, local.lessonMeta || {});
      (cloudResult.data || []).forEach(function (row) {
        if (row.completed_at) completed.add(row.lesson_id);
        var cloudMeta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        var existing = metadata[row.lesson_id] || {};
        metadata[row.lesson_id] = Object.assign({}, cloudMeta, existing);
        if (row.completed_at && !metadata[row.lesson_id].completedAt) {
          metadata[row.lesson_id].completedAt = new Date(row.completed_at).getTime();
        }
      });

      var merged = writeProgress(Array.from(completed), metadata);
      var rows = Object.keys(metadata).map(function (id) {
        var row = { user_id: user.id, lesson_id: id, metadata: metadata[id] || {}, updated_at: new Date().toISOString() };
        if (completed.has(id)) row.completed_at = new Date((metadata[id] && metadata[id].completedAt) || Date.now()).toISOString();
        return row;
      });
      if (rows.length) {
        var upsertResult = await client.from('user_lesson_progress').upsert(rows, { onConflict: 'user_id,lesson_id' });
        if (upsertResult.error) throw upsertResult.error;
      }
      global.dispatchEvent(new CustomEvent('amplify-progress-synced', { detail: merged }));
      return merged;
    } catch (e) {
      console.warn('Using offline lesson progress until cloud sync is available.');
      return readProgress();
    } finally {
      syncInProgress = false;
    }
  }

  global.AmplifyJourneyProgress = {
    STORAGE_KEY: STORAGE_KEY,
    MODULE_MAP: MODULE_MAP,
    TOTAL_LESSONS: TOTAL_LESSONS,
    lid: lid,
    readProgress: readProgress,
    writeProgress: writeProgress,
    markLessonComplete: markLessonComplete,
    recordLessonMeta: recordLessonMeta,
    isLessonComplete: isLessonComplete,
    syncWithCloud: syncWithCloud
  };

  var originalMarkLessonComplete = markLessonComplete;
  global.AmplifyJourneyProgress.markLessonComplete = function (moduleIndex, lessonIndex, meta) {
    var store = originalMarkLessonComplete(moduleIndex, lessonIndex, meta);
    var id = lid(moduleIndex, lessonIndex);
    syncLessonToCloud(id, store.lessonMeta[id], true);
    return store;
  };
  var originalRecordLessonMeta = recordLessonMeta;
  global.AmplifyJourneyProgress.recordLessonMeta = function (moduleIndex, lessonIndex, meta) {
    var store = originalRecordLessonMeta(moduleIndex, lessonIndex, meta);
    var id = lid(moduleIndex, lessonIndex);
    syncLessonToCloud(id, store.lessonMeta[id], store.completedLessons.indexOf(id) !== -1);
    return store;
  };

  if (getCloudClient()) setTimeout(syncWithCloud, 0);

  // Retry once connectivity returns. syncWithCloud is idempotent (upserts
  // on user_id+lesson_id) and guarded against overlapping calls above, so
  // this is always safe to fire, including if no client/user is available
  // yet — getCloudClient() and getCloudUser() both fail gracefully.
  global.addEventListener('online', function () {
    if (getCloudClient()) syncWithCloud();
  });
})(typeof window !== 'undefined' ? window : globalThis);
