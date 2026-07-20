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

/* ---------------------------------------------- Part A: static / structural */

// Catalog shape.
assert.equal(resources.length, 25, 'catalog holds exactly 25 resources');
const counts = catalog.categoryCounts();
for (const category of ['script', 'template', 'cheatsheet', 'worksheet', 'interview']) {
  assert.equal(counts[category], 5, `category ${category} has five resources`);
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
assert.equal(published.length, 25, 'all 25 approved resources are publicly published');
assert.deepEqual(
  published.map((r) => r.id),
  resources.filter((r) => r.active === true && r.status === 'reviewed').map((r) => r.id),
  'published() is exactly active AND reviewed'
);
for (const r of resources.filter((x) => x.status !== 'reviewed')) {
  assert.ok(!catalog.isPublished(r), `${r.id} (draft) is never published merely because it is active`);
}
const pubCounts = catalog.publishedCounts();
for (const category of ['script', 'template', 'cheatsheet', 'worksheet', 'interview']) {
  assert.equal(pubCounts[category], 5, `published ${category} category has five resources`);
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
assert.equal(checkedFiles, 50, 'all 50 download artifacts present and structurally valid');

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
assert.equal((migration.match(/^ {2}\('/gm) || []).length, 25, 'migration seeds all 25 resources');
for (const r of resources) assert.ok(migration.includes(`'${r.id}'`), `migration seeds ${r.id}`);
assert.match(migration, /create table if not exists public\.resource_catalog/, 'migration creates resource_catalog');
assert.match(migration, /enable row level security/, 'RLS is enabled');
assert.match(
  migration,
  /for select to anon, authenticated using \(active = true and status = 'reviewed'\)/,
  'public read requires BOTH active and reviewed — drafts are never publicly readable'
);
assert.match(migration, /revoke insert, update, delete on public\.resource_catalog from anon, authenticated/, 'clients cannot mutate the catalog');
assert.match(migration, /check \(category in \('script','template','cheatsheet','worksheet','interview'\)\)/, 'category constraint present');
for (const r of resources) {
  const expected = r.status === 'reviewed' ? 'reviewed' : 'draft';
  assert.ok(migration.includes(`'${r.id}'`) && migration.match(new RegExp(`'${r.id}',[\\s\\S]*?'${expected}',(true|false)\\)`)), `migration carries ${r.id} status=${expected}`);
}

console.log('Static QA passed: 25-resource catalog, publication gate, 50 valid artifacts, format rules, xlsx styling, and a reviewed-only public read policy.');

/* ---------------------------------------------------- Part B: browser tests */

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
await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
await page.route('https://fonts.gstatic.com/**', (route) => route.abort());

const draftCount = resources.filter((r) => r.status !== 'reviewed').length;
const publishedCount = resources.length - draftCount;

try {
  // --- PUBLIC library: only published resources, drafts never listed ---
  await page.goto(`${baseUrl}resources.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#resCount');
  assert.ok(!page.url().includes('signin'), 'library is public — no auth redirect');
  assert.equal(await page.locator('.res').count(), publishedCount, `public view lists exactly ${publishedCount} published resources (drafts excluded)`);
  if (publishedCount === 0) {
    assert.match(await page.locator('#emptyState').innerText(), /final editorial review/i, 'public empty state explains the review gate honestly');
    assert.match(await page.locator('#modeBannerText').innerText(), /editorial review/i, 'public banner explains nothing shows until reviewed');
  }
  assert.match(await page.locator('.flt', { hasText: 'All' }).innerText(), new RegExp(`All \\(${publishedCount}\\)`), 'public All count is derived from published resources only');

  // --- EDITORIAL PREVIEW: all drafts visible, clearly labelled ---
  await page.goto(`${baseUrl}resources.html?preview=review`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.res');
  assert.equal(await page.locator('.res').count(), 25, 'preview mode renders all 25 resources');
  assert.match(await page.locator('#modeBannerText').innerText(), /Editorial preview/i, 'preview mode is explicitly labelled');
  assert.equal(await page.locator('.res-draft').count(), draftCount, 'every draft carries a Draft chip');

  // Catalog-derived counts.
  assert.match(await page.locator('.flt', { hasText: 'All' }).innerText(), /All \(25\)/, 'preview All filter shows real total');
  assert.match(await page.locator('.flt', { hasText: 'Scripts' }).innerText(), /\(5\)/, 'Scripts chip shows derived count');
  assert.equal(await page.locator('.type-card').count(), 5, 'five category type cards (videos removed)');
  assert.equal(await page.locator('.type-card').evaluateAll((cards) => cards.every((card) => card.tagName === 'BUTTON')), true, 'category cards are semantic buttons');

  // A dashboard/category link opens the library already filtered to that type.
  await page.goto(`${baseUrl}resources.html?category=script`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.res');
  assert.equal(await page.locator('.res').count(), 5, 'direct Scripts URL renders the five script resources');
  assert.equal(await page.locator('#gridHeading').innerText(), 'Scripts', 'direct Scripts URL labels the filtered grid');
  const scriptsCard = page.locator('.type-card', { hasText: 'Scripts' });
  assert.equal(await scriptsCard.getAttribute('aria-pressed'), 'true', 'Scripts category control exposes its selected state');

  // Return to the complete editorial view for the remaining preview-only checks.
  await page.goto(`${baseUrl}resources.html?preview=review`, { waitUntil: 'domcontentloaded' });
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
  assert.ok(searchHits >= 1 && searchHits < 25, `search narrows results (${searchHits})`);
  await page.locator('#searchInput').fill('');
  await page.waitForFunction(() => document.querySelectorAll('.res').length === 25);

  // Cards keep the reviewer in preview mode.
  const firstHref = await page.locator('.res').first().getAttribute('href');
  assert.match(firstHref, /^resource\.html\?id=.+&preview=review$/, 'preview cards link into preview detail pages');

  // --- Every resource opens on the detail page (preview mode) ---
  for (const r of resources) {
    await page.goto(`${baseUrl}resource.html?id=${encodeURIComponent(r.id)}&preview=review`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1.title');
    const heading = await page.locator('h1.title').innerText();
    assert.ok(heading.trim().length > 0, `${r.id} renders a title`);
    assert.equal(await page.locator('.tb.dl').count(), (r.downloads || []).length, `${r.id} shows its download buttons`);
    if (r.status !== 'reviewed') {
      assert.equal(await page.locator('.draft-banner').count(), 1, `${r.id} (draft) shows the draft banner in preview`);
    }
  }

  // --- PUBLIC detail page: drafts are blocked, invalid ids are distinct ---
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

  // --- Detail page behaviour on one representative resource (preview) ---
  const sample = resources[0];
  await page.goto(`${baseUrl}resource.html?id=${encodeURIComponent(sample.id)}&preview=review`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('h1.title').innerText(), sample.title, 'detail title matches catalog');
  assert.ok(await page.locator('.toolbar .tb', { hasText: 'Copy' }).count() === 1, 'Copy action present');
  assert.ok(await page.locator('.toolbar .tb', { hasText: 'Print' }).count() === 1, 'Print/Save-as-PDF action present');
  assert.ok(await page.locator('.related a', { hasText: 'Go' }).count() === 1, 'related action present');
  const relHref = await page.locator('.related a').getAttribute('href');
  assert.equal(relHref, sample.related.route, 'related action points at the catalog route');

  // Public download actually serves the file.
  const dlHref = await page.locator('.tb.dl').first().getAttribute('href');
  const dlResp = await page.request.get(`${baseUrl}${dlHref}`);
  assert.equal(dlResp.status(), 200, 'download file is publicly served');
  assert.ok((await dlResp.body()).length > 300, 'served download is non-empty');

  // Bookmark prompts sign-in for anonymous users (Phase 2 wires real sync).
  await page.locator('.save-row .tb', { hasText: 'Bookmark' }).click();
  await page.waitForSelector('.save-note', { state: 'visible' });
  const signHref = await page.locator('.save-note a').getAttribute('href');
  assert.match(signHref, /signin\.html\?redirect=/, 'bookmark prompts sign-in');

  // --- Rendering safety: catalog content is rendered as text, never HTML ---
  // The stub resource is marked reviewed so this also exercises the PUBLIC path.
  await page.route('**/assets/resource-catalog.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `(function(root){
      var payload='<img src=x onerror="window.__xss=1">PWN';
      var RES=[{id:'xss-1',title:payload,category:'script',skill:'opening',difficulty:'beginner',duration:5,
        status:'reviewed',active:true,
        summary:payload,objectives:[payload],sections:[{type:'list',heading:payload,items:[payload]}],
        example:{title:'x',text:payload},safePractice:payload,related:{label:'x',route:'coach-home.html'},
        downloads:[{format:'pdf'}]}];
      var META={script:{label:'Script',plural:'Scripts',icon:'S'},template:{label:'Template',plural:'Templates',icon:'T'},cheatsheet:{label:'Cheat Sheet',plural:'Cheat Sheets',icon:'C'},worksheet:{label:'Worksheet',plural:'Worksheets',icon:'W'},interview:{label:'Interview Prep',plural:'Interview Prep',icon:'I'}};
      function isPublished(r){return !!r && r.active===true && r.status==='reviewed';}
      root.ResourceCatalog={reviewDate:'2026-07-19',categoryMeta:META,resources:RES,
        isPublished:isPublished,
        published:function(){return RES.filter(isPublished);},
        byId:function(id){return RES[0];},
        categoryCounts:function(){return {script:1,template:0,cheatsheet:0,worksheet:0,interview:0};},
        publishedCounts:function(){return {script:1,template:0,cheatsheet:0,worksheet:0,interview:0};}};
    })(window);`
  }));
  await page.goto(`${baseUrl}resource.html?id=xss-1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1.title');
  assert.equal(await page.evaluate(() => window.__xss || 0), 0, 'catalog HTML never executes');
  assert.equal(await page.locator('#main img').count(), 0, 'catalog HTML is rendered as text, not markup');
  assert.match(await page.locator('h1.title').innerText(), /PWN/, 'payload shown literally');

  assert.deepEqual(pageErrors, [], `browser errors: ${pageErrors.join(', ')}`);

  // Dashboard integration (published-only counts, no fake video card).
  const dashboard = await readFile(path.join(siteRoot, 'dashboard.html'), 'utf8');
  assert.match(dashboard, /href="resources\.html">Browse Library/, 'dashboard links to the real library');
  assert.match(dashboard, /publishedCounts\(\)/, 'dashboard derives counts from published resources only');
  assert.match(dashboard, /resources\.html\?category=/, 'dashboard category cards deep-link to filtered resource lists');
  assert.doesNotMatch(dashboard, /36 videos|18 templates|24 scripts/, 'dashboard no longer shows invented counts');

  console.log('Browser QA passed: reviewed-only public library, draft blocking, labelled editorial preview, search/filter, 25 detail pages, downloads, safe rendering, and honest dashboard.');
} finally {
  await browser.close();
  await server.close();
}
