import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildCliArgs, collectBriefingCitations, createCliService, parseCliOutput } from '../scripts/cli-bridge.mjs';
import { cliModelFor } from '../js/cli-models.js';

const briefing = {
  version: 1,
  title: 'CLI briefing',
  stance: 'Neutral',
  executive_summary: 'Structured local result.',
  findings: [{ id: 'one', section: 'Macro', headline: 'Finding', summary: 'Summary', why_it_matters: 'Impact', claim_type: 'confirmed', confidence: 'high', horizon: 'Current', importance: 'high', ticker: '', source_urls: ['https://example.com/source', 'javascript:alert(1)'] }],
  catalysts: [],
  watchlist: []
};

test('Codex command uses exec ordering, model ID, and stdin transport', () => {
  const args = buildCliArgs(cliModelFor('cli-codex-terra'), { schemaPath: 'C:\\temp\\schema.json', schemaJson: '{}', workspace: 'C:\\temp\\work' });
  assert.deepEqual(args.slice(0, 6), ['exec', '--full-auto', '--skip-git-repo-check', '-m', 'gpt-5.6-terra', '--output-schema']);
  assert.equal(args.at(-1), '-');
  assert.equal(args.includes('--ephemeral'), false);
});

test('Claude command is stateless and limited to web research tools', () => {
  const args = buildCliArgs(cliModelFor('cli-claude-sonnet-4-6'), { schemaPath: 'schema.json', schemaJson: '{"type":"object"}', workspace: 'work' });
  assert.equal(args[0], '-p');
  assert.ok(args.includes('--no-session-persistence'));
  assert.equal(args[args.indexOf('--tools') + 1], 'WebSearch,WebFetch');
  assert.equal(args.includes('--json-schema'), false);
  assert.deepEqual(args.slice(-2), ['--model', 'claude-sonnet-4-6']);
});

test('CLI output parsing extracts structured results and rejects unsafe citations', () => {
  const parsed = parseCliOutput('codex', JSON.stringify(briefing));
  assert.equal(parsed.briefing.title, 'CLI briefing');
  assert.deepEqual(parsed.citations, [{ url: 'https://example.com/source', title: 'example.com', citedText: '' }]);
  assert.equal(collectBriefingCitations(briefing).length, 1);
});

test('CLI parser downgrades unsupported confirmed claims', () => {
  const unsupported = structuredClone(briefing);
  unsupported.findings[0].source_urls = [];
  const parsed = parseCliOutput('claude', JSON.stringify({ type: 'result', structured_output: unsupported }));
  assert.equal(parsed.briefing.findings[0].claim_type, 'interpretation');
  assert.equal(parsed.briefing.findings[0].confidence, 'low');
});

test('CLI service validates login, allowlists the model, and sends the prompt through stdin', async () => {
  const calls = [];
  const execute = async (executable, args, options = {}) => {
    calls.push({ executable, args, options });
    if (args[0] === 'login') return { stdout: 'Logged in using ChatGPT', stderr: '', code: 0 };
    if (args[0] === 'auth') return { stdout: JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'max' }), stderr: '', code: 0 };
    return { stdout: JSON.stringify(briefing), stderr: '', code: 0 };
  };
  const service = createCliService({ resolve: async engine => `${engine}.cmd`, execute });
  const result = await service.generate({ modelId: 'cli-codex-terra', systemPrompt: 'System', prompt: 'Research markets.', depth: 'deep' });
  const generation = calls.find(call => call.args[0] === 'exec');
  assert.equal(result.briefing.title, 'CLI briefing');
  assert.equal(generation.executable, 'codex.cmd');
  assert.equal(typeof generation.executable, 'string');
  assert.match(generation.options.input, /LOCAL CLI SAFETY CONTRACT/);
  assert.match(generation.options.input, /Research markets/);
  assert.equal(generation.args.includes('Research markets.'), false);
  const status = await service.getStatus();
  assert.ok(status.engines.every(engine => engine.source === 'PATH auto-detection'));
  await assert.rejects(() => service.generate({ modelId: 'not-allowlisted', prompt: 'x' }), /supported local CLI model/i);
});

test('unrecognized login-status output is reported as unverified and still allows generation', async () => {
  const execute = async (_executable, args) => {
    if (args[0] === 'login' || args[0] === 'auth') return { stdout: 'Status output in a brand-new CLI format', stderr: '', code: 0 };
    return { stdout: JSON.stringify(briefing), stderr: '', code: 0 };
  };
  const service = createCliService({ resolve: async engine => `${engine}.cmd`, execute });
  const status = await service.getStatus({ refresh: true });
  assert.ok(status.engines.every(engine => engine.authState === 'unknown'));
  assert.ok(status.engines.every(engine => engine.available === true && engine.authenticated === false));
  const result = await service.generate({ modelId: 'cli-codex-terra', prompt: 'Research markets.' });
  assert.equal(result.briefing.title, 'CLI briefing');
});

test('Local mode rejects CLI sessions authenticated with provider API keys', async () => {
  const execute = async (_executable, args) => args[0] === 'login'
    ? { stdout: 'Logged in using an API key', stderr: '', code: 0 }
    : { stdout: JSON.stringify({ loggedIn: true, authMethod: 'console', subscriptionType: '' }), stderr: '', code: 0 };
  const service = createCliService({ resolve: async engine => `${engine}.cmd`, execute });
  const status = await service.getStatus({ refresh: true });
  assert.equal(status.ok, false);
  assert.ok(status.engines.every(engine => engine.available === false));
});

test('CLI service saves only verified Codex and Claude executable paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'market-cli-config-'));
  try {
    const local = join(root, '.local');
    await mkdir(local);
    const codexPath = join(root, 'codex.cmd');
    const claudePath = join(root, 'claude.exe');
    const unsafePath = join(root, 'notepad.exe');
    await Promise.all([codexPath, claudePath, unsafePath].map(path => writeFile(path, '')));
    const calls = [];
    const execute = async (executable, args) => {
      calls.push({ executable, args });
      return args[0] === 'login'
        ? { stdout: 'Logged in using ChatGPT', stderr: '', code: 0 }
        : { stdout: JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'max' }), stderr: '', code: 0 };
    };
    const service = createCliService({
      configFile: pathToFileURL(join(local, 'cli-config.json')),
      resolve: async () => '',
      execute
    });
    const saved = await service.setConfig({ codexPath, claudePath });
    assert.deepEqual(saved, { codexPath, claudePath });
    assert.deepEqual(await service.getConfig(), saved);
    const status = await service.getStatus({ refresh: true });
    assert.equal(status.ok, true);
    assert.ok(status.engines.every(engine => engine.source === 'Saved override'));
    assert.deepEqual(calls.map(call => call.executable).sort(), [codexPath, claudePath].sort());
    await assert.rejects(() => service.setConfig({ codexPath: unsafePath }), /not an arbitrary program/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
