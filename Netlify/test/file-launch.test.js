import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { STORAGE_KEYS } from '../js/storage.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] || null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

test('bundled application initializes from a file URL with profiles, buttons, and themes', async () => {
  const file = fileURLToPath(new URL('../index.html', import.meta.url));
  const browserErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => browserErrors.push(error.message));
  const storage = new MemoryStorage();
  const dom = await JSDOM.fromFile(file, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
      Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
      window.fetch = async () => { throw new Error('Network is disabled in the file-launch test.'); };
      window.scrollTo = () => {};
      window.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
      window.HTMLDialogElement.prototype.close = function() { this.open = false; };
    }
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('File application did not finish loading.')), 5000);
    dom.window.addEventListener('load', () => { clearTimeout(timeout); setTimeout(resolve, 0); }, { once: true });
  });

  const { document } = dom.window;
  assert.equal(document.documentElement.dataset.theme, 'dark');
  assert.equal(document.documentElement.dataset.runtime, 'api');
  assert.match(document.title, /— API$/);
  assert.match(document.querySelector('#runtime-label').textContent, /Standalone API/i);
  assert.equal(document.querySelector('#runtime-detail').textContent, 'Browser APIs');
  assert.equal(document.querySelector('#surface-notice'), null);
  assert.equal(document.querySelector('input[name="run-transport"]'), null);
  assert.equal(document.querySelector('#profile-select').value, 'daily-market');
  assert.ok(document.querySelectorAll('#profile-select option').length >= 4);
  assert.match(document.querySelector('.brand').textContent, /AI Market Aggregator/);
  const bodyFont = dom.window.getComputedStyle(document.body).fontFamily;
  for (const selector of ['button', 'input:not([type="hidden"])', 'select', 'textarea']) {
    assert.equal(dom.window.getComputedStyle(document.querySelector(selector)).fontFamily, bodyFont, `${selector} must use the application font stack`);
  }
  assert.equal(document.querySelector('#generation-status').hidden, true);
  assert.equal(document.querySelector('#customize-panel').hidden, true);
  assert.ok(document.querySelector('[data-action="dismiss-onboarding"]'));
  assert.match(await readFile(new URL('../styles.css', import.meta.url), 'utf8'), /\[hidden\]\s*\{\s*display:\s*none\s*!important/);

  document.querySelector('[data-action="show-sample"]').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(document.querySelector('#briefing-result').textContent, /product preview/i);
  const unsourced = document.querySelector('.data-table .unsourced');
  assert.ok(unsourced);
  assert.equal(dom.window.getComputedStyle(unsourced).display, 'block');
  document.querySelector('[data-action="dismiss-onboarding"]').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(document.querySelector('#onboarding-host').textContent, '');
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEYS.settings)).onboardingComplete, true);

  document.querySelector('.primary-nav [data-route="settings"][data-settings-section="profiles"]').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(document.querySelector('#view-settings').hidden, false);
  assert.equal(document.querySelector('#profile-transport'), null);
  assert.ok(document.querySelector('#profile-api-model'));
  assert.equal(document.querySelector('#profile-cli-model'), null);
  assert.ok([...document.querySelector('#profile-api-model').options].every(option => !option.value.startsWith('cli-')));
  assert.ok([...document.querySelector('#profile-api-model').options].some(option => option.value.startsWith('gpt-')));
  assert.equal(dom.window.getComputedStyle(document.querySelector('.profile-editor-card')).display, 'grid');
  assert.equal(dom.window.getComputedStyle(document.querySelector('.option-card > span')).display, 'grid');
  assert.match(document.querySelector('.profile-editor-card').textContent, /Default/);
  assert.equal(document.querySelector('[data-settings-save]').disabled, true);
  const addTicker = document.querySelector('#profile-watchlist-add');
  addTicker.value = 'AAPL';
  document.querySelector('[data-action="add-profile-ticker"]').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok([...document.querySelectorAll('.ticker-chip')].some(chip => /AAPL/.test(chip.textContent)));
  assert.equal(document.querySelector('[data-settings-save]').disabled, false);
  document.querySelector('[data-action="remove-profile-ticker"][data-ticker="AAPL"]').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(document.querySelector('[data-action="remove-profile-ticker"][data-ticker="AAPL"]'), null);
  document.querySelector('[data-action="discard-settings"]').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(document.querySelector('[data-settings-save]').disabled, true);
  document.querySelector('.settings-nav [data-settings-section="connections"]').click();
  assert.match(document.querySelector('#settings-content').textContent, /Cloud API connections/i);
  assert.match(document.querySelector('#settings-content').textContent, /OpenAI API key/i);
  assert.equal(document.querySelector('[data-action="refresh-cli-status"]'), null);
  assert.ok(document.querySelector('#settings-openai-key'));
  document.querySelector('.settings-nav [data-settings-section="appearance"]').click();
  const light = document.querySelector('input[name="settings-theme"][value="light"]');
  light.checked = true;
  light.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(document.documentElement.dataset.theme, 'light');
  assert.equal(document.querySelector('[data-settings-save]').disabled, false);
  const dark = document.querySelector('input[name="settings-theme"][value="dark"]');
  dark.checked = true;
  dark.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(document.documentElement.dataset.theme, 'dark');
  assert.deepEqual(browserErrors, []);
  dom.window.close();
});
