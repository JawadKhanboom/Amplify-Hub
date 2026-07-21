// Focused QA for the Task 3 progress-sync changes: the in-flight guard and
// online-retry hook added to assets/journey-progress.js, graceful handling
// with no client/no user, idempotent repeated sync, and the CTA/raw-API
// fixes. Follows the same Playwright-with-mocked-Supabase-CDN pattern used
// by qa-challenges.mjs elsewhere in this suite. Never touches any real or
// local Supabase project — every "backend" call here is a route-intercepted
// in-browser mock.
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appDir, '..');

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
let chromePath = null;
for (const candidate of candidates) {
  try { await access(candidate); chromePath = candidate; break; } catch {}
}
if (!chromePath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH to run this QA.');

const server = await createServer({ root: siteRoot, server: { host: '127.0.0.1', port: 4178, strictPort: false } });
await server.listen();
const baseUrl = server.resolvedUrls?.local[0];
if (!baseUrl) throw new Error('Vite did not expose a local URL.');

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--disable-gpu', '--no-first-run'] });

async function mockSupabaseRoute(page, { user = null, selectData = [], selectDelayMs = 0 } = {}) {
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.fulfill({
    contentType: 'application/javascript',
    body: `
      window.__calls = { select: 0, upsert: 0, getUser: 0 };
      const user = ${JSON.stringify(user)};
      const db = {
        auth: { getUser: async () => { window.__calls.getUser++; return { data: { user } }; } },
        from: () => ({
          select: async () => {
            window.__calls.select++;
            ${selectDelayMs ? `await new Promise(r => setTimeout(r, ${selectDelayMs}));` : ''}
            return { data: ${JSON.stringify(selectData)}, error: null };
          },
          upsert: async (rows, opts) => { window.__calls.upsert++; window.__lastUpsert = { rows, opts }; return { error: null }; },
        }),
      };
      window.supabase = { createClient: () => db };
    `,
  }));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
}

const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, pass: true }); }
  catch (err) { results.push({ name, pass: false, error: err.stack || err.message }); }
}

await test('graceful behavior with no Supabase client', async () => {
  const page = await browser.newPage();
  // Simulates the CDN being unreachable (ad-blocker, network hiccup). This
  // does make auth-config.js throw (a separate, expected failure mode, not
  // what this test is about) — what matters here is that journey-progress.js
  // still loads and its own functions resolve cleanly with no client ever set.
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.abort());
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.goto(`${baseUrl}mastery-1.html`, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(() => window.AmplifyJourneyProgress.syncWithCloud());
  assert.ok(Array.isArray(result.completedLessons), 'syncWithCloud should still resolve to a valid progress shape');
  await page.close();
});

await test('graceful behavior with no authenticated user', async () => {
  const page = await browser.newPage();
  await mockSupabaseRoute(page, { user: null });
  await page.goto(`${baseUrl}mastery-1.html`, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(() => window.AmplifyJourneyProgress.syncWithCloud());
  const calls = await page.evaluate(() => window.__calls);
  assert.ok(Array.isArray(result.completedLessons));
  assert.equal(calls.select, 0, 'should never attempt a select when there is no authenticated user');
  await page.close();
});

await test('in-flight guard prevents duplicate concurrent syncs', async () => {
  const page = await browser.newPage();
  await mockSupabaseRoute(page, { user: { id: 'user-a' }, selectData: [], selectDelayMs: 150 });
  await page.goto(`${baseUrl}mastery-1.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => Promise.all([
    window.AmplifyJourneyProgress.syncWithCloud(),
    window.AmplifyJourneyProgress.syncWithCloud(),
  ]));
  const calls = await page.evaluate(() => window.__calls);
  assert.equal(calls.select, 1, `expected exactly 1 select call from 2 concurrent syncWithCloud() calls, got ${calls.select}`);
  await page.close();
});

await test('online event triggers a retry sync', async () => {
  const page = await browser.newPage();
  await mockSupabaseRoute(page, { user: { id: 'user-a' }, selectData: [] });
  await page.goto(`${baseUrl}mastery-1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(150); // let the page-load auto-sync settle
  const before = await page.evaluate(() => window.__calls.select);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.__calls.select);
  assert.ok(after > before, `expected an additional select call after 'online' fired (before=${before}, after=${after})`);
  await page.close();
});

await test('idempotent repeated full sync (no duplicate ids, stable completedAt)', async () => {
  const page = await browser.newPage();
  await mockSupabaseRoute(page, { user: { id: 'user-a' }, selectData: [] });
  await page.goto(`${baseUrl}mastery-1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(50); // let the page-load auto-sync finish first
  await page.evaluate(() => window.AmplifyJourneyProgress.markLessonComplete(9, 0, { mins: 3 }));
  const first = await page.evaluate(() => window.AmplifyJourneyProgress.syncWithCloud());
  await page.waitForTimeout(20);
  const second = await page.evaluate(() => window.AmplifyJourneyProgress.syncWithCloud());
  assert.equal(second.completedLessons.filter(id => id === 'm9l0').length, 1, 'lesson id must not duplicate across repeated syncs');
  assert.equal(first.lessonMeta.m9l0.completedAt, second.lessonMeta.m9l0.completedAt, 'completedAt must stay stable across repeated syncs');
  await page.close();
});

await test('book-appointments.html uses the wrapped API, not raw writeProgress', async () => {
  const src = await readFile(path.join(siteRoot, 'book-appointments.html'), 'utf8');
  assert.match(src, /AJP\.markLessonComplete\(/);
  assert.match(src, /AJP\.recordLessonMeta\(/);
  assert.doesNotMatch(src, /AJP\.writeProgress\(/);
});

await test('sales-mindset-8.html uses the wrapped API, not raw writeProgress', async () => {
  const src = await readFile(path.join(siteRoot, 'sales-mindset-8.html'), 'utf8');
  assert.match(src, /AJP\.markLessonComplete\(/);
  assert.match(src, /AJP\.recordLessonMeta\(/);
  assert.doesNotMatch(src, /AJP\.writeProgress\(/);
});

await test('journey.html CTA routes through mod.pages before falling back to placeholder view', async () => {
  const src = await readFile(path.join(siteRoot, 'journey.html'), 'utf8');
  const ctaMatch = src.match(/document\.querySelector\('\.h-cta'\)\.addEventListener\('click', \(\)=>\{[\s\S]*?\n\}\);/);
  assert.ok(ctaMatch, 'CTA click handler not found');
  assert.match(ctaMatch[0], /if\(mod\.pages\)\{/);
  assert.match(ctaMatch[0], /window\.location\.href = mod\.pages\[li\];/);
});

await test('supabaseSync.ts derives the user from an authenticated session and upserts with onConflict', async () => {
  const src = await readFile(path.join(appDir, 'src', 'supabaseSync.ts'), 'utf8');
  assert.match(src, /supabase\.auth\.getUser\(\)/, 'must derive the user from the authenticated session');
  assert.match(src, /onConflict:\s*'user_id,lesson_id'/, 'must upsert with the same conflict target as the static site');
  assert.doesNotMatch(src, /service_role/i, 'must never reference a service-role key');
});

await browser.close();
await server.close();

console.log('\n=== Progress-sync focused test results ===');
let failed = 0;
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}: ${r.name}${r.pass ? '' : '\n       ' + r.error}`);
  if (!r.pass) failed++;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
if (failed > 0) process.exit(1);
