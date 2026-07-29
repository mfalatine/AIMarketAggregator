export const APP_VERSION = 4;

export const TOPICS = [
  { id: 'fed_policy', category: 'Macro & policy', name: 'Fed policy & rate expectations', hint: 'Current policy stance, market-implied probabilities, next FOMC date, and material Fed commentary.' },
  { id: 'economic_calendar', category: 'Macro & policy', name: 'Economic calendar & data', hint: 'Upcoming and recent releases with actual, expected, and prior values when available.' },
  { id: 'geopolitical', category: 'Macro & policy', name: 'Geopolitical risk', hint: 'Developments with a plausible transmission path into US equities, rates, commodities, or currencies.' },
  { id: 'bonds', category: 'Macro & policy', name: 'Treasury & bond market', hint: 'Key yields, curve shape, auctions, and the equity valuation implications.' },
  { id: 'sp500_technicals', category: 'Market structure', name: 'S&P 500 technical levels', hint: 'Current level, support, resistance, moving averages, and material breaks.' },
  { id: 'vix_sentiment', category: 'Market structure', name: 'Volatility & sentiment', hint: 'VIX, options or positioning signals, and whether risk appetite is changing.' },
  { id: 'sector_rotation', category: 'Market structure', name: 'Sector rotation & flows', hint: 'Leading and lagging sectors, material fund flows, and the likely driver.' },
  { id: 'market_breadth', category: 'Market structure', name: 'Market breadth', hint: 'Participation, advance/decline behavior, new highs/lows, and breadth divergences.' },
  { id: 'earnings_notable', category: 'Companies', name: 'Notable earnings', hint: 'Material upcoming and recent reports with expectations and market reaction.' },
  { id: 'insider_trading', category: 'Companies', name: 'Insider activity & buybacks', hint: 'Only unusually material disclosed transactions and announced buybacks.' },
  { id: 'ipo_calendar', category: 'Companies', name: 'IPO calendar', hint: 'Material upcoming listings and notable recent aftermarket performance.' }
];

export const COVERAGE_TYPES = [
  { id: 'price_moving_news', name: 'Price-moving news', prompt: 'Breaking or developing news with a plausible >2% price impact.' },
  { id: 'upcoming_earnings', name: 'Upcoming earnings', prompt: 'Next earnings date, consensus expectations, and the key debate.' },
  { id: 'analyst_ratings', name: 'Analyst changes', prompt: 'Material upgrades, downgrades, and price-target revisions.' },
  { id: 'options_unusual', name: 'Unusual options', prompt: 'Unusually large or informative options activity, with caveats.' }
];

export const API_MODELS = [
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic', transport: 'api', speed: 'Balanced', rates: { input: 3, output: 15 }, searchCost: 0.01 },
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic', transport: 'api', speed: 'Deep synthesis', rates: { input: 5, output: 25 }, searchCost: 0.01 },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', transport: 'api', speed: 'Fast', rates: { input: 0.3, output: 2.5 }, searchCost: 0 },
  { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', provider: 'openai', transport: 'api', speed: 'Frontier analysis', rates: { input: 5, output: 30 }, searchCost: 0 },
  { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', provider: 'openai', transport: 'api', speed: 'Balanced', rates: { input: 2.5, output: 15 }, searchCost: 0 },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', provider: 'openai', transport: 'api', speed: 'Cost efficient', rates: { input: 1, output: 6 }, searchCost: 0 }
];

export const MODELS = [...API_MODELS];
export const TRANSPORTS = {
  api: { id: 'api', name: 'Cloud APIs', description: 'Direct provider API connections' }
};

export const DEPTHS = {
  quick: { name: 'Quick', words: 450, maxTokens: 1300, sections: 4, searchUses: 5 },
  standard: { name: 'Standard', words: 900, maxTokens: 2600, sections: 7, searchUses: 8 },
  deep: { name: 'Deep dive', words: 1700, maxTokens: 4800, sections: 10, searchUses: 12 }
};

export const DEFAULT_PROFILES = [
  {
    id: 'daily-market', name: 'Daily Market', description: 'Balanced daily market pulse and watchlist scan',
    topicIds: ['fed_policy', 'economic_calendar', 'sp500_technicals', 'vix_sentiment', 'sector_rotation', 'earnings_notable'],
    watchlist: ['NVDA', 'PLTR', 'AMD', 'MRVL', 'VST'], coverageIds: ['price_moving_news', 'upcoming_earnings'],
    depth: 'standard', transport: 'api', apiModelId: 'claude-sonnet-4-5-20250929', modelId: 'claude-sonnet-4-5-20250929', instructions: 'Prioritize actionable catalysts and clearly separate confirmed facts, forecasts, market-implied values, and interpretation.'
  },
  {
    id: 'premarket-quick', name: 'Premarket Quick Scan', description: 'Fast scan of overnight changes and today’s catalysts',
    topicIds: ['economic_calendar', 'sp500_technicals', 'vix_sentiment', 'earnings_notable'],
    watchlist: ['NVDA', 'PLTR', 'AMD'], coverageIds: ['price_moving_news'],
    depth: 'quick', transport: 'api', apiModelId: 'claude-sonnet-4-5-20250929', modelId: 'claude-sonnet-4-5-20250929', instructions: 'Focus on developments since the prior close and events scheduled before the next close.'
  },
  {
    id: 'weekly-review', name: 'Weekly Review', description: 'Narrative changes, positioning, and the next week ahead',
    topicIds: ['fed_policy', 'economic_calendar', 'bonds', 'sp500_technicals', 'vix_sentiment', 'sector_rotation', 'market_breadth', 'earnings_notable'],
    watchlist: ['NVDA', 'PLTR', 'AMD', 'MRVL', 'VST'], coverageIds: ['price_moving_news', 'upcoming_earnings', 'analyst_ratings'],
    depth: 'deep', transport: 'api', apiModelId: 'claude-opus-4-6', modelId: 'claude-opus-4-6', instructions: 'Explain what changed during the period, what the market is pricing now, and the strongest bull and bear cases for next week.'
  },
  {
    id: 'earnings-focus', name: 'Earnings Focus', description: 'Company catalysts and watchlist earnings risk',
    topicIds: ['earnings_notable', 'sector_rotation'],
    watchlist: ['NVDA', 'PLTR', 'AMD', 'MRVL'], coverageIds: ['price_moving_news', 'upcoming_earnings', 'analyst_ratings', 'options_unusual'],
    depth: 'standard', transport: 'api', apiModelId: 'claude-sonnet-4-5-20250929', modelId: 'claude-sonnet-4-5-20250929', instructions: 'Emphasize expectation gaps, guidance, valuation implications, and read-throughs to peers.'
  },
  {
    id: 'earnings-futures', name: 'Mega-Cap Earnings Futures', description: 'Pre-earnings ES/NQ setup: direction, gap risk, severity score, key levels',
    topicIds: ['geopolitical', 'earnings_notable', 'vix_sentiment', 'sp500_technicals'],
    watchlist: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META'], coverageIds: ['price_moving_news', 'upcoming_earnings', 'options_unusual'],
    depth: 'standard', transport: 'api', apiModelId: 'claude-sonnet-4-5-20250929', modelId: 'claude-sonnet-4-5-20250929', instructions: 'Pre-earnings futures prep for the mega caps on the watchlist that report next. Answer in this order: (1) macro and geopolitical headwinds or tailwinds since their last reports, including strategic moves by global competitors such as rival earnings, IPOs, or major announcements; (2) expected net impact on S&P 500 (ES) and Nasdaq 100 (NQ) futures given index weights; (3) directional bias, bullish or bearish, and whether major price expansion up or down is expected; (4) whether the reaction is likely to create a price gap at the open or session restart; (5) a move severity score from 0 (negligible, sideways) to 5 (massive volatility, extreme range expansion) with a one-line rationale; (6) specific ES and NQ support and resistance levels to watch. Cite the options-market implied move where available. Be direct and focused on trading implications.'
  }
];

export const DEFAULT_SETTINGS = {
  version: APP_VERSION,
  theme: 'dark',
  activeProfileId: 'daily-market',
  onboardingComplete: false,
  expert: {
    systemPrompt: 'You are a senior market strategist. Produce decision-ready research, not generic commentary. Use current web sources. Separate confirmed facts, forecasts, market-implied values, and your own interpretation. Never invent a source. If a material claim is not supported by a retrieved source, mark it unsourced.',
    anthropicSearchTool: 'web_search_20250305'
  }
};

export const BRIEFING_SHAPE = {
  version: 1,
  title: 'string',
  stance: 'string',
  executive_summary: 'string',
  findings: [{ id: 'string', section: 'string', headline: 'string', summary: 'string', why_it_matters: 'string', claim_type: 'confirmed|estimate|market-implied|interpretation', confidence: 'high|medium|low', horizon: 'string', importance: 'high|medium|low', ticker: 'string optional', source_urls: ['string'] }],
  catalysts: [{ date: 'YYYY-MM-DD or descriptive date', event: 'string', expectation: 'string', impact: 'string', source_urls: ['string'] }],
  watchlist: [{ ticker: 'string', catalyst: 'string', potential_impact: 'string', next_date: 'string', source_urls: ['string'] }]
};

export function clone(value) { return JSON.parse(JSON.stringify(value)); }
export function uid(prefix = 'id') { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }
export function todayISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
export function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }

// Escaping-by-default markup builder. Interpolations are escaped unless they are html`` results,
// arrays of them, or explicit raw() wrappers; null/undefined/false render as nothing.
class SafeHtml { constructor(value) { this.value = value; } toString() { return this.value; } }
function toSafeString(value) {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(toSafeString).join('');
  if (value === null || value === undefined || value === false) return '';
  return escapeHtml(value);
}
export function raw(value) { return new SafeHtml(String(value === null || value === undefined ? '' : value)); }
export function html(strings, ...values) { return new SafeHtml(strings.reduce((out, chunk, index) => out + toSafeString(values[index - 1]) + chunk)); }
export function sanitizeUrl(value) { try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; } }
export function formatDate(iso, options = { month: 'short', day: 'numeric', year: 'numeric' }) { if (!iso) return '—'; const date = new Date(`${iso.slice(0, 10)}T12:00:00`); return Number.isNaN(date.getTime()) ? iso : new Intl.DateTimeFormat('en-US', options).format(date); }
export function formatDateTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date); }
export function modelFor(id) { return MODELS.find(model => model.id === id) || MODELS[0]; }
export function modelsForTransport(transport = 'api') { return MODELS.filter(model => model.transport === transport); }
export function topicFor(id) { return TOPICS.find(topic => topic.id === id); }

function uniqueStrings(values) { return [...new Set((Array.isArray(values) ? values : []).filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))]; }
function cleanTicker(value) { return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '').slice(0, 10); }
export function parseTickers(value) { const values = Array.isArray(value) ? value : String(value || '').split(/[\s,]+/); return uniqueStrings(values.map(cleanTicker).filter(Boolean)); }

export function normalizeProfile(profile, fallback = DEFAULT_PROFILES[0]) {
  const base = clone(fallback);
  if (!profile || typeof profile !== 'object') return base;
  const apiModels = modelsForTransport('api');
  const baseApiModelId = apiModels.some(model => model.id === base.apiModelId) ? base.apiModelId : apiModels.find(model => model.id === base.modelId)?.id || apiModels[0].id;
  const apiModelId = apiModels.some(model => model.id === profile.apiModelId) ? profile.apiModelId : apiModels.some(model => model.id === profile.modelId) ? profile.modelId : baseApiModelId;
  return {
    id: String(profile.id || base.id),
    name: String(profile.name || base.name),
    description: String(profile.description || ''),
    topicIds: uniqueStrings(profile.topicIds).filter(id => TOPICS.some(topic => topic.id === id)),
    watchlist: parseTickers(profile.watchlist),
    coverageIds: uniqueStrings(profile.coverageIds).filter(id => COVERAGE_TYPES.some(item => item.id === id)),
    depth: DEPTHS[profile.depth] ? profile.depth : base.depth,
    transport: 'api',
    apiModelId,
    modelId: apiModelId,
    instructions: String(profile.instructions || '')
  };
}

export function estimateRunCost({ modelId, depth = 'standard', topicCount = 6, tickerCount = 5 }) {
  const model = modelFor(modelId);
  const config = DEPTHS[depth] || DEPTHS.standard;
  const inputTokens = 900 + topicCount * 120 + tickerCount * 45;
  const outputTokens = Math.round(config.words * 1.45);
  const tokenCost = (inputTokens / 1_000_000) * model.rates.input + (outputTokens / 1_000_000) * model.rates.output;
  const searchCost = Math.min(config.searchUses, Math.max(2, Math.ceil(topicCount * 0.75))) * model.searchCost;
  return { low: Math.max(0, tokenCost + searchCost * 0.65), high: Math.max(0, tokenCost + searchCost), inputTokens, outputTokens };
}

export function buildPrompt({ profile, depth, dateFrom, dateTo, extraTickers = [], extraInstructions = '', parentContext = '', rawPrompt = '' }) {
  if (rawPrompt && rawPrompt.trim()) return rawPrompt.trim();
  const selectedDepth = DEPTHS[depth] || DEPTHS.standard;
  const topics = profile.topicIds.map(topicFor).filter(Boolean);
  const tickers = uniqueStrings([...profile.watchlist, ...parseTickers(extraTickers)]);
  const coverage = profile.coverageIds.map(id => COVERAGE_TYPES.find(item => item.id === id)).filter(Boolean);
  const period = dateFrom === dateTo ? formatDate(dateFrom) : `${formatDate(dateFrom)} through ${formatDate(dateTo)}`;
  const topicBlock = topics.map(topic => `- ${topic.category} / ${topic.name}: ${topic.hint}`).join('\n');
  const coverageBlock = coverage.map(item => `- ${item.name}: ${item.prompt}`).join('\n');
  return `Create a current market briefing for ${period}.

Profile: ${profile.name}
Depth: ${selectedDepth.name}, approximately ${selectedDepth.words} words

Research these topics:
${topicBlock || '- Broad market pulse'}

Watchlist: ${tickers.join(', ') || 'None'}
Watchlist coverage:
${coverageBlock || '- Material price-moving developments'}

Standing instructions:
${profile.instructions || 'Prioritize decision-relevant information.'}
${extraInstructions ? `\nOne-time instructions:\n${extraInstructions}` : ''}
${parentContext ? `\nThis is a contextual deep dive. Parent context:\n${parentContext}` : ''}

Return only a valid JSON object matching this shape exactly:
${JSON.stringify(BRIEFING_SHAPE, null, 2)}

Requirements:
- Put each material claim in a finding.
- Use source_urls only for sources actually retrieved during this run.
- If a claim is not directly supported, use claim_type "interpretation" and an empty source_urls array.
- Keep findings concise and put decision impact in why_it_matters.
- Use stable, descriptive finding ids such as "fed-policy-hold-probability" so later briefings can be compared.
- Do not wrap the JSON in markdown fences.`;
}

function findJson(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) { try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {} }
  return null;
}

function normalizeSources(sourceUrls, citations) {
  const citationMap = new Map(citations.map(source => [sanitizeUrl(source.url), source]));
  return uniqueStrings(sourceUrls).map(sanitizeUrl).filter(Boolean).map(url => ({ url, title: citationMap.get(url)?.title || new URL(url).hostname.replace(/^www\./, ''), citedText: citationMap.get(url)?.citedText || '' }));
}

export function normalizeBriefing(input, { citations = [], fallbackText = '', title = 'Market briefing' } = {}) {
  const parsed = typeof input === 'string' ? findJson(input) : input;
  if (!parsed || typeof parsed !== 'object') {
    return {
      version: 1, title, stance: 'Review required', executive_summary: String(fallbackText || input || 'The provider returned an empty response.'),
      findings: [{ id: 'provider-response', section: 'Provider response', headline: 'Unstructured response', summary: String(fallbackText || input || ''), why_it_matters: 'The response could not be separated into evidence-aware findings.', claim_type: 'interpretation', confidence: 'low', horizon: 'Current', importance: 'medium', ticker: '', sources: citations.map(source => ({ ...source, url: sanitizeUrl(source.url) })).filter(source => source.url) }],
      catalysts: [], watchlist: []
    };
  }
  const findings = (Array.isArray(parsed.findings) ? parsed.findings : []).map((finding, index) => ({
    id: String(finding.id || `finding-${index + 1}`), section: String(finding.section || 'Market developments'), headline: String(finding.headline || 'Untitled finding'),
    summary: String(finding.summary || ''), why_it_matters: String(finding.why_it_matters || ''),
    claim_type: ['confirmed', 'estimate', 'market-implied', 'interpretation'].includes(finding.claim_type) ? finding.claim_type : 'interpretation',
    confidence: ['high', 'medium', 'low'].includes(finding.confidence) ? finding.confidence : 'medium',
    horizon: String(finding.horizon || 'Current'), importance: ['high', 'medium', 'low'].includes(finding.importance) ? finding.importance : 'medium',
    ticker: cleanTicker(finding.ticker), sources: normalizeSources(finding.source_urls || [], citations)
  }));
  return {
    version: 1, title: String(parsed.title || title), stance: String(parsed.stance || 'Mixed'), executive_summary: String(parsed.executive_summary || ''),
    findings,
    catalysts: (Array.isArray(parsed.catalysts) ? parsed.catalysts : []).map(item => ({ date: String(item.date || ''), event: String(item.event || ''), expectation: String(item.expectation || ''), impact: String(item.impact || ''), sources: normalizeSources(item.source_urls || [], citations) })),
    watchlist: (Array.isArray(parsed.watchlist) ? parsed.watchlist : []).map(item => ({ ticker: cleanTicker(item.ticker), catalyst: String(item.catalyst || ''), potential_impact: String(item.potential_impact || ''), next_date: String(item.next_date || ''), sources: normalizeSources(item.source_urls || [], citations) }))
  };
}

function textSimilarity(a, b) {
  const words = value => new Set(String(value || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(word => word.length > 2));
  const left = words(a), right = words(b); if (!left.size && !right.size) return 1;
  const intersection = [...left].filter(word => right.has(word)).length;
  return intersection / Math.max(1, new Set([...left, ...right]).size);
}

export function compareBriefings(previous, current) {
  const before = previous?.briefing?.findings || previous?.findings || [];
  const after = current?.briefing?.findings || current?.findings || [];
  const used = new Set();
  const result = { new: [], changed: [], resolved: [], unchanged: [] };
  for (const item of after) {
    let matchIndex = before.findIndex((candidate, index) => !used.has(index) && candidate.id === item.id);
    if (matchIndex < 0) matchIndex = before.findIndex((candidate, index) => !used.has(index) && textSimilarity(candidate.headline, item.headline) >= 0.52);
    if (matchIndex < 0) { result.new.push(item); continue; }
    used.add(matchIndex);
    const oldItem = before[matchIndex];
    const similarity = textSimilarity(`${oldItem.summary} ${oldItem.why_it_matters}`, `${item.summary} ${item.why_it_matters}`);
    if (similarity < 0.72 || oldItem.claim_type !== item.claim_type || oldItem.confidence !== item.confidence) result.changed.push({ before: oldItem, after: item });
    else result.unchanged.push(item);
  }
  before.forEach((item, index) => { if (!used.has(index)) result.resolved.push(item); });
  return result;
}

export function createSampleBriefing(date = todayISO()) {
  return normalizeBriefing({
    title: `${formatDate(date)} market briefing`, stance: 'Cautiously constructive', executive_summary: 'Equities remain supported, but the next macro releases and concentrated leadership create asymmetric event risk. Treat the sample below as a product preview, not live market data.',
    findings: [
      { id: 'sample-macro', section: 'Macro & policy', headline: 'Policy expectations remain the primary valuation input', summary: 'This sample demonstrates how confirmed facts and interpretation are separated.', why_it_matters: 'Users can scan the decision implication before opening the evidence.', claim_type: 'interpretation', confidence: 'low', horizon: 'Next 1–2 weeks', importance: 'high', source_urls: [] },
      { id: 'sample-breadth', section: 'Market structure', headline: 'Leadership breadth deserves confirmation', summary: 'The redesigned briefing groups related findings and exposes uncertainty.', why_it_matters: 'Narrow leadership can make index strength less durable.', claim_type: 'interpretation', confidence: 'low', horizon: 'Current', importance: 'medium', source_urls: [] },
      { id: 'sample-watchlist', section: 'Watchlist', headline: 'Watchlist catalysts are separated from the broad market', summary: 'Ticker-specific events appear in a dedicated scan with next dates.', why_it_matters: 'This prevents company events from disappearing inside macro commentary.', claim_type: 'interpretation', confidence: 'low', horizon: 'Next event', importance: 'medium', ticker: 'NVDA', source_urls: [] }
    ],
    catalysts: [{ date, event: 'Sample economic release', expectation: 'Example only', impact: 'Shows the catalyst table layout', source_urls: [] }],
    watchlist: [{ ticker: 'NVDA', catalyst: 'Sample earnings catalyst', potential_impact: 'Example only', next_date: 'TBD', source_urls: [] }]
  });
}
