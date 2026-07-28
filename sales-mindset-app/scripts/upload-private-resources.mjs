import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appDir, '..');
const downloadDir = path.join(siteRoot, 'assets', 'resources', 'downloads');
const expectedProjectRef = 'dsuahpcqrrlbudomjrye';
const apply = process.argv.includes('--apply');
const bucket = 'resource-downloads';
const mimeTypes = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const catalogModule = await import(pathToFileURL(path.join(siteRoot, 'assets', 'resource-catalog.js')).href);
const catalog = catalogModule.default || catalogModule.ResourceCatalog;
assert.equal(catalog.resources.length, 40, 'expected exactly 40 catalog resources');

const uploads = [];
for (const resource of catalog.resources) {
  assert.match(resource.id, /^[a-z0-9][a-z0-9-]*$/, `safe resource id: ${resource.id}`);
  for (const download of resource.downloads || []) {
    const format = String(download.format || '').toLowerCase();
    assert.ok(mimeTypes[format], `supported format: ${format}`);
    const objectPath = `${resource.id}.${format}`;
    const filePath = path.join(downloadDir, objectPath);
    await access(filePath);
    const body = await readFile(filePath);
    assert.ok(body.length > 300, `${objectPath} is non-empty`);
    uploads.push({ objectPath, body, contentType: mimeTypes[format] });
  }
}
assert.equal(uploads.length, 80, 'expected exactly 80 download objects');
assert.equal(new Set(uploads.map((item) => item.objectPath)).size, 80, 'download object paths are unique');

if (!apply) {
  console.log(`Dry run passed: ${uploads.length} files are ready for private bucket "${bucket}".`);
  console.log('No network requests or uploads were made. Use --apply with the required environment variables after approval.');
  process.exit(0);
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const confirmation = process.env.CONFIRM_RESOURCE_UPLOAD || '';
const projectHost = new URL(supabaseUrl).hostname;
assert.equal(projectHost, `${expectedProjectRef}.supabase.co`, 'SUPABASE_URL must target the expected project');
assert.ok(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required');
assert.equal(confirmation, expectedProjectRef, 'CONFIRM_RESOURCE_UPLOAD must equal the expected project ref');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

for (const item of uploads) {
  const { error } = await supabase.storage.from(bucket).upload(item.objectPath, item.body, {
    contentType: item.contentType,
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw new Error(`Upload failed for ${item.objectPath}: ${error.message}`);
  console.log(`Uploaded ${item.objectPath}`);
}

const { data: listed, error: listError } = await supabase.storage.from(bucket).list('', {
  limit: 100,
  sortBy: { column: 'name', order: 'asc' },
});
if (listError) throw listError;
const listedNames = new Set((listed || []).map((item) => item.name));
for (const item of uploads) assert.ok(listedNames.has(item.objectPath), `uploaded object listed: ${item.objectPath}`);
console.log(`Verified ${uploads.length} private resource objects in "${bucket}".`);
