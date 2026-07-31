import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import {
  ContactRequestError,
  MAX_BODY_BYTES,
  MAX_TURNSTILE_TOKEN_LENGTH,
  validateContactRequest,
} from '../../supabase/functions/submit-contact/request-security.ts';
import {
  buildCorsHeaders,
  getAllowedOrigin,
  parseAllowedOrigins,
} from '../../supabase/functions/submit-contact/cors-security.ts';
import {
  parseAllowedHostnames,
  validateTurnstileResult,
} from '../../supabase/functions/submit-contact/turnstile-security.ts';
import {
  buildContactNotification,
  getContactNotificationConfig,
  sendContactNotification,
} from '../../supabase/functions/submit-contact/contact-notification.ts';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appDir, '..');

const expectRequestError = (body, status, code) => {
  assert.throws(
    () => validateContactRequest(body),
    error => error instanceof ContactRequestError
      && error.status === status
      && error.code === code,
  );
};

const validRequest = {
  name: '  Ada Lovelace  ',
  email: '  ADA@EXAMPLE.COM  ',
  subject: '  Partnership  ',
  message: '  This is a valid contact message.  ',
  website: '',
  turnstileToken: 'verified-token',
};
const normalized = validateContactRequest(validRequest);
assert.equal(normalized.name, 'Ada Lovelace');
assert.equal(normalized.email, 'ada@example.com');
assert.equal(normalized.subject, 'Partnership');
assert.equal(normalized.message, 'This is a valid contact message.');
assert.equal(normalized.isBot, false);
assert.equal(MAX_BODY_BYTES, 16 * 1024);
assert.equal(MAX_TURNSTILE_TOKEN_LENGTH, 2048);

assert.equal(validateContactRequest({ website: 'bot.example' }).isBot, true);
expectRequestError(null, 400, 'INVALID_CONTACT_REQUEST');
expectRequestError({ ...validRequest, email: 'invalid' }, 400, 'INVALID_CONTACT_REQUEST');
expectRequestError({ ...validRequest, message: 'too short' }, 400, 'INVALID_CONTACT_REQUEST');
expectRequestError({ ...validRequest, turnstileToken: '' }, 400, 'TURNSTILE_REQUIRED');
expectRequestError(
  { ...validRequest, turnstileToken: 'x'.repeat(2049) },
  400,
  'INVALID_CONTACT_REQUEST',
);

const allowedOrigins = parseAllowedOrigins(
  'http://localhost:8742/, https://amplify-hub-six.vercel.app/',
);
assert.equal(
  getAllowedOrigin('https://amplify-hub-six.vercel.app', allowedOrigins),
  'https://amplify-hub-six.vercel.app',
);
assert.equal(getAllowedOrigin('https://evil.example', allowedOrigins), null);
assert.equal(
  buildCorsHeaders(
    'https://amplify-hub-six.vercel.app',
    allowedOrigins,
  )['Access-Control-Allow-Origin'],
  'https://amplify-hub-six.vercel.app',
);

const allowedHostnames = parseAllowedHostnames(
  'amplify-hub-six.vercel.app',
);
assert.equal(
  validateTurnstileResult(
    {
      success: true,
      action: 'contact',
      hostname: 'amplify-hub-six.vercel.app',
    },
    allowedHostnames,
  ),
  true,
);
for (const result of [
  { success: false, action: 'contact', hostname: 'amplify-hub-six.vercel.app' },
  { success: true, action: 'login', hostname: 'amplify-hub-six.vercel.app' },
  { success: true, action: 'contact', hostname: 'evil.example' },
]) {
  assert.equal(validateTurnstileResult(result, allowedHostnames), false);
}

const notificationEnvironment = new Map([
  ['RESEND_API_KEY', 're_test_key'],
  ['CONTACT_NOTIFICATION_TO', 'Owner@Example.com, backup@example.com'],
  ['CONTACT_NOTIFICATION_FROM', 'AmplifyHub <onboarding@resend.dev>'],
]);
const notificationConfig = getContactNotificationConfig(
  name => notificationEnvironment.get(name),
);
assert.deepEqual(notificationConfig, {
  apiKey: 're_test_key',
  from: 'AmplifyHub <onboarding@resend.dev>',
  to: ['owner@example.com', 'backup@example.com'],
});
assert.equal(getContactNotificationConfig(() => undefined), null);
assert.equal(
  getContactNotificationConfig(name => name === 'RESEND_API_KEY'
    ? 'invalid-key'
    : name === 'CONTACT_NOTIFICATION_TO'
      ? 'owner@example.com'
      : 'AmplifyHub <onboarding@resend.dev>'),
  null,
);

const notificationMessage = {
  id: 'message-123',
  name: '<script>Ada</script>',
  email: 'ada@example.com',
  subject: 'Partnership\r\nBcc: attacker@example.com',
  message: '<img src=x onerror=alert(1)>',
};
const notification = buildContactNotification(notificationMessage);
assert.doesNotMatch(notification.subject, /[\r\n]/);
assert.doesNotMatch(notification.html, /<script>|<img/);
assert.match(notification.html, /&lt;script&gt;Ada&lt;\/script&gt;/);
assert.match(notification.html, /&lt;img src=x onerror=alert\(1\)&gt;/);

let resendRequest = null;
const notificationResult = await sendContactNotification(
  notificationConfig,
  notificationMessage,
  async (url, options) => {
    resendRequest = { url, options };
    return new Response(JSON.stringify({ id: 'email-123' }), { status: 200 });
  },
);
assert.deepEqual(notificationResult, { ok: true, status: 200 });
assert.equal(resendRequest.url, 'https://api.resend.com/emails');
assert.equal(resendRequest.options.headers.Authorization, 'Bearer re_test_key');
assert.equal(
  resendRequest.options.headers['Idempotency-Key'],
  'contact-notification/message-123',
);
const resendBody = JSON.parse(resendRequest.options.body);
assert.deepEqual(resendBody.to, ['owner@example.com', 'backup@example.com']);
assert.equal(resendBody.reply_to, 'ada@example.com');
assert.doesNotMatch(resendBody.subject, /[\r\n]/);
assert.deepEqual(
  await sendContactNotification(
    notificationConfig,
    notificationMessage,
    async () => new Response('provider unavailable', { status: 503 }),
  ),
  { ok: false, status: 503 },
);

const [edgeSource, contactHtml, migration, config, vercel] = await Promise.all([
  readFile(path.join(siteRoot, 'supabase/functions/submit-contact/index.ts'), 'utf8'),
  readFile(path.join(siteRoot, 'contact.html'), 'utf8'),
  readFile(path.join(siteRoot, 'supabase/migrations/20260728062120_protect_contact_messages.sql'), 'utf8'),
  readFile(path.join(siteRoot, 'supabase/config.toml'), 'utf8'),
  readFile(path.join(siteRoot, 'vercel.json'), 'utf8'),
]);

assert.match(edgeSource,/TURNSTILE_SECRET_KEY/,'Turnstile secret stays server-side');
assert.match(edgeSource,/turnstile\/v0\/siteverify/,'server calls Turnstile Siteverify');
assert.match(edgeSource,/validateTurnstileResult/,'server validates action and hostname');
assert.match(edgeSource,/getAllowedOrigin/,'server rejects unapproved origins');
assert.match(edgeSource,/SUPABASE_SERVICE_ROLE_KEY/,'server performs the privileged insert');
assert.match(edgeSource,/insertError\?\.code === '42501'/,'pre-migration deployments retain a safe server-only insert bridge');
assert.match(edgeSource,/insertError\.code === '23514'/,'database rate limits become HTTP 429');
assert.match(edgeSource,/sendContactNotification/,'server sends a post-insert email notification');
assert.match(edgeSource,/email notification failed/,'notification failures are logged without losing the message');

assert.match(contactHtml,/data-sitekey="0x4AAAAAAD_tqmWYRjbPHntw"/,'contact page uses the approved public site key');
assert.match(contactHtml,/data-action="contact"/,'contact token is scoped to the contact action');
assert.match(contactHtml,/functions\/v1\/submit-contact/,'contact page calls the protected Edge Function');
assert.doesNotMatch(contactHtml,/from\(['"]contact_messages['"]\)/,'browser no longer writes directly to contact_messages');
assert.match(contactHtml,/window\.turnstile\?\.reset/,'failed submissions reset the single-use token');

assert.match(migration,/drop policy if exists "Anyone can leave a message"/,'permissive public policy is removed');
assert.match(migration,/revoke all privileges on public\.contact_messages[\s\S]*?from public, anon, authenticated, service_role/,'direct client table grants are removed');
assert.match(migration,/grant insert on public\.contact_messages to service_role/,'only the server can insert messages');
assert.match(migration,/pg_advisory_xact_lock/,'same-email rate checks are serialized');
assert.match(migration,/new\.email := lower\(btrim\(new\.email\)\)/,'email rate limits are case-normalized');
assert.match(config,/\[functions\.submit-contact\][\s\S]*?verify_jwt = false/,'public form endpoint has explicit auth configuration');
assert.match(vercel,/script-src[^;]*https:\/\/challenges\.cloudflare\.com/,'CSP allows the Turnstile script');
assert.match(vercel,/frame-src https:\/\/challenges\.cloudflare\.com/,'CSP allows the Turnstile iframe');

const browserCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
let browserPath = null;
for (const candidate of browserCandidates) {
  try {
    await access(candidate);
    browserPath = candidate;
    break;
  } catch {}
}
if (!browserPath) {
  throw new Error('Chrome or Edge was not found. Set CHROME_PATH to run contact QA.');
}

const server = await createServer({
  root: siteRoot,
  server: { host: '127.0.0.1', port: 4182, strictPort: false },
});
await server.listen();
const baseUrl = server.resolvedUrls?.local[0];
if (!baseUrl) throw new Error('Vite did not expose a local URL.');

const browser = await chromium.launch({
  executablePath: browserPath,
  headless: true,
  args: ['--disable-gpu', '--no-first-run'],
});

try {
  const page = await browser.newPage();
  let submittedBody = null;
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.turnstile={
      getResponse:()=> 'browser-verified-token',
      reset:()=>{window.__turnstileReset=(window.__turnstileReset||0)+1}
    };`,
  }));
  await page.route('**/functions/v1/submit-contact', async route => {
    const request = route.request();
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    submittedBody = request.postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());

  await page.goto(`${baseUrl}contact.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.turnstile));
  await page.locator('#cName').fill('Ada Lovelace');
  await page.locator('#cEmail').fill('ada@example.com');
  await page.locator('#cSubject').fill('Partnership');
  await page.locator('#cMessage').fill('This is a valid browser contact message.');
  await page.getByRole('button', { name: /Send Message/ }).click();
  await page.waitForSelector('#formSuccess.show');

  assert.equal(submittedBody.turnstileToken,'browser-verified-token');
  assert.equal(submittedBody.email,'ada@example.com');
  assert.equal(submittedBody.website,'');
  await page.close();

  const failurePage = await browser.newPage();
  await failurePage.route('https://challenges.cloudflare.com/turnstile/v0/api.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.turnstile={
      getResponse:()=> 'browser-verified-token',
      reset:()=>{window.__turnstileReset=(window.__turnstileReset||0)+1}
    };`,
  }));
  await failurePage.route('**/functions/v1/submit-contact', async route => {
    const request = route.request();
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Security verification failed. Please try again.',
        code: 'TURNSTILE_REJECTED',
      }),
    });
  });
  await failurePage.route('https://fonts.googleapis.com/**', route => route.abort());
  await failurePage.route('https://fonts.gstatic.com/**', route => route.abort());

  await failurePage.goto(`${baseUrl}contact.html`, { waitUntil: 'domcontentloaded' });
  await failurePage.waitForFunction(() => Boolean(window.turnstile));
  await failurePage.locator('#cName').fill('Ada Lovelace');
  await failurePage.locator('#cEmail').fill('ada@example.com');
  await failurePage.locator('#cMessage').fill('This request should show a safe failure.');
  await failurePage.getByRole('button', { name: /Send Message/ }).click();
  await failurePage.waitForFunction(() => {
    const error = document.getElementById('formError');
    return error && error.style.display === 'block';
  });
  assert.match(
    await failurePage.locator('#formError').textContent(),
    /Security verification failed/,
  );
  assert.equal(await failurePage.evaluate(() => window.__turnstileReset),1);
  await failurePage.close();
} finally {
  await browser.close();
  await server.close();
}

console.log('Contact security QA passed: validated requests, Turnstile enforcement, server-only inserts, email notifications, CSP, and browser success/failure flows.');
