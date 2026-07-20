/*
 * AmplifyHub production smoke test.
 *
 * Creates a DISPOSABLE account against the live Supabase project, walks it
 * through the real user journey (signup → signin → lesson progress →
 * challenges → coach reachability → data-export reads → logout), and then
 * exercises the delete-account Edge Function end-to-end, verifying the
 * account is really gone afterwards.
 *
 * The only account it ever deletes is the disposable one it just created in
 * this run. It never touches existing users' data.
 *
 * Usage: npm run smoke:production
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Single source of truth for the public project config.
const cfgSrc = await readFile(path.join(siteRoot, 'auth-config.js'), 'utf-8');
const SUPABASE_URL = cfgSrc.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1];
const ANON_KEY = cfgSrc.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)?.[1];
if (!SUPABASE_URL || !ANON_KEY) throw new Error('Could not read Supabase config from auth-config.js');

const SITE_URL = process.env.SMOKE_SITE_URL || 'https://amplify-hub-six.vercel.app';

// Optional. The hosted project requires email confirmation on signup, so a
// fully-automated run needs the service-role key to mark the disposable
// account confirmed (and to sweep up leftovers from earlier failed runs).
// Provide it via env only — never hardcode or log it.
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

function adminHeaders() {
  return { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
}

// A leftover from a previous run is deleted ONLY when every condition holds:
// it carries the smoke_test metadata tag this script itself stamps at creation,
// AND its address is a +smoke- plus-address of the operator's own
// SMOKE_EMAIL_BASE. A real user can satisfy neither by accident.
function isSmokeAccount(u) {
  const email = (u.email || '').toLowerCase();
  const tagged = !!(u.user_metadata && u.user_metadata.smoke_test === true);
  return tagged
    && email.startsWith(baseLocal + '+smoke-')
    && email.endsWith('@' + baseDomain);
}

async function sweepLeftoverSmokeAccounts() {
  if (!SERVICE_KEY) return;
  try {
    const res = await fetch(SUPABASE_URL + '/auth/v1/admin/users?per_page=100', { headers: adminHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const leftovers = (data.users || []).filter(isSmokeAccount);
    for (const u of leftovers) {
      const del = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + u.id, { method: 'DELETE', headers: adminHeaders() });
      console.log(`  (cleanup) removed leftover smoke account ${u.email}: ${del.status}`);
    }
  } catch {}
}

const runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
// Supabase validates email deliverability (example.com is rejected), so the
// disposable address is plus-addressed on an inbox you own. Required from the
// environment — never committed. No email is ever sent to it: the account is
// created pre-confirmed via the Admin API.
const emailBase = process.env.SMOKE_EMAIL_BASE || '';
if (!/^[^@\s+]+@[^@\s]+\.[^@\s]+$/.test(emailBase)) {
  console.error('SMOKE_EMAIL_BASE is required (an inbox you own, e.g. you@yourdomain.com; no + in the local part).');
  console.error('The disposable account is created as <local>+smoke-<id>@<domain>. No email is sent to it.');
  process.exit(1);
}
const [baseLocal, baseDomain] = emailBase.toLowerCase().split('@');
const EMAIL = emailBase.replace('@', `+smoke-${runId}@`);
const PASSWORD = 'Smoke!' + runId + 'x9';

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, condition, detail) {
  if (condition) { console.log(`  ✓ ${name}`); passed++; }
  else { console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); failed++; failures.push(name); }
}

function authHeaders(token) {
  return {
    'apikey': ANON_KEY,
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
  };
}

async function api(method, urlPath, { token, body, base } = {}) {
  const res = await fetch((base || SUPABASE_URL) + urlPath, {
    method,
    headers: authHeaders(token),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

// ── 0. Site + auth service availability ─────────────────────────────────────
console.log(`\nSmoke run ${runId} — disposable account ${EMAIL}\n`);
console.log('0. Availability');

const site = await fetch(SITE_URL).catch(() => null);
ok('production site responds 200', site && site.status === 200, site ? 'status ' + site.status : 'unreachable');

// Post-deploy check: the deployed signin page must link to the reset flow.
const signinPage = await fetch(SITE_URL + '/signin.html').catch(() => null);
const signinHtml = signinPage ? await signinPage.text() : '';
ok('deployed signin page links to forgot-password flow', signinHtml.includes('forgot-password.html'), 'link missing — is the latest main deployed?');

const health = await api('GET', '/auth/v1/health');
ok('auth service healthy', health.status === 200, 'status ' + health.status);

// ── 1. Signup ───────────────────────────────────────────────────────────────
console.log('\n1. Signup (disposable account)');

await sweepLeftoverSmokeAccounts();

// Probe the public signup endpoint WITHOUT creating anything or sending email:
// an invalid-format address must come back 400 from validation, proving the
// endpoint is alive. (Real signups send a confirmation email, and the built-in
// SMTP quota is tiny — so automation must not create accounts through it.)
const signupProbe = await api('POST', '/auth/v1/signup', {
  body: { email: 'not-an-email', password: PASSWORD },
});
ok('public signup endpoint alive (rejects invalid email with 4xx)', signupProbe.status >= 400 && signupProbe.status < 500, 'status ' + signupProbe.status);

// Create the disposable account through the Admin API — pre-confirmed, no email.
let token = null;
let userId = null;
if (!SERVICE_KEY) {
  console.error('\nEmail confirmations are on, so the disposable account must be created via the');
  console.error('Admin API. Set SUPABASE_SERVICE_ROLE_KEY (never commit it) and re-run.');
  process.exit(1);
}
const createRes = await fetch(SUPABASE_URL + '/auth/v1/admin/users', {
  method: 'POST', headers: adminHeaders(),
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'Smoke Test', smoke_test: true } }),
});
const created = await createRes.json().catch(() => null);
userId = created?.id || created?.user?.id || null;
ok('disposable account created (admin, pre-confirmed, no email sent)', createRes.status === 200 && !!userId, 'status ' + createRes.status);

if (!userId) {
  console.error('\nCannot continue without a user — aborting.');
  process.exit(1);
}

const firstSignin = await api('POST', '/auth/v1/token?grant_type=password', {
  body: { email: EMAIL, password: PASSWORD },
});
ok('password signin issues a session', firstSignin.status === 200 && !!firstSignin.json?.access_token, 'status ' + firstSignin.status);
token = firstSignin.json?.access_token || null;

if (!token) {
  console.error('\nCannot continue without a session — aborting. Leftover account: ' + EMAIL);
  process.exit(1);
}

// ── 2. Logout, then signin again ────────────────────────────────────────────
console.log('\n2. Logout + signin');

const logout = await api('POST', '/auth/v1/logout', { token });
ok('logout succeeds', logout.status === 204 || logout.status === 200, 'status ' + logout.status);

const signin = await api('POST', '/auth/v1/token?grant_type=password', {
  body: { email: EMAIL, password: PASSWORD },
});
ok('signin succeeds', signin.status === 200, 'status ' + signin.status);
token = signin.json?.access_token || token;

const badSignin = await api('POST', '/auth/v1/token?grant_type=password', {
  body: { email: EMAIL, password: 'definitely-wrong-password' },
});
ok('signin with wrong password rejected', badSignin.status === 400 || badSignin.status === 401, 'status ' + badSignin.status);

// ── 3. Lesson progress (RLS write + read back) ──────────────────────────────
console.log('\n3. Lesson progress');

const lessonWrite = await fetch(SUPABASE_URL + '/rest/v1/user_lesson_progress', {
  method: 'POST',
  headers: { ...authHeaders(token), 'Prefer': 'return=representation' },
  body: JSON.stringify({ user_id: userId, lesson_id: 'm0l0', completed_at: new Date().toISOString(), metadata: { smoke: true } }),
});
ok('lesson progress insert succeeds', lessonWrite.status === 201, 'status ' + lessonWrite.status);

const lessonRead = await api('GET', '/rest/v1/user_lesson_progress?select=lesson_id', { token });
ok('lesson progress reads back own row', lessonRead.status === 200 && Array.isArray(lessonRead.json) && lessonRead.json.some(r => r.lesson_id === 'm0l0'));

const anonLessonRead = await api('GET', '/rest/v1/user_lesson_progress?select=lesson_id');
ok('RLS: anonymous read returns no rows', anonLessonRead.status !== 200 || (Array.isArray(anonLessonRead.json) && anonLessonRead.json.length === 0));

// ── 4. Challenges ───────────────────────────────────────────────────────────
console.log('\n4. Challenges');

const catalog = await api('GET', '/rest/v1/challenge_catalog?select=id&limit=1', { token });
ok('challenge catalog readable', catalog.status === 200, 'status ' + catalog.status);

const assignments = await api('GET', '/rest/v1/user_challenge_assignments?select=id', { token });
ok('own challenge assignments readable', assignments.status === 200, 'status ' + assignments.status);

// ── 5. AI Coach reachability (no Gemini quota spent) ────────────────────────
console.log('\n5. AI Coach function');

const coachNoAuth = await fetch(SUPABASE_URL + '/functions/v1/coach-chat', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
});
ok('coach-chat rejects unauthenticated (401)', coachNoAuth.status === 401, 'status ' + coachNoAuth.status);

const coachBadBody = await api('POST', '/functions/v1/coach-chat', { token, body: { action: 'nonsense' } });
ok('coach-chat alive: rejects invalid body with 4xx (not 5xx)', coachBadBody.status >= 400 && coachBadBody.status < 500, 'status ' + coachBadBody.status);

// ── 6. Data-export table reads (same queries settings.html runs) ────────────
console.log('\n6. Data export reads');

const exportTables = [
  'user_preferences', 'user_lesson_progress', 'coaching_sessions',
  'coach_messages', 'coach_documents', 'user_challenge_assignments', 'user_challenge_feedback',
];
for (const table of exportTables) {
  const r = await api('GET', `/rest/v1/${table}?select=*&limit=5`, { token });
  ok(`export read: ${table}`, r.status === 200, 'status ' + r.status);
}

// ── 7. Account deletion (the disposable account only) ───────────────────────
console.log('\n7. Account deletion');

const delNoAuth = await fetch(SUPABASE_URL + '/functions/v1/delete-account', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: 'DELETE' }),
});
ok('delete-account rejects unauthenticated (401)', delNoAuth.status === 401, 'status ' + delNoAuth.status);

const delWrongConfirm = await api('POST', '/functions/v1/delete-account', { token, body: { confirmation: 'nope' } });
ok('delete-account rejects wrong confirmation (400)', delWrongConfirm.status === 400, 'status ' + delWrongConfirm.status);

const delWrongMethod = await api('GET', '/functions/v1/delete-account', { token });
ok('delete-account rejects GET (405)', delWrongMethod.status === 405, 'status ' + delWrongMethod.status);

const del = await api('POST', '/functions/v1/delete-account', { token, body: { confirmation: 'DELETE' } });
ok('delete-account deletes the disposable account (200 ok:true)', del.status === 200 && del.json?.ok === true, 'status ' + del.status + ' ' + JSON.stringify(del.json)?.slice(0, 200));

// ── 8. Verify the account is really gone ────────────────────────────────────
console.log('\n8. Post-deletion verification');

const signinAfter = await api('POST', '/auth/v1/token?grant_type=password', {
  body: { email: EMAIL, password: PASSWORD },
});
ok('signin after deletion fails', signinAfter.status === 400 || signinAfter.status === 401, 'status ' + signinAfter.status);

const tokenAfter = await api('GET', '/auth/v1/user', { token });
ok('old token no longer resolves a user', tokenAfter.status === 401 || tokenAfter.status === 403 || tokenAfter.status === 404, 'status ' + tokenAfter.status);

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`Production smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) console.log('Failed: ' + failures.join(' | '));
if (del.status !== 200) {
  console.log(`⚠ Disposable account may still exist and needs manual cleanup: ${EMAIL}`);
}
console.log(`${'═'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
