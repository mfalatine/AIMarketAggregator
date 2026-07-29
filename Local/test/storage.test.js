import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_HISTORY_RECORDS, createStore, STORAGE_KEYS } from '../js/storage.js';
import { APP_VERSION, DEFAULT_PROFILES } from '../js/core.js';

class MemoryStorage {
  constructor(seed = {}) { this.map = new Map(Object.entries(seed)); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

test('store initializes versioned Local settings, profiles, and history', () => {
  const storage = new MemoryStorage(); const store = createStore(storage); store.initialize();
  assert.match(STORAGE_KEYS.settings, /^maa_local_/);
  assert.equal(store.getSettings().version, APP_VERSION);
  assert.ok(store.getProfiles().length >= 4);
  assert.equal(store.getProfiles()[0].transport, 'cli');
  assert.equal('apiModelId' in store.getProfiles()[0], false);
  assert.match(store.getProfiles()[0].cliModelId, /^cli-/);
  assert.deepEqual(store.getHistory(), []);
});

test('Local migrates the prior shared profile data into its own namespace', () => {
  const storage = new MemoryStorage({
    mba_v2_settings: JSON.stringify({ version: 4, theme: 'light', activeProfileId: 'daily-market', expert: {} }),
    mba_v2_profiles: JSON.stringify([{ ...DEFAULT_PROFILES[0], watchlist: ['MSFT'], transport: 'api', modelId: 'gemini-2.5-flash' }]),
    mba_v2_history: '[]', mba_v2_ui: '{}'
  });
  const store = createStore(storage); store.initialize();
  assert.deepEqual(store.getProfiles()[0].watchlist, ['MSFT']);
  assert.equal(store.getProfiles()[0].transport, 'cli');
  assert.ok(storage.getItem(STORAGE_KEYS.settings));
});

test('Local exports contain no cloud credential section', () => {
  const store = createStore(new MemoryStorage()); store.initialize();
  assert.equal('secrets' in store.exportBundle(), false);
});

test('legacy data migrates into the profile-based schema', () => {
  const storage = new MemoryStorage({
    mb_settings: JSON.stringify({ default_model: 'gemini-2.5-flash', enabled_topics: ['fed_policy'], watchlist: ['TSLA'], enabled_coverage: ['price_moving_news'], active_style: 'deep_dive', custom_instructions: 'Legacy', theme: 'light' }),
    mb_history: JSON.stringify([{ id: 'old-1', date: '2026-02-01', model: 'legacy-model', model_label: 'Legacy model', response: 'Old response', generated_at: '2026-02-01T12:00:00Z' }])
  });
  const store = createStore(storage); store.initialize();
  assert.equal(store.getProfiles()[0].depth, 'deep');
  assert.deepEqual(store.getProfiles()[0].watchlist, ['TSLA']);
  assert.equal(store.getHistory()[0].legacy, true);
  assert.equal(storage.getItem(STORAGE_KEYS.migrated), String(APP_VERSION));
});

test('version 3 profiles migrate into the Local CLI model field', () => {
  const storage = new MemoryStorage({
    [STORAGE_KEYS.migrated]: '3',
    [STORAGE_KEYS.settings]: JSON.stringify({ version: 3, theme: 'dark', activeProfileId: 'daily-market', expert: {} }),
    [STORAGE_KEYS.profiles]: JSON.stringify([{ ...DEFAULT_PROFILES[0], apiModelId: undefined, cliModelId: undefined, transport: 'cli', modelId: 'cli-codex-terra' }]),
    [STORAGE_KEYS.history]: '[]', [STORAGE_KEYS.ui]: '{}'
  });
  const store = createStore(storage); store.initialize();
  const profile = store.getProfiles()[0];
  assert.equal(profile.cliModelId, 'cli-codex-terra');
  assert.equal('apiModelId' in profile, false);
  assert.equal(store.getSettings().version, APP_VERSION);
  assert.equal(storage.getItem(STORAGE_KEYS.migrated), String(APP_VERSION));
});

test('new default profiles seed once into existing installs and stay deleted afterwards', () => {
  const storage = new MemoryStorage({
    [STORAGE_KEYS.migrated]: String(APP_VERSION),
    [STORAGE_KEYS.settings]: JSON.stringify({ version: APP_VERSION, theme: 'dark', activeProfileId: 'daily-market', expert: {} }),
    [STORAGE_KEYS.profiles]: JSON.stringify(DEFAULT_PROFILES.slice(0, 4)),
    [STORAGE_KEYS.history]: '[]', [STORAGE_KEYS.ui]: '{}'
  });
  const store = createStore(storage); store.initialize();
  assert.ok(store.getProfiles().some(profile => profile.id === 'earnings-futures'));
  store.saveProfiles(store.getProfiles().filter(profile => profile.id !== 'earnings-futures'));
  store.initialize();
  assert.equal(store.getProfiles().some(profile => profile.id === 'earnings-futures'), false);
});

test('imports reject incompatible and incomplete backups', () => {
  const store = createStore(new MemoryStorage()); store.initialize();
  assert.throws(() => store.importBundle({ format: 'other', version: 2 }), /Unsupported/);
  assert.throws(() => store.importBundle({ format: 'market-briefing-backup', version: 2, settings: {} }), /missing required/i);
});

test('history is bounded to the newest records', () => {
  const store = createStore(new MemoryStorage()); store.initialize();
  for (let i = 0; i < MAX_HISTORY_RECORDS + 5; i += 1) store.addHistory({ id: `record-${i}`, generatedAt: '2026-07-13T00:00:00Z' });
  const history = store.getHistory();
  assert.equal(history.length, MAX_HISTORY_RECORDS);
  assert.equal(history[0].id, `record-${MAX_HISTORY_RECORDS + 4}`);
  assert.equal(history.some(item => item.id === 'record-0'), false);
});

test('a storage quota failure prunes oldest history and never loses the record just generated', () => {
  class QuotaStorage extends MemoryStorage {
    setItem(key, value) {
      if (key === STORAGE_KEYS.history && String(value).length > 4000) { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; }
      super.setItem(key, value);
    }
  }
  const store = createStore(new QuotaStorage()); store.initialize();
  for (let i = 0; i < 60; i += 1) store.addHistory({ id: `record-${i}`, rawResponse: 'x'.repeat(100), generatedAt: '2026-07-13T00:00:00Z' });
  const history = store.getHistory();
  assert.ok(history.length > 0 && history.length < 60);
  assert.equal(history[0].id, 'record-59');
});
