import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'node:fs/promises';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, '..', '..');

async function read(relPath) {
  return readFile(join(siteRoot, relPath), 'utf-8');
}

async function exists(relPath) {
  try { await access(join(siteRoot, relPath)); return true; } catch { return false; }
}

async function allHtmlFiles() {
  const { readdirSync } = await import('node:fs');
  return readdirSync(siteRoot).filter(f => f.endsWith('.html'));
}

let passed = 0;
let failed = 0;

function ok(name, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ─────────────────────────────────────────────
// 1. OAuth buttons removed
// ─────────────────────────────────────────────
console.log('\n1. OAuth Button Removal');

const signin = await read('signin.html');
ok('signin: no Google button', !signin.includes('Google'));
ok('signin: no Apple button', !signin.includes('Apple'));
ok('signin: no .social class', !signin.includes('.social'));
ok('signin: no .divider class in CSS', !signin.match(/\.divider\s*\{/));
ok('signin: email/password form intact', signin.includes('emailInput') && signin.includes('passwordInput'));

const signup = await read('signup.html');
ok('signup: no Google button', !signup.includes('Google'));
ok('signup: no Apple button', !signup.includes('Apple'));
ok('signup: no .social class', !signup.includes('.social'));
ok('signup: email/password form intact', signup.includes('emailInput') && signup.includes('passwordInput'));

// ─────────────────────────────────────────────
// 2. Connected Accounts truthful
// ─────────────────────────────────────────────
console.log('\n2. Connected Accounts');

const settings = await read('settings.html');
ok('settings: no connectGithubBtn', !settings.includes('connectGithubBtn'));
ok('settings: no connectLinkedinBtn', !settings.includes('connectLinkedinBtn'));
ok('settings: no connectMicrosoftBtn', !settings.includes('connectMicrosoftBtn'));
ok('settings: has connectedAccountsCard', settings.includes('connectedAccountsCard'));
ok('settings: has renderConnectedAccounts function', settings.includes('renderConnectedAccounts'));
ok('settings: uses user.identities', settings.includes('.identities'));
ok('settings: uses textContent for rendering', settings.includes('.textContent'));

// ─────────────────────────────────────────────
// 3. Billing/membership claims removed
// ─────────────────────────────────────────────
console.log('\n3. Billing and Membership Claims');

const htmlFiles = await allHtmlFiles();

for (const file of htmlFiles) {
  const content = await read(file);
  ok(`${file}: no "Pro Member"`, !content.includes('Pro Member'));
  ok(`${file}: no "Pro Plan"`, !content.includes('Pro Plan'));
  ok(`${file}: no "$29"`, !content.includes('$29'));
  ok(`${file}: no "$79"`, !content.includes('$79'));
  ok(`${file}: no "launching soon" (case-insensitive)`, !content.toLowerCase().includes('launching soon'));
  ok(`${file}: no "money-back"`, !content.toLowerCase().includes('money-back'));
  ok(`${file}: no "7-day trial"`, !content.toLowerCase().includes('7-day trial'));
}

ok('settings: no billing nav item', !settings.includes('data-p="billing"'));
ok('settings: no upgradeBtn', !settings.includes('upgradeBtn'));
ok('settings: no manageSubBtn', !settings.includes('manageSubBtn'));

const index = await read('index.html');
ok('index: "free during beta" in footer', index.toLowerCase().includes('free during beta'));
ok('index: no 3-tier pricing', !index.includes('$29/mo') && !index.includes('$79/mo'));

const faq = await read('faq.html');
ok('faq: "Is AmplifyHub free?" question', faq.includes('Is AmplifyHub free'));
ok('faq: "completely free during beta"', faq.toLowerCase().includes('completely free during beta'));

// ─────────────────────────────────────────────
// 4. Hardcoded personal data removed
// ─────────────────────────────────────────────
console.log('\n4. Hardcoded Personal Data');

ok('settings: no hardcoded "Jawad Khan" fallback', !settings.includes("'Jawad Khan'"));
ok('settings: no hardcoded "jawadkhan" fallback', !settings.includes("'jawadkhan'"));
ok('settings: bio textarea empty by default', settings.includes('<textarea id="bioInput" class="track"></textarea>'));

for (const file of htmlFiles) {
  const content = await read(file);
  ok(`${file}: no "Jawad" in sidebar`, !content.match(/sb-un">Jawad<|sb-uname">Jawad</));
}

// ─────────────────────────────────────────────
// 5. Sidebar user script present
// ─────────────────────────────────────────────
console.log('\n5. Sidebar User Script');

ok('sidebar-user.js exists', await exists('assets/sidebar-user.js'));

const sidebarScript = await read('assets/sidebar-user.js');
ok('sidebar-user.js uses textContent', sidebarScript.includes('textContent'));
ok('sidebar-user.js never uses innerHTML', !sidebarScript.includes('innerHTML'));
ok('sidebar-user.js has no hardcoded project ref', !sidebarScript.includes('dsuahpcqrrlbudomjrye'));
ok('sidebar-user.js scans for sb-*-auth-token keys', sidebarScript.includes('sb-[a-z0-9]+-auth-token'));
ok('sidebar-user.js skips dead expired sessions', sidebarScript.includes('expires_at'));
ok('sidebar-user.js prefers live supabase client when present', sidebarScript.includes("typeof supabaseClient !== 'undefined'"));
ok('sidebar-user.js leaves page-managed (id-bearing) sidebar elements alone', sidebarScript.includes('!els[i].id'));

// ─────────────────────────────────────────────
// 6. Delete Account Edge Function
// ─────────────────────────────────────────────
console.log('\n6. Delete Account Edge Function');

ok('delete-account/index.ts exists', await exists('supabase/functions/delete-account/index.ts'));
ok('delete-account/deno.json exists', await exists('supabase/functions/delete-account/deno.json'));

const edgeFn = await read('supabase/functions/delete-account/index.ts');

ok('edge fn: only POST+OPTIONS', edgeFn.includes("method !== 'POST'") && edgeFn.includes("method === 'OPTIONS'"));
ok('edge fn: 2KB body limit', edgeFn.includes('2048'));
ok('edge fn: requires confirmation DELETE', edgeFn.includes("confirmation !== 'DELETE'"));
ok('edge fn: uses getUser() not request body for user ID', edgeFn.includes('getUser()') && !edgeFn.includes('body.userId') && !edgeFn.includes('body.user_id'));
ok('edge fn: uses admin.deleteUser', edgeFn.includes('admin.deleteUser'));
ok('edge fn: uses service role key from env', edgeFn.includes("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')"));
ok('edge fn: has CORS headers', edgeFn.includes('Access-Control-Allow-Origin'));
ok('edge fn: validates auth header', edgeFn.includes("'Bearer '"));
ok('edge fn: never logs tokens/emails', !edgeFn.includes('console.log') && !edgeFn.includes('console.error'));
ok('edge fn: generic error on delete failure', edgeFn.includes('Account deletion failed') && !edgeFn.includes('deleteError.message'));

// ─────────────────────────────────────────────
// 7. Password confirmation UI
// ─────────────────────────────────────────────
console.log('\n7. Password Confirmation for Deletion');

ok('settings: deletePasswordInput exists', settings.includes('deletePasswordInput'));
ok('settings: deleteError element', settings.includes('deleteError'));
ok('settings: uses signInWithPassword for reauthentication', settings.includes('signInWithPassword'));
ok('settings: does NOT send password to Edge Function', !settings.match(/body.*password|password.*body.*delete-account/));
ok('settings: uses fresh token for Edge Function call', settings.includes('freshToken') || settings.includes('signInData.session.access_token'));
ok('settings: clears localStorage on success', settings.includes("localStorage.removeItem") || settings.includes("startsWith('amplifyHub_')"));
ok('settings: redirects after deletion', settings.includes("window.location.href = 'index.html"));

// ─────────────────────────────────────────────
// 8. Genuine data export
// ─────────────────────────────────────────────
console.log('\n8. Data Export');

ok('settings: exports user_preferences', settings.includes("'user_preferences'"));
ok('settings: exports user_lesson_progress', settings.includes("'user_lesson_progress'"));
ok('settings: exports coaching_sessions', settings.includes("'coaching_sessions'"));
ok('settings: exports coach_messages', settings.includes("'coach_messages'"));
ok('settings: exports coach_documents', settings.includes("'coach_documents'"));
ok('settings: exports user_challenge_assignments', settings.includes("'user_challenge_assignments'"));
ok('settings: exports user_challenge_feedback', settings.includes("'user_challenge_feedback'"));
ok('settings: has schemaVersion', settings.includes('schemaVersion'));
ok('settings: filename has date', settings.includes("amplifyhub-data-'"));
ok('settings: does not export access tokens', !settings.includes('access_token') || settings.includes('access_token') && settings.includes('freshToken'));

// ─────────────────────────────────────────────
// 9. Cascade migration
// ─────────────────────────────────────────────
console.log('\n9. Cascade Migration');

ok('cascade migration exists', await exists('supabase/migrations/20260720010000_ensure_cascade_deletes.sql'));

const migration = await read('supabase/migrations/20260720010000_ensure_cascade_deletes.sql');
ok('migration: coaching_sessions cascade', migration.includes('coaching_sessions') && migration.includes('ON DELETE CASCADE'));
ok('migration: coach_messages cascade', migration.includes('coach_messages') && migration.includes('ON DELETE CASCADE'));
ok('migration: coach_documents cascade', migration.includes('coach_documents') && migration.includes('ON DELETE CASCADE'));
ok('migration: references auth.users', migration.includes('auth.users(id)'));

// ─────────────────────────────────────────────
// 10. Config.toml
// ─────────────────────────────────────────────
console.log('\n10. Config');

const config = await read('supabase/config.toml');
ok('config: delete-account function section', config.includes('[functions.delete-account]'));
ok('config: verify_jwt = true for delete-account', config.includes('verify_jwt = true'));

// ─────────────────────────────────────────────
// 11. XSS safety checks
// ─────────────────────────────────────────────
console.log('\n11. XSS Safety');

ok('settings: connected accounts use textContent not innerHTML',
  settings.includes('renderConnectedAccounts') && !settings.match(/connectedAccountsCard[\s\S]{0,200}innerHTML/));
ok('sidebar-user.js: no innerHTML', !sidebarScript.includes('innerHTML'));
ok('settings: loadDeviceSessionInfo uses textContent/createElement',
  settings.includes('createElement') && !settings.match(/sessionsInfo[\s\S]{0,100}innerHTML|devicesInfo[\s\S]{0,100}innerHTML/));

// ─────────────────────────────────────────────
// 12. Safe auth redirects (open-redirect fix)
// ─────────────────────────────────────────────
console.log('\n12. Safe Auth Redirects');

for (const page of ['signin.html', 'signup.html']) {
  const content = await read(page);
  ok(`${page}: has ALLOWED_REDIRECTS whitelist`, content.includes('ALLOWED_REDIRECTS'));
  ok(`${page}: redirect param no longer used unvalidated`, !content.includes("params.get('redirect') || 'dashboard.html'"));
}

// ─────────────────────────────────────────────
// 13. Password recovery flow
// ─────────────────────────────────────────────
console.log('\n13. Password Recovery');

const signinPage = await read('signin.html');
ok('signin links to forgot-password.html', signinPage.includes('forgot-password.html'));

ok('forgot-password.html exists', await exists('forgot-password.html'));
const forgot = await read('forgot-password.html');
ok('forgot: uses resetPasswordForEmail', forgot.includes('resetPasswordForEmail'));
ok('forgot: redirects recovery to reset-password.html', forgot.includes('reset-password.html'));
ok('forgot: no user enumeration (same message either way)', forgot.includes('If an account exists'));
ok('forgot: noindex', forgot.includes('noindex'));
ok('forgot: truly disables submit (no pointerEvents hack)', forgot.includes('btn.disabled = true') && !forgot.includes('pointerEvents'));
ok('forgot: guards against repeated requests', forgot.includes('if (sending) return'));

ok('reset-password.html exists', await exists('reset-password.html'));
const reset = await read('reset-password.html');
ok('reset: uses updateUser to set password', reset.includes('updateUser'));
ok('reset: enforces 8-char minimum', reset.includes('at least 8 characters') || reset.includes('p1.length < 8'));
ok('reset: handles invalid/expired links', reset.includes('invalid or has expired'));
ok('reset: gated on PASSWORD_RECOVERY auth event', reset.includes("'PASSWORD_RECOVERY'") && reset.includes('onAuthStateChange'));
ok('reset: session fallback requires a real recovery link', reset.includes("=== 'recovery'"));
ok('reset: surfaces expired-link errors from the URL', reset.includes('error_code'));
ok('reset: never uses innerHTML', !reset.includes('innerHTML'));
ok('reset: noindex', reset.includes('noindex'));

// ─────────────────────────────────────────────
// 14. Export failure honesty
// ─────────────────────────────────────────────
console.log('\n14. Export Failure Honesty');

ok('settings: export tracks failed tables', settings.includes('failedTables'));
ok('settings: export refuses incomplete download', settings.includes('Nothing was downloaded'));
ok('settings: no silent empty-array fallback left', !settings.includes('function safeSelect'));

// ─────────────────────────────────────────────
// 15. CI, smoke, monitoring, release process
// ─────────────────────────────────────────────
console.log('\n15. CI / Smoke / Monitoring / Release');

const pkg = JSON.parse(await read('sales-mindset-app/package.json'));
ok('package.json: qa:account-trust script', !!pkg.scripts['qa:account-trust']);
ok('package.json: smoke:production script', !!pkg.scripts['smoke:production']);
ok('package.json: monitor:health script', !!pkg.scripts['monitor:health']);

ok('CI workflow exists', await exists('.github/workflows/qa.yml'));
const ci = await read('.github/workflows/qa.yml');
ok('CI runs build', ci.includes('npm run build'));
ok('CI runs account-trust QA', ci.includes('qa:account-trust'));
ok('CI runs browser QA suites', ci.includes('qa:profile-progress') && ci.includes('qa:challenges'));

ok('monitor workflow exists', await exists('.github/workflows/monitor.yml'));
const mon = await read('.github/workflows/monitor.yml');
ok('monitor runs on a schedule', mon.includes('schedule:'));

ok('smoke script exists', await exists('sales-mindset-app/scripts/smoke-production.mjs'));
const smoke = await read('sales-mindset-app/scripts/smoke-production.mjs');
ok('smoke: service key from env only', smoke.includes('process.env.SUPABASE_SERVICE_ROLE_KEY') && !smoke.includes('sb_secret'));
ok('smoke: no personal email committed', !smoke.includes('jawadwicda') && !smoke.includes('@gmail.com'));
ok('smoke: SMOKE_EMAIL_BASE required from env', smoke.includes('process.env.SMOKE_EMAIL_BASE') && smoke.includes('SMOKE_EMAIL_BASE is required'));
ok('smoke: tags disposable accounts with smoke_test metadata', smoke.includes('smoke_test: true'));
ok('smoke: sweep requires metadata tag AND own-base address', smoke.includes('u.user_metadata.smoke_test === true') && smoke.includes("baseLocal + '+smoke-'"));
ok('smoke: verifies deletion end-to-end', smoke.includes('signin after deletion fails'));

ok('monitor script exists', await exists('sales-mindset-app/scripts/monitor-health.mjs'));
const monScript = await read('sales-mindset-app/scripts/monitor-health.mjs');
ok('monitor: read-only (no signup/delete calls)', !monScript.includes('/signup') && !monScript.includes('admin/users'));

ok('RELEASE_CHECKLIST.md exists', await exists('RELEASE_CHECKLIST.md'));
const checklist = await read('RELEASE_CHECKLIST.md');
ok('checklist covers redirect-URL config', checklist.includes('reset-password.html'));
ok('checklist covers SMTP quota', checklist.includes('SMTP'));

// ─────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`QA Account Trust: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}\n`);

if (failed > 0) process.exit(1);
