import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { lessons, parseLesson } from './lessons';
import { readProgress, writeProgress, type LessonMeta } from './progress';
import { initSync, syncLessonToCloud } from './supabaseSync';

interface QuizState {
  selections: Record<number, number>;
  checked: boolean;
}

type QuizStateByLesson = Record<number, QuizState>;

const getLessonFromHash = (): number => {
  const match = window.location.hash.match(/^#lesson-(\d+)$/);
  const lessonNumber = Number(match?.[1] ?? 1);
  return Math.min(Math.max(lessonNumber - 1, 0), lessons.length - 1);
};

const getQuizScore = (state: QuizState, answers: readonly number[]): string | null => {
  if (!state.checked) return null;
  const correct = answers.filter((answer, index) => state.selections[index] === answer).length;
  return `${correct}/${answers.length}`;
};

function App() {
  const initialProgress = useMemo(readProgress, []);
  const [currentIndex, setCurrentIndex] = useState(getLessonFromHash);
  const [completed, setCompleted] = useState(
    () => new Set(initialProgress.completedLessons),
  );
  const [lessonMeta, setLessonMeta] = useState<Record<string, LessonMeta>>(
    () => initialProgress.lessonMeta ?? {},
  );
  const [quizStates, setQuizStates] = useState<QuizStateByLesson>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const lessonStartedAt = useRef(Date.now());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const lesson = lessons[currentIndex];
  const parsedLesson = useMemo(() => parseLesson(lesson.source), [lesson.source]);
  const quizState = quizStates[currentIndex] ?? { selections: {}, checked: false };
  const completedCount = lessons.filter(({ id }) => completed.has(id)).length;
  const isComplete = completed.has(lesson.id);
  const progressPercent = (completedCount / lessons.length) * 100;

  const navigateTo = (index: number, replace = false) => {
    const nextIndex = Math.min(Math.max(index, 0), lessons.length - 1);
    const nextHash = `#lesson-${nextIndex + 1}`;
    window.history[replace ? 'replaceState' : 'pushState'](null, '', nextHash);
    lessonStartedAt.current = Date.now();
    setCurrentIndex(nextIndex);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!window.location.hash) navigateTo(0, true);

    const syncFromUrl = () => {
      lessonStartedAt.current = Date.now();
      setCurrentIndex(getLessonFromHash());
      setSidebarOpen(false);
    };

    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  // Cloud sync is additive to the localStorage read above — this only ever
  // pulls in/pushes out progress, never blocks or replaces the local state
  // already loaded into initialProgress.
  useEffect(() => {
    initSync();
  }, []);

  useEffect(() => {
    document.title = `${lesson.title} | AmplifyHub`;
    headingRef.current?.focus({ preventScroll: true });
  }, [lesson.title]);

  useEffect(() => {
    const wrapper = contentRef.current;
    if (!wrapper) return;

    wrapper.querySelectorAll<HTMLElement>('.qopt').forEach((option) => {
      const questionIndex = Number(option.dataset.qi);
      const optionIndex = Number(option.dataset.oi);
      const selected = quizState.selections[questionIndex] === optionIndex;
      const correct = quizState.checked && selected && lesson.answers[questionIndex] === optionIndex;
      const wrong = quizState.checked && selected && lesson.answers[questionIndex] !== optionIndex;
      const input = option.querySelector<HTMLInputElement>('input[type="radio"]');

      if (input) input.checked = selected;
      option.classList.toggle('correct', correct);
      option.classList.toggle('wrong', wrong);
    });

    wrapper.querySelectorAll<HTMLElement>('.q-item').forEach((question, questionIndex) => {
      const feedback = question.querySelector<HTMLElement>('.q-fb');
      if (!feedback) return;

      const selection = quizState.selections[questionIndex];
      if (!quizState.checked || selection === undefined) {
        feedback.textContent = '';
        feedback.removeAttribute('style');
        return;
      }

      const correct = selection === lesson.answers[questionIndex];
      feedback.textContent = correct ? '✓ Correct!' : '✕ Try again';
      feedback.style.color = correct ? 'var(--green)' : 'var(--red)';
    });
  }, [lesson.answers, parsedLesson.content, quizState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, button, a, summary')) return;
      if (event.key === 'ArrowLeft' && currentIndex > 0) navigateTo(currentIndex - 1);
      if (event.key === 'ArrowRight' && currentIndex < lessons.length - 1) {
        navigateTo(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const persistQuizScore = (state: QuizState) => {
    const quizScore = getQuizScore(state, lesson.answers);
    if (!quizScore) return;

    const nextMeta = {
      ...lessonMeta,
      [lesson.id]: { ...lessonMeta[lesson.id], quizScore },
    };

    try {
      writeProgress(completed, nextMeta);
      setLessonMeta(nextMeta);
      syncLessonToCloud(lesson.id, nextMeta[lesson.id], completed.has(lesson.id));
    } catch (error) {
      console.error('Unable to save quiz progress.', error);
      setToast('Progress could not be saved in this browser.');
    }
  };

  const handleContentClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const option = target.closest<HTMLElement>('.qopt');

    if (option) {
      event.preventDefault();
      const questionIndex = Number(option.dataset.qi);
      const optionIndex = Number(option.dataset.oi);
      if (!Number.isInteger(questionIndex) || !Number.isInteger(optionIndex)) return;

      setQuizStates((current) => ({
        ...current,
        [currentIndex]: {
          selections: {
            ...(current[currentIndex]?.selections ?? {}),
            [questionIndex]: optionIndex,
          },
          checked: false,
        },
      }));
      return;
    }

    if (target.closest('#checkQuiz')) {
      event.preventDefault();
      const checkedState = { ...quizState, checked: true };
      setQuizStates((current) => ({ ...current, [currentIndex]: checkedState }));
      persistQuizScore(checkedState);
    }
  };

  const markComplete = () => {
    if (isComplete) return;

    const nextCompleted = new Set(completed).add(lesson.id);
    const quizScore = getQuizScore(quizState, lesson.answers) ?? lessonMeta[lesson.id]?.quizScore;
    const nextMeta = {
      ...lessonMeta,
      [lesson.id]: {
        ...lessonMeta[lesson.id],
        mins: Math.max(1, Math.round((Date.now() - lessonStartedAt.current) / 60_000)),
        quizScore,
        completedAt: Date.now(),
      },
    };

    try {
      writeProgress(nextCompleted, nextMeta);
      setCompleted(nextCompleted);
      setLessonMeta(nextMeta);
      setToast(`Lesson ${lesson.number} complete · +${lesson.xp} XP`);
      syncLessonToCloud(lesson.id, nextMeta[lesson.id], true);
    } catch (error) {
      console.error('Unable to save lesson completion.', error);
      setToast('Progress could not be saved in this browser.');
    }
  };

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <a className="brand" href="../dashboard.html" aria-label="AmplifyHub dashboard">
          Amplify<span>Hub</span>
        </a>
        <button
          className="menu-button"
          type="button"
          aria-expanded={sidebarOpen}
          aria-controls="course-navigation"
          onClick={() => setSidebarOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span>
          <span className="sr-only">Toggle lesson navigation</span>
        </button>
      </header>

      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="Close lesson navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside id="course-navigation" className={`course-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div>
          <a className="brand" href="../dashboard.html" aria-label="AmplifyHub dashboard">
            Amplify<span>Hub</span>
          </a>
          <a className="back-link" href="../journey.html">← Back to Journey</a>
        </div>

        <div className="course-summary">
          <span className="eyebrow">Module 1</span>
          <h2>Sales Mindset</h2>
          <p>{completedCount} of {lessons.length} lessons complete</p>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Module completion"
            aria-valuemin={0}
            aria-valuemax={lessons.length}
            aria-valuenow={completedCount}
          >
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <nav aria-label="Sales mindset lessons">
          <ol className="lesson-list">
            {lessons.map((item, index) => {
              const active = index === currentIndex;
              const done = completed.has(item.id);
              return (
                <li key={item.id}>
                  <button
                    className={`lesson-tab${active ? ' active' : ''}${done ? ' completed' : ''}`}
                    type="button"
                    aria-current={active ? 'step' : undefined}
                    onClick={() => navigateTo(index)}
                  >
                    <span className="step-number" aria-hidden="true">{done ? '✓' : item.number}</span>
                    <span>
                      <strong>{item.shortTitle}</strong>
                      <small>{item.duration}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </aside>

      <main className="lesson-main">
        <div className="lesson-header">
          <div className="lesson-badge">
            Sales Mindset · Lesson {lesson.number} of {lessons.length}
            {isComplete && ' · ↻ Review Mode'}
          </div>
          <h1 ref={headingRef} className="lesson-title" tabIndex={-1}>{lesson.title}</h1>
          <div className="lesson-meta">
            <span>⏱ {lesson.duration}</span>
            <span>🏆 +{lesson.xp} XP</span>
            <span>📖 Module 1: Sales Mindset</span>
            {lessonMeta[lesson.id]?.quizScore && (
              <span>🧠 Last quiz: {lessonMeta[lesson.id].quizScore}</span>
            )}
          </div>
        </div>

        <div
          ref={contentRef}
          className="lesson-content"
          onClick={handleContentClick}
          dangerouslySetInnerHTML={{ __html: parsedLesson.content }}
        />

        <nav className="bottom-navigation" aria-label="Lesson controls">
          <button
            className="nav-button secondary"
            type="button"
            disabled={currentIndex === 0}
            onClick={() => navigateTo(currentIndex - 1)}
          >
            ← Previous
          </button>
          <button
            className={`nav-button complete${isComplete ? ' done' : ''}`}
            type="button"
            disabled={isComplete}
            onClick={markComplete}
          >
            {isComplete ? '✓ Completed' : 'Mark as Complete'}
          </button>
          {currentIndex < lessons.length - 1 ? (
            <button
              className="nav-button secondary"
              type="button"
              onClick={() => navigateTo(currentIndex + 1)}
            >
              Next →
            </button>
          ) : (
            <a className="nav-button secondary" href="../interview-prep.html">
              Build Portfolio →
            </a>
          )}
        </nav>
      </main>

      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}

export default App;
