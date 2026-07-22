// Deterministic fingerprint of the Sales Mindset build INPUTS.
//
// WHY: the committed sales-mindset/ output is a Vite build whose content-hash
// filenames are NOT reproducible across environments (e.g. GitHub Ubuntu emits
// index-C5B6LMCy.js while Windows/Linux-Docker emit index-Bjtyw6is.js for the
// same source). Diffing that output in CI false-positives. Instead we hash the
// build INPUTS (normalized), so the value is identical on every OS and only
// changes when a real input changes.
//
// Modes (an explicit flag is required — there is no default action):
//   node scripts/build-fingerprint.mjs --write   # write sales-mindset/build-fingerprint.json
//   node scripts/build-fingerprint.mjs --check    # fail if the committed fingerprint is stale
//
// The writer runs only as the last step of `npm run build`, so the fingerprint
// can never be refreshed without a full rebuild.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDir, '..', '..');
const OUTPUT_REL = 'sales-mindset/build-fingerprint.json';
const VERSION = 1;

// The exact set of files that determine the Sales Mindset build output.
// Update this list if the app gains new input sources.
const INPUT_DIRS = ['sales-mindset-app/src']; // recursive
const INPUT_FILES = [
  'sales-mindset-app/index.html',
  'sales-mindset-app/vite.config.ts',
  'sales-mindset-app/tsconfig.json',
  'sales-mindset-app/package.json',
  'sales-mindset-app/package-lock.json',
  'sales-mindset-app/scripts/build-fingerprint.mjs', // this script — a logic change forces regeneration
];
// Root lesson pages imported verbatim by src/lessons.ts via Vite `?raw`.
const LESSON_RE = /^sales-mindset-\d+\.html$/;

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function walk(relDir, acc) {
  for (const name of readdirSync(path.join(siteRoot, relDir)).sort()) {
    const rel = `${relDir}/${name}`;
    if (statSync(path.join(siteRoot, rel)).isDirectory()) walk(rel, acc);
    else acc.push(rel);
  }
}

function collectInputs() {
  const files = [];
  for (const dir of INPUT_DIRS) walk(dir, files);
  files.push(...INPUT_FILES);
  for (const name of readdirSync(siteRoot)) {
    if (LESSON_RE.test(name) && statSync(path.join(siteRoot, name)).isFile()) files.push(name);
  }
  // POSIX paths, de-duplicated, sorted — identical ordering on every OS.
  return [...new Set(files.map((p) => p.split(path.sep).join('/')))].sort();
}

function hashFile(rel) {
  // Normalize line endings before hashing so a CRLF (Windows) vs LF (Linux)
  // checkout of the same file produces the same hash.
  const normalized = readFileSync(path.join(siteRoot, rel), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function computeManifest() {
  const paths = collectInputs();
  const files = {};
  for (const p of paths) files[p] = hashFile(p);
  const digest = createHash('sha256')
    .update(paths.map((p) => `${p}\n${files[p]}\n`).join(''), 'utf8')
    .digest('hex');
  return {
    version: VERSION,
    algorithm: 'sha256',
    normalization: 'utf8; CRLF/CR -> LF',
    note: 'Fingerprint of Sales Mindset build INPUTS (not the non-deterministic Vite output). Regenerate with `npm run build`.',
    files,
    digest,
  };
}

const mode = process.argv.includes('--write')
  ? 'write'
  : process.argv.includes('--check')
    ? 'check'
    : null;
if (!mode) fail('Usage: build-fingerprint.mjs --write | --check');

const fresh = computeManifest();

if (mode === 'write') {
  writeFileSync(path.join(siteRoot, OUTPUT_REL), `${JSON.stringify(fresh, null, 2)}\n`);
  console.log(
    `Wrote ${OUTPUT_REL} (digest ${fresh.digest.slice(0, 12)}…, ${Object.keys(fresh.files).length} inputs).`,
  );
} else {
  // --check reads the committed fingerprint straight from the working tree — no
  // git, no child_process. CI runs this BEFORE `npm run build`, so the on-disk
  // file is still the committed one, not a freshly written copy. Locally it also
  // means the check passes right after a build, before you commit.
  const outPath = path.join(siteRoot, OUTPUT_REL);

  let raw;
  try {
    raw = readFileSync(outPath, 'utf8');
  } catch {
    fail(`Missing ${OUTPUT_REL}. Run \`npm run build\` and commit sales-mindset/.`);
  }

  let committed;
  try {
    committed = JSON.parse(raw);
  } catch {
    fail(`Malformed JSON in ${OUTPUT_REL}. Run \`npm run build\` to regenerate it.`);
  }

  const validShape =
    committed &&
    typeof committed === 'object' &&
    committed.version === VERSION &&
    committed.algorithm === 'sha256' &&
    typeof committed.digest === 'string' &&
    committed.files &&
    typeof committed.files === 'object';
  if (!validShape) {
    fail(
      `Incompatible fingerprint in ${OUTPUT_REL} (expected version ${VERSION}, sha256). Run \`npm run build\` to regenerate it.`,
    );
  }

  if (committed.digest === fresh.digest) {
    console.log(`Sales Mindset build fingerprint matches source (digest ${fresh.digest.slice(0, 12)}…). ✓`);
  } else {
    const changed = Object.keys(fresh.files).filter((p) => committed.files[p] !== fresh.files[p]);
    const removed = Object.keys(committed.files).filter((p) => !(p in fresh.files));
    console.error('::error::Sales Mindset build inputs changed but the committed fingerprint is stale.');
    if (changed.length) console.error(`Changed/added inputs:\n  ${changed.join('\n  ')}`);
    if (removed.length) console.error(`Removed inputs:\n  ${removed.join('\n  ')}`);
    console.error(
      '\nRegenerate and commit:\n  npm --prefix sales-mindset-app ci\n  npm --prefix sales-mindset-app run build\n  git add -- sales-mindset',
    );
    process.exit(1);
  }
}
