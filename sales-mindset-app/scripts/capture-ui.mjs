/*
 * UI screenshot capture for docs/qa/final-ui-polish/.
 * Serves the static site with vite, mocks the Supabase CDN script for
 * authenticated pages (same technique as qa-profile-progress.mjs — nothing
 * touches production), and captures desktop + mobile screenshots.
 *
 * Usage: node scripts/capture-ui.mjs <label>   (label = "before" | "after")
 */
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const label = process.argv[2];
if (!['before', 'after'].includes(label)) {
  console.error('Usage: node scripts/capture-ui.mjs <before|after>');
  process.exit(1);
}

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appDir, '..');
const outDir = path.join(siteRoot, 'docs', 'qa', 'final-ui-polish', label);
await mkdir(outDir, { recursive: true });

const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
let chromePath = null;
for (const c of candidates) { try { await access(c); chromePath = c; break; } catch {} }
if (!chromePath) throw new Error('Chrome or Edge not found. Set CHROME_PATH.');

const USER = {
  user: { id: 'u-preview', email: 'preview@example.com', created_at: new Date(Date.now() - 30 * 864e5).toISOString(), user_metadata: { full_name: 'Alex Rivera' } },
  tables: {
    user_preferences: [{ full_name: 'Alex Rivera', username: 'alexr', bio: 'Practicing daily.', xp_visibility: true }],
    user_lesson_progress: Array.from({ length: 5 }, (_, i) => ({ lesson_id: 'm0l' + i, completed_at: new Date().toISOString(), metadata: {}, updated_at: new Date().toISOString() })),
    coaching_sessions: [], coach_messages: [], coach_documents: [],
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
        signOut: async () => ({ error: null })
      },
      from(table) { return makeBuilder((DATA.tables && DATA.tables[table]) || []); },
      rpc: async () => ({ data: null, error: { message: 'rpc disabled in capture' } }),
      functions: { invoke: async () => ({ data: null, error: { message: 'disabled in capture' } }) }
    };
    window.supabase = { createClient: () => db };
  `;
}

// [page, needsAuthMock]
const PAGES = [
  ['index.html', false],
  ['signin.html', false],
  ['signup.html', false],
  ['forgot-password.html', false],
  ['reset-password.html', false],
  ['dashboard.html', true],
  ['journey.html', true],
  ['coach-home.html', true],
  ['challenges.html', true],
  ['profile.html', true],
  ['progress.html', true],
  ['settings.html', true],
  ['interview-prep.html', false],
  ['sales-mindset-1.html', false],
];

const VIEWPORTS = [
  ['desktop', { width: 1280, height: 800 }],
  ['mobile', { width: 390, height: 844 }],
];

const server = await createServer({ root: siteRoot, server: { host: '127.0.0.1', port: 4199, strictPort: false } });
await server.listen();
const baseUrl = server.resolvedUrls?.local[0];
if (!baseUrl) throw new Error('Vite did not expose a local URL.');

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--disable-gpu', '--no-first-run'] });

for (const [pageName, needsMock] of PAGES) {
  for (const [vpName, viewport] of VIEWPORTS) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    if (needsMock) {
      await page.route('**/assets/vendor/supabase-*.min.js', (route) => route.fulfill({ contentType: 'application/javascript', body: backendScript(USER) }));
    }
    await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
    try {
      await page.goto(baseUrl + pageName, { waitUntil: 'networkidle', timeout: 20000 });
    } catch { /* capture whatever rendered */ }
    await page.waitForTimeout(900);
    const file = path.join(outDir, `${pageName.replace('.html', '')}-${vpName}.png`);
    await page.screenshot({ path: file, fullPage: vpName === 'desktop' });
    console.log('captured', path.relative(siteRoot, file));
    await page.close();
  }
}

await browser.close();
await server.close();
console.log('\nDone: ' + PAGES.length * VIEWPORTS.length + ' screenshots in ' + path.relative(siteRoot, outDir));
