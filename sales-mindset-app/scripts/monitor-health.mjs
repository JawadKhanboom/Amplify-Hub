/*
 * AmplifyHub production health monitor.
 *
 * Read-only availability checks — creates nothing, deletes nothing, spends no
 * Gemini quota, needs no secrets beyond the public anon key. Exits non-zero on
 * any failure so a scheduled CI run notifies the repo owner.
 *
 * What it can't see: Gemini upstream failures and per-user quota exhaustion
 * only surface on real coach calls. For those, check the coach-chat function
 * logs in the Supabase dashboard (Functions → coach-chat → Logs), which record
 * 5xx responses and rate-limit rejections.
 *
 * Usage: npm run monitor:health
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfgSrc = await readFile(path.join(siteRoot, 'auth-config.js'), 'utf-8');
const SUPABASE_URL = cfgSrc.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1];
const ANON_KEY = cfgSrc.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)?.[1];
if (!SUPABASE_URL || !ANON_KEY) throw new Error('Could not read Supabase config from auth-config.js');

const SITE_URL = process.env.SMOKE_SITE_URL || 'https://amplify-hub-six.vercel.app';

let failed = 0;

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`  ✓ ${name}${detail ? ' (' + detail + ')' : ''}`);
  } catch (e) {
    console.error(`  ✗ ${name} — ${e.message}`);
    failed++;
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

console.log('\nAmplifyHub health check — ' + new Date().toISOString() + '\n');

await check('production site reachable', async () => {
  const res = await fetch(SITE_URL, { redirect: 'follow' });
  expect(res.status === 200, 'status ' + res.status);
  return 'status 200';
});

await check('auth service healthy', async () => {
  const res = await fetch(SUPABASE_URL + '/auth/v1/health', { headers: { apikey: ANON_KEY } });
  expect(res.status === 200, 'status ' + res.status);
  return 'status 200';
});

// Any well-formed non-5xx answer proves PostgREST is up and evaluating
// requests (an anonymous query is expected to be denied or come back empty —
// what matters here is that the service answers rather than erroring out).
await check('REST API (PostgREST) responding', async () => {
  const res = await fetch(SUPABASE_URL + '/rest/v1/challenge_catalog?select=id&limit=1', {
    headers: { apikey: ANON_KEY },
  });
  expect(res.status < 500, 'status ' + res.status);
  return 'status ' + res.status;
});

await check('RLS holding: anonymous reads return no user rows', async () => {
  const res = await fetch(SUPABASE_URL + '/rest/v1/user_preferences?select=user_id&limit=1', { headers: { apikey: ANON_KEY } });
  expect(res.status !== 200 || (await res.json()).length === 0, 'anonymous request returned user data!');
});

// A 401 proves the function is deployed and its JWT gate is up. A 404 means it
// vanished; a 5xx means the runtime is failing.
await check('coach-chat function deployed + auth gate up', async () => {
  const res = await fetch(SUPABASE_URL + '/functions/v1/coach-chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  expect(res.status === 401, 'expected 401, got ' + res.status);
  return '401 as expected';
});

await check('delete-account function deployed + auth gate up', async () => {
  const res = await fetch(SUPABASE_URL + '/functions/v1/delete-account', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: 'DELETE' }),
  });
  expect(res.status === 401, 'expected 401, got ' + res.status);
  return '401 as expected';
});

await check('signin page served', async () => {
  const res = await fetch(SITE_URL + '/signin.html');
  expect(res.status === 200, 'status ' + res.status);
  return 'status 200';
});

console.log(`\n${failed === 0 ? 'All health checks passed.' : failed + ' health check(s) FAILED.'}\n`);
process.exit(failed > 0 ? 1 : 0);
