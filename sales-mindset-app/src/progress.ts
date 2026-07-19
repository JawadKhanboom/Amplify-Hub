const STORAGE_KEY = 'amplifyHub_journeyProgress';

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

export const readProgress = (): ProgressStore => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return emptyStore();

    const parsed = JSON.parse(value) as Partial<ProgressStore>;
    return {
      ...parsed,
      completedLessons: Array.isArray(parsed.completedLessons)
        ? parsed.completedLessons.filter((item): item is string => typeof item === 'string')
        : [],
      lessonMeta: parsed.lessonMeta ?? {},
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
  const completed = new Set(completedLessons);
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
    lessonMeta,
    updatedAt: Date.now(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  return store;
};
