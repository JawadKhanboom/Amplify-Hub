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
  const storedProgress = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('amplifyHub_journeyProgress:v2:anonymous') ?? '{}'),
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
