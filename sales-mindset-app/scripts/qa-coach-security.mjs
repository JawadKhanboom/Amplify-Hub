import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import path from 'node:path';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appDir, '..');
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);

let chromePath = null;
for (const candidate of chromeCandidates) {
  try { await access(candidate); chromePath = candidate; break; } catch (_) {}
}
if (!chromePath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH to run browser QA.');

const server = await createServer({ root: siteRoot, server: { host: '127.0.0.1', port: 4176, strictPort: false } });
await server.listen();
const baseUrl = server.resolvedUrls?.local[0];
if (!baseUrl) throw new Error('Vite did not expose a local URL.');

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--disable-gpu', '--no-first-run'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

await page.route('**/assets/vendor/supabase-*.min.js', route => route.fulfill({
  contentType: 'application/javascript',
  body: `window.supabase={createClient:()=>({supabaseKey:'test-key',auth:{getSession:async()=>({data:{session:{access_token:'test-token'}},error:null}),getUser:async()=>({data:{user:{id:'test-user'}},error:null}),signOut:async()=>({})}})};`,
}));
await page.route('https://fonts.googleapis.com/**', route => route.abort());
await page.route('https://fonts.gstatic.com/**', route => route.abort());

try {
  await page.goto(`${baseUrl}coach-home.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof CoachHome !== 'undefined' && CoachHome._security);

  const payloads = [
    '<script>window.__coachXss=1</script>',
    '<img src=x onerror="window.__coachXss=2">',
    '<a href="javascript:window.__coachXss=3">click me</a>',
    '<b>bold-looking text</b>',
  ];

  for (const payload of payloads) {
    const result = await page.evaluate((text) => {
      window.__coachXss = 0;
      const host = document.createElement('div');
      document.body.appendChild(host);
      CoachHome._security.appendBubble(host, 'coach', text);
      const bubble = host.querySelector('.bub');
      return {
        text: bubble.textContent,
        childElements: bubble.querySelectorAll('*').length,
        executed: window.__coachXss,
      };
    }, payload);
    assert.equal(result.text, payload, 'AI payload is displayed literally');
    assert.equal(result.childElements, 0, 'AI payload creates no HTML elements');
    assert.equal(result.executed, 0, 'AI payload does not execute');
  }

  const transcript = await page.evaluate(() => {
    window.__coachXss = 0;
    const host = document.createElement('div');
    const payload = '<img src=x onerror="window.__coachXss=4">stored reply';
    CoachHome._security.appendTranscriptMessage(host, 'coach', payload);
    return {
      text: host.querySelector('.tx-bub').textContent,
      childElements: host.querySelector('.tx-bub').querySelectorAll('*').length,
      executed: window.__coachXss,
    };
  });
  assert.match(transcript.text, /<img src=x/);
  assert.equal(transcript.childElements, 0, 'stored transcript creates no HTML elements');
  assert.equal(transcript.executed, 0, 'stored transcript payload does not execute');

  const feedbackSafe = await page.evaluate(() => {
    window.__coachXss = 0;
    CoachHome._security.renderFeedbackReport({
      openingScore: 5,
      discoveryScore: 5,
      objectionScore: 5,
      communicationScore: 5,
      strengths: ['<img src=x onerror="window.__coachXss=5">'],
      weaknesses: ['<script>window.__coachXss=6</script>'],
      recommendations: ['<a href="javascript:window.__coachXss=7">bad link</a>'],
    }, {});
    return {
      executed: window.__coachXss,
      unsafeNodes: document.querySelectorAll('#fbStrengths img,#fbWeaknesses script,#fbRecommendations a').length,
    };
  });
  assert.equal(feedbackSafe.executed, 0, 'feedback payload does not execute');
  assert.equal(feedbackSafe.unsafeNodes, 0, 'feedback payload creates no unsafe elements');

  const source = await readFile(path.join(siteRoot, 'coach-home.js'), 'utf8');
  assert.doesNotMatch(source, /html\s*\?\s*content\s*:/, 'legacy raw HTML conversation branch is removed');
  assert.doesNotMatch(source, /const content = isUser \? esc\(m\.content\) : m\.content/, 'stored AI messages are not interpolated raw');
  assert.deepEqual(pageErrors, [], `browser errors: ${pageErrors.join(', ')}`);
  console.log('Coach security browser QA passed: live, stored, and feedback AI output is inert text.');
} finally {
  await browser.close();
  await server.close();
}
