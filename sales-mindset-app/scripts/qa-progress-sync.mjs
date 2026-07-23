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

async function mockSupabaseRoute(page, { user = null, getUserDelayMs = 0, selectData = [], selectDelayMs = 0 } = {}) {
  await page.route('**/assets/vendor/supabase-*.min.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `
      window.__calls = { select: 0, upsert: 0, getUser: 0 };
      window.__mockUser = ${JSON.stringify(user)};
      window.__authCallbacks = [];
      window.__emitAuth = (event, session) => window.__authCallbacks.forEach(callback => callback(event, session));
      const db = {
        auth: {
          getUser: async () => {
            window.__calls.getUser++;
            const userAtRequestStart = window.__mockUser;
            ${getUserDelayMs ? `await new Promise(r => setTimeout(r, ${getUserDelayMs}));` : ''}
            return { data: { user: userAtRequestStart } };
          },
          onAuthStateChange: callback => {
            window.__authCallbacks.push(callback);
            return { data: { subscription: { unsubscribe: () => {} } } };
          },
        },
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
  // Simulates the vendored supabase-js failing to load (blocked request or
  // deploy hiccup). This does make auth-config.js throw (a separate, expected
  // failure mode, not what this test is about) — what matters here is that
  // journey-progress.js still loads and resolves cleanly with no client set.
  await page.route('**/assets/vendor/supabase-*.min.js', route => route.abort());
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

await test('static lesson UI refreshes after verified cloud progress arrives', async () => {
  const page = await browser.newPage();
  await mockSupabaseRoute(page, {
    user: { id: 'user-a' },
    selectData: [{ lesson_id: 'm9l0', completed_at: new Date().toISOString(), metadata: {}, updated_at: new Date().toISOString() }],
  });
  await page.goto(`${baseUrl}mastery-1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('completeBtn')?.classList.contains('done'));
  assert.match(await page.locator('#completeBtn').textContent(), /Completed/);
  await page.close();
});

await test('delayed A lesson sync cannot upload after switching to B', async () => {
  const page = await browser.newPage();
  await mockSupabaseRoute(page, { user: { id: 'user-a' }, getUserDelayMs: 150, selectData: [] });
  await page.goto(`${baseUrl}mastery-1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    window.AmplifyJourneyProgress.markLessonComplete(9, 0, { mins: 3 });
    window.AmplifyJourneyProgress.clearOwner();
    window.__mockUser = { id: 'user-b' };
    window.AmplifyJourneyProgress.setOwner('user-b', true);
  });
  await page.waitForTimeout(250);
  const result = await page.evaluate(() => ({
    calls: window.__calls,
    b: window.AmplifyJourneyProgress.readProgress(),
  }));
  assert.equal(result.calls.upsert, 0, 'stale A request must be discarded before upsert');
  assert.ok(!result.b.completedLessons.includes('m9l0'), 'B cache must not receive A lesson action');
  await page.close();
});

await test('auth event hides A immediately and loads only B progress', async () => {
  const page = await browser.newPage();
  await mockSupabaseRoute(page, { user: { id: 'user-a' }, selectData: [] });
  await page.goto(`${baseUrl}mastery-1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(100);
  await page.evaluate(() => window.AmplifyJourneyProgress.markLessonComplete(9, 0, { mins: 3 }));
  await page.waitForTimeout(50);

  const duringSwitch = await page.evaluate(() => {
    window.__mockUser = { id: 'user-b' };
    window.__emitAuth('SIGNED_IN', { user: window.__mockUser });
    return {
      owner: window.AmplifyJourneyProgress.getOwner(),
      buttonDone: document.getElementById('completeBtn').classList.contains('done'),
      buttonDisabled: document.getElementById('completeBtn').disabled,
    };
  });
  assert.equal(duringSwitch.owner, null, 'old owner must be cleared synchronously');
  assert.equal(duringSwitch.buttonDone, false, 'A completion must disappear during B verification');
  assert.equal(duringSwitch.buttonDisabled, true, 'lesson actions must be blocked during B verification');

  await page.waitForFunction(() => window.AmplifyJourneyProgress.getOwner() === 'user-b');
  const bStore = await page.evaluate(() => window.AmplifyJourneyProgress.readProgress());
  assert.ok(!bStore.completedLessons.includes('m9l0'), 'B must not inherit A completion');
  assert.equal(await page.locator('#completeBtn').isDisabled(), false, 'lesson actions should resume after B is verified');
  await page.close();
});

await test('user A progress never appears in or uploads to user B', async () => {
  const page = await browser.newPage();
  await mockSupabaseRoute(page, { user: { id: 'user-a' }, selectData: [] });
  await page.goto(`${baseUrl}mastery-1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(100);

  await page.evaluate(() => window.AmplifyJourneyProgress.markLessonComplete(9, 0, { mins: 3 }));
  await page.waitForTimeout(50);
  const keyA = await page.evaluate(() => window.AmplifyJourneyProgress.getStorageKey());
  assert.match(keyA, /user-a$/);

  const userB = await page.evaluate(async () => {
    window.__mockUser = { id: 'user-b' };
    const store = await window.AmplifyJourneyProgress.syncWithCloud();
    return { key: window.AmplifyJourneyProgress.getStorageKey(), store };
  });
  assert.match(userB.key, /user-b$/);
  assert.ok(!userB.store.completedLessons.includes('m9l0'), 'B must not inherit A progress');

  const userA = await page.evaluate(async () => {
    window.__mockUser = { id: 'user-a' };
    const store = await window.AmplifyJourneyProgress.syncWithCloud();
    return { key: window.AmplifyJourneyProgress.getStorageKey(), store };
  });
  assert.match(userA.key, /user-a$/);
  assert.ok(userA.store.completedLessons.includes('m9l0'), 'A must retain A progress');
  await page.close();
});

await test('legacy browser progress is quarantined and requires explicit import', async () => {
  const page = await browser.newPage();
  await mockSupabaseRoute(page, { user: { id: 'user-b' }, selectData: [] });
  await page.addInitScript(() => {
    localStorage.setItem('amplifyHub_journeyProgress', JSON.stringify({
      completedLessons: ['m2l0'],
      lessonMeta: { m2l0: { mins: 4 } },
    }));
  });
  await page.goto(`${baseUrl}mastery-1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(100);

  const beforeImport = await page.evaluate(() => ({
    store: window.AmplifyJourneyProgress.readProgress(),
    hasLegacy: window.AmplifyJourneyProgress.hasLegacyProgress(),
    oldKey: localStorage.getItem('amplifyHub_journeyProgress'),
  }));
  assert.ok(!beforeImport.store.completedLessons.includes('m2l0'), 'legacy progress must not auto-attach to B');
  assert.equal(beforeImport.hasLegacy, true);
  assert.equal(beforeImport.oldKey, null);

  const imported = await page.evaluate(() => window.AmplifyJourneyProgress.importLegacyProgress());
  assert.ok(imported.completedLessons.includes('m2l0'), 'verified explicit import should recover legacy progress');
  assert.equal(await page.evaluate(() => window.AmplifyJourneyProgress.hasLegacyProgress()), false);
  await page.close();
});

await test('keeping recovery data hides it only for the current account', async () => {
  const page = await browser.newPage();
  await mockSupabaseRoute(page, { user: { id: 'user-b' }, selectData: [] });
  await page.addInitScript(() => {
    localStorage.setItem('amplifyHub_journeyProgress', JSON.stringify({
      completedLessons: ['m2l0'],
      lessonMeta: { m2l0: { mins: 4 } },
    }));
  });
  await page.goto(`${baseUrl}mastery-1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(100);
  const result = await page.evaluate(async () => {
    window.AmplifyJourneyProgress.dismissRecovery('legacy');
    const hiddenForB = window.AmplifyJourneyProgress.hasLegacyProgress();
    const preserved = localStorage.getItem('amplifyHub_journeyProgress:legacy:v1');
    window.AmplifyJourneyProgress.clearOwner();
    window.__mockUser = { id: 'user-c' };
    await window.AmplifyJourneyProgress.syncWithCloud();
    return { hiddenForB, preserved, visibleForC: window.AmplifyJourneyProgress.hasLegacyProgress() };
  });
  assert.equal(result.hiddenForB, false);
  assert.ok(result.preserved, 'Keep for another account must preserve the quarantined recovery copy');
  assert.equal(result.visibleForC, true, 'another verified account must still be offered the recovery data');
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

await test('recovery import: current fields win on overlap, source-only fields survive', async () => {
  const page = await browser.newPage();
  await mockSupabaseRoute(page, { user: { id: 'user-b' }, selectData: [] });
  await page.addInitScript(() => {
    localStorage.setItem('amplifyHub_journeyProgress', JSON.stringify({
      completedLessons: ['m2l0'],
      lessonMeta: { m2l0: { mins: 4, quizScore: '3/4' } },
    }));
  });
  await page.goto(`${baseUrl}mastery-1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.AmplifyJourneyProgress.getOwner() === 'user-b');

  // The signed-in account has its own fresher value for one overlapping field.
  await page.evaluate(() => window.AmplifyJourneyProgress.recordLessonMeta(2, 0, { mins: 9 }));
  const imported = await page.evaluate(() => window.AmplifyJourneyProgress.importLegacyProgress());
  assert.ok(imported.completedLessons.includes('m2l0'), 'source completion must be recovered');
  assert.equal(imported.lessonMeta.m2l0.mins, 9, 'current account value must win over the recovered value for the same field');
  assert.equal(imported.lessonMeta.m2l0.quizScore, '3/4', 'source-only fields must survive the merge');
  await page.close();
});

await test('book-appointments.html refreshes to Completed when verified cloud progress arrives', async () => {
  const page = await browser.newPage();
  await mockSupabaseRoute(page, {
    user: { id: 'user-a' },
    selectData: [{ lesson_id: 'm6l0', completed_at: new Date().toISOString(), metadata: {}, updated_at: new Date().toISOString() }],
  });
  await page.goto(`${baseUrl}book-appointments.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('completeBtn')?.classList.contains('done'));
  assert.match(await page.locator('#completeBtn').textContent(), /Completed/);
  assert.equal(await page.locator('#completeBtn').isDisabled(), true, 'a completed lesson must not be re-completable');
  await page.close();
});

await test('sales-mindset-8.html flips into Review Mode when verified cloud progress arrives', async () => {
  const page = await browser.newPage();
  await mockSupabaseRoute(page, {
    user: { id: 'user-a' },
    selectData: [{ lesson_id: 'm0l7', completed_at: new Date().toISOString(), metadata: {}, updated_at: new Date().toISOString() }],
  });
  await page.goto(`${baseUrl}sales-mindset-8.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (document.querySelector('.lesson-badge')?.textContent || '').includes('Review Mode'));
  assert.ok(
    (await page.locator('#completeBtn').textContent()).includes('Completed'),
    'the complete button must reflect the cloud completion alongside the Review Mode badge',
  );
  await page.close();
});

await test('sidebar name/avatar switch from A to B on an auth change', async () => {
  const page = await browser.newPage();
  await mockSupabaseRoute(page, { user: { id: 'user-a', user_metadata: { full_name: 'Alice Anders' } } });
  await page.goto(`${baseUrl}contact.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.sb-uname')?.textContent === 'Alice Anders');
  assert.equal(await page.locator('.sb-avatar').first().textContent(), 'A');

  await page.evaluate(() => {
    window.__mockUser = { id: 'user-b', user_metadata: { full_name: 'Bilal Khan' } };
    window.__emitAuth('SIGNED_IN', { user: window.__mockUser });
  });
  await page.waitForFunction(() => document.querySelector('.sb-uname')?.textContent === 'Bilal Khan');
  assert.equal(await page.locator('.sb-avatar').first().textContent(), 'B', 'avatar initial must switch with the account');
  await page.close();
});

await test('supabaseSync.ts guards every stale path with generation/scope re-checks', async () => {
  const src = await readFile(path.join(appDir, 'src', 'supabaseSync.ts'), 'utf8');
  // initSync must tag each run and discard results from a superseded run.
  assert.match(src, /const generation = \+\+syncGeneration/, 'each sync run must capture its own generation');
  assert.match(src, /if \(generation !== syncGeneration\) return/, 'stale sync completions must be discarded');
  // Signing out (and disposing) must invalidate any in-flight run.
  assert.match(src, /syncGeneration \+= 1/, 'SIGNED_OUT/dispose must bump the generation to orphan in-flight runs');
  // The full merge must re-validate owner + scope version after every await
  // before it writes locally or upserts to the cloud.
  assert.match(src, /getProgressScopeVersion\(\) !== startingVersion\) return readProgress\(\)/, 'owner resolution must abort on scope change');
  assert.match(src, /getProgressOwner\(\) !== ownerId \|\| getProgressScopeVersion\(\) !== capturedVersion\) return readProgress\(\)/, 'post-select stale scope must abort before local write');
  assert.match(src, /freshUser\.id !== ownerId/, 'the upload must re-verify the session user right before upsert');
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
