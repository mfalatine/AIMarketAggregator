import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const APPS = ['Local', 'Netlify'];

// Files the mandatory feature-parity rule requires to stay byte-identical between the two applications.
const IDENTICAL_FILES = ['styles.css', 'schemas/briefing.schema.json', 'scripts/check-project.mjs'];

const normalize = text => text.replace(/\r\n/g, '\n');
const failures = [];

for (const file of IDENTICAL_FILES) {
  const [local, netlify] = await Promise.all(APPS.map(app => readFile(join(root, app, file), 'utf8')));
  if (normalize(local) !== normalize(netlify)) failures.push(`Parity: ${file} differs between Local and Netlify. Apply the same change to both folders.`);
}

// Functional parity: the information-processing contract must be identical between the
// applications; only the interfacing (CLI vs cloud API) may differ. A change to topics,
// coverage, depths, profiles, prompts, or the briefing shape in one folder fails here
// until the same change is made in the other.
const [localCore, netlifyCore] = await Promise.all(APPS.map(app => import(pathToFileURL(join(root, app, 'js', 'core.js')).href)));
const stripInterfacing = ({ transport, cliModelId, apiModelId, modelId, ...shared }) => shared;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const CONTRACTS = [
  ['TOPICS', localCore.TOPICS, netlifyCore.TOPICS],
  ['COVERAGE_TYPES', localCore.COVERAGE_TYPES, netlifyCore.COVERAGE_TYPES],
  ['DEPTHS', localCore.DEPTHS, netlifyCore.DEPTHS],
  ['BRIEFING_SHAPE', localCore.BRIEFING_SHAPE, netlifyCore.BRIEFING_SHAPE],
  ['DEFAULT_PROFILES (excluding interfacing fields)', localCore.DEFAULT_PROFILES.map(stripInterfacing), netlifyCore.DEFAULT_PROFILES.map(stripInterfacing)],
  ['expert system prompt', localCore.DEFAULT_SETTINGS.expert.systemPrompt, netlifyCore.DEFAULT_SETTINGS.expert.systemPrompt]
];
for (const [name, local, netlify] of CONTRACTS) {
  if (!same(local, netlify)) failures.push(`Parity: ${name} differs between Local and Netlify. Apply the same change to both folders.`);
}
for (const [index, profile] of localCore.DEFAULT_PROFILES.entries()) {
  const run = { depth: profile.depth, dateFrom: '2026-01-02', dateTo: '2026-01-03' };
  const localPrompt = localCore.buildPrompt({ profile, ...run });
  const netlifyPrompt = netlifyCore.buildPrompt({ profile: netlifyCore.DEFAULT_PROFILES[index] || {}, ...run });
  if (localPrompt !== netlifyPrompt) failures.push(`Parity: buildPrompt output differs for profile "${profile.id}". Apply the same change to both folders.`);
}

// Build options mirror each app's package.json build script; keep them in sync if that script changes.
for (const app of APPS) {
  const result = await build({ absWorkingDir: join(root, app), entryPoints: ['app.js'], bundle: true, format: 'iife', platform: 'browser', target: 'chrome100', write: false });
  const fresh = normalize(result.outputFiles[0].text);
  const committed = normalize(await readFile(join(root, app, 'app.bundle.js'), 'utf8'));
  if (fresh !== committed) failures.push(`Stale bundle: ${app}/app.bundle.js does not match its source. Run "pnpm --dir ${app} build" and include the rebuilt bundle.`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Parity checks passed: ${IDENTICAL_FILES.length} shared files byte-identical, processing contract (topics, coverage, depths, profiles, prompts, briefing shape) identical, Local and Netlify bundles fresh.`);
