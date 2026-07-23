import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

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

if (!chromePath) {
  throw new Error('Chrome or Edge was not found. Set CHROME_PATH to run browser QA.');
}

const server = await preview({
  preview: { host: '127.0.0.1', port: 4173, strictPort: false },
});
const baseUrl = server.resolvedUrls?.local[0];

if (!baseUrl) {
  server.httpServer.close();
  throw new Error('Vite preview did not expose a local URL.');
}

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--disable-gpu', '--disable-breakpad', '--no-first-run'],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

// The lesson app is gated: it renders only with a locally persisted Supabase
// session. Seed one (the bundled client restores it without a network call —
// far-future expiry means no refresh attempt) and intercept the auth/REST
// endpoints its verified-owner sync path calls.
const QA_USER = { id: 'qa-user', aud: 'authenticated', email: 'qa@example.com', user_metadata: { full_name: 'QA User' } };
// Seed before EVERY document load (survives the localStorage.clear()+reload
// below) — without a session the gate redirects, and vite preview's SPA
// fallback would serve the app again in an endless loop.
await page.addInitScript((user) => {
  localStorage.setItem('sb-dsuahpcqrrlbudomjrye-auth-token', JSON.stringify({
    access_token: 'qa-token', refresh_token: 'qa-refresh', token_type: 'bearer',
    expires_in: 3600 * 24 * 365, expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365, user,
  }));
}, QA_USER);
await page.route('**/auth/v1/user**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(QA_USER) }));
await page.route('**/rest/v1/user_lesson_progress**', (route) => route.fulfill({ contentType: 'application/json', body: '[]' }));

try {
  await page.goto(`${baseUrl}#lesson-1`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });

  assert.equal(await page.locator('.lesson-tab').count(), 8, 'renders all lesson tabs');
  assert.match(await page.locator('h1').innerText(), /Sort, Don't Convert/);
  assert.ok(await page.locator('.lesson-content .lcard').count(), 'renders lesson content');

  await page.locator('.lesson-tab').nth(1).click();
  await page.waitForURL(/#lesson-2$/);
  assert.equal(await page.locator('h1').innerText(), 'Rejection is Information');

  await page.locator('.qopt[data-qi="0"][data-oi="1"]').click();
  await page.locator('#checkQuiz').click();
  assert.ok(
    await page.locator('.qopt[data-qi="0"][data-oi="1"]').evaluate((node) =>
      node.classList.contains('correct'),
    ),
    'marks a correct quiz answer',
  );

  await page.getByRole('button', { name: 'Mark as Complete' }).click();
  // Signed-in progress is user-scoped (per-account localStorage key).
  const storedProgress = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('amplifyHub_journeyProgress:v2:user:qa-user') ?? '{}'),
  );
  assert.ok(storedProgress.completedLessons.includes('m0l1'), 'persists completion');
  assert.equal(storedProgress.lessonMeta.m0l1.quizScore, '1/4', 'persists quiz score');

  await page.reload({ waitUntil: 'networkidle' });
  assert.match(await page.locator('.lesson-badge').innerText(), /review mode/i);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.menu-button').click();
  assert.ok(
    await page.locator('.course-sidebar').evaluate((node) => node.classList.contains('open')),
    'opens mobile lesson navigation',
  );

  assert.deepEqual(pageErrors, [], `browser errors: ${pageErrors.join(', ')}`);
  console.log('Browser QA passed: navigation, quiz, persistence, and mobile menu.');
} finally {
  await browser.close();
  await new Promise((resolve, reject) => {
    server.httpServer.close((error) => (error ? reject(error) : resolve()));
  });
}
