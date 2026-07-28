import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appDir, '..');
const downloadsDir = path.join(siteRoot, 'assets', 'resources', 'downloads');

const catalogModule = await import(pathToFileURL(path.join(siteRoot, 'assets', 'resource-catalog.js')).href);
const catalog = catalogModule.default || catalogModule.ResourceCatalog;
const resources = catalog.resources;
const catalogRows = resources.map((resource) => ({
  id: resource.id,
  title: resource.title,
  category: resource.category,
  skill: resource.skill,
  difficulty: resource.difficulty,
  duration_minutes: resource.duration,
  summary: resource.summary,
  objectives: resource.objectives,
  content: resource.sections,
  example: resource.example,
  safe_practice: resource.safePractice,
  related_label: resource.related?.label || '',
  related_route: resource.related?.route || '',
  downloads: (resource.downloads || []).map((download) => ({
    format: download.format,
    path: `${resource.id}.${download.format}`,
  })),
  review_date: resource.reviewDate || catalog.reviewDate,
  status: resource.status,
  active: resource.active === true,
}));

/* ---------------------------------------------- Part A: static / structural */

// Catalog shape. Scripts were expanded to 20; the other categories remain 5.
const EXPECTED = { script: 20, template: 5, cheatsheet: 5, worksheet: 5, interview: 5 };
const TOTAL = Object.values(EXPECTED).reduce((a, b) => a + b, 0); // 40
const TOTAL_FILES = TOTAL * 2; // each resource ships pdf + one editable format
assert.equal(resources.length, TOTAL, `catalog holds exactly ${TOTAL} resources`);
const counts = catalog.categoryCounts();
for (const category of Object.keys(EXPECTED)) {
  assert.equal(counts[category], EXPECTED[category], `category ${category} has ${EXPECTED[category]} resources`);
}
const ids = new Set();
for (const r of resources) {
  assert.ok(r.id && !ids.has(r.id), `unique id: ${r.id}`);
  ids.add(r.id);
  for (const field of ['title', 'category', 'skill', 'difficulty', 'summary']) {
    assert.ok(r[field] && String(r[field]).trim(), `${r.id} has ${field}`);
  }
  assert.ok(Array.isArray(r.objectives) && r.objectives.length >= 3, `${r.id} has objectives`);
  assert.ok(Array.isArray(r.sections) && r.sections.length >= 1, `${r.id} has content sections`);
  assert.ok(r.example && (r.example.text || typeof r.example === 'string'), `${r.id} has a worked example`);
  assert.ok(r.safePractice && r.safePractice.trim(), `${r.id} has a safe-practice note`);
  assert.ok(r.related && r.related.route, `${r.id} has a related action route`);
  assert.ok(['beginner', 'intermediate', 'advanced'].includes(r.difficulty), `${r.id} difficulty valid`);
  assert.ok(['draft', 'reviewed'].includes(r.status), `${r.id} has an explicit publication status`);
  // Related routes must point at real pages.
  const routeFile = r.related.route.split('#')[0];
  await access(path.join(siteRoot, routeFile));
}

// Publication gate semantics.
const published = catalog.published();
assert.equal(published.length, TOTAL, `all ${TOTAL} approved resources are publicly published`);
assert.deepEqual(
  published.map((r) => r.id),
  resources.filter((r) => r.active === true && r.status === 'reviewed').map((r) => r.id),
  'published() is exactly active AND reviewed'
);
for (const r of resources.filter((x) => x.status !== 'reviewed')) {
  assert.ok(!catalog.isPublished(r), `${r.id} (draft) is never published merely because it is active`);
}
const pubCounts = catalog.publishedCounts();
for (const category of Object.keys(EXPECTED)) {
  assert.equal(pubCounts[category], EXPECTED[category], `published ${category} category has ${EXPECTED[category]} resources`);
}
assert.equal(
  Object.values(pubCounts).reduce((a, b) => a + b, 0),
  published.length,
  'publishedCounts() matches published()'
);

// Download presence + format rules + structural signatures.
const editableByCategory = { script: 'docx', cheatsheet: 'docx', interview: 'docx', worksheet: 'xlsx' };
let checkedFiles = 0;
for (const r of resources) {
  const formats = (r.downloads || []).map((d) => d.format);
  assert.ok(formats.includes('pdf'), `${r.id} offers a PDF`);
  if (r.category === 'template') {
    assert.ok(formats.includes('docx') || formats.includes('xlsx'), `${r.id} (template) offers docx or xlsx`);
  } else {
    assert.ok(formats.includes(editableByCategory[r.category]), `${r.id} offers ${editableByCategory[r.category]}`);
  }
  for (const format of formats) {
    const file = path.join(downloadsDir, `${r.id}.${format}`);
    await access(file);
    const info = await stat(file);
    assert.ok(info.size > 300, `${r.id}.${format} is non-trivial (${info.size} bytes)`);
    const fd = await readFile(file);
    if (format === 'pdf') {
      assert.ok(fd.subarray(0, 7).toString('latin1') === '%PDF-1.', `${r.id}.pdf has a PDF header`);
      assert.ok(fd.subarray(-8).toString('latin1').includes('%%EOF'), `${r.id}.pdf ends with %%EOF`);
    } else {
      assert.equal(fd.readUInt32LE(0), 0x04034b50, `${r.id}.${format} is a valid ZIP (docx/xlsx)`);
    }
    checkedFiles++;
  }
}
assert.equal(checkedFiles, TOTAL_FILES, `all ${TOTAL_FILES} download artifacts present and structurally valid`);

// XLSX quality: styles, column widths, and wrap must be present (visual-QA regression).
{
  const xlsx = await readFile(path.join(downloadsDir, 'worksheets-rejection-log.xlsx'));
  const asText = xlsx.toString('latin1');
  assert.ok(asText.includes('xl/styles.xml'), 'xlsx ships a stylesheet');
  assert.ok(asText.includes('customWidth="1"'), 'xlsx sets explicit column widths');
  assert.ok(asText.includes('wrapText="1"'), 'xlsx enables text wrap');
}

// Migration parity + publication-gated security.
const migration = await readFile(path.join(siteRoot, 'supabase/migrations/20260719040000_resource_library.sql'), 'utf8');
assert.equal((migration.match(/^ {2}\('/gm) || []).length, TOTAL, `migration seeds all ${TOTAL} resources`);
for (const r of resources) assert.ok(migration.includes(`'${r.id}'`), `migration seeds ${r.id}`);
assert.match(migration, /create table if not exists public\.resource_catalog/, 'migration creates resource_catalog');
assert.match(migration, /enable row level security/, 'RLS is enabled');
assert.match(
  migration,
  /for select to anon, authenticated using \(active = true and status = 'reviewed'\)/,
  'public read requires BOTH active and reviewed — drafts are never publicly readable'
);
// Least-privilege table grants: REVOKE ALL from every role first (including
// PUBLIC, which anon/authenticated/service_role would otherwise inherit
// REFERENCES/TRIGGER/TRUNCATE from by this project's default), then GRANT
// back only SELECT to anon/authenticated. The older, narrower
// "revoke insert, update, delete ... from anon, authenticated" pattern is
// intentionally NOT accepted as an alternative — it left service_role and
// the PUBLIC-default REFERENCES/TRIGGER/TRUNCATE privileges untouched.
assert.doesNotMatch(
  migration,
  /revoke insert, update, delete on public\.resource_catalog from anon, authenticated;/,
  'the old narrower REVOKE pattern must not remain as an alternative',
);
assert.match(
  migration,
  /revoke all privileges on public\.resource_catalog from public, anon, authenticated, service_role;/,
  'REVOKE ALL privileges stripped from PUBLIC, anon, authenticated, and service_role',
);
// Strip comment lines before counting GRANT statements — several comments
// above discuss grants in prose and would otherwise risk a false match.
const migrationCode = migration.replace(/^--.*$/gm, '');
const catalogGrants = migrationCode.match(/grant\s+[^;]*?\son\s+public\.resource_catalog\s+to\s+[^;]+;/gi) || [];
assert.equal(catalogGrants.length, 1, 'exactly one GRANT statement targets resource_catalog');
assert.equal(
  catalogGrants[0].replace(/\s+/g, ' ').trim(),
  'grant select on public.resource_catalog to anon, authenticated;',
  'the sole grant is SELECT-only, to anon and authenticated only — no INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, or TRIGGER for any application role',
);
assert.match(migration, /check \(category in \('script','template','cheatsheet','worksheet','interview'\)\)/, 'category constraint present');
for (const r of resources) {
  const expected = r.status === 'reviewed' ? 'reviewed' : 'draft';
  assert.ok(migration.includes(`'${r.id}'`) && migration.match(new RegExp(`'${r.id}',[\\s\\S]*?'${expected}',(true|false)\\)`)), `migration carries ${r.id} status=${expected}`);
}

// Phase 2 schema, grants, RPC safety, and static-client integration.
const catalogSyncMigration = await readFile(path.join(siteRoot, 'supabase/migrations/20260726104712_resource_catalog_sync.sql'), 'utf8');
const phase2Migration = await readFile(path.join(siteRoot, 'supabase/migrations/20260726104713_resources_phase_2.sql'), 'utf8');
const activityClient = await readFile(path.join(siteRoot, 'assets/resource-activity.js'), 'utf8');
const privateResourceClient = await readFile(path.join(siteRoot, 'assets/private-resource-store.js'), 'utf8');
const resourceDetailSource = await readFile(path.join(siteRoot, 'resource.html'), 'utf8');
const resourceLibrarySource = await readFile(path.join(siteRoot, 'resources.html'), 'utf8');
const interviewPrepSource = await readFile(path.join(siteRoot, 'interview-prep.html'), 'utf8');
const privateMigration = await readFile(path.join(siteRoot, 'supabase/migrations/20260727201707_privatize_resource_library.sql'), 'utf8');
const vercelIgnore = await readFile(path.join(siteRoot, '.vercelignore'), 'utf8');
const vercelConfig = JSON.parse(await readFile(path.join(siteRoot, 'vercel.json'), 'utf8'));

assert.match(resourceLibrarySource, /<script src="auth\.js"><\/script>/, 'resource library loads the shared auth guard');
assert.match(resourceLibrarySource, /<script>requireAuth\(\);<\/script>/, 'resource library requires a signed-in session');
assert.match(resourceDetailSource, /<script src="auth\.js"><\/script>/, 'resource detail loads the shared auth guard');
assert.match(resourceDetailSource, /<script>requireAuth\(\);<\/script>/, 'resource detail requires a signed-in session');
for (const [label, source] of [['resource library', resourceLibrarySource], ['resource detail', resourceDetailSource]]) {
  assert.match(source, /assets\/private-resource-store\.js/, `${label} loads the authenticated catalog client`);
  assert.doesNotMatch(source, /assets\/resource-catalog\.js/, `${label} does not ship the static catalog`);
  assert.doesNotMatch(source, /assets\/resources\/downloads\//, `${label} contains no public artifact URL`);
}
assert.match(privateResourceClient, /\.from\('resource_catalog'\)/, 'private catalog client reads resource_catalog');
assert.match(privateResourceClient, /\.eq\('active', true\)/, 'private catalog client enforces active rows');
assert.match(privateResourceClient, /\.eq\('status', 'reviewed'\)/, 'private catalog client enforces reviewed rows');
assert.match(privateResourceClient, /createSignedUrl\(objectPath, SIGNED_URL_TTL_SECONDS/, 'downloads use short-lived signed URLs');
assert.match(privateResourceClient, /SIGNED_URL_TTL_SECONDS\s*=\s*60/, 'signed URLs expire after 60 seconds');
assert.match(privateMigration, /revoke all privileges on public\.resource_catalog\s+from anon;/, 'anon loses catalog privileges');
assert.match(privateMigration, /for select\s+to authenticated\s+using \(active = true and status = 'reviewed'\)/, 'catalog RLS is authenticated and publication-gated');
assert.match(privateMigration, /'resource-downloads',\s*'resource-downloads',\s*false/, 'resource bucket is private');
assert.match(privateMigration, /on storage\.objects\s+for select\s+to authenticated\s+using \(bucket_id = 'resource-downloads'\)/, 'private objects are readable only by authenticated members');
assert.match(vercelIgnore, /^assets\/resource-catalog\.js$/m, 'static catalog is excluded from deployment');
assert.match(vercelIgnore, /^assets\/resources\/downloads\/$/m, 'download source artifacts are excluded from deployment');
assert.ok(
  vercelConfig.redirects.some((redirect) => redirect.source === '/assets/resources/downloads/:path*' && redirect.permanent === false),
  'legacy public artifact paths have a defensive temporary redirect',
);

assert.equal((migration.match(/^ {2}\('/gm) || []).length, 40, 'catalog migration stays synchronized with all 40 catalog rows');
const catalogSyncIds = [...catalogSyncMigration.matchAll(/^ {2}\('([^']+)'/gm)].map((match) => match[1]);
assert.equal(catalogSyncIds.length, TOTAL, 'catalog sync contains exactly 40 resource rows');
assert.equal(new Set(catalogSyncIds).size, TOTAL, 'catalog sync resource IDs are unique');
assert.deepEqual(
  [...catalogSyncIds].sort(),
  resources.map((resource) => resource.id).sort(),
  'catalog sync carries every authoritative catalog ID verbatim',
);
const catalogUpsertMarker = 'insert into public.resource_catalog';
const catalogSeedUpsertIndex = migration.indexOf(catalogUpsertMarker);
const catalogSyncUpsertIndex = catalogSyncMigration.indexOf(catalogUpsertMarker);
const catalogSeedUpsert = migration.slice(catalogSeedUpsertIndex);
const catalogSyncUpsert = catalogSyncMigration.slice(catalogSyncUpsertIndex);
assert.ok(catalogSeedUpsert.startsWith(catalogUpsertMarker), 'catalog seed contains its generated upsert block');
assert.equal(catalogSyncUpsert, catalogSeedUpsert, 'catalog sync replays the generated 40-row upsert block verbatim');
assert.deepEqual(
  catalogSyncMigration.slice(0, catalogSyncUpsertIndex)
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('--')),
  [],
  'catalog sync contains only comments/whitespace before the verbatim upsert',
);
assert.match(catalogSyncMigration, /insert into public\.resource_catalog/, 'catalog sync targets resource_catalog');
assert.match(catalogSyncMigration, /on conflict \(id\) do update set/, 'catalog sync is a replay-safe upsert');
const catalogSyncCode = catalogSyncMigration.replace(/^--.*$/gm, '');
assert.doesNotMatch(
  catalogSyncCode,
  /^\s*(?:create|alter|drop)\s+table\b/gim,
  'catalog sync contains no table DDL',
);
assert.doesNotMatch(
  catalogSyncCode,
  /^\s*(?:create|alter|drop)\s+policy\b/gim,
  'catalog sync contains no policy DDL',
);
assert.doesNotMatch(
  catalogSyncCode,
  /^\s*(?:create|alter|drop)\s+(?:unique\s+)?index\b/gim,
  'catalog sync contains no index DDL',
);
assert.doesNotMatch(
  catalogSyncCode,
  /^\s*(?:grant|revoke)\b/gim,
  'catalog sync contains no privilege changes',
);
assert.match(
  phase2Migration,
  /resource_id text not null references public\.resource_catalog\(id\) on delete cascade/,
  'resource activity uses the catalog text key with cascading cleanup',
);
assert.doesNotMatch(phase2Migration, /resource_id uuid/, 'resource activity never guesses a uuid catalog key');
assert.match(phase2Migration, /\r?\n  helpful boolean,\r?\n/, 'helpful is nullable for the one-way useful affordance');
assert.doesNotMatch(phase2Migration, /helpful boolean not null/, 'helpful remains nullable');
assert.match(phase2Migration, /primary key \(user_id, resource_id\)/, 'resource activity is unique per user and resource');
assert.match(
  phase2Migration,
  /create index if not exists user_resource_activity_resource_id_idx\s+on public\.user_resource_activity \(resource_id\)/,
  'resource_id foreign key has a covering index',
);
assert.match(
  phase2Migration,
  /user_id uuid primary key references auth\.users\(id\) on delete cascade/,
  'interview prep primary key covers its cascading user foreign key',
);

for (const table of ['user_resource_activity', 'user_interview_prep']) {
  assert.match(
    phase2Migration,
    new RegExp(`alter table public\\.${table} enable row level security`),
    `${table} has RLS enabled`,
  );
  assert.match(
    phase2Migration,
    new RegExp(
      `create policy[\\s\\S]*?on public\\.${table}[\\s\\S]*?to authenticated` +
      `[\\s\\S]*?using \\(\\(select auth\\.uid\\(\\)\\) = user_id\\)` +
      `[\\s\\S]*?with check \\(\\(select auth\\.uid\\(\\)\\) = user_id\\)`,
    ),
    `${table} policy is authenticated, owner-scoped, and init-plan cached`,
  );
  assert.match(
    phase2Migration,
    new RegExp(
      `revoke all privileges on public\\.${table}\\s+from public, anon, authenticated, service_role;` +
      `[\\s\\S]*?grant select, insert, update, delete on public\\.${table}\\s+to authenticated;`,
    ),
    `${table} exposes authenticated CRUD only, with RLS deciding the rows`,
  );
}

assert.equal((phase2Migration.match(/security invoker\s+set search_path = ''/g) || []).length, 2, 'both Phase 2 RPCs are security-invoker with a fixed empty search_path');
assert.match(
  phase2Migration,
  /create or replace function public\.record_resource_download\(p_resource_id text\)[\s\S]*?returns public\.user_resource_activity[\s\S]*?download_count = public\.user_resource_activity\.download_count \+ 1/,
  'download RPC atomically increments and returns the owner activity row',
);
assert.match(
  phase2Migration,
  /create or replace function public\.migrate_legacy_interview_prep\([\s\S]*?p_legacy_updated_at timestamptz[\s\S]*?returns public\.user_interview_prep/,
  'legacy migration RPC accepts the verified legacy field map',
);
assert.match(
  phase2Migration,
  /insert into public\.user_interview_prep as existing \(\s*user_id,\s*opener,\s*objections,\s*rejection,\s*routine,\s*why,\s*first_call_done,\s*legacy_migrated_at,\s*updated_at\s*\)\s*values \(\s*v_user_id,\s*coalesce\(p_opener, ''\),\s*coalesce\(p_objections, ''\),\s*coalesce\(p_rejection, ''\),\s*coalesce\(p_routine, ''\),\s*coalesce\(p_why, ''\),\s*coalesce\(p_first_call_done, false\),\s*pg_catalog\.now\(\),\s*coalesce\(p_legacy_updated_at, pg_catalog\.now\(\)\)\s*\)\s*on conflict \(user_id\)/,
  'first-time legacy migration maps every field and sets its one-time marker',
);
assert.match(phase2Migration, /where existing\.legacy_migrated_at is null/, 'legacy merge is guarded by the one-time marker');
for (const field of ['opener', 'objections', 'rejection', 'routine', 'why']) {
  assert.match(
    phase2Migration,
    new RegExp(`when pg_catalog\\.btrim\\(existing\\.${field}\\) = '' then excluded\\.${field}[\\s\\S]*?else existing\\.${field}`),
    `legacy ${field} fills a blank cloud value without overwriting a non-blank value`,
  );
}
assert.match(phase2Migration, /first_call_done = existing\.first_call_done or excluded\.first_call_done/, 'first-call completion can never be erased by legacy data');
assert.match(phase2Migration, /legacy_migrated_at = pg_catalog\.now\(\)/, 'successful conflict-path migration sets its one-time marker');

for (const signature of [
  'public\\.record_resource_download\\(text\\)',
  'public\\.migrate_legacy_interview_prep\\([\\s\\S]*?timestamptz[\\s\\S]*?\\)',
]) {
  assert.match(
    phase2Migration,
    new RegExp(
      `revoke all privileges on function ${signature}\\s+from public, anon, authenticated, service_role;` +
      `[\\s\\S]*?grant execute on function ${signature}\\s+to authenticated;`,
    ),
    'Phase 2 RPC execute privilege is authenticated-only',
  );
}

assert.match(activityClient, /typeof supabaseClient !== 'undefined'/, 'activity client uses the lexical Supabase binding');
assert.match(activityClient, /client\.auth\.getUser\(\)/, 'activity operations verify the current user');
assert.match(activityClient, /SELECT_FIELDS\s*=\s*'[^']*\bhelpful\b[^']*'/, 'activity hydration explicitly selects helpful');
assert.match(activityClient, /onConflict: 'user_id,resource_id'/, 'activity writes use the composite conflict target');
assert.match(activityClient, /defaultToNull: false/, 'partial activity upserts preserve fields they do not own');
assert.match(activityClient, /client\.rpc\('record_resource_download'/, 'downloads use the atomic RPC');
assert.match(interviewPrepSource, /function getLegacySupabaseClient\(\)/, 'interview page guards access to the lexical Supabase binding');
assert.match(interviewPrepSource, /typeof\s+supabaseClient\s*!==\s*'undefined'/, 'interview page feature-detects the lexical Supabase binding safely');
assert.match(interviewPrepSource, /LEGACY_MIGRATION_OWNER_KEY/, 'legacy migration records a persistent browser-owner claim');
assert.match(interviewPrepSource, /if\(!claimLegacyPortfolio\(user\.id\)\)return;/, 'another account cannot claim the same browser-global portfolio');
assert.match(interviewPrepSource, /client\.rpc\(LEGACY_MIGRATION_RPC/, 'interview page invokes the one-time migration RPC through the guarded client');
assert.match(interviewPrepSource, /p_legacy_updated_at:legacyUpdatedAt\(portfolio\.updatedAt\)/, 'legacy epoch milliseconds are normalized before migration');

for (const [label, source] of [
  ['resource detail', resourceDetailSource],
  ['resource library', resourceLibrarySource],
  ['interview prep', interviewPrepSource],
]) {
  assert.match(source, /assets\/vendor\/supabase-2\.110\.8\.min\.js/, `${label} uses the pinned self-hosted Supabase client`);
  assert.doesNotMatch(source, /<script[^>]+src=["']https?:\/\/[^"']*supabase/i, `${label} adds no Supabase CDN origin`);
}

console.log(`Static QA passed: ${TOTAL}-resource catalog + migration parity, publication gate, ${TOTAL_FILES} valid artifacts, Phase 2 RLS/grants/indexes, secure RPCs, and self-hosted sync clients.`);

/* ---------------------------------------------------- Part B: browser tests */

const QA_BACKEND_KEY = '__amplifyhub_resource_qa_backend_v1';

function mockSupabaseScript(fixture = {}) {
  const initial = {
    user: fixture.user || null,
    tables: {
      resource_catalog: fixture.catalogRows || catalogRows,
      user_resource_activity: fixture.activityRows || [],
      user_interview_prep: fixture.interviewRows || [],
      user_lesson_progress: [],
    },
    calls: {
      getUser: 0,
      tableReads: 0,
      tableWrites: 0,
      rpcCalls: 0,
      rpcWrites: 0,
      rpcByName: {},
      signedUrlCalls: 0,
    },
  };

  return `
    (function () {
      const STATE_KEY = ${JSON.stringify(QA_BACKEND_KEY)};
      const INITIAL = ${JSON.stringify(initial)};

      function clone(value) {
        return JSON.parse(JSON.stringify(value));
      }

      function readState() {
        const raw = localStorage.getItem(STATE_KEY);
        return raw ? JSON.parse(raw) : clone(INITIAL);
      }

      function writeState(state) {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
        window.__qaSupabaseState = clone(state);
      }

      if (!localStorage.getItem(STATE_KEY)) writeState(clone(INITIAL));
      window.__readQaSupabaseState = readState;
      const authCallbacks = [];
      window.__setQaUser = (user) => {
        const state = readState();
        state.user = user || null;
        writeState(state);
        const session = user ? { access_token: 'qa-token', user } : null;
        const event = user ? 'SIGNED_IN' : 'SIGNED_OUT';
        authCallbacks.slice().forEach((callback) => callback(event, session));
      };

      function currentUser() {
        return readState().user || null;
      }

      function resourceDefaults(payload) {
        const now = new Date().toISOString();
        return {
          user_id: payload.user_id,
          resource_id: payload.resource_id,
          bookmarked: false,
          helpful: null,
          last_viewed_at: null,
          download_count: 0,
          created_at: now,
          updated_at: now,
        };
      }

      function rowMatches(table, row, payload) {
        if (table === 'user_resource_activity') {
          return row.user_id === payload.user_id && row.resource_id === payload.resource_id;
        }
        if (table === 'user_lesson_progress') {
          return row.user_id === payload.user_id && row.lesson_id === payload.lesson_id;
        }
        if (table === 'user_interview_prep') return row.user_id === payload.user_id;
        return false;
      }

      function makeBuilder(table) {
        let action = 'select';
        let payload = null;
        const filters = [];
        let ordering = null;
        let selectedColumns = null;

        function selectedRows(state) {
          let rows = (state.tables[table] || []).filter((row) =>
            filters.every((filter) => row[filter.column] === filter.value)
          );
          if (ordering) {
            rows = rows.slice().sort((a, b) => {
              const av = a[ordering.column];
              const bv = b[ordering.column];
              if (av == null && bv == null) return 0;
              if (av == null) return ordering.nullsFirst ? -1 : 1;
              if (bv == null) return ordering.nullsFirst ? 1 : -1;
              if (av === bv) return 0;
              const direction = av < bv ? -1 : 1;
              return ordering.ascending ? direction : -direction;
            });
          }
          return rows;
        }

        function projectRow(row) {
          if (!selectedColumns || selectedColumns.includes('*')) return row;
          return Object.fromEntries(selectedColumns.map((column) => [column, row[column]]));
        }

        function execute(mode) {
          const state = readState();
          state.tables[table] = state.tables[table] || [];
          let rows;

          if (action === 'upsert') {
            const inputs = Array.isArray(payload) ? payload : [payload];
            rows = inputs.map((item) => {
              const index = state.tables[table].findIndex((row) => rowMatches(table, row, item));
              const existing = index === -1 ? null : state.tables[table][index];
              const base = table === 'user_resource_activity'
                ? resourceDefaults(item)
                : {};
              const saved = Object.assign({}, base, existing || {}, item);
              if (index === -1) state.tables[table].push(saved);
              else state.tables[table][index] = saved;
              return saved;
            });
            if (table === 'user_resource_activity' || table === 'user_interview_prep') {
              state.calls.tableWrites += inputs.length;
            }
          } else {
            rows = selectedRows(state);
            if (table === 'user_resource_activity' || table === 'user_interview_prep') {
              state.calls.tableReads += 1;
            }
          }

          writeState(state);
          const projectedRows = rows.map(projectRow);
          if (mode === 'single') return { data: projectedRows[0] || null, error: rows.length ? null : { message: 'Row not found' } };
          if (mode === 'maybeSingle') return { data: projectedRows[0] || null, error: null };
          return { data: projectedRows, error: null };
        }

        const builder = {
          select(columns) {
            selectedColumns = typeof columns === 'string'
              ? columns.split(',').map((column) => column.trim()).filter(Boolean)
              : null;
            return builder;
          },
          eq(column, value) { filters.push({ column, value }); return builder; },
          order(column, options) {
            ordering = {
              column,
              ascending: !options || options.ascending !== false,
              nullsFirst: !!(options && options.nullsFirst),
            };
            return builder;
          },
          upsert(value) { action = 'upsert'; payload = value; return builder; },
          maybeSingle() { return Promise.resolve(execute('maybeSingle')); },
          single() { return Promise.resolve(execute('single')); },
          then(resolve, reject) { return Promise.resolve(execute('many')).then(resolve, reject); },
        };
        return builder;
      }

      function laterTimestamp(left, right) {
        if (!left) return right;
        if (!right) return left;
        return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
      }

      function rpc(name, args) {
        const request = Promise.resolve().then(() => {
          const state = readState();
          state.calls.rpcCalls += 1;
          state.calls.rpcByName[name] = (state.calls.rpcByName[name] || 0) + 1;
          const user = state.user;
          if (!user) {
            writeState(state);
            return { data: null, error: { message: 'Authentication required', code: '28000' } };
          }

          if (name === 'record_resource_download') {
            const table = state.tables.user_resource_activity;
            let row = table.find((item) =>
              item.user_id === user.id && item.resource_id === args.p_resource_id
            );
            if (!row) {
              row = resourceDefaults({ user_id: user.id, resource_id: args.p_resource_id });
              table.push(row);
            }
            row.download_count += 1;
            row.updated_at = new Date().toISOString();
            state.calls.rpcWrites += 1;
            writeState(state);
            return { data: clone(row), error: null };
          }

          if (name === 'migrate_legacy_interview_prep') {
            const table = state.tables.user_interview_prep;
            let row = table.find((item) => item.user_id === user.id);
            const now = new Date().toISOString();
            const legacyUpdatedAt = args.p_legacy_updated_at || now;
            let changed = false;

            if (!row) {
              row = {
                user_id: user.id,
                opener: args.p_opener || '',
                objections: args.p_objections || '',
                rejection: args.p_rejection || '',
                routine: args.p_routine || '',
                why: args.p_why || '',
                first_call_done: args.p_first_call_done === true,
                legacy_migrated_at: now,
                updated_at: legacyUpdatedAt,
              };
              table.push(row);
              changed = true;
            } else if (!row.legacy_migrated_at) {
              for (const field of ['opener', 'objections', 'rejection', 'routine', 'why']) {
                if (typeof row[field] !== 'string' || row[field].trim() === '') {
                  row[field] = args['p_' + field] || '';
                }
              }
              row.first_call_done = row.first_call_done === true || args.p_first_call_done === true;
              row.legacy_migrated_at = now;
              row.updated_at = laterTimestamp(row.updated_at, legacyUpdatedAt);
              changed = true;
            }

            if (changed) state.calls.rpcWrites += 1;
            writeState(state);
            return { data: clone(row), error: null };
          }

          writeState(state);
          return { data: null, error: null };
        });
        request.abortSignal = () => request;
        return request;
      }

      const db = {
        auth: {
          getSession: async () => {
            const user = currentUser();
            return { data: { session: user ? { access_token: 'qa-token', user } : null }, error: null };
          },
          getUser: async () => {
            const state = readState();
            state.calls.getUser += 1;
            writeState(state);
            return { data: { user: state.user || null }, error: null };
          },
          onAuthStateChange(callback) {
            authCallbacks.push(callback);
            setTimeout(() => {
              const user = currentUser();
              callback('INITIAL_SESSION', user ? { access_token: 'qa-token', user } : null);
            }, 0);
            return { data: { subscription: { unsubscribe() {} } } };
          },
        },
        from(table) { return makeBuilder(table); },
        rpc,
        storage: {
          from(bucket) {
            return {
              async createSignedUrl(objectPath, expiresIn) {
                const state = readState();
                if (!state.user) return { data: null, error: { message: 'Authentication required' } };
                state.calls.signedUrlCalls += 1;
                state.calls.lastSignedUrl = { bucket, objectPath, expiresIn };
                writeState(state);
                return {
                  data: { signedUrl: location.origin + '/__qa-private-download/' + encodeURIComponent(objectPath) },
                  error: null,
                };
              },
            };
          },
        },
      };

      window.supabase = { createClient: () => db };
    })();
  `;
}

async function installMockSupabase(page, fixture) {
  await page.route('**/assets/vendor/supabase-*.min.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: mockSupabaseScript(fixture),
  }));
  await page.route('**/__qa-private-download/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/octet-stream',
    headers: { 'Content-Disposition': 'attachment; filename="private-resource.bin"' },
    body: 'private resource qa payload',
  }));
}

async function readMockState(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), QA_BACKEND_KEY);
}

const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
let chromePath = null;
for (const candidate of candidates) { try { await access(candidate); chromePath = candidate; break; } catch {} }
if (!chromePath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH to run resource QA.');

const server = await createServer({ root: siteRoot, server: { host: '127.0.0.1', port: 4188, strictPort: false } });
await server.listen();
const baseUrl = server.resolvedUrls?.local[0];
if (!baseUrl) throw new Error('Vite did not expose a local URL.');

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--disable-gpu', '--no-first-run'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
await installMockSupabase(page, { user: null });
await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
await page.route('https://fonts.gstatic.com/**', (route) => route.abort());

async function newMockedPage(fixture) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mockedPage = await context.newPage();
  await installMockSupabase(mockedPage, fixture);
  await mockedPage.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await mockedPage.route('https://fonts.gstatic.com/**', (route) => route.abort());
  return { context, page: mockedPage };
}

const draftCount = resources.filter((r) => r.status !== 'reviewed').length;
const publishedCount = resources.length - draftCount;

try {
  await page.goto(`${baseUrl}resources.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/signin\.html\?redirect=resources\.html$/);
  assert.match(
    page.url(),
    /signin\.html\?redirect=resources\.html$/,
    'anonymous library visit redirects to sign-in and preserves the destination',
  );
  await page.goto(`${baseUrl}resource.html?id=${encodeURIComponent(resources[0].id)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/signin\.html\?redirect=resource\.html%3Fid%3D/);
  assert.match(
    page.url(),
    /signin\.html\?redirect=resource\.html%3Fid%3D/,
    'anonymous detail visit redirects before content loads and preserves the resource id',
  );
  await page.evaluate(() => window.__setQaUser({
    id: 'resource-library-viewer',
    email: 'resource-library-viewer@example.test',
    user_metadata: {},
  }));

  // --- SIGNED-IN library: only published resources, drafts never listed ---
  await page.goto(`${baseUrl}resources.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#resCount');
  assert.ok(!page.url().includes('signin'), 'signed-in visitor can open the library');
  assert.equal(await page.locator('.res').count(), publishedCount, `member view lists exactly ${publishedCount} published resources (drafts excluded)`);
  if (publishedCount === 0) {
    assert.match(await page.locator('#emptyState').innerText(), /final editorial review/i, 'member empty state explains the review gate honestly');
    assert.match(await page.locator('#modeBannerText').innerText(), /editorial review/i, 'member banner explains nothing shows until reviewed');
  }
  assert.match(await page.locator('.flt', { hasText: 'All' }).innerText(), new RegExp(`All \\(${publishedCount}\\)`), 'public All count is derived from published resources only');

  // Query parameters cannot bypass the authenticated, reviewed-only query.
  await page.goto(`${baseUrl}resources.html?preview=review`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.res');
  assert.equal(await page.locator('.res').count(), publishedCount, 'preview parameter cannot expose unpublished rows');
  assert.match(await page.locator('#modeBannerText').innerText(), /Reviewed resources/i, 'member banner describes the reviewed catalog');
  assert.equal(await page.locator('.res-draft').count(), 0, 'the member response contains no draft chips');

  // Catalog-derived counts.
  assert.match(await page.locator('.flt', { hasText: 'All' }).innerText(), new RegExp(`All \\(${publishedCount}\\)`), 'All filter shows the authenticated catalog total');
  assert.match(await page.locator('.flt', { hasText: 'Scripts' }).innerText(), new RegExp(`\\(${EXPECTED.script}\\)`), 'Scripts chip shows derived count');
  assert.equal(await page.locator('.type-card').count(), 5, 'five category type cards (videos removed)');
  assert.equal(await page.locator('.type-card').evaluateAll((cards) => cards.every((card) => card.tagName === 'BUTTON')), true, 'category cards are semantic buttons');

  // A dashboard/category link opens the library already filtered to that type.
  await page.goto(`${baseUrl}resources.html?category=script`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.res');
  assert.equal(await page.locator('.res').count(), EXPECTED.script, `direct Scripts URL renders the ${EXPECTED.script} script resources`);
  assert.equal(await page.locator('#gridHeading').innerText(), 'Scripts', 'direct Scripts URL labels the filtered grid');
  const scriptsCard = page.locator('.type-card', { hasText: 'Scripts' });
  assert.equal(await scriptsCard.getAttribute('aria-pressed'), 'true', 'Scripts category control exposes its selected state');

  // Return to the complete member view.
  await page.goto(`${baseUrl}resources.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.res');

  // No fake/removed content.
  for (const banned of ['Community Picks', 'Learning Paths', 'Videos', '% complete', 'saves', 'comments', 'Most Saved']) {
    assert.equal(await page.getByText(banned, { exact: false }).count(), 0, `removed fake content: ${banned}`);
  }

  // Category filter.
  await page.locator('.type-card', { hasText: 'Cheat Sheets' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.res').length === 5);
  assert.match(await page.locator('#resCount').innerText(), /Showing 5 resources/, 'count reflects filter');

  // Search.
  await page.locator('.type-card', { hasText: 'Cheat Sheets' }).click(); // toggle back to all
  await page.locator('#searchInput').fill('objection');
  await page.locator('#searchBtn').click();
  const searchHits = await page.locator('.res').count();
  assert.ok(searchHits >= 1 && searchHits < TOTAL, `search narrows results (${searchHits})`);
  await page.locator('#searchInput').fill('');
  await page.waitForFunction((n) => document.querySelectorAll('.res').length === n, publishedCount);

  // Cards stay on the private member route.
  const firstHref = await page.locator('.res').first().getAttribute('href');
  assert.match(firstHref, /^resource\.html\?id=.+$/, 'member cards link into private detail pages');

  // --- Every published resource opens on the private detail page ---
  for (const r of resources.filter((resource) => resource.status === 'reviewed' && resource.active === true)) {
    await page.goto(`${baseUrl}resource.html?id=${encodeURIComponent(r.id)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1.title');
    const heading = await page.locator('h1.title').innerText();
    assert.ok(heading.trim().length > 0, `${r.id} renders a title`);
    assert.equal(await page.locator('.tb.dl').count(), (r.downloads || []).length, `${r.id} shows its download buttons`);
  }

  // --- Member detail page: drafts are blocked by the catalog query ---
  const draftSample = resources.find((r) => r.status !== 'reviewed');
  if (draftSample) {
    await page.goto(`${baseUrl}resource.html?id=${encodeURIComponent(draftSample.id)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.notfound');
    assert.match(await page.locator('.notfound').innerText(), /not published yet/i, 'draft accessed publicly shows the unpublished state, never content');
    assert.equal(await page.locator('h1.title').count(), 0, 'no draft content leaks publicly');
  }
  await page.goto(`${baseUrl}resource.html?id=does-not-exist`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.notfound');
  assert.match(await page.locator('.notfound').innerText(), /Resource not found/i, 'invalid id shows the not-found state');

  // --- Detail page behaviour on one representative private resource ---
  const sample = resources[0];
  await page.goto(`${baseUrl}resource.html?id=${encodeURIComponent(sample.id)}`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('h1.title').innerText(), sample.title, 'detail title matches catalog');
  assert.ok(await page.locator('.toolbar .tb', { hasText: 'Copy' }).count() === 1, 'Copy action present');
  assert.ok(await page.locator('.toolbar .tb', { hasText: 'Print' }).count() === 1, 'Print/Save-as-PDF action present');
  assert.ok(await page.locator('.related a', { hasText: 'Go' }).count() === 1, 'related action present');
  const relHref = await page.locator('.related a').getAttribute('href');
  assert.equal(relHref, sample.related.route, 'related action points at the catalog route');

  assert.equal(await page.locator('.tb.dl').first().getAttribute('href'), null, 'download control contains no reusable public href');

  // --- Authenticated resource activity: view, bookmark, useful, download, reload, library ---
  const qaUser = { id: 'resource-qa-user', email: 'resource-qa@example.test', user_metadata: { full_name: 'Resource QA' } };
  const signedIn = await newMockedPage({ user: qaUser });
  const signedInErrors = [];
  signedIn.page.on('pageerror', (error) => signedInErrors.push(error.message));
  try {
    await signedIn.page.goto(`${baseUrl}resource.html?id=${encodeURIComponent(sample.id)}`, { waitUntil: 'domcontentloaded' });
    await signedIn.page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('.save-row button'));
      return buttons.length === 2 && buttons.every((button) => !button.disabled);
    });
    await signedIn.page.waitForFunction(({ key, id }) => {
      const state = JSON.parse(localStorage.getItem(key));
      const row = state.tables.user_resource_activity.find((item) => item.resource_id === id);
      return !!(row && row.last_viewed_at);
    }, { key: QA_BACKEND_KEY, id: sample.id });

    const signedBookmark = signedIn.page.getByRole('button', { name: /Bookmark/i });
    await signedBookmark.click();
    await signedIn.page.waitForFunction(({ key, id }) => {
      const state = JSON.parse(localStorage.getItem(key));
      return state.tables.user_resource_activity.some((row) => row.resource_id === id && row.bookmarked === true);
    }, { key: QA_BACKEND_KEY, id: sample.id });
    assert.equal(await signedBookmark.getAttribute('aria-pressed'), 'true', 'signed-in bookmark exposes its saved state');

    await signedIn.page.reload({ waitUntil: 'domcontentloaded' });
    await signedIn.page.waitForFunction(() => {
      const button = Array.from(document.querySelectorAll('.save-row button')).find((item) => /bookmark/i.test(item.textContent));
      return !!button && !button.disabled && button.getAttribute('aria-pressed') === 'true';
    });
    assert.equal(
      await signedIn.page.getByRole('button', { name: /Bookmarked/i }).getAttribute('aria-pressed'),
      'true',
      'bookmark round-trips across reload',
    );

    let signedUseful = signedIn.page.getByRole('button', { name: /useful/i });
    await signedUseful.click();
    await signedIn.page.waitForFunction(({ key, id }) => {
      const state = JSON.parse(localStorage.getItem(key));
      const row = state.tables.user_resource_activity.find((item) => item.resource_id === id);
      return !!row && row.helpful === true;
    }, { key: QA_BACKEND_KEY, id: sample.id });
    assert.equal(await signedUseful.getAttribute('aria-pressed'), 'true', 'useful toggle stores true');

    await signedIn.page.reload({ waitUntil: 'domcontentloaded' });
    await signedIn.page.waitForFunction(() => {
      const button = Array.from(document.querySelectorAll('.save-row button'))
        .find((item) => /useful/i.test(item.textContent));
      return !!button && !button.disabled && button.getAttribute('aria-pressed') === 'true';
    });
    signedUseful = signedIn.page.getByRole('button', { name: /useful/i });
    assert.equal(await signedUseful.getAttribute('aria-pressed'), 'true', 'useful rating hydrates from the selected cloud fields after reload');

    await signedUseful.click();
    await signedIn.page.waitForFunction(({ key, id }) => {
      const state = JSON.parse(localStorage.getItem(key));
      const row = state.tables.user_resource_activity.find((item) => item.resource_id === id);
      return !!row && row.helpful === null;
    }, { key: QA_BACKEND_KEY, id: sample.id });
    assert.equal(await signedUseful.getAttribute('aria-pressed'), 'false', 'useful toggle returns to the nullable state');

    const downloadStarted = signedIn.page.waitForEvent('download');
    await signedIn.page.locator('.tb.dl').first().click();
    await downloadStarted;
    await signedIn.page.waitForFunction(({ key, id }) => {
      const state = JSON.parse(localStorage.getItem(key));
      const row = state.tables.user_resource_activity.find((item) => item.resource_id === id);
      return !!row && row.download_count === 1 &&
        state.calls.rpcByName.record_resource_download === 1;
    }, { key: QA_BACKEND_KEY, id: sample.id });

    const postDownloadState = await readMockState(signedIn.page);
    const persistedActivity = postDownloadState.tables.user_resource_activity
      .find((row) => row.resource_id === sample.id);
    assert.equal(persistedActivity.bookmarked, true, 'later activity writes preserve the bookmark');
    assert.ok(persistedActivity.last_viewed_at, 'detail view records a recent-view timestamp');
    assert.equal(persistedActivity.download_count, 1, 'download invokes the atomic counter RPC');
    assert.equal(postDownloadState.calls.signedUrlCalls, 1, 'download requests one signed Storage URL');
    assert.deepEqual(
      postDownloadState.calls.lastSignedUrl,
      { bucket: 'resource-downloads', objectPath: `${sample.id}.pdf`, expiresIn: 60 },
      'signed URL targets the private bucket, canonical object path, and 60-second lifetime',
    );

    const detailOtherUser = { id: 'resource-detail-user-b', email: 'resource-detail-b@example.test', user_metadata: {} };
    const detailClearedSynchronously = await signedIn.page.evaluate((user) => {
      window.__setQaUser(user);
      const button = Array.from(document.querySelectorAll('.save-row button'))
        .find((item) => /bookmark/i.test(item.textContent));
      return {
        disabled: button && button.disabled,
        pressed: button && button.getAttribute('aria-pressed'),
      };
    }, detailOtherUser);
    assert.equal(detailClearedSynchronously.disabled, true, 'detail auth change blocks actions synchronously');
    assert.equal(detailClearedSynchronously.pressed, 'false', 'detail auth change clears the previous bookmark synchronously');
    await signedIn.page.waitForFunction(() => {
      const button = Array.from(document.querySelectorAll('.save-row button'))
        .find((item) => /bookmark/i.test(item.textContent));
      return !!button && !button.disabled && button.getAttribute('aria-pressed') === 'false';
    });
    await signedIn.page.evaluate((user) => window.__setQaUser(user), qaUser);
    await signedIn.page.waitForFunction(() => {
      const button = Array.from(document.querySelectorAll('.save-row button'))
        .find((item) => /bookmark/i.test(item.textContent));
      return !!button && !button.disabled && button.getAttribute('aria-pressed') === 'true';
    });

    const secondRecent = resources[1];
    await signedIn.page.evaluate(({ key, userId, firstId, secondId }) => {
      const state = JSON.parse(localStorage.getItem(key));
      const first = state.tables.user_resource_activity.find((row) =>
        row.user_id === userId && row.resource_id === firstId
      );
      first.last_viewed_at = new Date(Date.now() - 120000).toISOString();
      const now = new Date().toISOString();
      state.tables.user_resource_activity.push({
        user_id: userId,
        resource_id: secondId,
        bookmarked: false,
        helpful: null,
        last_viewed_at: now,
        download_count: 0,
        created_at: now,
        updated_at: now,
      });
      localStorage.setItem(key, JSON.stringify(state));
    }, {
      key: QA_BACKEND_KEY,
      userId: qaUser.id,
      firstId: sample.id,
      secondId: secondRecent.id,
    });

    await signedIn.page.goto(`${baseUrl}resources.html`, { waitUntil: 'domcontentloaded' });
    await signedIn.page.waitForSelector('#bookmarkedSection:not([hidden])');
    await signedIn.page.waitForSelector('#recentSection:not([hidden])');
    assert.equal(
      await signedIn.page.locator('#bookmarkedGrid .res-title', { hasText: sample.title }).count(),
      1,
      'saved resource appears in Your bookmarks',
    );
    assert.equal(
      await signedIn.page.locator('#recentGrid .res-title', { hasText: sample.title }).count(),
      1,
      'viewed resource appears in Recently viewed',
    );
    assert.deepEqual(
      await signedIn.page.locator('#recentGrid .res-title').allTextContents(),
      [secondRecent.title, sample.title],
      'recent resources render newest-first from the cloud ordering',
    );
    assert.match(
      await signedIn.page.locator('#bookmarkedGrid .res').first().getAttribute('aria-label'),
      /Bookmarked/,
      'bookmark state is included in the personalized card accessible name',
    );
    assert.match(
      await signedIn.page.locator('#recentGrid .res').first().getAttribute('aria-label'),
      /Viewed/,
      'recent-view state is included in the personalized card accessible name',
    );

    const nextUser = { id: 'resource-qa-user-b', email: 'resource-qa-b@example.test', user_metadata: {} };
    const clearedSynchronously = await signedIn.page.evaluate((user) => {
      window.__setQaUser(user);
      return {
        bookmarksHidden: document.getElementById('bookmarkedSection').hidden,
        recentsHidden: document.getElementById('recentSection').hidden,
        oldSavedBadgeVisible: Array.from(document.querySelectorAll('#resGrid .res'))
          .some((card) => /Bookmarked/.test(card.getAttribute('aria-label') || '')),
      };
    }, nextUser);
    assert.equal(clearedSynchronously.bookmarksHidden, true, 'auth change hides the previous account bookmarks synchronously');
    assert.equal(clearedSynchronously.recentsHidden, true, 'auth change hides the previous account recents synchronously');
    assert.equal(clearedSynchronously.oldSavedBadgeVisible, false, 'auth change clears previous-account saved badges synchronously');
    await signedIn.page.waitForFunction(() => document.getElementById('resourceSaveCta')?.textContent === 'Browse resources');
    assert.deepEqual(signedInErrors, [], `signed-in resource errors: ${signedInErrors.join(', ')}`);
  } finally {
    await signedIn.context.close();
  }

  // --- Legacy portfolio migration: fill blanks once, preserve server data ---
  const legacyUser = { id: 'legacy-qa-user', email: 'legacy-qa@example.test', user_metadata: {} };
  const cloudBefore = {
    user_id: legacyUser.id,
    opener: 'Server opener must win',
    objections: '',
    rejection: 'Server rejection must win',
    routine: '',
    why: '',
    first_call_done: false,
    legacy_migrated_at: null,
    updated_at: '2026-01-01T00:00:00.000Z',
  };
  const legacyLocal = {
    Opener: 'Legacy opener must not overwrite',
    Objections: 'Legacy objections fill',
    Rejection: 'Legacy rejection must not overwrite',
    Routine: 'Legacy routine fills',
    Why: 'Legacy why fills',
    firstCallDone: true,
    updatedAt: 1710000000000,
  };
  const legacy = await newMockedPage({ user: legacyUser, interviewRows: [cloudBefore] });
  const legacyErrors = [];
  legacy.page.on('pageerror', (error) => legacyErrors.push(error.message));
  try {
    await legacy.page.addInitScript(({ portfolio }) => {
      localStorage.setItem('amplifyHub_sdrPortfolio', JSON.stringify(portfolio));
    }, { portfolio: legacyLocal });
    await legacy.page.goto(`${baseUrl}interview-prep.html`, { waitUntil: 'domcontentloaded' });
    await legacy.page.waitForFunction(({ key, userId }) => {
      const state = JSON.parse(localStorage.getItem(key));
      const row = state.tables.user_interview_prep.find((item) => item.user_id === userId);
      return !!(row && row.legacy_migrated_at);
    }, { key: QA_BACKEND_KEY, userId: legacyUser.id });

    let legacyState = await readMockState(legacy.page);
    let migrated = legacyState.tables.user_interview_prep.find((row) => row.user_id === legacyUser.id);
    assert.equal(migrated.opener, cloudBefore.opener, 'migration preserves a non-empty cloud opener');
    assert.equal(migrated.rejection, cloudBefore.rejection, 'migration preserves a non-empty cloud rejection');
    assert.equal(migrated.objections, legacyLocal.Objections, 'migration fills an empty cloud objections field');
    assert.equal(migrated.routine, legacyLocal.Routine, 'migration fills an empty cloud routine field');
    assert.equal(migrated.why, legacyLocal.Why, 'migration fills an empty cloud why field');
    assert.equal(migrated.first_call_done, true, 'migration carries first-call completion');
    assert.ok(migrated.legacy_migrated_at, 'migration sets the server marker');
    assert.equal(legacyState.calls.rpcByName.migrate_legacy_interview_prep, 1, 'legacy migration runs once initially');
    assert.equal(legacyState.calls.rpcWrites, 1, 'legacy migration performs one server write');

    const migratedSnapshot = JSON.stringify(migrated);
    const sessionMarker = `amplifyHub_sdrPortfolio:migrated:${encodeURIComponent(legacyUser.id)}`;
    assert.equal(
      await legacy.page.evaluate((key) => sessionStorage.getItem(key), sessionMarker),
      '1',
      'successful migration records the user-scoped session marker',
    );

    await legacy.page.evaluate((portfolio) => {
      localStorage.setItem('amplifyHub_sdrPortfolio', JSON.stringify(portfolio));
    }, {
      Opener: 'Changed local opener',
      Objections: 'Changed local objections',
      Rejection: 'Changed local rejection',
      Routine: 'Changed local routine',
      Why: 'Changed local why',
      firstCallDone: false,
      updatedAt: 1810000000000,
    });
    await legacy.page.reload({ waitUntil: 'domcontentloaded' });
    await legacy.page.waitForTimeout(50);
    legacyState = await readMockState(legacy.page);
    assert.equal(legacyState.calls.rpcByName.migrate_legacy_interview_prep, 1, 'session marker prevents a reload re-run');
    migrated = legacyState.tables.user_interview_prep.find((row) => row.user_id === legacyUser.id);
    assert.equal(JSON.stringify(migrated), migratedSnapshot, 'reload cannot overwrite the migrated server row');

    // The database marker remains authoritative if a new tab/session lacks the
    // optimization marker: the RPC may be retried, but it performs no write.
    await legacy.page.evaluate((key) => sessionStorage.removeItem(key), sessionMarker);
    await legacy.page.reload({ waitUntil: 'domcontentloaded' });
    await legacy.page.waitForFunction((key) => {
      const state = JSON.parse(localStorage.getItem(key));
      return state.calls.rpcByName.migrate_legacy_interview_prep === 2;
    }, QA_BACKEND_KEY);
    legacyState = await readMockState(legacy.page);
    assert.equal(legacyState.calls.rpcWrites, 1, 'database marker makes a later RPC retry a no-op');
    migrated = legacyState.tables.user_interview_prep.find((row) => row.user_id === legacyUser.id);
    assert.equal(JSON.stringify(migrated), migratedSnapshot, 'database marker preserves every server field on retry');

    const legacyOwnerKey = 'amplifyHub_sdrPortfolio:migrationOwner:v1';
    const ownerClaim = await legacy.page.evaluate((key) => JSON.parse(localStorage.getItem(key)), legacyOwnerKey);
    assert.equal(ownerClaim.userId, legacyUser.id, 'the first verified account claims the browser-global legacy portfolio');
    const otherLegacyUser = { id: 'legacy-qa-user-b', email: 'legacy-qa-b@example.test', user_metadata: {} };
    await legacy.page.evaluate((user) => window.__setQaUser(user), otherLegacyUser);
    await legacy.page.waitForTimeout(100);
    legacyState = await readMockState(legacy.page);
    assert.equal(
      legacyState.calls.rpcByName.migrate_legacy_interview_prep,
      2,
      'switching accounts cannot migrate the same browser-global portfolio again',
    );
    assert.equal(
      legacyState.tables.user_interview_prep.some((row) => row.user_id === otherLegacyUser.id),
      false,
      'the second account receives no row from the first account legacy portfolio',
    );
    assert.deepEqual(legacyErrors, [], `legacy migration errors: ${legacyErrors.join(', ')}`);
  } finally {
    await legacy.context.close();
  }

  const freshLegacyUser = { id: 'legacy-fresh-user', email: 'legacy-fresh@example.test', user_metadata: {} };
  const freshLegacy = await newMockedPage({ user: freshLegacyUser });
  try {
    await freshLegacy.page.addInitScript(({ portfolio }) => {
      localStorage.setItem('amplifyHub_sdrPortfolio', JSON.stringify(portfolio));
    }, { portfolio: legacyLocal });
    await freshLegacy.page.goto(`${baseUrl}interview-prep.html`, { waitUntil: 'domcontentloaded' });
    await freshLegacy.page.waitForFunction(({ key, userId }) => {
      const state = JSON.parse(localStorage.getItem(key));
      const row = state.tables.user_interview_prep.find((item) => item.user_id === userId);
      return !!(row && row.legacy_migrated_at);
    }, { key: QA_BACKEND_KEY, userId: freshLegacyUser.id });
    const freshState = await readMockState(freshLegacy.page);
    const inserted = freshState.tables.user_interview_prep.find((row) => row.user_id === freshLegacyUser.id);
    assert.deepEqual(
      [inserted.opener, inserted.objections, inserted.rejection, inserted.routine, inserted.why],
      [legacyLocal.Opener, legacyLocal.Objections, legacyLocal.Rejection, legacyLocal.Routine, legacyLocal.Why],
      'legacy migration creates a complete cloud row when none exists',
    );
    assert.equal(inserted.first_call_done, true, 'new legacy row carries first-call completion');
    assert.equal(freshState.calls.rpcWrites, 1, 'new legacy row is written exactly once');
  } finally {
    await freshLegacy.context.close();
  }

  // --- Rendering safety: database catalog content is rendered as text, never HTML ---
  const xssPayload = '<img src=x onerror="window.__xss=1">PWN';
  await page.evaluate(({ key, payload }) => {
    const state = JSON.parse(localStorage.getItem(key));
    state.tables.resource_catalog = [{
      id: 'xss-1',
      title: payload,
      category: 'script',
      skill: 'opening',
      difficulty: 'beginner',
      duration_minutes: 5,
      status: 'reviewed',
      active: true,
      summary: payload,
      objectives: [payload],
      content: [{ type: 'list', heading: payload, items: [payload] }],
      example: { title: 'x', text: payload },
      safe_practice: payload,
      related_label: 'x',
      related_route: 'coach-home.html',
      downloads: [{ format: 'pdf', path: 'xss-1.pdf' }],
      review_date: '2026-07-19',
    }];
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: QA_BACKEND_KEY, payload: xssPayload });
  await page.goto(`${baseUrl}resource.html?id=xss-1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1.title');
  assert.equal(await page.evaluate(() => window.__xss || 0), 0, 'catalog HTML never executes');
  assert.equal(await page.locator('#main img').count(), 0, 'catalog HTML is rendered as text, not markup');
  assert.match(await page.locator('h1.title').innerText(), /PWN/, 'payload shown literally');

  assert.deepEqual(pageErrors, [], `browser errors: ${pageErrors.join(', ')}`);

  // Dashboard integration (published-only counts, no fake video card).
  const dashboard = await readFile(path.join(siteRoot, 'dashboard.html'), 'utf8');
  assert.match(dashboard, /href="resources\.html">Browse Library/, 'dashboard links to the real library');
  assert.match(dashboard, /PrivateResourceStore\.listPublished\(\)/, 'dashboard derives counts from the authenticated catalog');
  assert.match(dashboard, /resources\.html\?category=/, 'dashboard category cards deep-link to filtered resource lists');
  assert.doesNotMatch(dashboard, /36 videos|18 templates|24 scripts/, 'dashboard no longer shows invented counts');

  console.log(`Browser QA passed: anonymous route blocking, signed-in reviewed-only library, search/filter, ${TOTAL} private detail pages, signed URL downloads, activity round-trips, personalized lists, one-time legacy migration, safe rendering, and honest dashboard.`);
} finally {
  await browser.close();
  await server.close();
}
