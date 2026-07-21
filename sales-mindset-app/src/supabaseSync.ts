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
import { readProgress, writeProgress, type LessonMeta, type ProgressStore } from './progress';

const SUPABASE_URL = 'https://dsuahpcqrrlbudomjrye.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Yj-VkkJDCOE26_HYmwsP-w_XNBwJlb1';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getCloudUser() {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user ?? null;
  } catch {
    return null;
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
    const user = await getCloudUser();
    if (!user) return false;

    const payload: Record<string, unknown> = {
      user_id: user.id,
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

let syncInProgress = false;

/** Full merge: reads cloud + local, unions completion, pushes anything the
 * cloud is missing. Idempotent (upsert on user_id+lesson_id) and guarded
 * against overlapping calls, matching assets/journey-progress.js. */
export async function syncAllToCloud(): Promise<ProgressStore> {
  if (syncInProgress) return readProgress();
  syncInProgress = true;
  try {
    const user = await getCloudUser();
    if (!user) return readProgress();

    const { data: cloudRows, error } = await supabase
      .from('user_lesson_progress')
      .select('lesson_id,completed_at,metadata,updated_at');
    if (error) throw error;

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

    const rows = Object.keys(metadata).map((id) => {
      const row: Record<string, unknown> = {
        user_id: user.id,
        lesson_id: id,
        metadata: metadata[id] || {},
        updated_at: new Date().toISOString(),
      };
      if (completed.has(id)) {
        row.completed_at = new Date(metadata[id]?.completedAt || Date.now()).toISOString();
      }
      return row;
    });

    if (rows.length) {
      const { error: upsertError } = await supabase
        .from('user_lesson_progress')
        .upsert(rows, { onConflict: 'user_id,lesson_id' });
      if (upsertError) throw upsertError;
    }

    return merged;
  } catch (error) {
    console.warn('Using offline lesson progress until cloud sync is available.', error);
    return readProgress();
  } finally {
    syncInProgress = false;
  }
}

/** Call once on app mount. Syncs immediately if a session/connection is
 * available, and retries on the browser's 'online' event — both paths
 * gracefully no-op if there's no signed-in user or no connectivity. */
export function initSync(): void {
  syncAllToCloud();
  window.addEventListener('online', () => {
    syncAllToCloud();
  });
}
