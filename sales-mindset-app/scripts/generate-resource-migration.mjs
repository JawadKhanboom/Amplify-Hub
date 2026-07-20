// Regenerates the resource_catalog seed migration from the static catalog so the
// authoritative Supabase table can never drift from the version-controlled file.
// Run: npm run generate:resource-migration

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDir, '..', '..');
const catalogPath = path.join(siteRoot, 'assets', 'resource-catalog.js');
const migrationPath = path.join(siteRoot, 'supabase', 'migrations', '20260719040000_resource_library.sql');

const catalogModule = await import(pathToFileURL(catalogPath).href);
const catalog = catalogModule.default || catalogModule.ResourceCatalog;

const sqlText = (value) => `'${String(value == null ? '' : value).replace(/'/g, "''")}'`;
const sqlJson = (value) => `'${JSON.stringify(value == null ? [] : value).replace(/'/g, "''")}'::jsonb`;

const rows = catalog.resources.map((r) => {
  const downloads = (r.downloads || []).map((d) => ({
    format: d.format,
    file: `assets/resources/downloads/${r.id}.${d.format}`
  }));
  const related = r.related || {};
  return '  (' + [
    sqlText(r.id),
    sqlText(r.title),
    sqlText(r.category),
    sqlText(r.skill),
    sqlText(r.difficulty),
    String(r.duration),
    sqlText(r.summary),
    sqlJson(r.objectives),
    sqlJson(r.sections || []),
    sqlJson(r.example || {}),
    sqlText(r.safePractice || ''),
    sqlText(related.label || ''),
    sqlText(related.route || ''),
    sqlJson(downloads),
    sqlText(r.reviewDate || catalog.reviewDate),
    sqlText(r.status === 'reviewed' ? 'reviewed' : 'draft'),
    r.active === false ? 'false' : 'true'
  ].join(',') + ')';
});

const header = `-- AmplifyHub Practical Resource Library: authoritative resource catalog.
-- GENERATED from assets/resource-catalog.js by scripts/generate-resource-migration.mjs.
-- Do not edit by hand; regenerate after changing the catalog so the table and the
-- static file stay in sync. Content is DRAFT pending human editorial review (status='draft').

create table if not exists public.resource_catalog (
  id text primary key,
  title text not null,
  category text not null check (category in ('script','template','cheatsheet','worksheet','interview')),
  skill text not null,
  difficulty text not null check (difficulty in ('beginner','intermediate','advanced')),
  duration_minutes integer not null check (duration_minutes between 3 and 60),
  summary text not null,
  objectives jsonb not null default '[]'::jsonb,
  content jsonb not null default '[]'::jsonb,
  example jsonb not null default '{}'::jsonb,
  safe_practice text not null default '',
  related_label text not null default '',
  related_route text not null default '',
  downloads jsonb not null default '[]'::jsonb,
  review_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft','reviewed')),
  active boolean not null default true
);

-- Publication gate (defense in depth): the public can read a resource only when
-- it is BOTH active and editorially reviewed. Draft resources must never appear
-- publicly merely because they are active. Only authenticated personalization
-- (Phase 2) will write to separate user tables.
alter table public.resource_catalog enable row level security;
drop policy if exists "Public reads active resources" on public.resource_catalog;
drop policy if exists "Public reads reviewed active resources" on public.resource_catalog;
create policy "Public reads reviewed active resources" on public.resource_catalog
  for select to anon, authenticated using (active = true and status = 'reviewed');
revoke insert, update, delete on public.resource_catalog from anon, authenticated;

create index if not exists resource_catalog_category_idx on public.resource_catalog (category) where active;

insert into public.resource_catalog
  (id,title,category,skill,difficulty,duration_minutes,summary,objectives,content,example,safe_practice,related_label,related_route,downloads,review_date,status,active)
values
`;

const footer = `
on conflict (id) do update set
  title=excluded.title, category=excluded.category, skill=excluded.skill,
  difficulty=excluded.difficulty, duration_minutes=excluded.duration_minutes,
  summary=excluded.summary, objectives=excluded.objectives, content=excluded.content,
  example=excluded.example, safe_practice=excluded.safe_practice,
  related_label=excluded.related_label, related_route=excluded.related_route,
  downloads=excluded.downloads, review_date=excluded.review_date,
  status=excluded.status, active=excluded.active;
`;

await writeFile(migrationPath, header + rows.join(',\n') + footer, 'utf8');

// Sanity: the number of seeded rows must match the catalog length.
const written = await readFile(migrationPath, 'utf8');
const count = (written.match(/^ {2}\('/gm) || []).length;
if (count !== catalog.resources.length) {
  throw new Error(`Seed row count ${count} does not match catalog length ${catalog.resources.length}`);
}
console.log(`Wrote ${migrationPath} with ${count} seeded resources.`);
