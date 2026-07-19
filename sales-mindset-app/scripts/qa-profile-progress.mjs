import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appDir, '..');

const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
let chromePath = null;
for (const c of candidates) { try { await access(c); chromePath = c; break; } catch {} }
if (!chromePath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH to run profile/progress QA.');

// ── Relative timestamps so streak/this-week logic is exercised deterministically ──
const dayMs = 24 * 60 * 60 * 1000;
const iso = (offsetDays) => new Date(Date.now() - offsetDays * dayMs).toISOString();

const NEW_USER = {
  user: { id: 'u-new', email: 'newbie@example.com', created_at: iso(2), user_metadata: {} },
  tables: { user_preferences: [], user_lesson_progress: [], coaching_sessions: [], user_challenge_assignments: [], challenge_catalog: [] }
};

const ACTIVE_USER = {
  user: { id: 'u-1', email: 'alex@example.com', created_at: iso(60), user_metadata: { full_name: 'Alex Rivera' } },
  tables: {
    user_preferences: [{ full_name: 'Alex Rivera', username: 'alexr', bio: 'Aspiring SDR, practicing daily.', timezone: 'Asia/Karachi', weekly_goal_lessons: 5, xp_visibility: true }],
    // All 8 lessons of module 0 (Sales Mindset) completed today → 8 lessons, module-master, this-week 8.
    user_lesson_progress: Array.from({ length: 8 }, (_, i) => ({ lesson_id: 'm0l' + i, completed_at: iso(0), metadata: {}, updated_at: iso(0) })),
    coaching_sessions: [
      { id: 's1', mode: 'roleplay', title: 'Cold open practice', score: 8, turns: 6, scores: { opening: 8, objection: 6, discovery: 7 }, status: 'completed', started_at: iso(1), ended_at: iso(1) },
      { id: 's2', mode: 'ask', title: 'Quick question', score: null, turns: 3, scores: null, status: 'completed', started_at: iso(1), ended_at: iso(1) }
    ],
    user_challenge_assignments: [
      { challenge_id: 'c1', status: 'completed', xp_awarded: 60, assignment_date: iso(1).slice(0, 10), completed_at: iso(1) },
      { challenge_id: 'c2', status: 'completed', xp_awarded: 40, assignment_date: iso(2).slice(0, 10), completed_at: iso(2) },
      { challenge_id: 'c3', status: 'assigned', xp_awarded: 0, assignment_date: iso(0).slice(0, 10), completed_at: null }
    ],
    challenge_catalog: [{ id: 'c1', title: 'Reframe Three Rejections', skill: 'mindset' }, { id: 'c2', title: 'Build a Simple ICP', skill: 'prospecting' }]
  }
};

const MALICIOUS_USER = {
  user: { id: 'u-x', email: 'x@example.com', created_at: iso(3), user_metadata: {} },
  tables: {
    user_preferences: [{ full_name: '<img src=x onerror="window.__xss=1">Mallory', bio: '<script>window.__xss=1</script>Careful.', username: '<b>x</b>', xp_visibility: true }],
    user_lesson_progress: [{ lesson_id: 'm0l0', completed_at: iso(0), metadata: {}, updated_at: iso(0) }],
    coaching_sessions: [], user_challenge_assignments: [], challenge_catalog: []
  }
};

function backendScript(data) {
  return `
    window.__xss = 0;
    const DATA = ${JSON.stringify(data)};
    function makeBuilder(rows) {
      const b = {
        select() { return b; }, eq() { return b; }, order() { return b; }, limit() { return b; },
        maybeSingle: async () => ({ data: (rows && rows[0]) || null, error: null }),
        single: async () => ({ data: (rows && rows[0]) || null, error: null }),
        insert() { return b; }, update() { return b; }, delete() { return b; },
        upsert: async () => ({ data: null, error: null }),
        then(resolve) { resolve({ data: rows || [], error: null }); }
      };
      return b;
    }
    const db = {
      auth: {
        getSession: async () => ({ data: { session: DATA.user ? { access_token: 't', user: DATA.user } : null } }),
        getUser: async () => ({ data: { user: DATA.user }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
      },
      from(table) { return makeBuilder((DATA.tables && DATA.tables[table]) || []); },
      rpc: async () => ({ data: null, error: { message: 'rpc disabled in test' } })
    };
    window.supabase = { createClient: () => db };
  `;
}

const server = await createServer({ root: siteRoot, server: { host: '127.0.0.1', port: 4190, strictPort: false } });
await server.listen();
const baseUrl = server.resolvedUrls?.local[0];
if (!baseUrl) throw new Error('Vite did not expose a local URL.');

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--disable-gpu', '--no-first-run'] });

let currentData = NEW_USER;
async function newPage(viewport) {
  const page = await browser.newPage(viewport || { viewport: { width: 1280, height: 900 } });
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', (route) => route.fulfill({ contentType: 'application/javascript', body: backendScript(currentData) }));
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  return page;
}

const FAKE_STRINGS = ['Jawad', 'Pro Member', '2,450', '247', 'Calls This Week', 'Resources Saved', 'Saved Resources', 'Meetings Simulated', 'Confidence Score', 'Calls Practiced', 'Reach Level 10', 'Cold Calling Pro', 'Peshawar'];

try {
  // ═══ 1. NEW ACCOUNT — zeros, no fictional identity or numbers ═══
  currentData = NEW_USER;
  let page = await newPage();
  const errs1 = []; page.on('pageerror', (e) => errs1.push(e.message));
  await page.goto(`${baseUrl}profile.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('pName') && document.getElementById('pName').textContent !== 'Loading…');
  const bodyText1 = await page.locator('body').innerText();
  for (const s of FAKE_STRINGS) assert.ok(!bodyText1.includes(s), `new profile must not contain fake "${s}"`);
  assert.equal(await page.locator('#qsGrid .qs').count(), 6, 'quick stats render');
  // Every quick-stat value is 0 or an em dash (no invented numbers).
  const qsVals = await page.locator('#qsGrid .qs-v').allInnerTexts();
  for (const v of qsVals) assert.ok(/^(0|—)$/.test(v.trim()), `new-account quick stat is zero/empty, got "${v}"`);
  assert.equal(await page.locator('.ach.earned').count(), 0, 'new account has zero earned achievements');
  assert.ok((await page.locator('#timeline .tl-empty').count()) === 1, 'empty activity message shown');
  assert.match(await page.locator('#stateBanner').innerText(), /Welcome/i, 'new user sees an encouraging empty banner');
  assert.match(await page.locator('#pName').innerText(), /newbie@example\.com|Your profile/, 'name falls back to email, never Jawad');
  assert.deepEqual(errs1, [], `new profile page errors: ${errs1.join(', ')}`);
  await page.close();

  // ═══ 2. ACTIVE ACCOUNT — every number traceable to stored data ═══
  currentData = ACTIVE_USER;
  page = await newPage();
  const errs2 = []; page.on('pageerror', (e) => errs2.push(e.message));
  await page.goto(`${baseUrl}profile.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('pName') && document.getElementById('pName').textContent === 'Alex Rivera');
  const body2 = await page.locator('body').innerText();
  for (const s of FAKE_STRINGS) assert.ok(!body2.includes(s), `active profile must not contain fake "${s}"`);
  assert.equal(await page.locator('#sbName').innerText(), 'Alex Rivera', 'sidebar shows real name');
  assert.match(await page.locator('#pUser').innerText(), /@alexr/, 'username from preferences');
  assert.match(await page.locator('#pBio').innerText(), /Aspiring SDR/, 'bio from preferences');
  // Traceable totals: 8 lessons, XP 100, 2 coach sessions, 2 challenges, avg 8, journey 22%.
  const qsText = await page.locator('#qsGrid').innerText();
  assert.ok(qsText.includes('100'), 'Total XP = sum of challenge XP (60+40)');
  assert.ok(qsText.includes('8'), 'Lessons Done = 8 completed lesson rows');
  assert.ok(qsText.includes('2'), 'coach sessions / challenges counts present');
  assert.match(await page.locator('#pHeadStats').innerText(), /20%/, 'Journey % = round(8/40 lessons)');
  assert.match(await page.locator('#qsGrid').innerText(), /8 \/ 10/, 'Avg Coach Score from scored sessions');
  // Achievements earned reflect real rules: first-lesson, five-lessons, module-master, ai-explorer, sharp-scorer, first-challenge, streak-3.
  const earned = await page.locator('.ach.earned .ach-n').allInnerTexts();
  for (const name of ['First Lesson', 'Five Lessons', 'Module Master', 'AI Explorer', 'Sharp Scorer', 'First Challenge', '3-Day Streak']) {
    assert.ok(earned.includes(name), `achievement earned by rule: ${name}`);
  }
  assert.ok(!earned.includes('7-Day Streak'), '7-Day Streak stays locked (streak is 3)');
  // Real per-skill bars appear (Opening/Objection/Discovery from scores jsonb).
  assert.match(await page.locator('#prGrid').innerText(), /Objection Handling/, 'per-skill coach average rendered');
  assert.ok((await page.locator('#timeline .tl-item').count()) >= 3, 'activity timeline built from lessons+coach+challenges');
  assert.deepEqual(errs2, [], `active profile page errors: ${errs2.join(', ')}`);

  // Progress page, active user.
  await page.goto(`${baseUrl}progress.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body.state-active');
  const prog2 = await page.locator('body').innerText();
  for (const s of ['247', '87', 'Confidence Score', 'Meetings Simulated', 'Calls Practiced']) assert.ok(!prog2.includes(s), `progress must not contain fake "${s}"`);
  await page.waitForFunction(() => document.getElementById('prPct').textContent === '20%'); // ring animates 0 → real journey %
  assert.match(await page.locator('#prPct').innerText(), /20%/, 'ring settles on real journey %');
  assert.match(await page.locator('#pstatGrid').innerText(), /Lessons Done/, 'progress stat tiles relabelled');
  await page.close();

  // ═══ 3. MALICIOUS PROFILE TEXT — rendered literally, never executed ═══
  currentData = MALICIOUS_USER;
  page = await newPage();
  await page.goto(`${baseUrl}profile.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('pName') && document.getElementById('pName').textContent.indexOf('Mallory') !== -1);
  assert.equal(await page.evaluate(() => window.__xss || 0), 0, 'malicious profile HTML never executes');
  assert.equal(await page.locator('.main img').count(), 0, 'malicious HTML is rendered as text, not an <img>');
  assert.match(await page.locator('#pName').innerText(), /Mallory/, 'name shows literally');
  assert.match(await page.locator('#pBio').innerText(), /Careful\./, 'bio shows literally');
  await page.close();

  // ═══ 4. MOBILE LAYOUT ═══
  currentData = ACTIVE_USER;
  page = await newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await page.goto(`${baseUrl}profile.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('pName') && document.getElementById('pName').textContent === 'Alex Rivera');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.mh')).display), 'flex', 'mobile header is visible on small screens');
  assert.ok((await page.locator('#qsGrid .qs').count()) === 6, 'quick stats still render on mobile');
  await page.close();

  // ═══ 5. DASHBOARD — honest labels + rule-matched achievements (live) ═══
  currentData = ACTIVE_USER;
  page = await newPage();
  await page.goto(`${baseUrl}dashboard.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('#badgesGrid .badge').length > 0);
  const dashText = await page.locator('body').innerText();
  for (const s of ['100 Calls', '10 Bookings', '500 Calls', 'Confidence Score', 'Calls Practiced', 'Meetings Simulated']) {
    assert.ok(!dashText.includes(s), `dashboard must not contain mismatched/fake "${s}"`);
  }
  assert.match(dashText, /AI Roleplays/, 'dashboard stat relabelled to AI Roleplays');
  assert.match(dashText, /Avg Coach Score/, 'dashboard stat relabelled to Avg Coach Score');
  assert.equal(await page.locator('#sbName').innerText(), 'Alex Rivera', 'dashboard sidebar shows real name');
  const dashBadges = await page.locator('#badgesGrid .badge-name').allInnerTexts();
  assert.ok(dashBadges.includes('First Lesson') && dashBadges.includes('AI Explorer'), 'dashboard achievements come from the shared honest ruleset');
  await page.close();

  // ═══ 6. STATIC CHECK — source no longer hardcodes the fictional data ═══
  for (const file of ['profile.html', 'progress.html', 'dashboard.html']) {
    const src = await readFile(path.join(siteRoot, file), 'utf8');
    assert.ok(!/>\s*Jawad\s*</.test(src) && !src.includes('Pro Member'), `${file} has no hardcoded Jawad/Pro Member`);
    assert.ok(src.includes('assets/user-stats.js'), `${file} loads the shared stats module`);
  }

  console.log('Profile/Progress QA passed: new-account zeros, traceable active numbers, safe malicious text, mobile layout, and honest dashboard labels + achievements.');
} finally {
  await browser.close();
  await server.close();
}
