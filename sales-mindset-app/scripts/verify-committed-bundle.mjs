// Verifies that the COMMITTED sales-mindset/ build output actually
// corresponds to the source — closing the drift-guard blind spot where a
// hand-edit to the committed bundle passes CI because `npm run build`
// overwrites it in the workspace before any browser QA runs.
//
// Two modes, used around the build step in CI (.github/workflows/qa.yml):
//
//   --snapshot <dir>   BEFORE build: copy the committed sales-mindset/ tree
//                      aside, exactly as it was checked out.
//   --compare <dir>    AFTER build: structurally validate both trees and
//                      compare the snapshot against the fresh output.
//
// Cross-platform reality (why this is not a plain `diff -r`): the lesson
// pages are bundled verbatim via Vite `?raw`, and git checks them out with
// CRLF on Windows but LF on the Ubuntu runners. That changes the embedded
// string bytes, which changes Rolldown's content-hash filenames — the
// exact false-positive that sank the original output-diff guard. Both
// sides are therefore normalized before comparison:
//   1. raw CRLF/CR  -> LF        (bytes in template literals + text files)
//   2. escaped \r\n -> \n        (the same content when the minifier emits
//      it as a quoted string instead of a template literal)
//   3. each side's own content-hash tokens -> the literal `HASH`
// After normalization the committed and fresh outputs must be identical.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundleDir = path.resolve(appDir, '..', 'sales-mindset');

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

const HASHED_RE = /^index-([A-Za-z0-9_-]+)\.(js|css)$/;

// Reads one bundle tree and validates its structure: index.html,
// build-fingerprint.json, and exactly one hashed js + one hashed css in
// assets/ — each actually referenced by index.html, with no strays.
function loadTree(dir, label) {
  if (!existsSync(dir)) fail(`${label}: ${dir} does not exist`);
  const assetsDir = path.join(dir, 'assets');
  const rootFiles = readdirSync(dir).filter((f) => f !== 'assets');
  const assetFiles = existsSync(assetsDir) ? readdirSync(assetsDir) : [];

  for (const required of ['index.html', 'build-fingerprint.json']) {
    if (!rootFiles.includes(required)) fail(`${label}: missing ${required}`);
  }
  const strayRoot = rootFiles.filter((f) => !['index.html', 'build-fingerprint.json'].includes(f));
  if (strayRoot.length) fail(`${label}: unexpected root files: ${strayRoot.join(', ')}`);

  const js = assetFiles.filter((f) => HASHED_RE.test(f) && f.endsWith('.js'));
  const css = assetFiles.filter((f) => HASHED_RE.test(f) && f.endsWith('.css'));
  const stray = assetFiles.filter((f) => !HASHED_RE.test(f));
  if (js.length !== 1 || css.length !== 1) {
    fail(`${label}: expected exactly one hashed js and one hashed css in assets/, found js=[${js}] css=[${css}]`);
  }
  if (stray.length) fail(`${label}: unexpected asset files (stale build leftovers?): ${stray.join(', ')}`);

  const html = readFileSync(path.join(dir, 'index.html'), 'utf8');
  for (const ref of [js[0], css[0]]) {
    if (!html.includes(`/assets/${ref}`)) fail(`${label}: index.html does not reference ${ref}`);
  }

  return {
    hashes: [js[0].match(HASHED_RE)[1], css[0].match(HASHED_RE)[1]],
    files: {
      'index.html': html,
      'build-fingerprint.json': readFileSync(path.join(dir, 'build-fingerprint.json'), 'utf8'),
      'assets/index.HASH.js': readFileSync(path.join(assetsDir, js[0]), 'utf8'),
      'assets/index.HASH.css': readFileSync(path.join(assetsDir, css[0]), 'utf8'),
    },
  };
}

function normalize(content, hashes) {
  let out = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\\r\\n/g, '\\n');
  for (const hash of hashes) out = out.split(hash).join('HASH');
  return out;
}

function firstDivergence(a, b) {
  const max = Math.min(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) {
      const start = Math.max(0, i - 80);
      return `at char ${i}\n  committed: …${JSON.stringify(a.slice(start, i + 80))}\n  fresh:     …${JSON.stringify(b.slice(start, i + 80))}`;
    }
  }
  return `lengths differ (committed=${a.length}, fresh=${b.length}) after common prefix`;
}

const mode = process.argv[2];
const dir = process.argv[3];
if (!['--snapshot', '--compare'].includes(mode) || !dir) {
  fail('Usage: verify-committed-bundle.mjs --snapshot <dir> | --compare <dir>');
}

if (mode === '--snapshot') {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(path.dirname(dir), { recursive: true });
  cpSync(bundleDir, dir, { recursive: true });
  console.log(`Snapshotted committed bundle -> ${dir}`);
  process.exit(0);
}

const committed = loadTree(dir, 'committed bundle');
const fresh = loadTree(bundleDir, 'fresh build');

let mismatches = 0;
for (const name of Object.keys(committed.files)) {
  const a = normalize(committed.files[name], committed.hashes);
  const b = normalize(fresh.files[name], fresh.hashes);
  if (a !== b) {
    mismatches++;
    console.error(`::error::committed ${name} does not correspond to the fresh build — ${firstDivergence(a, b)}`);
  }
}
if (mismatches) {
  fail(`${mismatches} bundle file(s) drifted from source. Rebuild with \`npm run build\` and commit the output — never hand-edit sales-mindset/.`);
}
console.log('Committed bundle corresponds to the freshly built output (structure + normalized content). ✓');
