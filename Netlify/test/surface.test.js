import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { DEFAULT_PROFILES, DEFAULT_SETTINGS } from '../js/core.js';

test('Netlify application is permanently limited to cloud API controls', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://ai-market.example/#briefing', pretendToBeVisual: true });
  dom.window.localStorage.setItem('mba_v2_migrated', '4');
  dom.window.localStorage.setItem('mba_v2_settings', JSON.stringify({ ...DEFAULT_SETTINGS, onboardingComplete: true }));
  dom.window.localStorage.setItem('mba_v2_profiles', JSON.stringify(DEFAULT_PROFILES));
  dom.window.localStorage.setItem('mba_v2_history', '[]');
  dom.window.localStorage.setItem('mba_v2_secrets', JSON.stringify({ anthropic: '', google: '', openai: '' }));
  dom.window.localStorage.setItem('mba_v2_ui', JSON.stringify({ route: 'briefing', settingsSection: 'profiles' }));
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, Blob: dom.window.Blob, URL: dom.window.URL, confirm: () => true, fetch: async () => { throw new Error('No network request expected.'); } });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  dom.window.scrollTo = () => {};
  dom.window.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function() { this.open = false; };
  await import(`../app.js?netlify-surface=${Date.now()}`);

  assert.equal(document.documentElement.dataset.runtime, 'api');
  assert.equal(document.querySelector('input[name="run-transport"]'), null);
  assert.ok([...document.querySelector('#run-model').options].every(option => !option.value.startsWith('cli-')));
  assert.ok([...document.querySelector('#run-model').options].some(option => option.value.startsWith('gpt-')));

  document.querySelector('.primary-nav [data-route="settings"]').click();
  assert.ok(document.querySelector('#profile-api-model'));
  assert.equal(document.querySelector('#profile-cli-model'), null);
  assert.equal(document.querySelector('#profile-transport'), null);

  document.querySelector('.settings-nav [data-settings-section="connections"]').click();
  assert.ok(document.querySelector('#settings-anthropic-key'));
  assert.ok(document.querySelector('#settings-google-key'));
  assert.ok(document.querySelector('#settings-openai-key'));
  assert.equal(document.querySelector('[data-action="refresh-cli-status"]'), null);
  assert.equal(document.querySelector('#cli-codex-path'), null);

  document.querySelector('.primary-nav [data-settings-section="expert"]').click();
  assert.match(document.querySelector('#settings-content').textContent, /API administration/i);
  assert.doesNotMatch(document.querySelector('#settings-content').textContent, /CLI administration/i);
  assert.ok(document.querySelector('#expert-search-tool'));

  document.querySelector('.settings-nav [data-settings-section="data"]').click();
  assert.ok(document.querySelector('[data-action="export-secrets"]'));
  dom.window.close();
});
