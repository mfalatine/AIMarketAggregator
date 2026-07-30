import {
  COVERAGE_TYPES, DEFAULT_PROFILES, DEPTHS, TOPICS, buildPrompt, clone, compareBriefings,
  createSampleBriefing, estimateRunCost, formatDate, formatDateTime, html, modelFor, modelsForTransport,
  normalizeBriefing, normalizeProfile, parseTickers, sanitizeUrl, todayISO, TRANSPORTS, uid
} from './js/core.js';
import { createStore, STORAGE_KEYS } from './js/storage.js';
import { formatProviderError, runProvider, validateProviderKey } from './js/providers.js';

const store = createStore();
store.initialize();
const directFileMode = window.location.protocol === 'file:';

const state = {
  settings: store.getSettings(), profiles: store.getProfiles(), secrets: store.getSecrets(), history: store.getHistory(),
  route: store.getUi().route || 'briefing', settingsSection: store.getUi().settingsSection || 'profiles',
  editingProfileId: store.getSettings().activeProfileId, currentRecord: null, compareIds: [], generationController: null,
  onboardingStep: 1, onboardingProvider: 'anthropic', onboardingTransport: 'api', onboardingWatchlist: null, customizeOpen: false,
  settingsDraft: null, profilesDraft: null, secretsDraft: null, settingsDirty: false, run: null
};
const requestedRoute = window.location.hash.replace(/^#/, '');
if (['briefing', 'history', 'settings'].includes(requestedRoute)) state.route = requestedRoute;

function activeProfile() { return state.profiles.find(profile => profile.id === state.settings.activeProfileId) || state.profiles[0]; }
function resetRun(profile = activeProfile()) {
  const transport = 'api';
  const models = availableModelsForTransport(transport);
  const savedModelId = profile.apiModelId;
  const modelId = models.some(model => model.id === savedModelId) ? savedModelId : models[0].id;
  state.run = { profileId: profile.id, depth: profile.depth, transport, modelId, dateFrom: todayISO(), dateTo: todayISO(), extraTickers: '', instructions: '', rawPrompt: '' };
}
resetRun();
state.currentRecord = state.history.find(item => item.kind === 'briefing') || null;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function applyRuntimeIdentity() {
  document.documentElement.dataset.runtime = 'api';
  document.title = 'AI Market Aggregator — API';
  $('#runtime-label').textContent = directFileMode ? 'Standalone API' : 'API mode';
  $('#runtime-detail').textContent = directFileMode ? 'Browser APIs' : 'Cloud APIs';
  $('#runtime-indicator').title = 'API mode uses browser-configured Anthropic, Gemini, and OpenAI credentials.';
}

function availableModelsForTransport(transport) { return modelsForTransport(transport); }
function modelsForRun(transport = state.run.transport) { return availableModelsForTransport(transport); }
function modelOptions(transport, selectedId) {
  const providerNames = { anthropic: 'Anthropic API', google: 'Google API', openai: 'OpenAI API' };
  return html`${modelsForTransport(transport).map(model => html`<option value="${model.id}" ${model.id === selectedId ? 'selected' : ''}>${providerNames[model.provider]} — ${model.name} · ${model.speed}</option>`)}`;
}

function toast(message, type = '') {
  const node = document.createElement('div'); node.className = `toast ${type}`.trim(); node.textContent = message;
  $('#toast-region').append(node); setTimeout(() => node.remove(), 4200);
}

function applyTheme(theme) { document.documentElement.dataset.theme = theme || 'dark'; }
function persistUi() { store.saveUi({ route: state.route, settingsSection: state.settingsSection, selectedHistoryId: state.currentRecord?.id || '' }); }

function setRoute(route, settingsSection = '') {
  if (!['briefing', 'history', 'settings'].includes(route)) route = 'briefing';
  if (state.route === 'settings') captureSettingsSection();
  state.route = route; if (settingsSection) state.settingsSection = settingsSection;
  $$('.view').forEach(view => { const active = view.id === `view-${route}`; view.hidden = !active; view.classList.toggle('is-active', active); });
  $$('.nav-link').forEach(button => { const active = button.dataset.route === route && (!button.dataset.settingsSection || button.dataset.settingsSection === state.settingsSection); button.classList.toggle('is-active', active); if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  if (route === 'briefing') renderWorkspace();
  if (route === 'history') renderHistory();
  if (route === 'settings') { ensureSettingsDrafts(); renderSettings(); }
  if (window.location.hash !== `#${route}`) {
    try { window.history.replaceState(null, '', `#${route}`); }
    catch { window.location.hash = route; }
  }
  persistUi(); $('#main-content').focus({ preventScroll: true });
}

function profileSummary(profile) {
  return [
    `${profile.topicIds.length} topics`, `${profile.watchlist.length} tickers`, DEPTHS[state.run.depth]?.name || 'Standard', TRANSPORTS[state.run.transport].name, modelFor(state.run.modelId).name
  ];
}

function runCostText() {
  const profile = activeProfile(); const cost = estimateRunCost({ modelId: state.run.modelId, depth: state.run.depth, topicCount: profile.topicIds.length, tickerCount: profile.watchlist.length + parseTickers(state.run.extraTickers).length });
  if (cost.high < 0.005) return '< $0.01';
  return `$${cost.low.toFixed(2)}–$${cost.high.toFixed(2)}`;
}

function renderWorkspace() {
  const profile = activeProfile();
  if (state.run.transport !== 'api') resetRun(profile);
  const available = modelsForRun();
  if (!available.some(item => item.id === state.run.modelId)) state.run.modelId = available[0].id;
  const model = modelFor(state.run.modelId);
  const connected = Boolean(state.secrets[model.provider]);
  $('#workspace-date').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
  $('#profile-select').innerHTML = html`${state.profiles.map(item => html`<option value="${item.id}" ${item.id === profile.id ? 'selected' : ''}>${item.name}</option>`)}`;
  $('#profile-summary').innerHTML = html`${profileSummary(profile).map(item => html`<span class="summary-chip">${item}</span>`)}`;
  const connection = $('#connection-status'); connection.classList.toggle('is-connected', connected); connection.innerHTML = html`<span class="status-dot"></span>${connected ? ({ google: 'Gemini connected', anthropic: 'Anthropic connected', openai: 'OpenAI connected' })[model.provider] : 'Connection required'}`;
  $$('input[name="run-depth"]').forEach(input => { input.checked = input.value === state.run.depth; });
  $('#run-date-from').value = state.run.dateFrom; $('#run-date-to').value = state.run.dateTo; $('#run-tickers').value = state.run.extraTickers; $('#run-instructions').value = state.run.instructions; $('#run-prompt').value = state.run.rawPrompt;
  $('#run-model').innerHTML = modelOptions(state.run.transport, state.run.modelId);
  $('#customize-panel').hidden = !state.customizeOpen; $('[data-action="toggle-customize"]').setAttribute('aria-expanded', String(state.customizeOpen));
  $('#run-summary').innerHTML = html`${[
    html`<div><dt>Profile</dt><dd>${profile.name}</dd></div>`, html`<div><dt>Period</dt><dd>${state.run.dateFrom === state.run.dateTo ? formatDate(state.run.dateFrom) : `${formatDate(state.run.dateFrom)}–${formatDate(state.run.dateTo)}`}</dd></div>`,
    html`<div><dt>Depth</dt><dd>${DEPTHS[state.run.depth].name}</dd></div>`, html`<div><dt>Method</dt><dd>${TRANSPORTS[state.run.transport].name}</dd></div>`, html`<div><dt>Model</dt><dd>${model.name}</dd></div>`,
    html`<div><dt>Coverage</dt><dd>${profile.topicIds.length} topics<br>${profile.watchlist.length + parseTickers(state.run.extraTickers).length} tickers</dd></div>`
  ]}`;
  $('#cost-estimate').textContent = runCostText();
  const costNote = $('#cost-estimate').closest('.cost-note');
  costNote.querySelector('span').textContent = 'Estimated cost';
  costNote.querySelector('small').textContent = 'Actual provider charges may vary.';
  renderOnboarding(); renderResult(state.currentRecord);
}

function renderOnboarding() {
  const host = $('#onboarding-host');
  if (state.settings.onboardingComplete) { host.innerHTML = ''; return; }
  const step = state.onboardingStep;
  const progress = html`<div class="onboarding-steps" aria-label="Setup step ${step} of 4">${[1,2,3,4].map(n => html`<span class="${n <= step ? 'is-active' : ''}"></span>`)}</div>`;
  const exitSetup = html`<button class="text-button" data-action="dismiss-onboarding">Open dashboard without setup</button>`;
  let content = '';
  if (step === 1) content = html`<span class="eyebrow">Welcome</span><h2>Start with a useful briefing, not a wall of settings.</h2><p>Setup takes about a minute. You can change every choice later.</p><div class="onboarding-actions"><button class="primary-button" data-action="onboarding-next">Get started</button><button class="secondary-button" data-action="show-sample">Preview a sample first</button>${exitSetup}</div>`;
  if (step === 2) {
    state.onboardingTransport = 'api';
    const apiSetup = html`<p>This provider key stays in this browser and is sent only to the selected provider.</p><fieldset class="depth-selector"><legend>Provider</legend><label><input type="radio" name="onboarding-provider" value="anthropic" ${state.onboardingProvider === 'anthropic' ? 'checked' : ''}><span>Anthropic<small>Claude models</small></span></label><label><input type="radio" name="onboarding-provider" value="google" ${state.onboardingProvider === 'google' ? 'checked' : ''}><span>Google<small>Gemini models</small></span></label><label><input type="radio" name="onboarding-provider" value="openai" ${state.onboardingProvider === 'openai' ? 'checked' : ''}><span>OpenAI<small>GPT models</small></span></label></fieldset><label>API key<input id="onboarding-key" type="password" autocomplete="off" placeholder="Paste your key"></label>`;
    content = html`<span class="eyebrow">Connection</span><h2>Connect a cloud API</h2>${apiSetup}<div class="onboarding-actions"><button class="secondary-button" data-action="onboarding-back">Back</button><button class="primary-button" data-action="onboarding-save-key">Test and continue</button><button class="text-button" data-action="onboarding-next">Skip this step</button>${exitSetup}</div>`;
  }
  if (step === 3) content = html`<span class="eyebrow">Starting point</span><h2>Choose a briefing profile</h2><p>A profile bundles topics, tickers, depth, and model choice.</p><label>Starting profile<select id="onboarding-profile">${state.profiles.map(profile => html`<option value="${profile.id}">${profile.name} — ${profile.description}</option>`)}</select></label><div class="onboarding-actions"><button class="secondary-button" data-action="onboarding-back">Back</button><button class="primary-button" data-action="onboarding-next">Continue</button>${exitSetup}</div>`;
  if (step === 4) { state.onboardingWatchlist ||= [...activeProfile().watchlist]; content = html`<span class="eyebrow">Watchlist</span><h2>Make it yours</h2><p>Add the stocks you need scanned every time. You can leave the defaults.</p><div class="field-group"><span class="field-label">Stocks to watch</span>${tickerEditorMarkup(state.onboardingWatchlist, 'onboarding')}</div><div class="onboarding-actions"><button class="secondary-button" data-action="onboarding-back">Back</button><button class="primary-button" data-action="finish-onboarding">Finish setup</button><button class="secondary-button" data-action="show-sample">Use a sample briefing</button>${exitSetup}</div>`; }
  host.innerHTML = html`<section class="onboarding surface"><div class="onboarding-grid"><div>${progress}${content}</div><div class="executive-pulse"><span class="eyebrow">What you get</span><h2>Evidence before confidence</h2><p>Each material claim is labeled, connected to sources when available, and saved for meaningful comparison later.</p></div></div></section>`;
}

function previousComparable(record) {
  if (!record) return null;
  return state.history.find(item => item.id !== record.id && item.kind === 'briefing' && item.profileId === record.profileId && new Date(item.generatedAt) < new Date(record.generatedAt));
}

function sourceMarkup(sources = []) {
  const valid = sources.map(source => ({ ...source, url: sanitizeUrl(source.url) })).filter(source => source.url);
  if (!valid.length) return html`<span class="unsourced">No retrieved source attached</span>`;
  return html`<div class="source-list">${valid.map((source, index) => html`<a class="source-link" href="${source.url}" target="_blank" rel="noopener noreferrer" title="${source.citedText || ''}">${index + 1}. ${source.title || new URL(source.url).hostname}</a>`)}</div>`;
}

function findingMarkup(finding, record) {
  return html`<article class="finding-card"><div class="finding-topline"><div><h3>${finding.ticker ? `${finding.ticker}: ${finding.headline}` : finding.headline}</h3><p>${finding.summary}</p></div><button class="secondary-button small" type="button" data-action="open-deep-dive" data-record-id="${record.id}" data-finding-id="${finding.id}">Deep dive</button></div>${finding.why_it_matters ? html`<p class="why-it-matters"><strong>Why it matters:</strong> ${finding.why_it_matters}</p>` : ''}<div class="finding-meta"><span class="claim-chip ${finding.claim_type}">${finding.claim_type}</span><span class="confidence-chip">${finding.confidence} confidence</span><span class="meta-chip">${finding.horizon}</span></div>${sourceMarkup(finding.sources)}</article>`;
}

function comparisonSummaryMarkup(previous, record) {
  if (!previous?.briefing || !record?.briefing) return '';
  const changes = compareBriefings(previous, record);
  const list = (items, mapper) => items.length ? html`<ul>${items.slice(0, 5).map(item => html`<li>${mapper(item)}</li>`)}</ul>` : html`<p class="subtle">None detected</p>`;
  return html`<section class="change-summary surface"><div class="briefing-section-header"><div><span class="eyebrow">Compared with ${formatDateTime(previous.generatedAt)}</span><h2>What changed</h2></div><button class="text-button" data-action="open-comparison" data-left="${previous.id}" data-right="${record.id}">Open full comparison</button></div><div class="change-columns"><div class="change-column"><h3>New</h3>${list(changes.new, item => item.headline)}</div><div class="change-column"><h3>Changed</h3>${list(changes.changed, item => `${item.before.headline} → ${item.after.headline}`)}</div><div class="change-column"><h3>No longer active</h3>${list(changes.resolved, item => item.headline)}</div></div></section>`;
}

function briefingMarkup(record, { compact = false } = {}) {
  if (!record) return html`<div class="empty-briefing"><h2>No briefing yet</h2><p>Generate a live briefing or preview the sample to see the evidence-aware layout.</p></div>`;
  const briefing = record.briefing || normalizeBriefing(record.rawResponse || '', { fallbackText: record.rawResponse || '', title: 'Imported briefing' });
  record.briefing = briefing;
  const groups = Object.groupBy ? Object.groupBy(briefing.findings, item => item.section) : briefing.findings.reduce((map, item) => ((map[item.section] ||= []).push(item), map), {});
  const sections = Object.entries(groups).map(([section, findings]) => html`<section class="briefing-section surface"><div class="briefing-section-header"><h2>${section}</h2><button class="text-button" data-action="open-section-deep-dive" data-record-id="${record.id}" data-section="${section}">Deep dive on section</button></div><div class="finding-list">${findings.map(finding => findingMarkup(finding, record))}</div></section>`);
  const catalysts = briefing.catalysts.length ? html`<section class="briefing-section surface"><div class="briefing-section-header"><h2>Catalyst calendar</h2></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Event</th><th>Expectation</th><th>Potential impact</th></tr></thead><tbody>${briefing.catalysts.map(item => html`<tr><td>${item.date}</td><td>${item.event}${sourceMarkup(item.sources)}</td><td>${item.expectation}</td><td>${item.impact}</td></tr>`)}</tbody></table></div></section>` : '';
  const watchlist = briefing.watchlist.length ? html`<section class="briefing-section surface"><div class="briefing-section-header"><h2>Watchlist scan</h2></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Ticker</th><th>Catalyst</th><th>Potential impact</th><th>Next date</th></tr></thead><tbody>${briefing.watchlist.map(item => html`<tr><td><strong>${item.ticker}</strong></td><td>${item.catalyst}${sourceMarkup(item.sources)}</td><td>${item.potential_impact}</td><td>${item.next_date}</td></tr>`)}</tbody></table></div></section>` : '';
  return html`<div class="result-shell"><section class="result-hero surface"><div class="result-header"><div><span class="eyebrow">${record.kind === 'deep-dive' ? 'Contextual deep dive' : 'Latest briefing'}</span><h1>${briefing.title}</h1><div class="result-meta"><span class="meta-chip">${record.profileName}</span><span class="meta-chip">${modelFor(record.modelId).name}</span><span class="meta-chip">${formatDateTime(record.generatedAt)}</span><span class="meta-chip">${record.citations?.length || 0} sources</span></div></div>${compact ? '' : html`<div class="result-actions"><button class="secondary-button small" data-action="copy-briefing" data-record-id="${record.id}">Copy</button><button class="secondary-button small" data-action="export-briefing" data-record-id="${record.id}">Export HTML</button><button class="secondary-button small" data-action="print">Print</button><button class="secondary-button small" data-action="regenerate" data-record-id="${record.id}">Regenerate</button></div>`}</div><div class="pulse-grid"><div class="executive-pulse"><h2>Executive pulse</h2><p>${briefing.executive_summary}</p></div><div class="stance-card"><span class="eyebrow">Overall stance</span><strong>${briefing.stance}</strong></div></div></section>${compact ? '' : comparisonSummaryMarkup(previousComparable(record), record)}${sections}${catalysts}${watchlist}</div>`;
}

function renderResult(record) { $('#briefing-result').innerHTML = briefingMarkup(record); }

function setProgress(step, detail) {
  const order = ['prepare', 'search', 'synthesize', 'format']; const index = order.indexOf(step);
  $$('.progress-steps li').forEach((item, i) => { item.classList.toggle('is-active', i === index); item.classList.toggle('is-done', i < index); });
  $('#generation-status-title').textContent = ({ prepare: 'Preparing briefing', search: 'Researching current sources', synthesize: 'Synthesizing findings', format: 'Connecting claims to evidence' })[step] || 'Generating briefing';
  $('#generation-status-detail').textContent = detail || '';
}

async function generate({ parentRecord = null, parentContext = '', deepDivePrompt = '', regenerateRecord = null } = {}) {
  if (state.generationController) return;
  const profile = activeProfile(); const depth = parentRecord ? 'deep' : (regenerateRecord?.depth || state.run.depth); const transport = 'api'; const requestedModelId = parentRecord ? ($('#deep-dive-model')?.value || state.run.modelId) : (regenerateRecord?.modelId || state.run.modelId); const modelId = availableModelsForTransport('api').some(model => model.id === requestedModelId) ? requestedModelId : state.run.modelId;
  const model = modelFor(modelId); const apiKey = state.secrets[model.provider];
  if (transport === 'api' && !apiKey) { const connectionName = ({ google: 'a Gemini API key', anthropic: 'an Anthropic API key', openai: 'an OpenAI API key' })[model.provider]; toast(`Add ${connectionName} in Connections first.`, 'error'); setRoute('settings', 'connections'); return; }
  const prompt = regenerateRecord?.prompt || buildPrompt({ profile, depth, dateFrom: state.run.dateFrom, dateTo: state.run.dateTo, extraTickers: state.run.extraTickers, extraInstructions: deepDivePrompt || state.run.instructions, parentContext, rawPrompt: regenerateRecord ? '' : state.run.rawPrompt });
  state.generationController = new AbortController(); $('#generation-status').hidden = false; setProgress('prepare', 'Building the request…'); $('#generate-button').disabled = true;
  try {
    const result = await runProvider({ transport, apiKey, modelId, systemPrompt: state.settings.expert.systemPrompt, prompt, depth, anthropicSearchTool: state.settings.expert.anthropicSearchTool, signal: state.generationController.signal, onProgress: setProgress, onRetry: info => setProgress('search', `Temporary provider issue. Retry ${info.attempt} in ${(info.delay / 1000).toFixed(1)} seconds…`) });
    const record = { id: uid(parentRecord ? 'deep-dive' : 'briefing'), kind: parentRecord ? 'deep-dive' : 'briefing', parentId: parentRecord?.id || null, profileId: regenerateRecord?.profileId || profile.id, profileName: regenerateRecord?.profileName || profile.name, dateFrom: regenerateRecord?.dateFrom || state.run.dateFrom, dateTo: regenerateRecord?.dateTo || state.run.dateTo, transport, authMethod: result.authMethod || '', modelId, modelName: model.name, depth, generatedAt: new Date().toISOString(), prompt, systemPrompt: state.settings.expert.systemPrompt, usage: result.usage, citations: result.citations, rawResponse: result.text, briefing: result.briefing };
    store.addHistory(record); state.history = store.getHistory(); if (!parentRecord) state.currentRecord = record;
    if (parentRecord) { $('#dialog-content').innerHTML = briefingMarkup(record, { compact: true }); }
    else { renderResult(record); window.scrollTo({ top: $('#briefing-result').offsetTop - 90, behavior: 'smooth' }); }
    toast(parentRecord ? 'Deep dive completed and linked to its parent briefing.' : 'Briefing generated and saved.');
  } catch (error) { toast(formatProviderError(error), error.name === 'AbortError' ? '' : 'error'); }
  finally { state.generationController = null; $('#generation-status').hidden = true; $('#generate-button').disabled = false; }
}

function historySearchText(record) { const briefing = record.briefing || {}; return [record.profileName, record.modelName, record.rawResponse, briefing.title, briefing.executive_summary, ...(briefing.findings || []).flatMap(item => [item.headline, item.summary, item.ticker])].join(' ').toLowerCase(); }

function renderHistory() {
  state.history = store.getHistory();
  $('#history-profile-filter').innerHTML = html`<option value="">All profiles</option>${state.profiles.map(profile => html`<option value="${profile.id}">${profile.name}</option>`)}`;
  renderHistoryList(); renderHistoryDetail(state.currentRecord || state.history[0]);
}

function renderHistoryList() {
  const query = $('#history-search')?.value.trim().toLowerCase() || ''; const profileId = $('#history-profile-filter')?.value || '';
  const records = state.history.filter(record => (!query || historySearchText(record).includes(query)) && (!profileId || record.profileId === profileId));
  $('#history-list').innerHTML = records.length ? html`${records.map(record => html`<article class="history-row ${state.currentRecord?.id === record.id ? 'is-selected' : ''}"><label class="visually-hidden" for="compare-${record.id}">Select ${record.briefing?.title || record.profileName} for comparison</label><input id="compare-${record.id}" type="checkbox" data-history-compare="${record.id}" ${state.compareIds.includes(record.id) ? 'checked' : ''}><button class="text-button history-row-main" type="button" data-action="open-history" data-record-id="${record.id}"><strong>${record.kind === 'deep-dive' ? 'Deep dive · ' : ''}${record.briefing?.title || record.profileName || 'Imported briefing'}</strong><small>${record.briefing?.executive_summary || 'Legacy briefing — open to view'}</small></button><span class="history-row-time">${formatDateTime(record.generatedAt)}</span></article>`)}` : '<div class="empty-briefing"><h2>No matching history</h2><p>Try another search or generate a briefing.</p></div>';
  $('#compare-count').textContent = state.compareIds.length; $('#compare-button').disabled = state.compareIds.length !== 2;
}

function renderHistoryDetail(record) {
  const detail = $('#history-detail'); if (!detail) return;
  if (!record) { detail.innerHTML = '<div class="empty-briefing"><h2>Select a briefing</h2><p>Its evidence, lineage, and full content will appear here.</p></div>'; return; }
  state.currentRecord = record; detail.innerHTML = briefingMarkup(record, { compact: true });
}

function comparisonMarkup(left, right) {
  const diff = compareBriefings(left, right); const group = (title, values, mapper) => html`<section class="comparison-group"><h3>${title} <span class="meta-chip">${values.length}</span></h3>${values.length ? html`<ul>${values.map(value => html`<li>${mapper(value)}</li>`)}</ul>` : html`<p class="subtle">None detected</p>`}</section>`;
  return html`<div><p class="subtle">${formatDateTime(left.generatedAt)} → ${formatDateTime(right.generatedAt)}</p><div class="comparison-grid">${group('New', diff.new, item => item.headline)}${group('Changed', diff.changed, item => html`<strong>${item.after.headline}</strong><br><span class="subtle">Before: ${item.before.summary}</span><br>Now: ${item.after.summary}`)}${group('No longer active', diff.resolved, item => item.headline)}${group('Unchanged', diff.unchanged, item => item.headline)}</div></div>`;
}

function openDialog(title, content, eyebrow = '') { $('#dialog-title').textContent = title; $('#dialog-eyebrow').textContent = eyebrow; $('#dialog-content').innerHTML = content; $('#app-dialog').showModal(); }
function closeDialog() { $('#app-dialog').close(); }

function openDeepDive(recordId, { findingId = '', section = '' } = {}) {
  const record = state.history.find(item => item.id === recordId) || state.currentRecord; if (!record?.briefing) return;
  const findings = section ? record.briefing.findings.filter(item => item.section === section) : record.briefing.findings.filter(item => item.id === findingId);
  const contextTitle = section || findings[0]?.headline || record.briefing.title;
  const context = findings.map(item => `${item.headline}: ${item.summary}\nWhy it matters: ${item.why_it_matters}`).join('\n\n');
  openDialog('Deep dive', html`<div class="deep-dive-context"><strong>${contextTitle}</strong><p>${context}</p></div><div class="form-grid two-column"><label>Model<select id="deep-dive-model">${modelsForRun().map(model => html`<option value="${model.id}" ${model.id === state.run.modelId ? 'selected' : ''}>${model.name}</option>`)}</select></label><label>Analysis style<select id="deep-dive-style"><option value="evidence">Evidence review</option><option value="bull-bear">Bull vs bear</option><option value="scenario">Scenario analysis</option><option value="contrarian">Challenge the conclusion</option></select></label></div><label>Question or focus<textarea id="deep-dive-question" rows="4">Explain the evidence, strongest counterargument, key uncertainty, and the next observable signal that would confirm or invalidate this conclusion.</textarea></label><div class="onboarding-actions"><button class="primary-button" data-action="run-deep-dive" data-record-id="${record.id}" data-context="${context}">Run deep dive</button><button class="secondary-button" data-action="close-dialog">Cancel</button></div>`, contextTitle);
}

function ensureSettingsDrafts() {
  if (!state.settingsDraft) state.settingsDraft = clone(state.settings);
  if (!state.profilesDraft) state.profilesDraft = clone(state.profiles);
  if (!state.secretsDraft) state.secretsDraft = clone(state.secrets);
  if (!state.profilesDraft.some(profile => profile.id === state.editingProfileId)) state.editingProfileId = state.profilesDraft[0]?.id;
}

function updateSettingsActions() {
  $$('[data-settings-state]').forEach(node => { node.textContent = state.settingsDirty ? 'Unsaved changes' : 'No unsaved changes'; });
  $$('[data-settings-save], [data-settings-discard]').forEach(button => { button.disabled = !state.settingsDirty; });
}

function markSettingsDirty() {
  state.settingsDirty = true;
  updateSettingsActions();
}

function isPersistedSettingsControl(target) {
  if (!target.matches?.('input, select, textarea') || !target.closest('#settings-content')) return false;
  if (target.id === 'profile-watchlist-add') return false;
  return true;
}

function tickerEditorMarkup(tickers = [], scope = 'profile') {
  const prefix = scope === 'onboarding' ? 'onboarding-watchlist' : 'profile-watchlist';
  return html`<div class="ticker-editor">
    <input id="${prefix}" type="hidden" value="${tickers.join(', ')}">
    <div class="ticker-chip-list" aria-label="Stocks currently on this watchlist">${tickers.length ? tickers.map(ticker => html`<span class="ticker-chip"><span>${ticker}</span><button type="button" data-action="remove-${scope}-ticker" data-ticker="${ticker}" aria-label="Remove ${ticker} from watchlist">×</button></span>`) : html`<span class="subtle">No stocks added yet.</span>`}</div>
    <div class="ticker-add-row"><label for="${prefix}-add"><span>Add a stock</span><input id="${prefix}-add" autocomplete="off" autocapitalize="characters" placeholder="Enter a ticker, such as AAPL"></label><button class="secondary-button" type="button" data-action="add-${scope}-ticker">Add stock</button></div>
    <small class="field-help">Add one ticker at a time, or paste several separated by commas.</small>
  </div>`;
}

function captureSettingsSection() {
  if (!state.settingsDraft || !$('#settings-content')) return;
  const section = state.settingsSection;
  if (section === 'profiles') {
    const profile = state.profilesDraft.find(item => item.id === state.editingProfileId); if (!profile || !$('#profile-name')) return;
    Object.assign(profile, { name: $('#profile-name').value.trim() || profile.name, description: $('#profile-description').value.trim(), watchlist: parseTickers($('#profile-watchlist').value), depth: $('#profile-depth').value, transport: 'api', instructions: $('#profile-instructions').value.trim(), topicIds: $$('input[name="profile-topic"]:checked').map(input => input.value), coverageIds: $$('input[name="profile-coverage"]:checked').map(input => input.value) });
    if ($('#profile-api-model')) profile.apiModelId = $('#profile-api-model').value;
    profile.modelId = profile.apiModelId;
  }
  if (section === 'connections') {
    if ($('#settings-anthropic-key')) state.secretsDraft.anthropic = $('#settings-anthropic-key').value.trim();
    if ($('#settings-google-key')) state.secretsDraft.google = $('#settings-google-key').value.trim();
    if ($('#settings-openai-key')) state.secretsDraft.openai = $('#settings-openai-key').value.trim();
  }
  if (section === 'appearance') state.settingsDraft.theme = $('input[name="settings-theme"]:checked')?.value || state.settingsDraft.theme;
  if (section === 'expert') { state.settingsDraft.expert.systemPrompt = $('#expert-system-prompt')?.value || state.settingsDraft.expert.systemPrompt; state.settingsDraft.expert.anthropicSearchTool = $('#expert-search-tool')?.value || state.settingsDraft.expert.anthropicSearchTool; }
}

function settingsProfilesMarkupV3() {
  const profiles = state.profilesDraft;
  const profile = profiles.find(item => item.id === state.editingProfileId) || profiles[0];
  const categories = [...new Set(TOPICS.map(topic => topic.category))];
  const apiModels = availableModelsForTransport('api');
  const apiModelId = apiModels.some(model => model.id === profile.apiModelId) ? profile.apiModelId : apiModels[0].id;
  const modelControl = html`<article class="mode-setting-card is-api"><span class="scope-chip api">Cloud API</span><h3>API model</h3><p>Uses the selected provider API.</p><label>API model<select id="profile-api-model">${modelOptions('api', apiModelId)}</select></label></article>`;
  const profileModeSummary = item => `API model: ${modelFor(item.apiModelId).name}`;
  return html`<section class="settings-section">
    <div class="section-heading"><div><h2>Briefing profiles</h2><p>This Netlify version uses cloud APIs only.</p></div><button class="secondary-button small" data-action="add-profile">Add profile</button></div>
    <div class="profile-editor-list">${profiles.map(item => html`<button type="button" class="profile-editor-card text-button ${item.id === profile.id ? 'is-active' : ''}" data-action="edit-profile" data-profile-id="${item.id}"><span class="profile-title-row"><strong>${item.name}</strong>${item.id === state.settingsDraft.activeProfileId ? html`<span class="meta-chip">Default</span>` : ''}</span><span class="subtle">${item.description} · ${profileModeSummary(item)}</span></button>`)}</div>
  </section><section class="settings-section">
    <div class="section-heading"><div><span class="scope-chip shared">Common profile fields</span><h2>Edit ${profile.name}</h2><p>${profile.id === state.settingsDraft.activeProfileId ? 'This is the default Dashboard profile.' : 'Changes apply after Save changes.'}</p></div><div class="button-cluster">${profile.id !== state.settingsDraft.activeProfileId ? html`<button class="secondary-button small" data-action="make-default-profile" data-profile-id="${profile.id}">Make default</button>` : html`<span class="meta-chip">Default profile</span>`}<button class="secondary-button small" data-action="duplicate-profile" data-profile-id="${profile.id}">Duplicate</button>${profiles.length > 1 ? html`<button class="danger-button small" data-action="delete-profile" data-profile-id="${profile.id}">Delete</button>` : ''}</div></div>
    <div class="form-grid two-column">
      <label>Name<input id="profile-name" value="${profile.name}"></label>
      <label>Description<input id="profile-description" value="${profile.description}"></label>
      <label>Default depth<select id="profile-depth">${Object.entries(DEPTHS).map(([id, item]) => html`<option value="${id}" ${id === profile.depth ? 'selected' : ''}>${item.name}</option>`)}</select></label>
    </div>
    <div class="field-group"><span class="field-label">Stocks to watch</span>${tickerEditorMarkup(profile.watchlist)}</div>
    <label>Standing instructions<textarea id="profile-instructions" rows="4">${profile.instructions}</textarea></label>
    <h3>Topics</h3>${categories.map(category => html`<p class="eyebrow">${category}</p><div class="option-grid">${TOPICS.filter(topic => topic.category === category).map(topic => html`<label class="option-card"><input type="checkbox" name="profile-topic" value="${topic.id}" ${profile.topicIds.includes(topic.id) ? 'checked' : ''}><span><strong>${topic.name}</strong><small class="subtle">${topic.hint}</small></span></label>`)}</div>`)}
    <h3>Watchlist coverage</h3><div class="option-grid">${COVERAGE_TYPES.map(item => html`<label class="option-card"><input type="checkbox" name="profile-coverage" value="${item.id}" ${profile.coverageIds.includes(item.id) ? 'checked' : ''}><span><strong>${item.name}</strong><small class="subtle">${item.prompt}</small></span></label>`)}</div>
    <div class="mode-settings-grid">${modelControl}</div>
  </section>`;
}

function cloudConnectionsMarkup() {
  const status = provider => state.secrets[provider] ? html`<span class="connection-pill is-connected"><span class="status-dot"></span>Saved</span>` : html`<span class="connection-pill"><span class="status-dot"></span>Not set</span>`;
  const openaiConnection = html`<div class="connection-card"><label>OpenAI API key<input id="settings-openai-key" type="password" value="${state.secretsDraft.openai}" autocomplete="off"></label><div>${status('openai')} <button class="secondary-button small" data-action="test-connection" data-provider="openai">Test</button></div></div>`;
  return html`<section class="settings-section"><span class="scope-chip api">API only</span><h2>Cloud API connections</h2><p class="subtle">Anthropic, Gemini, and OpenAI keys are device-local and are sent only to the selected provider. Standard exports exclude all connection secrets.</p>
    <div class="connection-card"><label>Anthropic API key<input id="settings-anthropic-key" type="password" value="${state.secretsDraft.anthropic}" autocomplete="off"></label><div>${status('anthropic')} <button class="secondary-button small" data-action="test-connection" data-provider="anthropic">Test</button></div></div>
    <div class="connection-card"><label>Google Gemini API key<input id="settings-google-key" type="password" value="${state.secretsDraft.google}" autocomplete="off"></label><div>${status('google')} <button class="secondary-button small" data-action="test-connection" data-provider="google">Test</button></div></div>
    ${openaiConnection}
  </section>`;
}

function settingsConnectionsMarkupV3() {
  return cloudConnectionsMarkup();
}

function settingsAppearanceMarkup() { return html`<section class="settings-section"><span class="scope-chip shared">Application setting</span><h2>Appearance</h2><p class="subtle">Dark remains the default. Light and the original maize-and-blue theme are still available.</p><div class="theme-grid">${[['dark','Dark'],['light','Light'],['umich','Go Blue!']].map(([id,name]) => html`<label class="theme-card"><input type="radio" name="settings-theme" value="${id}" ${state.settingsDraft.theme === id ? 'checked' : ''}><span>${name}</span></label>`)}</div></section>`; }

function settingsDataMarkup() {
  const credentialBackup = html`<section class="settings-section"><span class="scope-chip api">API only</span><h2>Credential backup</h2><div class="danger-zone"><p><strong>Advanced and sensitive.</strong> This produces a plain JSON file containing API keys. Use it only for a secure transfer and delete it afterward.</p><button class="danger-button" data-action="export-secrets">Export backup with credentials</button></div></section>`;
  return html`<section class="settings-section"><span class="scope-chip shared">Application data</span><h2>Data & privacy</h2><p class="subtle">Normal exports exclude credentials. History includes prompts, responses, and retrieved source URLs.</p><div class="button-cluster"><button class="secondary-button" data-action="export-config">Export configuration</button><button class="secondary-button" data-action="export-history">Export history</button><button class="primary-button" data-action="export-full">Export full backup</button><button class="secondary-button" data-action="import-backup">Import backup</button></div></section>${credentialBackup}<section class="settings-section"><span class="scope-chip shared">Application data</span><h2>Storage</h2><p>${state.history.length} saved analyses on this device.</p><div class="danger-zone"><div class="button-cluster"><button class="danger-button" data-action="clear-history">Clear history</button><button class="danger-button" data-action="reset-app">Reset entire application</button></div></div></section>`;
}

function settingsExpertMarkup() {
  const apiControls = html`<section class="settings-section"><span class="scope-chip api">API only</span><h2>API administration</h2><p class="subtle">This setting affects Anthropic API requests.</p><label>Anthropic API web-search tool version<select id="expert-search-tool"><option value="web_search_20250305" ${state.settingsDraft.expert.anthropicSearchTool === 'web_search_20250305' ? 'selected' : ''}>web_search_20250305 · basic API search</option><option value="web_search_20260209" ${state.settingsDraft.expert.anthropicSearchTool === 'web_search_20260209' ? 'selected' : ''}>web_search_20260209 · dynamic API filtering</option></select></label></section>`;
  return html`<section class="settings-section"><span class="scope-chip shared">All API runs</span><h2>Analysis instructions</h2><p class="subtle">This system prompt applies to every run in this application.</p><label>System prompt<textarea id="expert-system-prompt" rows="10" class="code-input">${state.settingsDraft.expert.systemPrompt}</textarea></label></section>${apiControls}`;
}

function renderSettings() {
  ensureSettingsDrafts();
  $$('.settings-nav button').forEach(button => button.classList.toggle('is-active', button.dataset.settingsSection === state.settingsSection));
  const renderers = { profiles: settingsProfilesMarkupV3, connections: settingsConnectionsMarkupV3, appearance: settingsAppearanceMarkup, data: settingsDataMarkup, expert: settingsExpertMarkup };
  $('#settings-content').innerHTML = (renderers[state.settingsSection] || renderers.profiles)();
  updateSettingsActions();
}

function saveSettings() {
  captureSettingsSection(); state.profilesDraft = state.profilesDraft.map(profile => normalizeProfile(profile));
  if (!state.profilesDraft.some(profile => profile.id === state.settingsDraft.activeProfileId)) state.settingsDraft.activeProfileId = state.profilesDraft[0].id;
  store.saveSettings(state.settingsDraft); store.saveProfiles(state.profilesDraft); store.saveSecrets(state.secretsDraft);
  state.settings = clone(state.settingsDraft); state.profiles = clone(state.profilesDraft); state.secrets = clone(state.secretsDraft); applyTheme(state.settings.theme);
  state.settingsDirty = false; const profile = activeProfile(); resetRun(profile); toast('Settings saved.'); renderSettings();
}

function discardSettings() {
  state.settingsDraft = clone(state.settings); state.profilesDraft = clone(state.profiles); state.secretsDraft = clone(state.secrets); state.settingsDirty = false;
  state.editingProfileId = state.settings.activeProfileId; applyTheme(state.settings.theme); renderSettings(); toast('Unsaved settings discarded.');
}

function download(name, content, type = 'application/json') { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function recordText(record) { const briefing = record.briefing; return [briefing.title, briefing.executive_summary, ...briefing.findings.flatMap(item => [`${item.section}: ${item.headline}`, item.summary, `Why it matters: ${item.why_it_matters}`])].join('\n\n'); }
function exportRecordHtml(record) {
  const briefing = record.briefing;
  const sources = list => list?.length ? html`<ul class="sources">${list.map(source => html`<li><a href="${sanitizeUrl(source.url)}">${source.title || source.url}</a></li>`)}</ul>` : html`<p class="unsourced">No retrieved source attached</p>`;
  const sections = Object.entries(briefing.findings.reduce((map, item) => ((map[item.section] ||= []).push(item), map), {})).map(([name, findings]) => html`<section><h2>${name}</h2>${findings.map(item => html`<article><h3>${item.ticker ? `${item.ticker}: ${item.headline}` : item.headline}</h3><p>${item.summary}</p><p><strong>Why it matters:</strong> ${item.why_it_matters}</p><p class="meta">${item.claim_type} · ${item.confidence} confidence · ${item.horizon}</p>${sources(item.sources)}</article>`)}</section>`);
  return String(html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${briefing.title}</title><style>body{max-width:840px;margin:0 auto;padding:32px 20px;color:#14202b;font:16px/1.6 system-ui,sans-serif}h1{line-height:1.15}h2{margin-top:32px;border-bottom:2px solid #d9e0e6;padding-bottom:6px}article{margin:16px 0;padding:18px;border:1px solid #d9e0e6;border-radius:12px;background:#f7f9fb}.meta{color:#536270;font-size:13px}.sources{font-size:13px}.unsourced{color:#a52727;font-size:13px}header{padding:22px;border-radius:14px;background:#dff3ee}.stance{font-weight:700}</style></head><body><header><h1>${briefing.title}</h1><p>${briefing.executive_summary}</p><p class="stance">Overall stance: ${briefing.stance}</p><p class="meta">${record.profileName} · ${modelFor(record.modelId).name} · ${formatDateTime(record.generatedAt)}</p></header>${sections}</body></html>`);
}
function fileUpload(callback) { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.addEventListener('change', async () => { const file = input.files?.[0]; if (file) callback(await file.text()); }); input.click(); }

async function handleAction(button) {
  const action = button.dataset.action; if (!action) return;
  if (action === 'toggle-customize') { state.customizeOpen = !state.customizeOpen; renderWorkspace(); }
  if (action === 'reset-run') { resetRun(); renderWorkspace(); }
  if (action === 'preview-prompt') { state.run.rawPrompt = buildPrompt({ profile: activeProfile(), depth: state.run.depth, dateFrom: state.run.dateFrom, dateTo: state.run.dateTo, extraTickers: state.run.extraTickers, extraInstructions: state.run.instructions }); $('#run-prompt').value = state.run.rawPrompt; toast('Prompt preview built.'); }
  if (action === 'generate') await generate();
  if (action === 'cancel-generation') state.generationController?.abort();
  if (action === 'show-sample') { const record = { id: uid('sample'), kind: 'briefing', parentId: null, profileId: activeProfile().id, profileName: 'Product preview', dateFrom: todayISO(), dateTo: todayISO(), transport: state.run.transport, modelId: state.run.modelId, generatedAt: new Date().toISOString(), prompt: 'Local sample', citations: [], briefing: createSampleBriefing(), usage: null, rawResponse: '' }; state.currentRecord = record; renderResult(record); toast('Showing a local sample. It is not live market data.'); }
  if (action === 'onboarding-next') { if (state.onboardingStep === 3) { const selected = $('#onboarding-profile')?.value; if (selected) { state.settings.activeProfileId = selected; const profile = activeProfile(); profile.apiModelId = ({ anthropic: 'claude-sonnet-4-5-20250929', google: 'gemini-2.5-flash', openai: 'gpt-5.6-terra' })[state.onboardingProvider]; profile.modelId = profile.apiModelId; state.onboardingWatchlist = [...profile.watchlist]; resetRun(profile); } } state.onboardingStep = Math.min(4, state.onboardingStep + 1); renderWorkspace(); }
  if (action === 'onboarding-back') { state.onboardingStep = Math.max(1, state.onboardingStep - 1); renderWorkspace(); }
  if (action === 'dismiss-onboarding') { state.settings.onboardingComplete = true; store.saveSettings(state.settings); resetRun(activeProfile()); renderWorkspace(); toast('Setup skipped. Configure profiles and connections any time in Settings.'); }
  if (action === 'onboarding-save-key') { const key = $('#onboarding-key').value.trim(); if (!key) return toast('Enter a key or choose Skip for now.', 'error'); button.disabled = true; const result = await validateProviderKey(state.onboardingProvider, key); button.disabled = false; if (!result.ok) return toast(result.message, 'error'); state.onboardingTransport = 'api'; state.secrets[state.onboardingProvider] = key; store.saveSecrets(state.secrets); state.onboardingStep = 3; renderWorkspace(); toast('Connection verified.'); }
  if (action === 'finish-onboarding') { const profile = activeProfile(); profile.watchlist = [...(state.onboardingWatchlist || profile.watchlist)]; state.settings.onboardingComplete = true; store.saveProfiles(state.profiles); store.saveSettings(state.settings); resetRun(profile); renderWorkspace(); toast('Setup complete.'); }
  if (action === 'open-help') {
    const modeHelp = '<p><strong>API mode is open.</strong> Every briefing uses a configured cloud API.</p>';
    openDialog('AI Market Aggregator guide', `<div class="settings-section"><h3>Current version</h3>${modeHelp}<h3>Dashboard</h3><p>Choose a profile and depth, then generate with the configured cloud API.</p><h3>Connections</h3><p>Configure an Anthropic, Gemini, or OpenAI API key.</p><h3>Customize</h3><p>Use Customize this run for dates, one-time tickers, model overrides, and special questions.</p><h3>Deep dives</h3><p>Open any finding or section and request an evidence review, bull-versus-bear analysis, scenario analysis, or challenge.</p><h3>Evidence</h3><p>Retrieved source links appear beside claims. An explicit unsourced label means the provider did not attach retrievable evidence.</p><h3>Themes</h3><p>Dark is the default. Light and Go Blue remain available under Settings → Appearance.</p><h3>Privacy</h3><p>Settings, history, and provider keys stay in this browser. Standard exports exclude API credentials.</p></div>`, 'Guide');
  }
  if (action === 'close-dialog') closeDialog();
  if (action === 'open-deep-dive') openDeepDive(button.dataset.recordId, { findingId: button.dataset.findingId });
  if (action === 'open-section-deep-dive') openDeepDive(button.dataset.recordId, { section: button.dataset.section });
  if (action === 'run-deep-dive') { const parent = state.history.find(item => item.id === button.dataset.recordId) || state.currentRecord; const style = $('#deep-dive-style').value; const question = $('#deep-dive-question').value; await generate({ parentRecord: parent, parentContext: button.dataset.context, deepDivePrompt: `Analysis style: ${style}.\nQuestion: ${question}` }); }
  if (action === 'open-history') { const record = state.history.find(item => item.id === button.dataset.recordId); renderHistoryDetail(record); renderHistoryList(); }
  if (action === 'compare-selected') { const [left, right] = state.compareIds.map(id => state.history.find(item => item.id === id)).sort((a,b) => new Date(a.generatedAt) - new Date(b.generatedAt)); if (left && right) openDialog('What changed', comparisonMarkup(left, right), 'History comparison'); }
  if (action === 'open-comparison') { const left = state.history.find(item => item.id === button.dataset.left); const right = state.history.find(item => item.id === button.dataset.right) || state.currentRecord; if (left && right) openDialog('What changed', comparisonMarkup(left, right), 'History comparison'); }
  if (action === 'copy-briefing') { const record = state.history.find(item => item.id === button.dataset.recordId) || state.currentRecord; await navigator.clipboard.writeText(recordText(record)); toast('Briefing copied.'); }
  if (action === 'export-briefing') { const record = state.history.find(item => item.id === button.dataset.recordId) || state.currentRecord; download(`market-briefing-${record.dateFrom}.html`, exportRecordHtml(record), 'text/html'); toast('Briefing exported.'); }
  if (action === 'print') window.print();
  if (action === 'regenerate') { const record = state.history.find(item => item.id === button.dataset.recordId) || state.currentRecord; await generate({ regenerateRecord: record }); }
  if (action === 'save-settings') saveSettings();
  if (action === 'discard-settings') discardSettings();
  if (action === 'edit-profile') { captureSettingsSection(); state.editingProfileId = button.dataset.profileId; renderSettings(); }
  if (action === 'make-default-profile') { captureSettingsSection(); state.settingsDraft.activeProfileId = button.dataset.profileId; markSettingsDirty(); renderSettings(); toast('Default profile selected. Save changes to confirm.'); }
  if (action === 'add-profile-ticker') { captureSettingsSection(); const profile = state.profilesDraft.find(item => item.id === state.editingProfileId); const additions = parseTickers($('#profile-watchlist-add')?.value || ''); if (!additions.length) return toast('Enter a valid ticker symbol.', 'error'); profile.watchlist = [...new Set([...profile.watchlist, ...additions])]; markSettingsDirty(); renderSettings(); $('#profile-watchlist-add')?.focus(); }
  if (action === 'remove-profile-ticker') { captureSettingsSection(); const profile = state.profilesDraft.find(item => item.id === state.editingProfileId); profile.watchlist = profile.watchlist.filter(ticker => ticker !== button.dataset.ticker); markSettingsDirty(); renderSettings(); }
  if (action === 'add-onboarding-ticker') { const additions = parseTickers($('#onboarding-watchlist-add')?.value || ''); if (!additions.length) return toast('Enter a valid ticker symbol.', 'error'); state.onboardingWatchlist = [...new Set([...(state.onboardingWatchlist || activeProfile().watchlist), ...additions])]; renderOnboarding(); $('#onboarding-watchlist-add')?.focus(); }
  if (action === 'remove-onboarding-ticker') { state.onboardingWatchlist = (state.onboardingWatchlist || activeProfile().watchlist).filter(ticker => ticker !== button.dataset.ticker); renderOnboarding(); }
  if (action === 'add-profile') { captureSettingsSection(); const profile = normalizeProfile({ ...clone(DEFAULT_PROFILES[0]), id: uid('profile'), name: 'New profile', description: 'Custom briefing profile' }); state.profilesDraft.push(profile); state.editingProfileId = profile.id; markSettingsDirty(); renderSettings(); }
  if (action === 'duplicate-profile') { captureSettingsSection(); const source = state.profilesDraft.find(item => item.id === button.dataset.profileId); const copy = { ...clone(source), id: uid('profile'), name: `${source.name} copy` }; state.profilesDraft.push(copy); state.editingProfileId = copy.id; markSettingsDirty(); renderSettings(); }
  if (action === 'delete-profile') { const id = button.dataset.profileId; state.profilesDraft = state.profilesDraft.filter(item => item.id !== id); state.editingProfileId = state.profilesDraft[0].id; if (state.settingsDraft.activeProfileId === id) state.settingsDraft.activeProfileId = state.editingProfileId; markSettingsDirty(); renderSettings(); }
  if (action === 'test-connection') { captureSettingsSection(); const provider = button.dataset.provider; button.disabled = true; const result = await validateProviderKey(provider, state.secretsDraft[provider]); button.disabled = false; toast(result.message, result.ok ? '' : 'error'); }
  if (action === 'export-config') download(`market-briefing-config-${todayISO()}.json`, JSON.stringify(store.exportBundle({ includeHistory: false }), null, 2));
  if (action === 'export-history') download(`market-briefing-history-${todayISO()}.json`, JSON.stringify({ format: 'market-briefing-history', version: 2, history: state.history }, null, 2));
  if (action === 'export-full') download(`market-briefing-backup-${todayISO()}.json`, JSON.stringify(store.exportBundle(), null, 2));
  if (action === 'export-secrets') { if (confirm('This file will contain plain-text API credentials. Create it only for a secure transfer?')) download(`market-briefing-sensitive-backup-${todayISO()}.json`, JSON.stringify(store.exportBundle({ includeSecrets: true }), null, 2)); }
  if (action === 'import-backup') fileUpload(text => { try { const bundle = JSON.parse(text); const hasSecrets = Boolean(bundle.secrets); const accept = hasSecrets && confirm('This backup contains API credentials. Import them into this browser?'); store.importBundle(bundle, { acceptSecrets: accept }); location.reload(); } catch (error) { toast(error.message || 'Invalid backup.', 'error'); } });
  if (action === 'clear-history' && confirm('Delete all saved briefings and deep dives? This cannot be undone.')) { store.clearHistory(); state.history = []; state.currentRecord = null; renderSettings(); toast('History cleared.'); }
  if (action === 'reset-app' && confirm('Reset settings, profiles, connections, and history? This cannot be undone.')) { store.reset(); location.reload(); }
}

document.addEventListener('click', event => {
  const route = event.target.closest('[data-route]'); if (route) { event.preventDefault(); setRoute(route.dataset.route, route.dataset.settingsSection || ''); return; }
  const settingsButton = event.target.closest('[data-settings-section]'); if (settingsButton && settingsButton.closest('.settings-nav')) { captureSettingsSection(); state.settingsSection = settingsButton.dataset.settingsSection; renderSettings(); persistUi(); return; }
  const action = event.target.closest('[data-action]'); if (action) handleAction(action).catch(error => toast(error.message || 'Action failed.', 'error'));
});

document.addEventListener('change', event => {
  if (isPersistedSettingsControl(event.target)) markSettingsDirty();
  if (event.target.id === 'profile-select') { state.settings.activeProfileId = event.target.value; store.saveSettings(state.settings); resetRun(activeProfile()); renderWorkspace(); }
  if (event.target.name === 'run-depth') { state.run.depth = event.target.value; state.run.rawPrompt = ''; renderWorkspace(); }
  if (event.target.id === 'run-model') { state.run.modelId = event.target.value; state.run.rawPrompt = ''; renderWorkspace(); }
  if (event.target.name === 'onboarding-provider') { state.onboardingProvider = event.target.value; renderOnboarding(); }
  if (event.target.name === 'settings-theme') { state.settingsDraft.theme = event.target.value; markSettingsDirty(); applyTheme(event.target.value); }
  if (event.target.dataset.historyCompare) { const id = event.target.dataset.historyCompare; if (event.target.checked) { if (state.compareIds.length === 2) state.compareIds.shift(); state.compareIds.push(id); } else state.compareIds = state.compareIds.filter(item => item !== id); renderHistoryList(); }
  if (event.target.id === 'history-profile-filter') renderHistoryList();
});

document.addEventListener('input', event => {
  if (isPersistedSettingsControl(event.target)) markSettingsDirty();
  const map = { 'run-date-from': 'dateFrom', 'run-date-to': 'dateTo', 'run-tickers': 'extraTickers', 'run-instructions': 'instructions', 'run-prompt': 'rawPrompt' };
  if (map[event.target.id]) { state.run[map[event.target.id]] = event.target.value; if (event.target.id !== 'run-prompt') state.run.rawPrompt = ''; $('#cost-estimate').textContent = runCostText(); }
  if (event.target.id === 'history-search') renderHistoryList();
});

document.addEventListener('keydown', event => {
  if (['profile-watchlist-add', 'onboarding-watchlist-add'].includes(event.target.id) && event.key === 'Enter') {
    event.preventDefault();
    $(`[data-action="add-${event.target.id.startsWith('onboarding') ? 'onboarding' : 'profile'}-ticker"]`)?.click();
  }
});

let sharedSyncTimer = null;
window.addEventListener('storage', event => {
  if (![STORAGE_KEYS.settings, STORAGE_KEYS.profiles, STORAGE_KEYS.secrets, STORAGE_KEYS.history].includes(event.key)) return;
  if (event.key === STORAGE_KEYS.history) { state.history = store.getHistory(); if (state.route === 'history') renderHistory(); return; }
  if (state.settingsDirty && [STORAGE_KEYS.settings, STORAGE_KEYS.profiles, STORAGE_KEYS.secrets].includes(event.key)) {
    toast('Settings changed in another API tab. Save or discard this tab’s unsaved changes, then reopen the section.', 'error');
    return;
  }
  clearTimeout(sharedSyncTimer);
  sharedSyncTimer = setTimeout(() => {
    state.settings = store.getSettings(); state.profiles = store.getProfiles(); state.secrets = store.getSecrets(); state.history = store.getHistory();
    state.settingsDraft = null; state.profilesDraft = null; state.secretsDraft = null;
    state.editingProfileId = state.profiles.some(profile => profile.id === state.editingProfileId) ? state.editingProfileId : state.settings.activeProfileId;
    applyTheme(state.settings.theme); resetRun(activeProfile());
    if (state.route === 'briefing') renderWorkspace();
    if (state.route === 'history') renderHistory();
    if (state.route === 'settings') renderSettings();
    toast('Settings updated from another API tab.');
  }, 40);
});

$('#app-dialog').addEventListener('click', event => { if (event.target === $('#app-dialog')) closeDialog(); });
applyRuntimeIdentity();
applyTheme(state.settings.theme);
setRoute(state.route);
