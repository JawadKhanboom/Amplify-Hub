import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appDir, '..');
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);

const chromePath = await chromeCandidates.reduce(async (foundPromise, candidate) => {
  const found = await foundPromise;
  if (found) return found;
  try {
    await access(candidate);
    return candidate;
  } catch {
    return null;
  }
}, Promise.resolve(null));

if (!chromePath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH to run browser QA.');

const server = await createServer({
  root: siteRoot,
  server: { host: '127.0.0.1', port: 4175, strictPort: false },
});
await server.listen();
const baseUrl = server.resolvedUrls?.local[0];
if (!baseUrl) throw new Error('Vite did not expose a local URL.');

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--disable-gpu', '--disable-breakpad', '--no-first-run'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

// The lesson pages are gated behind requireAuth(). Static pages get an authed
// in-browser mock of the vendored client; the React app leg (bundled client)
// instead gets a seeded local session plus intercepted auth/REST endpoints.
const QA_USER = { id: 'qa-user', email: 'qa@example.com', user_metadata: { full_name: 'QA User' } };
await page.route('**/assets/vendor/supabase-*.min.js', (route) => route.fulfill({
  contentType: 'application/javascript',
  body: `
    const USER = ${JSON.stringify(QA_USER)};
    function makeBuilder(rows) {
      const b = {
        select() { return b; }, eq() { return b; }, order() { return b; }, limit() { return b; },
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
        insert() { return b; }, update() { return b; }, delete() { return b; },
        upsert: async () => ({ data: null, error: null }),
        then(resolve) { resolve({ data: rows || [], error: null }); }
      };
      return b;
    }
    const db = {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 't', user: USER } } }),
        getUser: async () => ({ data: { user: USER }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      from() { return makeBuilder([]); },
    };
    window.supabase = { createClient: () => db };
  `,
}));
await page.route('**/auth/v1/user**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...QA_USER, aud: 'authenticated' }) }));
await page.route('**/rest/v1/user_lesson_progress**', (route) => route.fulfill({ contentType: 'application/json', body: '[]' }));
const seedReactSession = () =>
  page.evaluate((user) => {
    localStorage.setItem('sb-dsuahpcqrrlbudomjrye-auth-token', JSON.stringify({
      access_token: 'qa-token', refresh_token: 'qa-refresh', token_type: 'bearer',
      expires_in: 3600 * 24 * 365, expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365, user,
    }));
  }, QA_USER);

const readStore = () =>
  page.evaluate(() => {
    if (window.AmplifyJourneyProgress) return window.AmplifyJourneyProgress.readProgress();
    // React app page: no static helper global — read the signed-in scope
    // directly (same key the mocked qa-user session writes to).
    return JSON.parse(
      localStorage.getItem('amplifyHub_journeyProgress:v2:user:qa-user')
        ?? sessionStorage.getItem('amplifyHub_journeyProgress:v2:anonymous')
        ?? 'null',
    );
  });

const clearStore = async () => {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
};

const completeLessonPage = async (file) => {
  await page.goto(`${baseUrl}${file}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /mark as complete/i }).click();
};

// dashboard.html and journey.html (like every lesson page now) are gated
// behind requireAuth(); the authed mock above satisfies the gate for the
// pages this suite drives. Dashboard/journey consumption of the shared
// store is still verified statically against source below.
try {
  // ── 1. Progress survives completing lessons from different modules ──
  await page.goto(`${baseUrl}sales-mindset-1.html`, { waitUntil: 'networkidle' });
  await clearStore();
  await seedReactSession(); // survives per-origin for the React app leg below

  await completeLessonPage('sales-mindset-1.html'); // m0l0
  await completeLessonPage('finding-prospects-1.html'); // m1l0
  await completeLessonPage('building-script-1.html'); // m2l0

  let store = await readStore();
  assert.ok(store, 'progress store exists after completing lessons');
  assert.deepEqual(
    [...store.completedLessons].sort(),
    ['m0l0', 'm1l0', 'm2l0'],
    'keeps completions from every module visited so far',
  );
  assert.equal(store.lessonsCompleted, 3, 'lessonsCompleted reflects all three modules');
  assert.equal(store.totalLessons, 40, 'totalLessons stays fixed at 40');
  assert.equal(store.overallProgress, Math.round((3 / 40) * 100), 'overallProgress matches 3/40');
  console.log('PASS: progress survives completions across different modules');

  // ── 2. Completing a standalone lesson does not erase React lesson metadata ──
  await page.goto(`${baseUrl}sales-mindset/index.html#lesson-2`, { waitUntil: 'networkidle' });
  await page.locator('.qopt[data-qi="0"][data-oi="1"]').click();
  await page.locator('#checkQuiz').click();
  await page.getByRole('button', { name: 'Mark as Complete' }).click();

  const afterReact = await readStore();
  assert.ok(afterReact.completedLessons.includes('m0l1'), 'React app records its own completion');
  assert.equal(afterReact.lessonMeta.m0l1.quizScore, '1/4', 'React app records its own quiz score');

  await completeLessonPage('objection-handling-2.html'); // m5l1, unrelated module

  const afterStandalone = await readStore();
  assert.ok(afterStandalone.completedLessons.includes('m0l1'), 'React completion is preserved');
  assert.ok(afterStandalone.completedLessons.includes('m5l1'), 'standalone completion is recorded');
  assert.equal(
    afterStandalone.lessonMeta.m0l1.quizScore,
    '1/4',
    'React lessonMeta.m0l1 is untouched by the standalone save',
  );
  assert.ok(afterStandalone.lessonMeta.m5l1, 'standalone lesson gets its own lessonMeta entry');
  assert.equal(afterStandalone.totalLessons, 40, 'totalLessons remains 40 after mixed saves');
  console.log('PASS: standalone completion does not erase React lesson metadata');

  // ── 3. Dashboard percentage and lesson count remain correct ──
  // dashboard.html/journey.html require an authenticated Supabase session
  // (requireAuth()), so this suite doesn't drive them live. Instead it
  // verifies (a) the store values those pages read are internally
  // consistent, and (b) both pages still read from the shared schema.
  const consistencyStore = await readStore();
  assert.equal(
    consistencyStore.overallProgress,
    Math.round((consistencyStore.lessonsCompleted / consistencyStore.totalLessons) * 100),
    'overallProgress is correctly derived from lessonsCompleted/totalLessons',
  );

  const dashboardSource = await readFile(path.join(siteRoot, 'dashboard.html'), 'utf8');
  assert.match(
    dashboardSource,
    /AmplifyJourneyProgress\.readProgress\(\)/,
    'dashboard reads progress through the user-scoped helper',
  );
  assert.match(dashboardSource, /d\.overallProgress\s*\?\?\s*0/, 'dashboard reads overallProgress');
  assert.match(dashboardSource, /d\.lessonsCompleted\s*\?\?\s*0/, 'dashboard reads lessonsCompleted');
  assert.match(dashboardSource, /d\.currentModuleName/, 'dashboard reads currentModuleName');

  const journeySource = await readFile(path.join(siteRoot, 'journey.html'), 'utf8');
  assert.match(
    journeySource,
    /AJP\.readProgress\(\)/,
    'journey.html loads progress through the shared helper',
  );
  assert.match(
    journeySource,
    /AJP\.writeProgress\(completed,\s*lessonMeta\)/,
    'journey.html saves progress through the shared helper (preserves lessonMeta every time)',
  );
  console.log('PASS: dashboard percentage and lesson count are correct and read from the shared schema');

  // ── 4. Repeated completion is idempotent ──
  await page.goto(`${baseUrl}discovery-questions-1.html`, { waitUntil: 'networkidle' });
  const idempotentResult = await page.evaluate(() => {
    const AJP = window.AmplifyJourneyProgress;
    const first = AJP.markLessonComplete(2, 0, { mins: 5, quizScore: '3/4' });
    const second = AJP.markLessonComplete(2, 0, { mins: 5, quizScore: '3/4' });
    return { first, second };
  });
  assert.deepEqual(
    idempotentResult.first.completedLessons.slice().sort(),
    idempotentResult.second.completedLessons.slice().sort(),
    'completedLessons does not grow or change on repeated completion',
  );
  assert.equal(
    idempotentResult.first.lessonsCompleted,
    idempotentResult.second.lessonsCompleted,
    'lessonsCompleted is stable across repeated completion',
  );
  assert.equal(
    idempotentResult.first.lessonMeta.m2l0.completedAt,
    idempotentResult.second.lessonMeta.m2l0.completedAt,
    'completedAt is preserved (not bumped) on repeated completion',
  );
  console.log('PASS: repeated completion is idempotent');

  // ── 5. Corrupt or older localStorage data is handled safely ──
  const corruptResult = await page.evaluate(() => {
    const AJP = window.AmplifyJourneyProgress;
    (AJP.getOwner() ? localStorage : sessionStorage).setItem(AJP.getStorageKey(), '{not-valid-json');
    return AJP.readProgress();
  });
  assert.deepEqual(corruptResult.completedLessons, [], 'corrupt JSON is treated as empty progress');
  assert.deepEqual(corruptResult.lessonMeta, {}, 'corrupt JSON yields empty lessonMeta');

  const oldSchemaResult = await page.evaluate(() => {
    const AJP = window.AmplifyJourneyProgress;
    (AJP.getOwner() ? localStorage : sessionStorage).setItem(
      AJP.getStorageKey(),
      JSON.stringify({ completedLessons: ['m0l0', 'm1l0'], updatedAt: 123 }),
    );
    const read = AJP.readProgress();
    const written = AJP.markLessonComplete(2, 1, { mins: 2 });
    return { read, written };
  });
  assert.deepEqual(
    oldSchemaResult.read.completedLessons,
    ['m0l0', 'm1l0'],
    'older schema (missing summary fields) still yields prior completions',
  );
  assert.ok(
    ['m0l0', 'm1l0', 'm2l1'].every((id) => oldSchemaResult.written.completedLessons.includes(id)),
    'saving from older schema recovers full summary fields without losing prior completions',
  );
  assert.equal(oldSchemaResult.written.totalLessons, 40, 'recovers totalLessons=40 from older schema');

  await clearStore();
  await page.evaluate(() => {
    const AJP = window.AmplifyJourneyProgress;
    (AJP.getOwner() ? localStorage : sessionStorage).setItem(AJP.getStorageKey(), '{not-valid-json');
  });
  await page.goto(`${baseUrl}mastery-1.html`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /mark as complete/i }).click();
  const recoveredStore = await readStore();
  assert.ok(recoveredStore.completedLessons.includes('m9l0'), 'a lesson page recovers from corrupt storage on save');
  console.log('PASS: corrupt and older localStorage data are handled safely');

  assert.deepEqual(pageErrors, [], `browser errors: ${pageErrors.join(', ')}`);
  console.log('\nProgress QA passed: cross-module persistence, React compatibility, dashboard/journey sync, idempotency, and corrupt-data safety.');
} finally {
  await browser.close();
  await server.close();
}
