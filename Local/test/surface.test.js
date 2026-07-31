import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { DEFAULT_PROFILES, DEFAULT_SETTINGS } from '../js/core.js';

test('Local application is permanently limited to subscription CLI controls', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.option-card\s*>\s*span\s*\{[^}]*display:\s*grid/s);
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4173/#briefing', pretendToBeVisual: true });
  const profiles = structuredClone(DEFAULT_PROFILES);
  profiles[0].cliModelId = 'cli-codex-terra';
  dom.window.localStorage.setItem('mba_v2_migrated', '4');
  dom.window.localStorage.setItem('mba_v2_settings', JSON.stringify({ ...DEFAULT_SETTINGS, onboardingComplete: true }));
  dom.window.localStorage.setItem('mba_v2_profiles', JSON.stringify(profiles));
  dom.window.localStorage.setItem('mba_v2_history', '[]');
  dom.window.localStorage.setItem('mba_v2_ui', JSON.stringify({ route: 'briefing', settingsSection: 'profiles' }));
  const detectedStatus = { ok: true, engines: [
    { id: 'codex', installed: true, authenticated: true, available: true, authMethod: 'ChatGPT subscription', path: 'C:\\Users\\micha\\AppData\\Roaming\\npm\\codex.cmd', source: 'PATH auto-detection' },
    { id: 'claude', installed: true, authenticated: true, available: true, authMethod: 'Claude max', path: 'C:\\Users\\micha\\.local\\bin\\claude.exe', source: 'PATH auto-detection' }
  ] };
  const fetch = async url => String(url).includes('/backtesting/')
    ? { ok: false, headers: { get: () => null }, json: async () => ({}) }
    : { ok: true, headers: { get: () => null }, json: async () => String(url).includes('/status') ? detectedStatus : { codexPath: '', claudePath: '' } };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, Blob: dom.window.Blob, URL: dom.window.URL, confirm: () => true, fetch });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  dom.window.scrollTo = () => {};
  dom.window.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function() { this.open = false; };
  await import(`../app.js?local-surface=${Date.now()}`);
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(document.documentElement.dataset.runtime, 'local');
  assert.match(document.querySelector('#runtime-detail').textContent, /Subscription CLI/i);
  assert.equal(document.querySelector('input[name="run-transport"]'), null);
  assert.ok([...document.querySelector('#run-model').options].every(option => option.value.startsWith('cli-')));

  document.querySelector('.primary-nav [data-route="backtest"]').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(document.querySelector('#view-backtest').hidden, false);
  assert.match(document.querySelector('#backtest-content').textContent, /No results yet/i);

  document.querySelector('.primary-nav [data-route="settings"]').click();
  assert.ok(document.querySelector('#profile-cli-model'));
  assert.equal(document.querySelector('#profile-api-model'), null);
  assert.equal(document.querySelector('#profile-transport'), null);

  document.querySelector('.settings-nav [data-settings-section="connections"]').click();
  assert.ok(document.querySelector('[data-action="refresh-cli-status"]'));
  assert.ok(document.querySelector('#cli-codex-path'));
  assert.match(document.querySelector('#settings-content').textContent, /PATH auto-detection/i);
  assert.doesNotMatch(document.querySelector('#settings-content').textContent, /has not been checked/i);
  assert.match(document.querySelector('#cli-codex-path').value, /codex\.cmd$/i);
  assert.match(document.querySelector('#cli-claude-path').value, /claude\.exe$/i);
  assert.equal(document.querySelector('#settings-anthropic-key'), null);
  assert.equal(document.querySelector('#settings-google-key'), null);
  assert.equal(document.querySelector('#settings-openai-token'), null);

  document.querySelector('.primary-nav [data-settings-section="expert"]').click();
  assert.match(document.querySelector('#settings-content').textContent, /CLI administration/i);
  assert.doesNotMatch(document.querySelector('#settings-content').textContent, /API administration/i);
  assert.equal(document.querySelector('#expert-search-tool'), null);

  document.querySelector('.settings-nav [data-settings-section="data"]').click();
  assert.equal(document.querySelector('[data-action="export-secrets"]'), null);
  dom.window.close();
});
