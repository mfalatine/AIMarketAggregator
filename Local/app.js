import {
  COVERAGE_TYPES, DEFAULT_PROFILES, DEPTHS, TOPICS, buildPrompt, clone, compareBriefings,
  createSampleBriefing, formatDate, formatDateTime, html, modelFor, modelsForTransport,
  normalizeBriefing, normalizeProfile, parseTickers, sanitizeUrl, todayISO, TRANSPORTS, uid
} from './js/core.js';
import { createStore, STORAGE_KEYS } from './js/storage.js';
import { formatProviderError, getCliConfig, getCliStatus, runProvider, saveCliConfig } from './js/providers.js';

const store = createStore();
store.initialize();
const state = {
  settings: store.getSettings(), profiles: store.getProfiles(), history: store.getHistory(),
  route: store.getUi().route || 'briefing', settingsSection: store.getUi().settingsSection || 'profiles',
  editingProfileId: store.getSettings().activeProfileId, currentRecord: null, compareIds: [], generationController: null,
  onboardingStep: 1, onboardingTransport: 'cli', onboardingWatchlist: null, customizeOpen: false,
  settingsDraft: null, profilesDraft: null, settingsDirty: false, cliStatus: null, cliConfig: { codexPath: '', claudePath: '' }, cliStatusLoading: false, run: null
};
const requestedRoute = window.location.hash.replace(/^#/, '');
if (['briefing', 'history', 'backtest', 'settings'].includes(requestedRoute)) state.route = requestedRoute;

function activeProfile() { return state.profiles.find(profile => profile.id === state.settings.activeProfileId) || state.profiles[0]; }
function resetRun(profile = activeProfile()) {
  const transport = 'cli';
  const models = availableModelsForTransport(transport);
  const savedModelId = profile.cliModelId;
  const modelId = models.some(model => model.id === savedModelId) ? savedModelId : models[0].id;
  state.run = { profileId: profile.id, depth: profile.depth, transport, modelId, dateFrom: todayISO(), dateTo: todayISO(), extraTickers: '', instructions: '', rawPrompt: '' };
}
resetRun();
state.currentRecord = state.history.find(item => item.kind === 'briefing') || null;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function applyRuntimeIdentity() {
  document.documentElement.dataset.runtime = 'local';
  document.title = 'AI Market Aggregator — Local';
  $('#runtime-label').textContent = 'Local server';
  $('#runtime-detail').textContent = 'Subscription CLI';
  $('#runtime-indicator').title = 'Local server mode: briefings use an authenticated Codex or Claude subscription CLI.';
}

function cliEngineStatus(engine) { return state.cliStatus?.engines?.find(item => item.id === engine); }
function availableModelsForTransport(transport) { return modelsForTransport(transport); }
function modelsForRun(transport = state.run.transport) { return availableModelsForTransport(transport); }
function modelOptions(transport, selectedId) {
  const providerNames = { codex: 'Codex subscription', claude: 'Claude subscription' };
  return html`${modelsForTransport(transport).map(model => {
    const unavailable = state.cliStatus && !cliEngineStatus(model.provider)?.available;
    return html`<option value="${model.id}" ${model.id === selectedId ? 'selected' : ''} ${unavailable ? 'disabled' : ''}>${providerNames[model.provider]} — ${model.name} · ${model.speed}${unavailable ? ' · unavailable' : ''}</option>`;
  })}`;
}

async function refreshCliStatus({ refresh = false, rerender = true } = {}) {
  if (state.cliStatusLoading) return state.cliStatus;
  state.cliStatusLoading = true;
  try {
    const [status, config] = await Promise.all([getCliStatus({ refresh }), getCliConfig()]);
    state.cliStatus = status; state.cliConfig = config;
    if (state.run?.transport === 'cli' && !cliEngineStatus(modelFor(state.run.modelId).provider)?.available) {
      const fallback = modelsForTransport('cli').find(model => cliEngineStatus(model.provider)?.available);
      if (fallback) state.run.modelId = fallback.id;
    }
  }
  finally {
    state.cliStatusLoading = false;
    if (rerender) {
      if (state.route === 'settings' && state.settingsSection === 'connections') renderSettings();
      else if (state.route === 'briefing') renderWorkspace();
    }
  }
  return state.cliStatus;
}

function toast(message, type = '') {
  const node = document.createElement('div'); node.className = `toast ${type}`.trim(); node.textContent = message;
  $('#toast-region').append(node); setTimeout(() => node.remove(), 4200);
}

function applyTheme(theme) { document.documentElement.dataset.theme = theme || 'dark'; }
function persistUi() { store.saveUi({ route: state.route, settingsSection: state.settingsSection, selectedHistoryId: state.currentRecord?.id || '' }); }

function setRoute(route, settingsSection = '') {
  if (!['briefing', 'history', 'backtest', 'settings'].includes(route)) route = 'briefing';
  if (state.route === 'settings') captureSettingsSection();
  state.route = route; if (settingsSection) state.settingsSection = settingsSection;
  $$('.view').forEach(view => { const active = view.id === `view-${route}`; view.hidden = !active; view.classList.toggle('is-active', active); });
  $$('.nav-link').forEach(button => { const active = button.dataset.route === route && (!button.dataset.settingsSection || button.dataset.settingsSection === state.settingsSection); button.classList.toggle('is-active', active); if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  if (route === 'briefing') renderWorkspace();
  if (route === 'history') renderHistory();
  if (route === 'backtest') renderBacktest();
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
  return 'Plan usage';
}

function renderWorkspace() {
  const profile = activeProfile();
  if (state.run.transport !== 'cli') resetRun(profile);
  const available = modelsForRun();
  if (!available.some(item => item.id === state.run.modelId)) state.run.modelId = available[0].id;
  const model = modelFor(state.run.modelId);
  const engine = cliEngineStatus(model.provider);
  const connected = Boolean(engine?.authenticated);
  const attemptable = Boolean(engine?.available);
  $('#workspace-date').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
  $('#profile-select').innerHTML = html`${state.profiles.map(item => html`<option value="${item.id}" ${item.id === profile.id ? 'selected' : ''}>${item.name}</option>`)}`;
  $('#profile-summary').innerHTML = html`${profileSummary(profile).map(item => html`<span class="summary-chip">${item}</span>`)}`;
  const connection = $('#connection-status'); connection.classList.toggle('is-connected', connected); connection.innerHTML = html`<span class="status-dot"></span>${connected ? `${model.provider === 'codex' ? 'Codex' : 'Claude'} CLI connected` : !state.cliStatus ? 'CLI server not checked' : attemptable ? 'CLI login status unverified — runs will be attempted' : 'Connection required'}`;
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
  costNote.querySelector('span').textContent = 'Billing';
  costNote.querySelector('small').textContent = 'Uses the active CLI account and its plan limits.';
  renderOnboarding(); renderResult(state.currentRecord);
}

function cliStatusMarkup() {
  if (state.cliStatusLoading) return html`<p class="subtle">Checking Codex and Claude subscription logins…</p>`;
  if (!state.cliStatus) return html`<p class="subtle">CLI status could not be loaded automatically. Select Recheck CLIs.</p>`;
  if (!state.cliStatus.engines?.length) return html`<p class="subtle">${state.cliStatus.message || 'Local CLI server is offline.'}</p>`;
  return html`<div class="cli-status-grid">${state.cliStatus.engines.map(engine => html`<div class="cli-engine-row"><div><strong>${engine.id === 'codex' ? 'Codex CLI' : 'Claude CLI'}</strong><small class="subtle">${engine.available ? engine.authMethod : engine.installed ? 'Installed · login required' : 'Not installed'} · ${engine.source || 'DAI/PATH auto-detection'}</small><small class="cli-path">${engine.path || 'Executable not detected'}</small></div><span class="connection-pill ${engine.authenticated ? 'is-connected' : ''}"><span class="status-dot"></span>${engine.authenticated ? 'Ready' : engine.available ? 'Unverified' : 'Unavailable'}</span></div>`)}</div>`;
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
    state.onboardingTransport = 'cli';
    content = html`<span class="eyebrow">Connection</span><h2>Connect your subscription CLI</h2><p>This application always uses an existing Codex or Claude subscription login.</p>${cliStatusMarkup()}<button class="secondary-button small" data-action="refresh-cli-status">Check subscription CLIs</button><div class="onboarding-actions"><button class="secondary-button" data-action="onboarding-back">Back</button><button class="primary-button" data-action="onboarding-use-cli">Use subscription CLI</button><button class="text-button" data-action="onboarding-next">Skip this step</button>${exitSetup}</div>`;
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
  const profile = activeProfile(); const depth = parentRecord ? 'deep' : (regenerateRecord?.depth || state.run.depth); const transport = 'cli'; const requestedModelId = parentRecord ? ($('#deep-dive-model')?.value || state.run.modelId) : (regenerateRecord?.modelId || state.run.modelId); const modelId = modelsForTransport('cli').some(model => model.id === requestedModelId) ? requestedModelId : state.run.modelId;
  const model = modelFor(modelId);
  const status = await refreshCliStatus({ refresh: true, rerender: false });
  if (!status?.engines?.find(item => item.id === model.provider)?.available) { toast(`${model.provider === 'codex' ? 'Codex' : 'Claude'} CLI is not installed and logged in. Check Connections.`, 'error'); setRoute('settings', 'connections'); return; }
  const prompt = regenerateRecord?.prompt || buildPrompt({ profile, depth, dateFrom: state.run.dateFrom, dateTo: state.run.dateTo, extraTickers: state.run.extraTickers, extraInstructions: deepDivePrompt || state.run.instructions, parentContext, rawPrompt: regenerateRecord ? '' : state.run.rawPrompt });
  state.generationController = new AbortController(); $('#generation-status').hidden = false; setProgress('prepare', 'Building the request…'); $('#generate-button').disabled = true;
  try {
    const result = await runProvider({ modelId, systemPrompt: state.settings.expert.systemPrompt, prompt, depth, signal: state.generationController.signal, onProgress: setProgress });
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
  if (['cli-codex-path', 'cli-claude-path', 'profile-watchlist-add'].includes(target.id)) return false;
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
    Object.assign(profile, { name: $('#profile-name').value.trim() || profile.name, description: $('#profile-description').value.trim(), watchlist: parseTickers($('#profile-watchlist').value), depth: $('#profile-depth').value, transport: 'cli', instructions: $('#profile-instructions').value.trim(), topicIds: $$('input[name="profile-topic"]:checked').map(input => input.value), coverageIds: $$('input[name="profile-coverage"]:checked').map(input => input.value) });
    if ($('#profile-cli-model')) profile.cliModelId = $('#profile-cli-model').value;
    profile.modelId = profile.cliModelId;
  }
  if (section === 'appearance') state.settingsDraft.theme = $('input[name="settings-theme"]:checked')?.value || state.settingsDraft.theme;
  if (section === 'expert') state.settingsDraft.expert.systemPrompt = $('#expert-system-prompt')?.value || state.settingsDraft.expert.systemPrompt;
}

function settingsProfilesMarkupV3() {
  const profiles = state.profilesDraft;
  const profile = profiles.find(item => item.id === state.editingProfileId) || profiles[0];
  const categories = [...new Set(TOPICS.map(topic => topic.category))];
  const cliModels = availableModelsForTransport('cli');
  const cliModelId = cliModels.some(model => model.id === profile.cliModelId) ? profile.cliModelId : cliModels[0].id;
  const modelControl = html`<article class="mode-setting-card is-local"><span class="scope-chip local">Subscription CLI</span><h3>CLI model</h3><p>Uses the authenticated Codex or Claude subscription.</p><label>Subscription model<select id="profile-cli-model">${modelOptions('cli', cliModelId)}</select></label></article>`;
  const profileModeSummary = item => `Subscription model: ${modelFor(item.cliModelId).name}`;
  return html`<section class="settings-section">
    <div class="section-heading"><div><h2>Briefing profiles</h2><p>This Local version uses subscription CLIs only.</p></div><button class="secondary-button small" data-action="add-profile">Add profile</button></div>
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

function settingsConnectionsMarkupV3() {
  const detected = engine => cliEngineStatus(engine)?.path || '';
  return html`<section class="settings-section"><div class="section-heading"><div><span class="scope-chip local">Local subscription only</span><h2>Codex and Claude connections</h2><p>Local checks the same CLI commands DAI uses: DAI command overrides first, then Windows PATH. No path setup is required when a CLI is detected.</p></div><button class="secondary-button small" data-action="refresh-cli-status">Recheck CLIs</button></div>
    ${cliStatusMarkup()}
    <details class="advanced-disclosure cli-path-settings"><summary>Advanced path override (normally unnecessary)</summary><div class="advanced-body"><label>Codex executable<input id="cli-codex-path" value="${state.cliConfig.codexPath || detected('codex')}" placeholder="${detected('codex') || 'Example: C:\\Users\\you\\AppData\\Roaming\\npm\\codex.cmd'}"><small class="field-help">The detected DAI/PATH value is shown. Edit only to force a different codex executable.</small></label><label>Claude executable<input id="cli-claude-path" value="${state.cliConfig.claudePath || detected('claude')}" placeholder="${detected('claude') || 'Example: C:\\Users\\you\\.local\\bin\\claude.exe'}"><small class="field-help">The detected DAI/PATH value is shown. Edit only to force a different claude executable.</small></label><button class="secondary-button" data-action="save-cli-paths">Save path overrides</button></div></details>
    <p class="field-help">CLI prompts run in an isolated temporary workspace that is deleted after each run. Codex may write only inside that workspace; Claude is limited to web research tools.</p>
  </section>`;
}

async function renderBacktestSettings() {
  const panel = $('#backtest-settings');
  let config = null;
  try {
    const response = await fetch('/backtesting/config', { cache: 'no-store' });
    if (response.ok) config = await response.json();
  } catch {}
  if (state.route !== 'backtest') return;
  if (!config) {
    panel.innerHTML = html`<p class="subtle">Arena settings unavailable (engine config not reachable).</p>`;
    return;
  }
  const definition = config.detection.event_definition;
  const bands = config.detection.severity_bands_pct || {};
  panel.innerHTML = html`
    <div class="section-heading"><div><h2>Arena settings</h2><p class="subtle">The event definition is a variable — change it, save, re-run. Sources are checkboxes; any combination, all at once.</p></div></div>
    <div class="form-grid two-column">
      <label>Event definition mode
        <select id="arena-mode">${['magnitude', 'percentile', 'either', 'both'].map(mode => html`<option value="${mode}" ${definition.mode === mode ? 'selected' : ''}>${mode}</option>`)}</select>
      </label>
      <label>Percentile: top %<input id="arena-top-percent" type="number" min="1" max="50" step="1" value="${definition.percentile.top_percent}"></label>
      <label>Percentile: trailing years<input id="arena-trailing-years" type="number" min="1" max="4" step="1" value="${definition.percentile.trailing_years}"></label>
    </div>
    <h3>Spike/drop magnitude per timeframe (%)</h3>
    <div class="form-grid two-column">${Object.entries(definition.magnitude.spike_thresholds_pct).map(([kind, value]) => html`<label>${kind}<input data-arena-threshold="${kind}" type="number" min="0.05" step="0.05" value="${value}"></label>`)}</div>
    <h3>Severity bands (|session %| at each score)</h3>
    <div class="form-grid two-column">${[1, 2, 3, 4, 5].map(score => html`<label>Score ${score}<input data-arena-band="${score}" type="number" min="0.05" step="0.05" value="${bands[String(score)] ?? ''}"></label>`)}</div>
    <h3>News sources (declared set — checked sources are the source lock)</h3>
    <div class="form-grid two-column">${Object.entries(config.sources).map(([name, enabled]) => html`<label class="option-card"><input data-arena-source="${name}" type="checkbox" ${enabled ? 'checked' : ''}><span>${name}</span></label>`)}</div>
    <div class="button-cluster">
      <button id="arena-save" class="primary-button" type="button">Save settings</button>
      <button id="arena-run" class="secondary-button" type="button">Re-run engine</button>
      <span id="arena-status" class="subtle" role="status"></span>
    </div>`;
  $('#arena-save').addEventListener('click', async () => {
    const statusNode = $('#arena-status');
    const detection = config.detection;
    detection.event_definition.mode = $('#arena-mode').value;
    detection.event_definition.percentile.top_percent = Number($('#arena-top-percent').value);
    detection.event_definition.percentile.trailing_years = Number($('#arena-trailing-years').value);
    for (const input of $$('[data-arena-threshold]')) detection.event_definition.magnitude.spike_thresholds_pct[input.dataset.arenaThreshold] = Number(input.value);
    for (const input of $$('[data-arena-band]')) detection.severity_bands_pct[input.dataset.arenaBand] = Number(input.value);
    const sources = Object.fromEntries($$('[data-arena-source]').map(input => [input.dataset.arenaSource, input.checked]));
    statusNode.textContent = 'Saving…';
    const response = await fetch('/backtesting/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ detection, sources }) });
    statusNode.textContent = response.ok ? 'Saved. Re-run the engine to apply.' : 'Save failed.';
  });
  $('#arena-run').addEventListener('click', async () => {
    const statusNode = $('#arena-status');
    statusNode.textContent = 'Running the engine — this takes a minute or two…';
    try {
      const response = await fetch('/backtesting/run', { method: 'POST' });
      const body = await response.json();
      statusNode.textContent = response.ok ? 'Engine re-run complete.' : (body.error?.message || 'Run failed.');
    } catch { statusNode.textContent = 'Run failed (server unreachable).'; }
    renderBacktest();
  });
}

async function renderBacktest() {
  renderBacktestSettings();
  const container = $('#backtest-content');
  container.innerHTML = html`<p class="subtle">Loading backtesting results…</p>`;
  let summary = null;
  try {
    const response = await fetch('/backtesting/summary.json', { cache: 'no-store' });
    if (response.ok) summary = await response.json();
  } catch {}
  if (state.route !== 'backtest') return;
  if (!summary || typeof summary !== 'object') {
    container.innerHTML = html`<h2>No results yet</h2><p class="subtle">The arena has not produced a summary. Run <span class="code-input">python Backtesting/engine/make_summary.py</span> from the repo root, then reopen this tab. The design and status live in Backtesting/docs/DESIGN.md.</p>`;
    return;
  }
  const sections = Array.isArray(summary.sections) ? summary.sections : [];
  container.innerHTML = html`<h2>${summary.headline || 'Backtesting summary'}</h2><p class="subtle">Generated ${summary.generated_at || 'unknown'} · all times CST</p>${sections.map(section => html`<section class="settings-section"><h3>${section.title || ''}</h3>${Array.isArray(section.rows) ? html`<div class="table-wrap"><table class="data-table"><tbody>${section.rows.map(row => html`<tr>${(Array.isArray(row) ? row : [row]).map((cell, index) => index === 0 ? html`<th scope="row">${cell}</th>` : html`<td>${cell}</td>`)}</tr>`)}</tbody></table></div>` : ''}${section.table ? html`<div class="table-wrap"><table class="data-table"><thead><tr>${(section.table.columns || []).map(column => html`<th>${column}</th>`)}</tr></thead><tbody>${(section.table.rows || []).map(row => html`<tr>${(Array.isArray(row) ? row : [row]).map(cell => html`<td>${cell}</td>`)}</tr>`)}</tbody></table></div>` : ''}${section.note ? html`<p class="subtle">${section.note}</p>` : ''}</section>`)}`;
}

function settingsAppearanceMarkup() { return html`<section class="settings-section"><span class="scope-chip shared">Application setting</span><h2>Appearance</h2><p class="subtle">Dark remains the default. Light and the original maize-and-blue theme are still available.</p><div class="theme-grid">${[['dark','Dark'],['light','Light'],['umich','Go Blue!']].map(([id,name]) => html`<label class="theme-card"><input type="radio" name="settings-theme" value="${id}" ${state.settingsDraft.theme === id ? 'checked' : ''}><span>${name}</span></label>`)}</div></section>`; }

function settingsDataMarkup() {
  return html`<section class="settings-section"><span class="scope-chip shared">Application data</span><h2>Data & privacy</h2><p class="subtle">History includes prompts, responses, and retrieved source URLs. CLI credentials remain owned by the installed CLI.</p><div class="button-cluster"><button class="secondary-button" data-action="export-config">Export configuration</button><button class="secondary-button" data-action="export-history">Export history</button><button class="primary-button" data-action="export-full">Export full backup</button><button class="secondary-button" data-action="import-backup">Import backup</button></div></section><section class="settings-section"><span class="scope-chip shared">Application data</span><h2>Storage</h2><p>${state.history.length} saved analyses on this device.</p><div class="danger-zone"><div class="button-cluster"><button class="danger-button" data-action="clear-history">Clear history</button><button class="danger-button" data-action="reset-app">Reset entire application</button></div></div></section>`;
}

function settingsExpertMarkup() {
  const localControls = html`<section class="settings-section"><span class="scope-chip local">Local subscription only</span><h2>CLI administration</h2><p class="subtle">These protections apply to Codex and Claude subscription runs.</p><div class="admin-fact-grid"><div><strong>Codex workspace</strong><span>Isolated temporary folder, deleted after each run</span></div><div><strong>Claude tools</strong><span>WebSearch and WebFetch only</span></div><div><strong>Prompt transport</strong><span>stdin; no shell command input</span></div><div><strong>Credentials</strong><span>Owned by the installed CLI</span></div></div><p class="field-help">Executable selection and authentication status are managed under Connections.</p></section>`;
  return html`<section class="settings-section"><span class="scope-chip shared">All subscription runs</span><h2>Analysis instructions</h2><p class="subtle">This system prompt applies to every run in this application.</p><label>System prompt<textarea id="expert-system-prompt" rows="10" class="code-input">${state.settingsDraft.expert.systemPrompt}</textarea></label></section>${localControls}`;
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
  store.saveSettings(state.settingsDraft); store.saveProfiles(state.profilesDraft);
  state.settings = clone(state.settingsDraft); state.profiles = clone(state.profilesDraft); applyTheme(state.settings.theme);
  state.settingsDirty = false; const profile = activeProfile(); resetRun(profile); toast('Settings saved.'); renderSettings();
}

function discardSettings() {
  state.settingsDraft = clone(state.settings); state.profilesDraft = clone(state.profiles); state.settingsDirty = false;
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
  if (action === 'onboarding-next') { if (state.onboardingStep === 3) { const selected = $('#onboarding-profile')?.value; if (selected) { state.settings.activeProfileId = selected; const profile = activeProfile(); profile.cliModelId = cliEngineStatus('codex')?.available ? 'cli-codex-terra' : 'cli-claude-default'; profile.modelId = profile.cliModelId; state.onboardingWatchlist = [...profile.watchlist]; resetRun(profile); } } state.onboardingStep = Math.min(4, state.onboardingStep + 1); renderWorkspace(); }
  if (action === 'onboarding-back') { state.onboardingStep = Math.max(1, state.onboardingStep - 1); renderWorkspace(); }
  if (action === 'dismiss-onboarding') { state.settings.onboardingComplete = true; store.saveSettings(state.settings); resetRun(activeProfile()); renderWorkspace(); toast('Setup skipped. Configure profiles and connections any time in Settings.'); }
  if (action === 'onboarding-use-cli') { const status = await refreshCliStatus({ refresh: true, rerender: false }); if (!status?.ok) return toast('Install and log in to Codex or Claude, then check again.', 'error'); state.onboardingTransport = 'cli'; state.onboardingStep = 3; renderWorkspace(); toast('Local CLI connection verified.'); }
  if (action === 'finish-onboarding') { const profile = activeProfile(); profile.watchlist = [...(state.onboardingWatchlist || profile.watchlist)]; state.settings.onboardingComplete = true; store.saveProfiles(state.profiles); store.saveSettings(state.settings); resetRun(profile); renderWorkspace(); toast('Setup complete.'); }
  if (action === 'open-help') {
    const modeHelp = '<p><strong>Local Server mode is open.</strong> Every briefing uses an authenticated Codex or Claude subscription CLI.</p>';
    openDialog('AI Market Aggregator guide', `<div class="settings-section"><h3>Current version</h3>${modeHelp}<h3>Dashboard</h3><p>Choose a profile and depth, then generate with your subscription CLI.</p><h3>Connections</h3><p>Connect an authenticated Codex or Claude installation and its existing subscription.</p><h3>Customize</h3><p>Use Customize this run for dates, one-time tickers, model overrides, and special questions.</p><h3>Deep dives</h3><p>Open any finding or section and request an evidence review, bull-versus-bear analysis, scenario analysis, or challenge.</p><h3>Evidence</h3><p>Retrieved source links appear beside claims. An explicit unsourced label means the CLI did not attach retrievable evidence.</p><h3>Themes</h3><p>Dark is the default. Light and Go Blue remain available under Settings → Appearance.</p><h3>Privacy</h3><p>Settings and history stay in this browser. CLI credentials remain owned by the installed CLI.</p></div>`, 'Guide');
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
  if (action === 'refresh-cli-status') { button.disabled = true; await refreshCliStatus({ refresh: true }); button.disabled = false; toast(state.cliStatus?.ok ? 'Local CLI status refreshed.' : 'No authenticated local CLI is available.', state.cliStatus?.ok ? '' : 'error'); }
  if (action === 'save-cli-paths') { button.disabled = true; try { const result = await saveCliConfig({ codexPath: $('#cli-codex-path')?.value || '', claudePath: $('#cli-claude-path')?.value || '' }); state.cliConfig = result.config; state.cliStatus = result.status; renderSettings(); toast('CLI executable paths saved and verified.'); } finally { button.disabled = false; } }
  if (action === 'edit-profile') { captureSettingsSection(); state.editingProfileId = button.dataset.profileId; renderSettings(); }
  if (action === 'make-default-profile') { captureSettingsSection(); state.settingsDraft.activeProfileId = button.dataset.profileId; markSettingsDirty(); renderSettings(); toast('Default profile selected. Save changes to confirm.'); }
  if (action === 'add-profile-ticker') { captureSettingsSection(); const profile = state.profilesDraft.find(item => item.id === state.editingProfileId); const additions = parseTickers($('#profile-watchlist-add')?.value || ''); if (!additions.length) return toast('Enter a valid ticker symbol.', 'error'); profile.watchlist = [...new Set([...profile.watchlist, ...additions])]; markSettingsDirty(); renderSettings(); $('#profile-watchlist-add')?.focus(); }
  if (action === 'remove-profile-ticker') { captureSettingsSection(); const profile = state.profilesDraft.find(item => item.id === state.editingProfileId); profile.watchlist = profile.watchlist.filter(ticker => ticker !== button.dataset.ticker); markSettingsDirty(); renderSettings(); }
  if (action === 'add-onboarding-ticker') { const additions = parseTickers($('#onboarding-watchlist-add')?.value || ''); if (!additions.length) return toast('Enter a valid ticker symbol.', 'error'); state.onboardingWatchlist = [...new Set([...(state.onboardingWatchlist || activeProfile().watchlist), ...additions])]; renderOnboarding(); $('#onboarding-watchlist-add')?.focus(); }
  if (action === 'remove-onboarding-ticker') { state.onboardingWatchlist = (state.onboardingWatchlist || activeProfile().watchlist).filter(ticker => ticker !== button.dataset.ticker); renderOnboarding(); }
  if (action === 'add-profile') { captureSettingsSection(); const profile = normalizeProfile({ ...clone(DEFAULT_PROFILES[0]), id: uid('profile'), name: 'New profile', description: 'Custom briefing profile' }); state.profilesDraft.push(profile); state.editingProfileId = profile.id; markSettingsDirty(); renderSettings(); }
  if (action === 'duplicate-profile') { captureSettingsSection(); const source = state.profilesDraft.find(item => item.id === button.dataset.profileId); const copy = { ...clone(source), id: uid('profile'), name: `${source.name} copy` }; state.profilesDraft.push(copy); state.editingProfileId = copy.id; markSettingsDirty(); renderSettings(); }
  if (action === 'delete-profile') { const id = button.dataset.profileId; state.profilesDraft = state.profilesDraft.filter(item => item.id !== id); state.editingProfileId = state.profilesDraft[0].id; if (state.settingsDraft.activeProfileId === id) state.settingsDraft.activeProfileId = state.editingProfileId; markSettingsDirty(); renderSettings(); }
  if (action === 'export-config') download(`market-briefing-config-${todayISO()}.json`, JSON.stringify(store.exportBundle({ includeHistory: false }), null, 2));
  if (action === 'export-history') download(`market-briefing-history-${todayISO()}.json`, JSON.stringify({ format: 'market-briefing-history', version: 2, history: state.history }, null, 2));
  if (action === 'export-full') download(`market-briefing-backup-${todayISO()}.json`, JSON.stringify(store.exportBundle(), null, 2));
  if (action === 'import-backup') fileUpload(text => { try { store.importBundle(JSON.parse(text)); location.reload(); } catch (error) { toast(error.message || 'Invalid backup.', 'error'); } });
  if (action === 'clear-history' && confirm('Delete all saved briefings and deep dives? This cannot be undone.')) { store.clearHistory(); state.history = []; state.currentRecord = null; renderSettings(); toast('History cleared.'); }
  if (action === 'reset-app' && confirm('Reset settings, profiles, CLI paths, and history? This cannot be undone.')) { store.reset(); location.reload(); }
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
  if (![STORAGE_KEYS.settings, STORAGE_KEYS.profiles, STORAGE_KEYS.history].includes(event.key)) return;
  if (event.key === STORAGE_KEYS.history) { state.history = store.getHistory(); if (state.route === 'history') renderHistory(); return; }
  if (state.settingsDirty && [STORAGE_KEYS.settings, STORAGE_KEYS.profiles].includes(event.key)) {
    toast('Settings changed in another Local tab. Save or discard this tab’s unsaved changes, then reopen the section.', 'error');
    return;
  }
  clearTimeout(sharedSyncTimer);
  sharedSyncTimer = setTimeout(() => {
    state.settings = store.getSettings(); state.profiles = store.getProfiles(); state.history = store.getHistory();
    state.settingsDraft = null; state.profilesDraft = null;
    state.editingProfileId = state.profiles.some(profile => profile.id === state.editingProfileId) ? state.editingProfileId : state.settings.activeProfileId;
    applyTheme(state.settings.theme); resetRun(activeProfile());
    if (state.route === 'briefing') renderWorkspace();
    if (state.route === 'history') renderHistory();
    if (state.route === 'settings') renderSettings();
    toast('Settings updated from another Local tab.');
  }, 40);
});

$('#app-dialog').addEventListener('click', event => { if (event.target === $('#app-dialog')) closeDialog(); });
applyRuntimeIdentity();
applyTheme(state.settings.theme);
void refreshCliStatus({ refresh: true });
setRoute(state.route);
