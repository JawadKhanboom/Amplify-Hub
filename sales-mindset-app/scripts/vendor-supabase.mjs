// Vendors the supabase-js UMD build for the static site.
//
// Source of truth: the npm-integrity-verified copy in node_modules (pinned
// by package-lock.json) — never a CDN download, so the bytes shipped to the
// site are exactly the bytes npm verified. Re-run after bumping the
// @supabase/supabase-js version:
//
//   node scripts/vendor-supabase.mjs        # writes assets/vendor/supabase-<version>.min.js
//   node scripts/vendor-supabase.mjs --check  # fails if the vendored file is missing or stale
//
// One deliberate, semantically inert transform: supabase-js contains a lazy
// optional `import("@opentelemetry/api")`, immediately chained with
// `.catch(()=>null)`. A bare specifier can never resolve in a browser
// without an import map, so at runtime this ALWAYS ends in the catch —
// but the Vite dev server used by the QA suites eagerly analyzes every
// served module and hard-errors on the unresolvable specifier
// (`/* @vite-ignore */` only silences variable imports, not string
// literals). Replacing the import expression with an immediate rejection
// preserves the exact runtime outcome (catch -> null, tracing disabled)
// while removing the unanalyzable import.
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appDir, '..');
const vendorDir = path.join(siteRoot, 'assets', 'vendor');

const lock = JSON.parse(readFileSync(path.join(appDir, 'package-lock.json'), 'utf8'));
const version = lock.packages['node_modules/@supabase/supabase-js'].version;
const sourcePath = path.join(appDir, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
const targetPath = path.join(vendorDir, `supabase-${version}.min.js`);

const BARE_IMPORT = 'import(`@opentelemetry/api`)';
const IGNORED_IMPORT = 'Promise.reject(new Error(`@opentelemetry/api is not bundled in the vendored browser build`))';

function buildContent() {
  const source = readFileSync(sourcePath, 'utf8');
  const occurrences = source.split(BARE_IMPORT).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected exactly 1 bare @opentelemetry/api import in the UMD, found ${occurrences} — re-inspect the upstream build before vendoring.`);
  }
  return source.replace(BARE_IMPORT, IGNORED_IMPORT);
}

if (process.argv.includes('--check')) {
  if (!existsSync(targetPath)) {
    console.error(`::error::assets/vendor/supabase-${version}.min.js is missing — run scripts/vendor-supabase.mjs`);
    process.exit(1);
  }
  if (readFileSync(targetPath, 'utf8') !== buildContent()) {
    console.error(`::error::assets/vendor/supabase-${version}.min.js does not match the pinned node_modules build — run scripts/vendor-supabase.mjs`);
    process.exit(1);
  }
  const stale = readdirSync(vendorDir).filter((f) => /^supabase-.*\.min\.js$/.test(f) && f !== path.basename(targetPath));
  if (stale.length) {
    console.error(`::error::stale vendored supabase builds present: ${stale.join(', ')} — remove them so pages can't reference an old version`);
    process.exit(1);
  }
  console.log(`Vendored supabase-js ${version} matches the pinned package. ✓`);
  process.exit(0);
}

mkdirSync(vendorDir, { recursive: true });
for (const f of readdirSync(vendorDir)) {
  if (/^supabase-.*\.min\.js$/.test(f)) rmSync(path.join(vendorDir, f));
}
writeFileSync(targetPath, buildContent());
console.log(`Vendored supabase-js ${version} -> assets/vendor/supabase-${version}.min.js`);
