// Generates the forward-only content refresh for the professional resource set.
// This deliberately does not rewrite the already-applied seed/sync migrations.
// Run: npm run generate:professional-resource-migration

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDir, '..', '..');
const catalogPath = path.join(siteRoot, 'assets', 'resource-catalog.js');
const migrationPath = path.join(
  siteRoot,
  'supabase',
  'migrations',
  '20260728133215_professional_resource_content.sql',
);

const catalogModule = await import(pathToFileURL(catalogPath).href);
const catalog = catalogModule.default || catalogModule.ResourceCatalog;

const sqlText = (value) => `'${String(value == null ? '' : value).replace(/'/g, "''")}'`;
const sqlJson = (value) => `'${JSON.stringify(value == null ? [] : value).replace(/'/g, "''")}'::jsonb`;

const rows = catalog.resources.map((resource) => {
  const downloads = (resource.downloads || []).map((download) => ({
    format: download.format,
    path: `${resource.id}.${download.format}`,
  }));
  const related = resource.related || {};
  return '  (' + [
    sqlText(resource.id),
    sqlText(resource.title),
    sqlText(resource.category),
    sqlText(resource.skill),
    sqlText(resource.difficulty),
    String(resource.duration),
    sqlText(resource.summary),
    sqlJson(resource.objectives),
    sqlJson(resource.sections || []),
    sqlJson(resource.example || {}),
    sqlText(resource.safePractice || ''),
    sqlText(related.label || ''),
    sqlText(related.route || ''),
    sqlJson(downloads),
    sqlText(resource.reviewDate || catalog.reviewDate),
    sqlText(resource.status === 'reviewed' ? 'reviewed' : 'draft'),
    resource.active === false ? 'false' : 'true',
  ].join(',') + ')';
});

const migration = `-- AmplifyHub Resource Library: professional content refresh.
-- GENERATED from assets/resource-catalog.js by
-- sales-mindset-app/scripts/generate-professional-resource-migration.mjs.
-- Forward-only: the previously applied seed and catalog-sync migrations remain
-- unchanged. Private Storage object paths stay canonical (<resource-id>.<format>).

insert into public.resource_catalog
  (id,title,category,skill,difficulty,duration_minutes,summary,objectives,content,example,safe_practice,related_label,related_route,downloads,review_date,status,active)
values
${rows.join(',\n')}
on conflict (id) do update set
  title=excluded.title,
  category=excluded.category,
  skill=excluded.skill,
  difficulty=excluded.difficulty,
  duration_minutes=excluded.duration_minutes,
  summary=excluded.summary,
  objectives=excluded.objectives,
  content=excluded.content,
  example=excluded.example,
  safe_practice=excluded.safe_practice,
  related_label=excluded.related_label,
  related_route=excluded.related_route,
  downloads=excluded.downloads,
  review_date=excluded.review_date,
  status=excluded.status,
  active=excluded.active;
`;

await writeFile(migrationPath, migration, 'utf8');

const written = await readFile(migrationPath, 'utf8');
const count = (written.match(/^ {2}\('/gm) || []).length;
if (count !== catalog.resources.length) {
  throw new Error(`Professional migration row count ${count} does not match catalog length ${catalog.resources.length}`);
}
if (!written.includes('"path":')) {
  throw new Error('Professional migration must preserve canonical private object paths.');
}

console.log(`Wrote ${migrationPath} with ${count} professional resource rows.`);
