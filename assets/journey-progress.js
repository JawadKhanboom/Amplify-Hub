/*!
 * AmplifyHub shared journey-progress helper.
 * Single source of truth for journey progress across standalone lesson pages.
 * Authenticated progress is stored per user. Anonymous progress is tab-scoped
 * so one person's data can never be merged into another person's account.
 */
(function (global) {
  'use strict';

  var LEGACY_STORAGE_KEY = 'amplifyHub_journeyProgress';
  var LEGACY_QUARANTINE_KEY = 'amplifyHub_journeyProgress:legacy:v1';
  var USER_STORAGE_PREFIX = 'amplifyHub_journeyProgress:v2:user:';
  var ANONYMOUS_STORAGE_KEY = 'amplifyHub_journeyProgress:v2:anonymous';
  var RECOVERY_DISMISS_PREFIX = 'amplifyHub_journeyProgress:recovery-dismissed:';
  var activeOwnerId = null;
  var ownerVerified = false;
  var ownerTransitionPending = false;
  var scopeVersion = 0;

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

  function isValidLessonId(id) {
    var match = /^m(\d+)l(\d+)$/.exec(id || '');
    if (!match) return false;
    var moduleIndex = parseInt(match[1], 10);
    var lessonIndex = parseInt(match[2], 10);
    return !!MODULE_MAP[moduleIndex] && lessonIndex >= 0 && lessonIndex < MODULE_MAP[moduleIndex][1];
  }

  function normalizeStore(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyStore();
    var completedLessons = Array.isArray(parsed.completedLessons)
      ? parsed.completedLessons.filter(function (item) { return typeof item === 'string' && isValidLessonId(item); })
      : [];
    var lessonMeta = {};
    if (parsed.lessonMeta && typeof parsed.lessonMeta === 'object' && !Array.isArray(parsed.lessonMeta)) {
      Object.keys(parsed.lessonMeta).forEach(function (id) {
        var value = parsed.lessonMeta[id];
        if (isValidLessonId(id) && value && typeof value === 'object' && !Array.isArray(value)) lessonMeta[id] = value;
      });
    }
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

  function currentStorage() {
    return activeOwnerId ? global.localStorage : global.sessionStorage;
  }

  function currentStorageKey() {
    return activeOwnerId ? USER_STORAGE_PREFIX + encodeURIComponent(activeOwnerId) : ANONYMOUS_STORAGE_KEY;
  }

  function readFrom(storage, key) {
    try {
      var raw = storage.getItem(key);
      if (!raw) return emptyStore();
      return normalizeStore(JSON.parse(raw));
    } catch (e) {
      console.error('Unable to read journey progress.', e);
      return emptyStore();
    }
  }

  function emitProgressChanged(reason) {
    try {
      global.dispatchEvent(new CustomEvent('amplify-progress-changed', {
        detail: { ownerId: activeOwnerId, reason: reason, store: readProgress() }
      }));
    } catch (e) { /* CustomEvent may be unavailable in a non-browser test. */ }
  }

  function setOwner(userId, verified) {
    var nextOwner = typeof userId === 'string' && userId ? userId : null;
    var nextVerified = !!nextOwner && verified !== false;
    ownerTransitionPending = false;
    if (activeOwnerId === nextOwner && ownerVerified === nextVerified) {
      emitProgressChanged('scope');
      return readProgress();
    }
    activeOwnerId = nextOwner;
    ownerVerified = nextVerified;
    scopeVersion += 1;
    emitProgressChanged('scope');
    return readProgress();
  }

  function clearOwner() {
    activeOwnerId = null;
    ownerVerified = false;
    scopeVersion += 1;
    emitProgressChanged('scope');
    return readProgress();
  }

  // Old builds used one browser-wide key. Preserve it for explicit recovery,
  // but never assign it to the next person who signs in.
  function quarantineLegacyProgress() {
    try {
      var raw = global.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return;
      JSON.parse(raw);
      if (!global.localStorage.getItem(LEGACY_QUARANTINE_KEY)) {
        global.localStorage.setItem(LEGACY_QUARANTINE_KEY, raw);
      }
      global.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (e) {
      console.warn('Older journey progress could not be quarantined safely.');
    }
  }

  function hasProgressData(store) {
    return !!((store.completedLessons && store.completedLessons.length) || Object.keys(store.lessonMeta || {}).length);
  }

  function recoveryDismissKey(source) {
    return RECOVERY_DISMISS_PREFIX + source + ':' + encodeURIComponent(activeOwnerId || 'anonymous');
  }

  function isRecoveryDismissed(source) {
    try { return global.sessionStorage.getItem(recoveryDismissKey(source)) === '1'; }
    catch (e) { return false; }
  }

  function dismissRecovery(source) {
    if (!activeOwnerId || !ownerVerified) return;
    try { global.sessionStorage.setItem(recoveryDismissKey(source), '1'); } catch (e) {}
  }

  function hasLegacyProgress() {
    if (!activeOwnerId || !ownerVerified) return false;
    try { return !!global.localStorage.getItem(LEGACY_QUARANTINE_KEY) && !isRecoveryDismissed('legacy'); }
    catch (e) { return false; }
  }

  async function importRecoveryProgress(storage, key) {
    var capturedOwnerId = activeOwnerId;
    var capturedVersion = scopeVersion;
    if (!capturedOwnerId || !ownerVerified) return readProgress();
    var client = getCloudClient();
    var user = await getCloudUser(client);
    if (!user || user.id !== capturedOwnerId || activeOwnerId !== capturedOwnerId || scopeVersion !== capturedVersion) return readProgress();

    var source = readFrom(storage, key);
    var current = readProgress();
    var completed = new Set(current.completedLessons || []);
    (source.completedLessons || []).forEach(function (id) { completed.add(id); });
    var metadata = {};
    Object.keys(source.lessonMeta || {}).forEach(function (id) {
      metadata[id] = Object.assign({}, source.lessonMeta[id]);
    });
    Object.keys(current.lessonMeta || {}).forEach(function (id) {
      metadata[id] = Object.assign({}, metadata[id] || {}, current.lessonMeta[id]);
    });
    writeProgress(Array.from(completed), metadata);

    var persisted = readProgress();
    var completionSaved = (source.completedLessons || []).every(function (id) {
      return persisted.completedLessons.indexOf(id) !== -1;
    });
    var metadataSaved = Object.keys(metadata).every(function (id) {
      if (!persisted.lessonMeta[id]) return false;
      return Object.keys(metadata[id]).every(function (field) {
        return JSON.stringify(persisted.lessonMeta[id][field]) === JSON.stringify(metadata[id][field]);
      });
    });
    if (!completionSaved || !metadataSaved || activeOwnerId !== capturedOwnerId || scopeVersion !== capturedVersion) return persisted;

    await syncWithCloud();
    if (activeOwnerId === capturedOwnerId && scopeVersion === capturedVersion) {
      try { storage.removeItem(key); } catch (e) {}
    }
    return readProgress();
  }

  function importLegacyProgress() {
    return importRecoveryProgress(global.localStorage, LEGACY_QUARANTINE_KEY);
  }

  function hasAnonymousProgress() {
    if (!activeOwnerId || !ownerVerified || isRecoveryDismissed('anonymous')) return false;
    return hasProgressData(readFrom(global.sessionStorage, ANONYMOUS_STORAGE_KEY));
  }

  function importAnonymousProgress() {
    return importRecoveryProgress(global.sessionStorage, ANONYMOUS_STORAGE_KEY);
  }

  // Reads the raw store and normalizes it so callers always get a safe shape,
  // even if localStorage has corrupt JSON or an older/partial schema.
  function readProgress() {
    return readFrom(currentStorage(), currentStorageKey());
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
    if (ownerTransitionPending) return readProgress();
    var completedSet = new Set(Array.from(completedLessons || []).filter(isValidLessonId));
    var safeMeta = {};
    if (lessonMeta && typeof lessonMeta === 'object') {
      Object.keys(lessonMeta).forEach(function (id) {
        var value = lessonMeta[id];
        if (isValidLessonId(id) && value && typeof value === 'object' && !Array.isArray(value)) safeMeta[id] = value;
      });
    }
    var store = {
      completedLessons: Array.from(completedSet),
      overallProgress: Math.round((completedSet.size / TOTAL_LESSONS) * 100),
      lessonsCompleted: completedSet.size,
      totalLessons: TOTAL_LESSONS,
      currentModuleName: computeCurrentModuleName(completedSet),
      lessonMeta: safeMeta,
      updatedAt: Date.now()
    };
    try {
      currentStorage().setItem(currentStorageKey(), JSON.stringify(store));
      emitProgressChanged('local-write');
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
    if (!client || !client.auth) return undefined;
    try {
      var result = await client.auth.getUser();
      if (result && result.data && result.data.user) return result.data.user;
      if (result && result.error) return undefined;
      return null;
    } catch (e) {
      return undefined;
    }
  }

  async function syncLessonToCloud(id, meta, completed) {
    try {
      if (!isValidLessonId(id)) return false;
      var capturedOwnerId = activeOwnerId;
      var capturedVersion = scopeVersion;
      if (!capturedOwnerId || !ownerVerified) return false;
      var client = getCloudClient();
      var user = await getCloudUser(client);
      if (!user || user.id !== capturedOwnerId || activeOwnerId !== capturedOwnerId || scopeVersion !== capturedVersion) return false;
      var payload = {
        user_id: capturedOwnerId,
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
  var syncByOwner = Object.create(null);
  async function syncOwnerWithCloud(client, user, capturedVersion) {
    try {
      var cloudResult = await client.from('user_lesson_progress').select('lesson_id,completed_at,metadata,updated_at');
      if (cloudResult.error) throw cloudResult.error;
      if (activeOwnerId !== user.id || scopeVersion !== capturedVersion) return readProgress();

      var local = readProgress();
      var completed = new Set(local.completedLessons || []);
      var metadata = Object.assign({}, local.lessonMeta || {});
      (cloudResult.data || []).forEach(function (row) {
        if (!isValidLessonId(row.lesson_id)) return;
        if (row.completed_at) completed.add(row.lesson_id);
        var cloudMeta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        var existing = metadata[row.lesson_id] || {};
        metadata[row.lesson_id] = Object.assign({}, cloudMeta, existing);
        if (row.completed_at && !metadata[row.lesson_id].completedAt) {
          metadata[row.lesson_id].completedAt = new Date(row.completed_at).getTime();
        }
      });

      var merged = writeProgress(Array.from(completed), metadata);
      var mergedCompleted = new Set(merged.completedLessons || []);
      var mergedMetadata = merged.lessonMeta || {};
      var rows = Object.keys(mergedMetadata).map(function (id) {
        var row = { user_id: user.id, lesson_id: id, metadata: mergedMetadata[id] || {}, updated_at: new Date().toISOString() };
        if (mergedCompleted.has(id)) row.completed_at = new Date((mergedMetadata[id] && mergedMetadata[id].completedAt) || Date.now()).toISOString();
        return row;
      });
      if (rows.length) {
        var freshUser = await getCloudUser(client);
        if (!freshUser || freshUser.id !== user.id || activeOwnerId !== user.id || scopeVersion !== capturedVersion) return readProgress();
        var upsertResult = await client.from('user_lesson_progress').upsert(rows, { onConflict: 'user_id,lesson_id' });
        if (upsertResult.error) throw upsertResult.error;
      }
      global.dispatchEvent(new CustomEvent('amplify-progress-synced', { detail: merged }));
      return merged;
    } catch (e) {
      console.warn('Using offline lesson progress until cloud sync is available.');
      return readProgress();
    }
  }

  async function syncWithCloud() {
    var startingVersion = scopeVersion;
    var startingOwnerId = activeOwnerId;
    var client = getCloudClient();
    var user = await getCloudUser(client);
    if (scopeVersion !== startingVersion) return readProgress();
    if (user === null) {
      ownerTransitionPending = false;
      if (startingOwnerId) clearOwner();
      else emitProgressChanged('scope');
      return readProgress();
    }
    if (!user) {
      ownerTransitionPending = false;
      emitProgressChanged('scope');
      return readProgress();
    }
    if (startingOwnerId && startingOwnerId !== user.id) {
      clearOwner();
      setOwner(user.id, true);
    } else if (!startingOwnerId || !ownerVerified) {
      setOwner(user.id, true);
    }
    var capturedVersion = scopeVersion;
    var key = encodeURIComponent(user.id) + ':' + capturedVersion;
    if (syncByOwner[key]) return syncByOwner[key];
    syncByOwner[key] = syncOwnerWithCloud(client, user, capturedVersion);
    try { return await syncByOwner[key]; }
    finally { delete syncByOwner[key]; }
  }

  function ready() {
    var sync = syncWithCloud();
    return new Promise(function (resolve) {
      var settled = false;
      var timeout = setTimeout(function () {
        if (settled) return;
        settled = true;
        ownerTransitionPending = false;
        emitProgressChanged('scope');
        resolve(readProgress());
      }, 2500);
      sync.then(function (store) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(store);
      });
    });
  }

  global.AmplifyJourneyProgress = {
    STORAGE_KEY: LEGACY_STORAGE_KEY,
    USER_STORAGE_PREFIX: USER_STORAGE_PREFIX,
    ANONYMOUS_STORAGE_KEY: ANONYMOUS_STORAGE_KEY,
    MODULE_MAP: MODULE_MAP,
    TOTAL_LESSONS: TOTAL_LESSONS,
    lid: lid,
    getStorageKey: currentStorageKey,
    getOwner: function () { return activeOwnerId; },
    isReadyForWrites: function () { return !ownerTransitionPending; },
    setOwner: setOwner,
    clearOwner: clearOwner,
    ready: ready,
    readProgress: readProgress,
    writeProgress: writeProgress,
    markLessonComplete: markLessonComplete,
    recordLessonMeta: recordLessonMeta,
    isLessonComplete: isLessonComplete,
    syncWithCloud: syncWithCloud,
    hasLegacyProgress: hasLegacyProgress,
    importLegacyProgress: importLegacyProgress,
    hasAnonymousProgress: hasAnonymousProgress,
    importAnonymousProgress: importAnonymousProgress,
    dismissRecovery: dismissRecovery
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

  quarantineLegacyProgress();
  var authClient = getCloudClient();
  if (authClient && authClient.auth && typeof authClient.auth.onAuthStateChange === 'function') {
    authClient.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        ownerTransitionPending = false;
        clearOwner();
        return;
      }
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && session.user) {
        if (activeOwnerId !== session.user.id) {
          ownerTransitionPending = true;
          clearOwner();
        }
        setTimeout(syncWithCloud, 0);
      }
    });
  }
  if (authClient) setTimeout(syncWithCloud, 0);

  // Retry once connectivity returns. syncWithCloud is idempotent (upserts
  // on user_id+lesson_id) and guarded against overlapping calls above, so
  // this is always safe to fire, including if no client/user is available
  // yet — getCloudClient() and getCloudUser() both fail gracefully.
  global.addEventListener('online', function () {
    if (getCloudClient()) syncWithCloud();
  });

  global.addEventListener('storage', function (event) {
    if (!activeOwnerId || event.key !== currentStorageKey()) return;
    emitProgressChanged('cross-tab');
  });
})(typeof window !== 'undefined' ? window : globalThis);
