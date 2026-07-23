/*!
 * Cloud sync for the React sales-mindset lesson app.
 *
 * This app is a separate Vite/ES-module build from the rest of the static
 * site and cannot see the classic-script `supabaseClient` global that
 * assets/journey-progress.js relies on (module scope and classic-script
 * scope don't share bindings). This file creates its own Supabase client
 * instance instead — same public project URL and publishable/anon key as
 * auth-config.js (these are meant to be public; the key ships to every
 * browser already). If the project URL/key ever changes, update both files.
 *
 * Because this client is configured for the same Supabase project and uses
 * the default persistSession behavior, it automatically picks up whatever
 * session the main site's sign-in flow already stored in localStorage —
 * no separate auth flow is needed here.
 *
 * Mirrors the merge/upsert algorithm in assets/journey-progress.js so both
 * surfaces stay compatible; reuses readProgress/writeProgress from ./progress
 * rather than touching the localStorage key or shape directly.
 */
import { createClient } from '@supabase/supabase-js';
import {
  clearProgressOwner,
  getProgressOwner,
  getProgressScopeVersion,
  getProgressStorageKey,
  readProgress,
  setProgressOwner,
  writeProgress,
  type LessonMeta,
  type ProgressStore,
} from './progress';

const SUPABASE_URL = 'https://dsuahpcqrrlbudomjrye.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Yj-VkkJDCOE26_HYmwsP-w_XNBwJlb1';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getCloudUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return undefined;
    return data?.user ?? null;
  } catch {
    return undefined;
  }
}

/** Session presence only (no network round-trip): the auth gate uses this to
 * decide whether the lesson app may render at all, mirroring the static
 * pages' requireAuth() which also keys off the locally persisted session.
 * Ownership of progress data still requires the verified getUser() path. */
export async function hasLocalSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data?.session);
  } catch {
    return false;
  }
}

/** Pushes a single lesson's state. Fire-and-forget from the caller's
 * perspective — always resolves, never throws. Local writeProgress must
 * already have succeeded before this is called. */
export async function syncLessonToCloud(
  lessonId: string,
  meta: LessonMeta | undefined,
  completed: boolean,
): Promise<boolean> {
  try {
    const capturedOwnerId = getProgressOwner();
    const capturedVersion = getProgressScopeVersion();
    if (!capturedOwnerId) return false;
    const user = await getCloudUser();
    if (!user || user.id !== capturedOwnerId || getProgressOwner() !== capturedOwnerId || getProgressScopeVersion() !== capturedVersion) return false;

    const payload: Record<string, unknown> = {
      user_id: capturedOwnerId,
      lesson_id: lessonId,
      metadata: meta || {},
      updated_at: new Date().toISOString(),
    };
    if (completed) {
      payload.completed_at = new Date(meta?.completedAt || Date.now()).toISOString();
    }

    const { error } = await supabase
      .from('user_lesson_progress')
      .upsert(payload, { onConflict: 'user_id,lesson_id' });
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Lesson progress will sync when the connection is available.', error);
    return false;
  }
}

const syncByOwner = new Map<string, Promise<ProgressStore>>();

/** Full merge: reads cloud + local, unions completion, pushes anything the
 * cloud is missing. Idempotent (upsert on user_id+lesson_id) and guarded
 * against overlapping calls, matching assets/journey-progress.js. */
export async function syncAllToCloud(): Promise<ProgressStore> {
  const startingOwnerId = getProgressOwner();
  const startingVersion = getProgressScopeVersion();
  const user = await getCloudUser();
  if (getProgressScopeVersion() !== startingVersion) return readProgress();
  if (user === null) {
    if (startingOwnerId) clearProgressOwner();
    return readProgress();
  }
  if (!user) return readProgress();
  if (startingOwnerId && startingOwnerId !== user.id) {
    clearProgressOwner();
    setProgressOwner(user.id);
  } else if (!startingOwnerId) {
    setProgressOwner(user.id);
  }
  const capturedVersion = getProgressScopeVersion();
  const syncKey = `${user.id}:${capturedVersion}`;
  const existing = syncByOwner.get(syncKey);
  if (existing) return existing;

  const sync = (async () => {
    try {
      const ownerId = user.id;

    const { data: cloudRows, error } = await supabase
      .from('user_lesson_progress')
      .select('lesson_id,completed_at,metadata,updated_at');
    if (error) throw error;
    if (getProgressOwner() !== ownerId || getProgressScopeVersion() !== capturedVersion) return readProgress();

    const local = readProgress();
    const completed = new Set(local.completedLessons || []);
    const metadata: Record<string, LessonMeta> = { ...(local.lessonMeta || {}) };

    (cloudRows || []).forEach((row) => {
      if (row.completed_at) completed.add(row.lesson_id);
      const cloudMeta = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as LessonMeta;
      const existing = metadata[row.lesson_id] || {};
      metadata[row.lesson_id] = { ...cloudMeta, ...existing };
      if (row.completed_at && !metadata[row.lesson_id].completedAt) {
        metadata[row.lesson_id].completedAt = new Date(row.completed_at).getTime();
      }
    });

    const merged = writeProgress(completed, metadata);
    const mergedCompleted = new Set(merged.completedLessons);
    const mergedMetadata = merged.lessonMeta ?? {};

    const rows = Object.keys(mergedMetadata).map((id) => {
      const row: Record<string, unknown> = {
        user_id: user.id,
        lesson_id: id,
        metadata: mergedMetadata[id] || {},
        updated_at: new Date().toISOString(),
      };
      if (mergedCompleted.has(id)) {
        row.completed_at = new Date(mergedMetadata[id]?.completedAt || Date.now()).toISOString();
      }
      return row;
    });

    if (rows.length) {
      const freshUser = await getCloudUser();
      if (!freshUser || freshUser.id !== ownerId || getProgressOwner() !== ownerId || getProgressScopeVersion() !== capturedVersion) return readProgress();
      const { error: upsertError } = await supabase
        .from('user_lesson_progress')
        .upsert(rows, { onConflict: 'user_id,lesson_id' });
      if (upsertError) throw upsertError;
    }

    return merged;
  } catch (error) {
    console.warn('Using offline lesson progress until cloud sync is available.', error);
    return readProgress();
    }
  })();

  syncByOwner.set(syncKey, sync);
  try { return await sync; }
  finally { syncByOwner.delete(syncKey); }
}

/** Call once on app mount. Syncs immediately if a session/connection is
 * available, and retries on the browser's 'online' event — both paths
 * gracefully no-op if there's no signed-in user or no connectivity. */
export function initSync(onSynced?: (store: ProgressStore, ready: boolean) => void): () => void {
  let syncGeneration = 0;
  let readinessTimeout: number | undefined;
  const sync = async () => {
    const generation = ++syncGeneration;
    window.clearTimeout(readinessTimeout);
    readinessTimeout = window.setTimeout(() => {
      if (generation !== syncGeneration) return;
      onSynced?.(readProgress(), true);
    }, 2500);
    const store = await syncAllToCloud();
    if (generation !== syncGeneration) return;
    window.clearTimeout(readinessTimeout);
    onSynced?.(store, true);
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.storageArea !== localStorage || event.key !== getProgressStorageKey()) return;
    onSynced?.(readProgress(), true);
  };
  void sync();
  window.addEventListener('online', sync);
  window.addEventListener('storage', handleStorage);
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      syncGeneration += 1;
      window.clearTimeout(readinessTimeout);
      clearProgressOwner();
      onSynced?.(readProgress(), true);
      return;
    }
    if (event === 'SIGNED_IN') {
      if (session?.user?.id && getProgressOwner() !== session.user.id) {
        clearProgressOwner();
        onSynced?.(readProgress(), false);
      }
      void sync();
    }
  });
  return () => {
    syncGeneration += 1;
    window.clearTimeout(readinessTimeout);
    window.removeEventListener('online', sync);
    window.removeEventListener('storage', handleStorage);
    data.subscription.unsubscribe();
  };
}
