/*
 * UI polish + landing page QA.
 *
 * Static checks: internal link/asset integrity across all root pages, shared
 * stylesheet adoption, honest-copy guards on the landing page.
 * Browser checks: no horizontal overflow at 360/390/768/1280/1440, no uncaught
 * page errors, landing drill behavior (mouse + keyboard), mobile menu
 * accessibility, aria-current on authenticated pages, single h1 + landmarks.
 *
 * Run: npm run qa:ui-polish   (Chrome/Edge or CHROME_PATH required)
 */
import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appDir, '..');

let passed = 0;
function ok(name, condition, detail) {
  if (condition) { passed++; }
  else { throw new assert.AssertionError({ message: name + (detail ? ' — ' + detail : '') }); }
}

// ═══ Static: internal link + asset integrity ═══════════════════════════════
console.log('1. Static link/asset integrity');

const htmlFiles = (await readdir(siteRoot)).filter(f => f.endsWith('.html'));
const missing = [];
for (const file of htmlFiles) {
  const html = await readFile(path.join(siteRoot, file), 'utf-8');
  const refs = [...html.matchAll(/(?:href|src)="([^"#?]+)(?:[#?][^"]*)?"/g)].map(m => m[1]);
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(ref) || ref === '') continue;
    const target = path.join(siteRoot, ref.replace(/\//g, path.sep));
    try { await access(target); } catch { missing.push(`${file} -> ${ref}`); }
  }
}
ok('all internal hrefs/srcs resolve to real files', missing.length === 0, missing.slice(0, 10).join(', '));
console.log(`  ✓ ${htmlFiles.length} pages scanned, all internal references resolve`);

// ═══ Static: shared stylesheet + landing honesty ═══════════════════════════
console.log('2. Static UI + honesty checks');

let uiCssCount = 0;
for (const file of htmlFiles) {
  const html = await readFile(path.join(siteRoot, file), 'utf-8');
  if (html.includes('assets/ui.css')) uiCssCount++;
}
ok('shared ui.css adopted across the site', uiCssCount >= 60, `only ${uiCssCount}`);
console.log(`  ✓ ui.css linked on ${uiCssCount}/${htmlFiles.length} pages`);

const landing = await readFile(path.join(siteRoot, 'index.html'), 'utf-8');
const BANNED = [
  [/testimonial/i, 'testimonials'],
  [/\b\d{2,3}%\b/, 'percentage claims'],
  [/\b[\d,]{4,}\+/, 'big-number claims'],
  [/500\+|\bSDRs trained\b|meetings booked/i, 'fake usage stats'],
  [/ChatGPT/i, 'unverifiable comparison'],
  [/money.?back|guarantee/i, 'refund claims'],
  [/\$\d/, 'pricing claims'],
  // "no trial clock" (an honest denial) is fine; selling a trial is not.
  [/\b(free|\d+.?day|start\s+your?)\s+trial\b|\btrial\s+(period|ends)/i, 'trial offers'],
  [/confidence score/i, 'fake scoring UI'],
];
for (const [re, label] of BANNED) {
  ok(`landing: no ${label}`, !re.test(landing.replace(/<script[\s\S]*?<\/script>/g, '')), String(re));
}
ok('landing: drill is labeled as a guided example', landing.includes('Guided example'));
ok('landing: drill renders coaching via textContent', landing.includes('drillCoach.textContent'));
// The landing page's scripts must be fully local: no network calls, no
// storage, no backend SDKs. (Mentioning Gemini in the FAQ copy is fine.)
const landingScripts = [...landing.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
ok('landing: scripts make no network calls', !/fetch\(|XMLHttpRequest|supabaseClient|createClient|WebSocket/.test(landingScripts));
ok('landing: scripts store no visitor data', !/localStorage|sessionStorage|document\.cookie|indexedDB/.test(landingScripts));
ok('landing: no external script tags (no CDN SDKs)', !/<script[^>]*src="http/.test(landing));
ok('landing: scripts never use innerHTML', !landingScripts.includes('innerHTML'));
console.log('  ✓ landing honesty + drill safety checks pass');

// ═══ Browser checks ════════════════════════════════════════════════════════
console.log('3. Browser checks');

const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
let chromePath = null;
for (const c of candidates) { try { await access(c); chromePath = c; break; } catch {} }
if (!chromePath) throw new Error('Chrome or Edge not found. Set CHROME_PATH.');

const USER = {
  user: { id: 'u-qa', email: 'qa@example.com', created_at: new Date().toISOString(), user_metadata: { full_name: 'Alex Rivera' } },
  tables: {
    user_preferences: [{ full_name: 'Alex Rivera', username: 'alexr', xp_visibility: true }],
    user_lesson_progress: [], coaching_sessions: [], coach_messages: [], coach_documents: [],
    user_challenge_assignments: [], user_challenge_feedback: [], challenge_catalog: [],
  },
};

function backendScript(DATA) {
  return `
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
    const DATA = ${JSON.stringify(DATA)};
    const db = {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 't', user: DATA.user } } }),
        getUser: async () => ({ data: { user: DATA.user }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: async () => ({ error: null }),
        signInWithPassword: async () => ({ data: null, error: { message: 'disabled in QA' } })
      },
      from(table) { return makeBuilder((DATA.tables && DATA.tables[table]) || []); },
      rpc: async () => ({ data: null, error: { message: 'rpc disabled in QA' } }),
      functions: { invoke: async () => ({ data: null, error: { message: 'disabled in QA' } }) }
    };
    window.supabase = { createClient: () => db };
  `;
}

const server = await createServer({ root: siteRoot, server: { host: '127.0.0.1', port: 4198, strictPort: false } });
await server.listen();
const baseUrl = server.resolvedUrls?.local[0];
if (!baseUrl) throw new Error('Vite did not expose a local URL.');
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--disable-gpu', '--no-first-run'] });

const ALL_WIDTHS = [360, 390, 768, 1280, 1440];
// [page, needsAuthMock, widths]
const PAGES = [
  ['index.html', false, ALL_WIDTHS],
  ['signin.html', true, [360, 1280]],
  ['signup.html', true, [360, 1280]],
  ['forgot-password.html', true, [360, 1280]],
  ['reset-password.html', true, [360, 1280]],
  ['dashboard.html', true, ALL_WIDTHS],
  ['journey.html', true, [360, 768, 1280]],
  ['coach-home.html', true, [360, 768, 1280]],
  ['challenges.html', true, [360, 1280]],
  ['profile.html', true, [360, 1280]],
  ['progress.html', true, [360, 1280]],
  ['settings.html', true, ALL_WIDTHS],
  ['interview-prep.html', false, [360, 1280]],
  ['sales-mindset-1.html', false, ALL_WIDTHS],
];

async function newPage(viewportWidth, mock) {
  const page = await browser.newPage({ viewport: { width: viewportWidth, height: 844 }, reducedMotion: 'reduce' });
  if (mock) await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', r => r.fulfill({ contentType: 'application/javascript', body: backendScript(USER) }));
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  return page;
}

for (const [pageName, mock, widths] of PAGES) {
  for (const width of widths) {
    const page = await newPage(width, mock);
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(baseUrl + pageName, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    // Allow a 1px rounding tolerance.
    ok(`${pageName} @${width}: no horizontal overflow`, overflow <= 1, `${overflow}px over`);
    ok(`${pageName} @${width}: no uncaught page errors`, errs.length === 0, errs.join(' | '));
    await page.close();
  }
  console.log(`  ✓ ${pageName}: no overflow, no page errors (${widths.join('/')}px)`);
}

// ── Landing: structure, drill, mobile menu ──
{
  const page = await newPage(1280, false);
  await page.goto(baseUrl + 'index.html', { waitUntil: 'domcontentloaded' });
  ok('landing: exactly one h1', await page.locator('h1').count() === 1);
  ok('landing: has main landmark', await page.locator('main').count() === 1);
  ok('landing: has nav landmark', await page.locator('nav').count() >= 1);
  ok('landing: has footer', await page.locator('footer').count() === 1);
  ok('landing: skip link present', await page.locator('.ah-skip').count() === 1);

  // Drill via mouse
  await page.locator('[data-choice="redirect"]').click();
  ok('drill: feedback appears on choice', await page.locator('#drillFeedback.show').count() === 1);
  ok('drill: good verdict for acknowledge-and-redirect', (await page.locator('#drillVerdict').textContent()).includes('Strong'));
  ok('drill: chosen option marked aria-pressed', await page.locator('[data-choice="redirect"][aria-pressed="true"]').count() === 1);
  await page.locator('#drillReset').click();
  ok('drill: reset hides feedback', await page.locator('#drillFeedback.show').count() === 0);

  // Drill via keyboard only
  await page.locator('[data-choice="push"]').focus();
  await page.keyboard.press('Enter');
  ok('drill: keyboard Enter activates an option', await page.locator('#drillFeedback.show').count() === 1);
  ok('drill: focus lands on feedback region', await page.evaluate(() => document.activeElement === document.getElementById('drillFeedback')));
  await page.close();
}
console.log('  ✓ landing structure + drill (mouse & keyboard)');

{
  const page = await newPage(390, false);
  await page.goto(baseUrl + 'index.html', { waitUntil: 'domcontentloaded' });
  const tog = page.locator('.mob-tog');
  ok('mobile menu: hamburger visible at 390', await tog.isVisible());
  await tog.click();
  ok('mobile menu: opens with aria-expanded=true', await page.locator('.mob-tog[aria-expanded="true"]').count() === 1);
  await page.keyboard.press('Escape');
  ok('mobile menu: Escape closes it', await page.locator('.mob-tog[aria-expanded="false"]').count() === 1);
  await page.close();
}
console.log('  ✓ mobile menu open/Escape');

// ── aria-current on authenticated pages whose nav links to themselves ──
for (const authedPage of ['dashboard.html', 'challenges.html']) {
  const page = await newPage(1280, true);
  await page.goto(baseUrl + authedPage, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const current = await page.evaluate(() => {
    const el = document.querySelector('[aria-current="page"]');
    return el ? (el.getAttribute('href') || '') : null;
  });
  ok(`${authedPage}: active nav link has aria-current`, current !== null && current.includes(authedPage), String(current));
  await page.close();
}
console.log('  ✓ aria-current marks active nav on authed pages');

// ── Auth pages: duplicate-submit + autocomplete ──
{
  const signin = await readFile(path.join(siteRoot, 'signin.html'), 'utf-8');
  const signup = await readFile(path.join(siteRoot, 'signup.html'), 'utf-8');
  ok('signin: guard against duplicate submits', signin.includes('if (signingIn) return'));
  ok('signin: disables button while submitting', signin.includes('btn.disabled = true'));
  ok('signin: autocomplete attributes', signin.includes('autocomplete="current-password"') && signin.includes('autocomplete="email"'));
  ok('signup: guard against duplicate submits', signup.includes('if (signingUp) return'));
  ok('signup: autocomplete new-password', signup.includes('autocomplete="new-password"'));
  ok('signin: Enter submits', signin.includes("e.key === 'Enter'"));
  ok('signup: Enter submits', signup.includes("e.key === 'Enter'"));
}
console.log('  ✓ auth pages: duplicate-submit guards + autocomplete');

await browser.close();
await server.close();

console.log(`\nUI polish QA passed: ${passed} checks — links, honesty, overflow, drill, menu, aria-current, auth hardening.`);
