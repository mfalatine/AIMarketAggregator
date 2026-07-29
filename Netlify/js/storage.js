import { APP_VERSION, DEFAULT_PROFILES, DEFAULT_SETTINGS, clone, normalizeProfile, uid } from './core.js';

export const STORAGE_KEYS = {
  settings: 'maa_netlify_v4_settings', profiles: 'maa_netlify_v4_profiles', history: 'maa_netlify_v4_history', secrets: 'maa_netlify_v4_secrets', ui: 'maa_netlify_v4_ui', migrated: 'maa_netlify_v4_migrated', seededProfiles: 'maa_netlify_v4_seeded_profiles'
};

const SHARED_KEYS = {
  settings: 'mba_v2_settings', profiles: 'mba_v2_profiles', history: 'mba_v2_history', secrets: 'mba_v2_secrets', ui: 'mba_v2_ui'
};

function parse(storage, key, fallback) { try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : clone(fallback); } catch { return clone(fallback); } }
function write(storage, key, value) { storage.setItem(key, JSON.stringify(value)); return value; }

export const MAX_HISTORY_RECORDS = 200;
function isQuotaError(error) { return Boolean(error) && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22 || error.code === 1014); }
// History is newest-first; trimming the tail drops the oldest records so a quota failure never loses the record just generated.
function writeHistory(storage, history) {
  const bounded = history.slice(0, MAX_HISTORY_RECORDS);
  for (;;) {
    try { return write(storage, STORAGE_KEYS.history, bounded); }
    catch (error) {
      if (!isQuotaError(error) || bounded.length <= 1) throw error;
      bounded.length = Math.max(1, Math.floor(bounded.length / 2));
    }
  }
}

export function createStore(storage = globalThis.localStorage) {
  function migrateLegacy() {
    if (storage.getItem(STORAGE_KEYS.migrated)) return;
    const sharedSettings = parse(storage, SHARED_KEYS.settings, null);
    const sharedProfiles = parse(storage, SHARED_KEYS.profiles, null);
    if (sharedSettings && Array.isArray(sharedProfiles)) {
      write(storage, STORAGE_KEYS.settings, sharedSettings);
      write(storage, STORAGE_KEYS.profiles, sharedProfiles);
      write(storage, STORAGE_KEYS.history, parse(storage, SHARED_KEYS.history, []));
      write(storage, STORAGE_KEYS.secrets, parse(storage, SHARED_KEYS.secrets, { anthropic: '', google: '', openai: '' }));
      write(storage, STORAGE_KEYS.ui, parse(storage, SHARED_KEYS.ui, { route: 'briefing', selectedHistoryId: '', settingsSection: 'profiles' }));
      storage.setItem(STORAGE_KEYS.migrated, String(APP_VERSION));
      return;
    }
    const legacySettings = parse(storage, 'mb_settings', null);
    const legacyAdmin = parse(storage, 'mb_admin', null);
    const legacyHistory = parse(storage, 'mb_history', []);
    const profiles = clone(DEFAULT_PROFILES);
    const settings = clone(DEFAULT_SETTINGS);
    if (legacySettings) {
      profiles[0] = normalizeProfile({
        ...profiles[0], topicIds: legacySettings.enabled_topics, watchlist: legacySettings.watchlist,
        coverageIds: legacySettings.enabled_coverage, depth: legacySettings.active_style === 'concise' ? 'quick' : legacySettings.active_style === 'deep_dive' ? 'deep' : 'standard',
        modelId: legacySettings.default_model, instructions: legacySettings.custom_instructions
      });
      settings.theme = legacySettings.theme || settings.theme;
    }
    if (legacyAdmin?.system_prompt) settings.expert.systemPrompt = legacyAdmin.system_prompt;
    write(storage, STORAGE_KEYS.settings, settings);
    write(storage, STORAGE_KEYS.profiles, profiles);
    write(storage, STORAGE_KEYS.history, legacyHistory.map(entry => ({
      id: entry.id || uid('briefing'), kind: 'briefing', parentId: null, profileId: profiles[0].id, profileName: profiles[0].name,
      dateFrom: entry.date, dateTo: entry.date_to || entry.date, modelId: entry.model, modelName: entry.model_label || entry.model,
      depth: entry.style === 'deep_dive' ? 'deep' : entry.style === 'concise' ? 'quick' : 'standard', generatedAt: entry.generated_at,
      prompt: entry.prompt_sent || '', systemPrompt: entry.system_prompt_sent || '', usage: null, citations: [], rawResponse: entry.response || '',
      briefing: null, legacy: true
    })));
    write(storage, STORAGE_KEYS.secrets, { anthropic: storage.getItem('mb_api_key') || '', google: storage.getItem('mb_gemini_api_key') || '', openai: '' });
    storage.setItem(STORAGE_KEYS.migrated, String(APP_VERSION));
  }

  function initialize() {
    migrateLegacy();
    if (!storage.getItem(STORAGE_KEYS.settings)) write(storage, STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    if (!storage.getItem(STORAGE_KEYS.profiles)) write(storage, STORAGE_KEYS.profiles, DEFAULT_PROFILES);
    if (!storage.getItem(STORAGE_KEYS.history)) write(storage, STORAGE_KEYS.history, []);
    if (!storage.getItem(STORAGE_KEYS.secrets)) write(storage, STORAGE_KEYS.secrets, { anthropic: '', google: '', openai: '' });
    if (!storage.getItem(STORAGE_KEYS.ui)) write(storage, STORAGE_KEYS.ui, { route: 'briefing', selectedHistoryId: '', settingsSection: 'profiles' });
    const storedSettings = parse(storage, STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    write(storage, STORAGE_KEYS.settings, { ...clone(DEFAULT_SETTINGS), ...storedSettings, version: APP_VERSION, expert: { ...DEFAULT_SETTINGS.expert, ...storedSettings.expert } });
    const storedProfiles = parse(storage, STORAGE_KEYS.profiles, DEFAULT_PROFILES);
    const profiles = storedProfiles.map((profile, index) => normalizeProfile(profile, DEFAULT_PROFILES[index] || DEFAULT_PROFILES[0]));
    // Seed each shipped default profile into this browser exactly once, so existing
    // installs receive new defaults without resurrecting ones the user deleted.
    const seededIds = new Set(parse(storage, STORAGE_KEYS.seededProfiles, []));
    for (const preset of DEFAULT_PROFILES) {
      if (!seededIds.has(preset.id) && !profiles.some(profile => profile.id === preset.id)) profiles.push(clone(preset));
      seededIds.add(preset.id);
    }
    write(storage, STORAGE_KEYS.seededProfiles, [...seededIds]);
    write(storage, STORAGE_KEYS.profiles, profiles);
    storage.setItem(STORAGE_KEYS.migrated, String(APP_VERSION));
  }

  const api = {
    initialize,
    getSettings: () => ({ ...clone(DEFAULT_SETTINGS), ...parse(storage, STORAGE_KEYS.settings, DEFAULT_SETTINGS), expert: { ...DEFAULT_SETTINGS.expert, ...parse(storage, STORAGE_KEYS.settings, DEFAULT_SETTINGS).expert } }),
    saveSettings: settings => write(storage, STORAGE_KEYS.settings, { ...settings, version: APP_VERSION }),
    getProfiles: () => parse(storage, STORAGE_KEYS.profiles, DEFAULT_PROFILES).map((profile, index) => normalizeProfile(profile, DEFAULT_PROFILES[index] || DEFAULT_PROFILES[0])),
    saveProfiles: profiles => write(storage, STORAGE_KEYS.profiles, profiles.map(profile => normalizeProfile(profile))),
    getHistory: () => parse(storage, STORAGE_KEYS.history, []),
    saveHistory: history => writeHistory(storage, history),
    addHistory: record => { const history = api.getHistory(); history.unshift(record); writeHistory(storage, history); return record; },
    getSecrets: () => ({ anthropic: '', google: '', openai: '', ...parse(storage, STORAGE_KEYS.secrets, { anthropic: '', google: '', openai: '' }) }),
    saveSecrets: secrets => write(storage, STORAGE_KEYS.secrets, { anthropic: String(secrets.anthropic || ''), google: String(secrets.google || ''), openai: String(secrets.openai || '') }),
    getUi: () => parse(storage, STORAGE_KEYS.ui, { route: 'briefing', selectedHistoryId: '', settingsSection: 'profiles' }),
    saveUi: ui => write(storage, STORAGE_KEYS.ui, ui),
    exportBundle({ includeHistory = true, includeSecrets = false } = {}) {
      return {
        format: 'market-briefing-backup', version: APP_VERSION, exportedAt: new Date().toISOString(),
        settings: api.getSettings(), profiles: api.getProfiles(), history: includeHistory ? api.getHistory() : [],
        ...(includeSecrets ? { secrets: api.getSecrets(), warning: 'This file contains API credentials. Store it securely.' } : {})
      };
    },
    importBundle(bundle, { acceptSecrets = false } = {}) {
      if (!bundle || bundle.format !== 'market-briefing-backup' || Number(bundle.version) > APP_VERSION) throw new Error('Unsupported backup format or version.');
      if (!bundle.settings || !Array.isArray(bundle.profiles) || !Array.isArray(bundle.history)) throw new Error('Backup is missing required data.');
      api.saveSettings({ ...DEFAULT_SETTINGS, ...bundle.settings, expert: { ...DEFAULT_SETTINGS.expert, ...bundle.settings.expert } });
      api.saveProfiles(bundle.profiles);
      api.saveHistory(bundle.history.filter(item => item && item.id && item.generatedAt));
      if (acceptSecrets && bundle.secrets) api.saveSecrets(bundle.secrets);
    },
    clearHistory: () => write(storage, STORAGE_KEYS.history, []),
    reset() { Object.values(STORAGE_KEYS).forEach(key => storage.removeItem(key)); initialize(); }
  };
  return api;
}
