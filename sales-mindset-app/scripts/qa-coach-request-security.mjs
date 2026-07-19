import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError, MAX_BODY_BYTES, validateRequest } from '../../supabase/functions/coach-chat/request-security.ts';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appDir, '..');
const catalog = {
  personas: ['skeptical_dm', 'gatekeeper'],
  scenarios: ['cold_call', 'discovery'],
};
const message = (role = 'user', content = 'hello') => ({ role, content });
const expectError = (fn, status, code) => {
  assert.throws(fn, error => error instanceof HttpError && error.status === status && error.code === code);
};

const valid = validateRequest({ mode: 'ask', messages: [message()] }, catalog);
assert.equal(valid.action, 'chat');
assert.equal(valid.messages.length, 1);

expectError(() => validateRequest(null, catalog), 400, 'INVALID_REQUEST');
expectError(() => validateRequest({ action: 'unknown', messages: [message()] }, catalog), 400, 'INVALID_ACTION');
expectError(() => validateRequest({ mode: 'unknown', messages: [message()] }, catalog), 400, 'INVALID_MODE');
expectError(() => validateRequest({ mode: 'ask', messages: [message('system')] }, catalog), 400, 'INVALID_MESSAGES');
expectError(() => validateRequest({ mode: 'ask', messages: [message('user', 'x'.repeat(2001))] }, catalog), 400, 'INVALID_MESSAGES');
expectError(() => validateRequest({ mode: 'ask', messages: Array.from({ length: 21 }, () => message()) }, catalog), 400, 'INVALID_MESSAGES');
expectError(() => validateRequest({ mode: 'ask', messages: Array.from({ length: 20 }, () => message('user', 'x'.repeat(1001))) }, catalog), 400, 'INVALID_MESSAGES');
expectError(() => validateRequest({ mode: 'ask', prefs: { persona: 'unknown' }, messages: [message()] }, catalog), 400, 'INVALID_PREFS');

const feedbackMessages = [
  message('user', 'one'), message('coach', 'reply'),
  message('user', 'two'), message('coach', 'reply'),
  message('user', 'three'), message('coach', 'reply'),
  message('user', 'four'), message('coach', 'reply'),
];
assert.equal(validateRequest({ action: 'feedback', messages: feedbackMessages }, catalog).messages.length, 8);
expectError(() => validateRequest({ action: 'feedback', messages: feedbackMessages.slice(0, 6) }, catalog), 400, 'INSUFFICIENT_FEEDBACK_TURNS');
expectError(() => validateRequest({ action: 'feedback', messages: Array.from({ length: 81 }, (_, i) => message(i % 2 ? 'coach' : 'user')) }, catalog), 400, 'INVALID_MESSAGES');

assert.equal(MAX_BODY_BYTES, 64 * 1024);

const edgeSource = await readFile(path.join(siteRoot, 'supabase/functions/coach-chat/index.ts'), 'utf8');
assert.match(edgeSource, /req\.method !== 'POST'/, 'Edge Function rejects non-POST methods');
assert.match(edgeSource, /PAYLOAD_TOO_LARGE/, 'Edge Function rejects oversized bodies');
assert.match(edgeSource, /consumeQuota\(supabaseClient, action\)/, 'Edge Function consumes quota before Gemini');
assert.match(edgeSource, /'Retry-After'/, 'rate-limit responses include Retry-After');

const migration = await readFile(path.join(siteRoot, 'supabase/migrations/20260719010000_coach_api_usage_limits.sql'), 'utf8');
assert.match(migration, /pg_advisory_xact_lock/, 'quota consumption is concurrency serialized');
assert.match(migration, /when 'chat'.*30/s, 'chat quota is 30');
assert.match(migration, /interval '10 minutes'/, 'chat window is 10 minutes');
assert.match(migration, /when 'feedback'.*10/s, 'feedback quota is 10');
assert.match(migration, /interval '1 hour'/, 'feedback window is one hour');
assert.match(migration, /revoke all on private\.coach_api_usage from public, anon, authenticated/, 'quota table has no direct client grants');

const coachStoreSource = await readFile(path.join(siteRoot, 'coach-store.js'), 'utf8');
assert.doesNotMatch(coachStoreSource, /\.upsert\(sessionData\)/, 'partial session saves do not use insert-style upserts');
assert.match(coachStoreSource, /table\.insert\(sessionData\)/, 'new sessions use INSERT with required columns');
assert.match(coachStoreSource, /table[\s\S]*\.update\(sessionData\)[\s\S]*\.eq\('id', sessionId\)/, 'existing sessions use UPDATE by ID');
assert.match(coachStoreSource, /Calling saveSession\(\{ id \}\)[\s\S]*\.select\('\*'\)/, 'activating an existing session performs a read-only lookup');

console.log('Coach request security QA passed: validation, limits, quota migration, and safe session updates.');
