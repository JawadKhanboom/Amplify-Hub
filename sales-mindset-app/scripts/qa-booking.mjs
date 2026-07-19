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
  server: { host: '127.0.0.1', port: 4174, strictPort: false },
});
await server.listen();
const baseUrl = server.resolvedUrls?.local[0];
if (!baseUrl) throw new Error('Vite did not expose a local URL.');

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--disable-gpu', '--disable-breakpad', '--no-first-run'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await page.goto(`${baseUrl}book-appointments.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  assert.equal(await page.locator('h1').innerText(), 'Appointment Setting');
  assert.equal(await page.locator('.section').count(), 20, 'renders every ordered lesson block');
  assert.match(await page.locator('.eyebrow').first().innerText(), /^1-4/);
  assert.match(await page.locator('.eyebrow').last().innerText(), /^24/);
  assert.equal(await page.locator('.q-item').count(), 10, 'renders ten quiz questions');

  const answers = [1, 0, 2, 1, 1, 1, 1, 1, 2, 0];
  for (const [question, answer] of answers.entries()) {
    await page.locator(`.qopt[data-qi="${question}"][data-oi="${answer}"]`).click();
  }
  await page.locator('#checkQuiz').click();
  assert.equal(await page.locator('#quizScore').innerText(), 'Score: 10/10');

  await page.getByRole('button', { name: 'Mark as Complete' }).click();
  const progress = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('amplifyHub_journeyProgress') ?? '{}'),
  );
  assert.ok(progress.completedLessons.includes('m6l0'), 'persists appointment-setting completion');
  assert.equal(progress.lessonMeta.m6l0.quizScore, '10/10', 'persists quiz score');
  assert.equal(progress.totalLessons, 40, 'uses the consolidated 40-lesson journey total');

  await page.screenshot({ path: path.join(appDir, 'qa-booking-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#menuBtn').click();
  assert.ok(await page.locator('#sidebar').evaluate((node) => node.classList.contains('open')));
  assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'), 'true');
  await page.screenshot({ path: path.join(appDir, 'qa-booking-mobile.png'), fullPage: false });

  const journeySource = await readFile(path.join(siteRoot, 'journey.html'), 'utf8');
  assert.match(
    journeySource,
    /lessons:\['Appointment Setting'\],[\s\S]*?pages:\['book-appointments\.html'\]/,
    'connects the consolidated lesson from Journey',
  );

  assert.deepEqual(pageErrors, [], `browser errors: ${pageErrors.join(', ')}`);
  console.log('Booking QA passed: content, quiz, progress, mobile menu, and Journey route.');
} finally {
  await browser.close();
  await server.close();
}
