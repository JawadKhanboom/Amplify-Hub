const LEGACY_STORAGE_KEY = 'amplifyHub_journeyProgress';
const LEGACY_QUARANTINE_KEY = 'amplifyHub_journeyProgress:legacy:v1';
const USER_STORAGE_PREFIX = 'amplifyHub_journeyProgress:v2:user:';
const ANONYMOUS_STORAGE_KEY = 'amplifyHub_journeyProgress:v2:anonymous';

let activeOwnerId: string | null = null;
let progressScopeVersion = 0;

export const setProgressOwner = (userId: string | null): void => {
  const nextOwner = typeof userId === 'string' && userId ? userId : null;
  if (activeOwnerId === nextOwner) return;
  activeOwnerId = nextOwner;
  progressScopeVersion += 1;
};

export const clearProgressOwner = (): void => {
  activeOwnerId = null;
  progressScopeVersion += 1;
};

export const getProgressOwner = (): string | null => activeOwnerId;
export const getProgressScopeVersion = (): number => progressScopeVersion;

export const getProgressStorageKey = (): string => activeOwnerId
  ? `${USER_STORAGE_PREFIX}${encodeURIComponent(activeOwnerId)}`
  : ANONYMOUS_STORAGE_KEY;

const activeStorage = (): Storage => activeOwnerId ? localStorage : sessionStorage;

export const hasUnassignedProgress = (): boolean => {
  if (!activeOwnerId) return false;
  const hasData = (value: string | null): boolean => {
    if (!value) return false;
    try {
      const parsed = JSON.parse(value) as Partial<ProgressStore>;
      return Boolean(
        (Array.isArray(parsed.completedLessons) && parsed.completedLessons.some(
          (id) => typeof id === 'string' && isValidLessonId(id),
        )) || Object.keys(parsed.lessonMeta ?? {}).some(isValidLessonId),
      );
    } catch {
      return false;
    }
  };
  return hasData(sessionStorage.getItem(ANONYMOUS_STORAGE_KEY))
    || hasData(localStorage.getItem(LEGACY_QUARANTINE_KEY));
};

const quarantineLegacyProgress = (): void => {
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return;
    JSON.parse(legacy);
    if (!localStorage.getItem(LEGACY_QUARANTINE_KEY)) {
      localStorage.setItem(LEGACY_QUARANTINE_KEY, legacy);
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    console.warn('Older journey progress could not be quarantined safely.');
  }
};

quarantineLegacyProgress();

const MODULE_MAP = [
  ['Sales Mindset', 8],
  ['Finding Prospects', 3],
  ['Building Your Script', 4],
  ['Opening the Call', 4],
  ['Discovery Questions', 4],
  ['Objection Handling', 5],
  ['Booking Appointments', 1],
  ['Follow-up', 3],
  ['Live Practice', 4],
  ['Mastery', 4],
] as const;

export interface LessonMeta {
  mins?: number;
  quizScore?: string | null;
  completedAt?: number;
}

export interface ProgressStore {
  completedLessons: string[];
  overallProgress?: number;
  lessonsCompleted?: number;
  totalLessons?: number;
  currentModuleName?: string;
  lessonMeta?: Record<string, LessonMeta>;
  updatedAt?: number;
}

const emptyStore = (): ProgressStore => ({ completedLessons: [], lessonMeta: {} });

const isValidLessonId = (id: string): boolean => {
  const match = /^m(\d+)l(\d+)$/.exec(id);
  if (!match) return false;
  const moduleIndex = Number(match[1]);
  const lessonIndex = Number(match[2]);
  return Boolean(MODULE_MAP[moduleIndex]) && lessonIndex >= 0 && lessonIndex < MODULE_MAP[moduleIndex][1];
};

export const readProgress = (): ProgressStore => {
  try {
    const value = activeStorage().getItem(getProgressStorageKey());
    if (!value) return emptyStore();

    const parsed = JSON.parse(value) as Partial<ProgressStore>;
    const lessonMeta = Object.fromEntries(
      Object.entries(parsed.lessonMeta ?? {}).filter(([id, value]) =>
        isValidLessonId(id) && Boolean(value) && typeof value === 'object' && !Array.isArray(value)),
    );
    return {
      ...parsed,
      completedLessons: Array.isArray(parsed.completedLessons)
        ? parsed.completedLessons.filter((item): item is string => typeof item === 'string' && isValidLessonId(item))
        : [],
      lessonMeta,
    };
  } catch (error) {
    console.error('Unable to read lesson progress.', error);
    return emptyStore();
  }
};

export const writeProgress = (
  completedLessons: Iterable<string>,
  lessonMeta: Record<string, LessonMeta>,
): ProgressStore => {
  const completed = new Set([...completedLessons].filter(isValidLessonId));
  const safeLessonMeta = Object.fromEntries(
    Object.entries(lessonMeta).filter(([id, value]) =>
      isValidLessonId(id) && Boolean(value) && typeof value === 'object' && !Array.isArray(value)),
  );
  const totalLessons = MODULE_MAP.reduce((total, [, count]) => total + count, 0);

  let currentModuleName = MODULE_MAP.at(-1)?.[0] ?? 'Mastery';
  for (let moduleIndex = 0; moduleIndex < MODULE_MAP.length; moduleIndex += 1) {
    const [name, lessonCount] = MODULE_MAP[moduleIndex];
    const moduleComplete = Array.from({ length: lessonCount }, (_, lessonIndex) =>
      completed.has(`m${moduleIndex}l${lessonIndex}`),
    ).every(Boolean);

    if (!moduleComplete) {
      currentModuleName = name;
      break;
    }
  }

  const store: ProgressStore = {
    completedLessons: [...completed],
    overallProgress: Math.round((completed.size / totalLessons) * 100),
    lessonsCompleted: completed.size,
    totalLessons,
    currentModuleName,
    lessonMeta: safeLessonMeta,
    updatedAt: Date.now(),
  };

  activeStorage().setItem(getProgressStorageKey(), JSON.stringify(store));
  return store;
};
