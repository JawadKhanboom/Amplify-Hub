import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDir, '..', '..');

const config = JSON.parse(await readFile(path.join(siteRoot, 'vercel.json'), 'utf8'));
assert.equal(config.cleanUrls, true, 'legacy redirect sources must use extensionless URLs');

const redirects = new Map(
  (config.redirects || []).map(({ source, destination }) => [source, destination]),
);

for (let lesson = 1; lesson <= 8; lesson += 1) {
  assert.equal(
    redirects.get(`/sales-mindset-${lesson}`),
    `/sales-mindset/index?lesson=${lesson}`,
    `legacy Sales Mindset lesson ${lesson} redirects to the React lesson app`,
  );

  const source = await readFile(
    path.join(siteRoot, `sales-mindset-${lesson}.html`),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /href="sales-mindset-\d+\.html"/,
    `lesson ${lesson} contains no user-facing link to a legacy lesson route`,
  );
}

assert.equal(redirects.get('/Sales_mindset_lesson'), '/dashboard');
assert.equal(redirects.get('/emotional-journey'), '/journey');

for (const obsoleteFile of ['Sales_mindset_lesson.html', 'emotional-journey.html']) {
  await assert.rejects(
    access(path.join(siteRoot, obsoleteFile)),
    { code: 'ENOENT' },
    `${obsoleteFile} should be removed after its redirect is configured`,
  );
}

const catalog = await readFile(path.join(siteRoot, 'assets', 'resource-catalog.js'), 'utf8');
assert.match(
  catalog,
  /id: 'worksheets-rejection-log'[\s\S]*?route: 'sales-mindset\/index\.html#lesson-2'/,
  'Rejection Log routes to canonical React lesson 2',
);
assert.doesNotMatch(
  catalog,
  /route: 'sales-mindset-\d+\.html'/,
  'resource catalog contains no legacy Sales Mindset lesson route',
);

const migration = await readFile(
  path.join(
    siteRoot,
    'supabase',
    'migrations',
    '20260728003752_canonicalize_resource_lesson_route.sql',
  ),
  'utf8',
);
assert.match(
  migration,
  /where id = 'worksheets-rejection-log'/,
  'forward migration updates only the Rejection Log resource',
);
assert.match(
  migration,
  /related_route = 'sales-mindset\/index\.html#lesson-2'/,
  'forward migration stores the canonical React lesson route',
);

console.log('PASS: legacy lesson routes resolve to canonical destinations');
