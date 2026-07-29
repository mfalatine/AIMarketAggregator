(() => {
  // js/core.js
  var APP_VERSION = 4;
  var TOPICS = [
    { id: "fed_policy", category: "Macro & policy", name: "Fed policy & rate expectations", hint: "Current policy stance, market-implied probabilities, next FOMC date, and material Fed commentary." },
    { id: "economic_calendar", category: "Macro & policy", name: "Economic calendar & data", hint: "Upcoming and recent releases with actual, expected, and prior values when available." },
    { id: "geopolitical", category: "Macro & policy", name: "Geopolitical risk", hint: "Developments with a plausible transmission path into US equities, rates, commodities, or currencies." },
    { id: "bonds", category: "Macro & policy", name: "Treasury & bond market", hint: "Key yields, curve shape, auctions, and the equity valuation implications." },
    { id: "sp500_technicals", category: "Market structure", name: "S&P 500 technical levels", hint: "Current level, support, resistance, moving averages, and material breaks." },
    { id: "vix_sentiment", category: "Market structure", name: "Volatility & sentiment", hint: "VIX, options or positioning signals, and whether risk appetite is changing." },
    { id: "sector_rotation", category: "Market structure", name: "Sector rotation & flows", hint: "Leading and lagging sectors, material fund flows, and the likely driver." },
    { id: "market_breadth", category: "Market structure", name: "Market breadth", hint: "Participation, advance/decline behavior, new highs/lows, and breadth divergences." },
    { id: "earnings_notable", category: "Companies", name: "Notable earnings", hint: "Material upcoming and recent reports with expectations and market reaction." },
    { id: "insider_trading", category: "Companies", name: "Insider activity & buybacks", hint: "Only unusually material disclosed transactions and announced buybacks." },
    { id: "ipo_calendar", category: "Companies", name: "IPO calendar", hint: "Material upcoming listings and notable recent aftermarket performance." }
  ];
  var COVERAGE_TYPES = [
    { id: "price_moving_news", name: "Price-moving news", prompt: "Breaking or developing news with a plausible >2% price impact." },
    { id: "upcoming_earnings", name: "Upcoming earnings", prompt: "Next earnings date, consensus expectations, and the key debate." },
    { id: "analyst_ratings", name: "Analyst changes", prompt: "Material upgrades, downgrades, and price-target revisions." },
    { id: "options_unusual", name: "Unusual options", prompt: "Unusually large or informative options activity, with caveats." }
  ];
  var API_MODELS = [
    { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5", provider: "anthropic", transport: "api", speed: "Balanced", rates: { input: 3, output: 15 }, searchCost: 0.01 },
    { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "anthropic", transport: "api", speed: "Deep synthesis", rates: { input: 5, output: 25 }, searchCost: 0.01 },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google", transport: "api", speed: "Fast", rates: { input: 0.3, output: 2.5 }, searchCost: 0 },
    { id: "gpt-5.6-sol", name: "GPT-5.6 Sol", provider: "openai", transport: "api", speed: "Frontier analysis", rates: { input: 5, output: 30 }, searchCost: 0 },
    { id: "gpt-5.6-terra", name: "GPT-5.6 Terra", provider: "openai", transport: "api", speed: "Balanced", rates: { input: 2.5, output: 15 }, searchCost: 0 },
    { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", provider: "openai", transport: "api", speed: "Cost efficient", rates: { input: 1, output: 6 }, searchCost: 0 }
  ];
  var MODELS = [...API_MODELS];
  var TRANSPORTS = {
    api: { id: "api", name: "Cloud APIs", description: "Direct provider API connections" }
  };
  var DEPTHS = {
    quick: { name: "Quick", words: 450, maxTokens: 1300, sections: 4, searchUses: 5 },
    standard: { name: "Standard", words: 900, maxTokens: 2600, sections: 7, searchUses: 8 },
    deep: { name: "Deep dive", words: 1700, maxTokens: 4800, sections: 10, searchUses: 12 }
  };
  var DEFAULT_PROFILES = [
    {
      id: "daily-market",
      name: "Daily Market",
      description: "Balanced daily market pulse and watchlist scan",
      topicIds: ["fed_policy", "economic_calendar", "sp500_technicals", "vix_sentiment", "sector_rotation", "earnings_notable"],
      watchlist: ["NVDA", "PLTR", "AMD", "MRVL", "VST"],
      coverageIds: ["price_moving_news", "upcoming_earnings"],
      depth: "standard",
      transport: "api",
      apiModelId: "claude-sonnet-4-5-20250929",
      modelId: "claude-sonnet-4-5-20250929",
      instructions: "Prioritize actionable catalysts and clearly separate confirmed facts, forecasts, market-implied values, and interpretation."
    },
    {
      id: "premarket-quick",
      name: "Premarket Quick Scan",
      description: "Fast scan of overnight changes and today\u2019s catalysts",
      topicIds: ["economic_calendar", "sp500_technicals", "vix_sentiment", "earnings_notable"],
      watchlist: ["NVDA", "PLTR", "AMD"],
      coverageIds: ["price_moving_news"],
      depth: "quick",
      transport: "api",
      apiModelId: "claude-sonnet-4-5-20250929",
      modelId: "claude-sonnet-4-5-20250929",
      instructions: "Focus on developments since the prior close and events scheduled before the next close."
    },
    {
      id: "weekly-review",
      name: "Weekly Review",
      description: "Narrative changes, positioning, and the next week ahead",
      topicIds: ["fed_policy", "economic_calendar", "bonds", "sp500_technicals", "vix_sentiment", "sector_rotation", "market_breadth", "earnings_notable"],
      watchlist: ["NVDA", "PLTR", "AMD", "MRVL", "VST"],
      coverageIds: ["price_moving_news", "upcoming_earnings", "analyst_ratings"],
      depth: "deep",
      transport: "api",
      apiModelId: "claude-opus-4-6",
      modelId: "claude-opus-4-6",
      instructions: "Explain what changed during the period, what the market is pricing now, and the strongest bull and bear cases for next week."
    },
    {
      id: "earnings-focus",
      name: "Earnings Focus",
      description: "Company catalysts and watchlist earnings risk",
      topicIds: ["earnings_notable", "sector_rotation"],
      watchlist: ["NVDA", "PLTR", "AMD", "MRVL"],
      coverageIds: ["price_moving_news", "upcoming_earnings", "analyst_ratings", "options_unusual"],
      depth: "standard",
      transport: "api",
      apiModelId: "claude-sonnet-4-5-20250929",
      modelId: "claude-sonnet-4-5-20250929",
      instructions: "Emphasize expectation gaps, guidance, valuation implications, and read-throughs to peers."
    },
    {
      id: "earnings-futures",
      name: "Mega-Cap Earnings Futures",
      description: "Pre-earnings ES/NQ setup: direction, gap risk, severity score, key levels",
      topicIds: ["geopolitical", "earnings_notable", "vix_sentiment", "sp500_technicals"],
      watchlist: ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META"],
      coverageIds: ["price_moving_news", "upcoming_earnings", "options_unusual"],
      depth: "standard",
      transport: "api",
      apiModelId: "claude-sonnet-4-5-20250929",
      modelId: "claude-sonnet-4-5-20250929",
      instructions: "Pre-earnings futures prep for the mega caps on the watchlist that report next. Answer in this order: (1) macro and geopolitical headwinds or tailwinds since their last reports, including strategic moves by global competitors such as rival earnings, IPOs, or major announcements; (2) expected net impact on S&P 500 (ES) and Nasdaq 100 (NQ) futures given index weights; (3) directional bias, bullish or bearish, and whether major price expansion up or down is expected; (4) whether the reaction is likely to create a price gap at the open or session restart; (5) a move severity score from 0 (negligible, sideways) to 5 (massive volatility, extreme range expansion) with a one-line rationale; (6) specific ES and NQ support and resistance levels to watch. Cite the options-market implied move where available. Be direct and focused on trading implications."
    }
  ];
  var DEFAULT_SETTINGS = {
    version: APP_VERSION,
    theme: "dark",
    activeProfileId: "daily-market",
    onboardingComplete: false,
    expert: {
      systemPrompt: "You are a senior market strategist. Produce decision-ready research, not generic commentary. Use current web sources. Separate confirmed facts, forecasts, market-implied values, and your own interpretation. Never invent a source. If a material claim is not supported by a retrieved source, mark it unsourced.",
      anthropicSearchTool: "web_search_20250305"
    }
  };
  var BRIEFING_SHAPE = {
    version: 1,
    title: "string",
    stance: "string",
    executive_summary: "string",
    findings: [{ id: "string", section: "string", headline: "string", summary: "string", why_it_matters: "string", claim_type: "confirmed|estimate|market-implied|interpretation", confidence: "high|medium|low", horizon: "string", importance: "high|medium|low", ticker: "string optional", source_urls: ["string"] }],
    catalysts: [{ date: "YYYY-MM-DD or descriptive date", event: "string", expectation: "string", impact: "string", source_urls: ["string"] }],
    watchlist: [{ ticker: "string", catalyst: "string", potential_impact: "string", next_date: "string", source_urls: ["string"] }]
  };
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function uid(prefix = "id") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }
  function todayISO(date = /* @__PURE__ */ new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
  }
  var SafeHtml = class {
    constructor(value) {
      this.value = value;
    }
    toString() {
      return this.value;
    }
  };
  function toSafeString(value) {
    if (value instanceof SafeHtml) return value.value;
    if (Array.isArray(value)) return value.map(toSafeString).join("");
    if (value === null || value === void 0 || value === false) return "";
    return escapeHtml(value);
  }
  function html(strings, ...values) {
    return new SafeHtml(strings.reduce((out, chunk, index) => out + toSafeString(values[index - 1]) + chunk));
  }
  function sanitizeUrl(value) {
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }
  function formatDate(iso, options = { month: "short", day: "numeric", year: "numeric" }) {
    if (!iso) return "\u2014";
    const date = /* @__PURE__ */ new Date(`${iso.slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? iso : new Intl.DateTimeFormat("en-US", options).format(date);
  }
  function formatDateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "\u2014" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
  }
  function modelFor(id) {
    return MODELS.find((model) => model.id === id) || MODELS[0];
  }
  function modelsForTransport(transport = "api") {
    return MODELS.filter((model) => model.transport === transport);
  }
  function topicFor(id) {
    return TOPICS.find((topic) => topic.id === id);
  }
  function uniqueStrings(values) {
    return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
  }
  function cleanTicker(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 10);
  }
  function parseTickers(value) {
    const values = Array.isArray(value) ? value : String(value || "").split(/[\s,]+/);
    return uniqueStrings(values.map(cleanTicker).filter(Boolean));
  }
  function normalizeProfile(profile, fallback = DEFAULT_PROFILES[0]) {
    const base = clone(fallback);
    if (!profile || typeof profile !== "object") return base;
    const apiModels = modelsForTransport("api");
    const baseApiModelId = apiModels.some((model) => model.id === base.apiModelId) ? base.apiModelId : apiModels.find((model) => model.id === base.modelId)?.id || apiModels[0].id;
    const apiModelId = apiModels.some((model) => model.id === profile.apiModelId) ? profile.apiModelId : apiModels.some((model) => model.id === profile.modelId) ? profile.modelId : baseApiModelId;
    return {
      id: String(profile.id || base.id),
      name: String(profile.name || base.name),
      description: String(profile.description || ""),
      topicIds: uniqueStrings(profile.topicIds).filter((id) => TOPICS.some((topic) => topic.id === id)),
      watchlist: parseTickers(profile.watchlist),
      coverageIds: uniqueStrings(profile.coverageIds).filter((id) => COVERAGE_TYPES.some((item) => item.id === id)),
      depth: DEPTHS[profile.depth] ? profile.depth : base.depth,
      transport: "api",
      apiModelId,
      modelId: apiModelId,
      instructions: String(profile.instructions || "")
    };
  }
  function estimateRunCost({ modelId, depth = "standard", topicCount = 6, tickerCount = 5 }) {
    const model = modelFor(modelId);
    const config = DEPTHS[depth] || DEPTHS.standard;
    const inputTokens = 900 + topicCount * 120 + tickerCount * 45;
    const outputTokens = Math.round(config.words * 1.45);
    const tokenCost = inputTokens / 1e6 * model.rates.input + outputTokens / 1e6 * model.rates.output;
    const searchCost = Math.min(config.searchUses, Math.max(2, Math.ceil(topicCount * 0.75))) * model.searchCost;
    return { low: Math.max(0, tokenCost + searchCost * 0.65), high: Math.max(0, tokenCost + searchCost), inputTokens, outputTokens };
  }
  function buildPrompt({ profile, depth, dateFrom, dateTo, extraTickers = [], extraInstructions = "", parentContext = "", rawPrompt = "" }) {
    if (rawPrompt && rawPrompt.trim()) return rawPrompt.trim();
    const selectedDepth = DEPTHS[depth] || DEPTHS.standard;
    const topics = profile.topicIds.map(topicFor).filter(Boolean);
    const tickers = uniqueStrings([...profile.watchlist, ...parseTickers(extraTickers)]);
    const coverage = profile.coverageIds.map((id) => COVERAGE_TYPES.find((item) => item.id === id)).filter(Boolean);
    const period = dateFrom === dateTo ? formatDate(dateFrom) : `${formatDate(dateFrom)} through ${formatDate(dateTo)}`;
    const topicBlock = topics.map((topic) => `- ${topic.category} / ${topic.name}: ${topic.hint}`).join("\n");
    const coverageBlock = coverage.map((item) => `- ${item.name}: ${item.prompt}`).join("\n");
    return `Create a current market briefing for ${period}.

Profile: ${profile.name}
Depth: ${selectedDepth.name}, approximately ${selectedDepth.words} words

Research these topics:
${topicBlock || "- Broad market pulse"}

Watchlist: ${tickers.join(", ") || "None"}
Watchlist coverage:
${coverageBlock || "- Material price-moving developments"}

Standing instructions:
${profile.instructions || "Prioritize decision-relevant information."}
${extraInstructions ? `
One-time instructions:
${extraInstructions}` : ""}
${parentContext ? `
This is a contextual deep dive. Parent context:
${parentContext}` : ""}

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
    const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      return JSON.parse(cleaned);
    } catch {
    }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
      }
    }
    return null;
  }
  function normalizeSources(sourceUrls, citations) {
    const citationMap = new Map(citations.map((source) => [sanitizeUrl(source.url), source]));
    return uniqueStrings(sourceUrls).map(sanitizeUrl).filter(Boolean).map((url) => ({ url, title: citationMap.get(url)?.title || new URL(url).hostname.replace(/^www\./, ""), citedText: citationMap.get(url)?.citedText || "" }));
  }
  function normalizeBriefing(input, { citations = [], fallbackText = "", title = "Market briefing" } = {}) {
    const parsed = typeof input === "string" ? findJson(input) : input;
    if (!parsed || typeof parsed !== "object") {
      return {
        version: 1,
        title,
        stance: "Review required",
        executive_summary: String(fallbackText || input || "The provider returned an empty response."),
        findings: [{ id: "provider-response", section: "Provider response", headline: "Unstructured response", summary: String(fallbackText || input || ""), why_it_matters: "The response could not be separated into evidence-aware findings.", claim_type: "interpretation", confidence: "low", horizon: "Current", importance: "medium", ticker: "", sources: citations.map((source) => ({ ...source, url: sanitizeUrl(source.url) })).filter((source) => source.url) }],
        catalysts: [],
        watchlist: []
      };
    }
    const findings = (Array.isArray(parsed.findings) ? parsed.findings : []).map((finding, index) => ({
      id: String(finding.id || `finding-${index + 1}`),
      section: String(finding.section || "Market developments"),
      headline: String(finding.headline || "Untitled finding"),
      summary: String(finding.summary || ""),
      why_it_matters: String(finding.why_it_matters || ""),
      claim_type: ["confirmed", "estimate", "market-implied", "interpretation"].includes(finding.claim_type) ? finding.claim_type : "interpretation",
      confidence: ["high", "medium", "low"].includes(finding.confidence) ? finding.confidence : "medium",
      horizon: String(finding.horizon || "Current"),
      importance: ["high", "medium", "low"].includes(finding.importance) ? finding.importance : "medium",
      ticker: cleanTicker(finding.ticker),
      sources: normalizeSources(finding.source_urls || [], citations)
    }));
    return {
      version: 1,
      title: String(parsed.title || title),
      stance: String(parsed.stance || "Mixed"),
      executive_summary: String(parsed.executive_summary || ""),
      findings,
      catalysts: (Array.isArray(parsed.catalysts) ? parsed.catalysts : []).map((item) => ({ date: String(item.date || ""), event: String(item.event || ""), expectation: String(item.expectation || ""), impact: String(item.impact || ""), sources: normalizeSources(item.source_urls || [], citations) })),
      watchlist: (Array.isArray(parsed.watchlist) ? parsed.watchlist : []).map((item) => ({ ticker: cleanTicker(item.ticker), catalyst: String(item.catalyst || ""), potential_impact: String(item.potential_impact || ""), next_date: String(item.next_date || ""), sources: normalizeSources(item.source_urls || [], citations) }))
    };
  }
  function textSimilarity(a, b) {
    const words = (value) => new Set(String(value || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word.length > 2));
    const left = words(a), right = words(b);
    if (!left.size && !right.size) return 1;
    const intersection = [...left].filter((word) => right.has(word)).length;
    return intersection / Math.max(1, (/* @__PURE__ */ new Set([...left, ...right])).size);
  }
  function compareBriefings(previous, current) {
    const before = previous?.briefing?.findings || previous?.findings || [];
    const after = current?.briefing?.findings || current?.findings || [];
    const used = /* @__PURE__ */ new Set();
    const result = { new: [], changed: [], resolved: [], unchanged: [] };
    for (const item of after) {
      let matchIndex = before.findIndex((candidate, index) => !used.has(index) && candidate.id === item.id);
      if (matchIndex < 0) matchIndex = before.findIndex((candidate, index) => !used.has(index) && textSimilarity(candidate.headline, item.headline) >= 0.52);
      if (matchIndex < 0) {
        result.new.push(item);
        continue;
      }
      used.add(matchIndex);
      const oldItem = before[matchIndex];
      const similarity = textSimilarity(`${oldItem.summary} ${oldItem.why_it_matters}`, `${item.summary} ${item.why_it_matters}`);
      if (similarity < 0.72 || oldItem.claim_type !== item.claim_type || oldItem.confidence !== item.confidence) result.changed.push({ before: oldItem, after: item });
      else result.unchanged.push(item);
    }
    before.forEach((item, index) => {
      if (!used.has(index)) result.resolved.push(item);
    });
    return result;
  }
  function createSampleBriefing(date = todayISO()) {
    return normalizeBriefing({
      title: `${formatDate(date)} market briefing`,
      stance: "Cautiously constructive",
      executive_summary: "Equities remain supported, but the next macro releases and concentrated leadership create asymmetric event risk. Treat the sample below as a product preview, not live market data.",
      findings: [
        { id: "sample-macro", section: "Macro & policy", headline: "Policy expectations remain the primary valuation input", summary: "This sample demonstrates how confirmed facts and interpretation are separated.", why_it_matters: "Users can scan the decision implication before opening the evidence.", claim_type: "interpretation", confidence: "low", horizon: "Next 1\u20132 weeks", importance: "high", source_urls: [] },
        { id: "sample-breadth", section: "Market structure", headline: "Leadership breadth deserves confirmation", summary: "The redesigned briefing groups related findings and exposes uncertainty.", why_it_matters: "Narrow leadership can make index strength less durable.", claim_type: "interpretation", confidence: "low", horizon: "Current", importance: "medium", source_urls: [] },
        { id: "sample-watchlist", section: "Watchlist", headline: "Watchlist catalysts are separated from the broad market", summary: "Ticker-specific events appear in a dedicated scan with next dates.", why_it_matters: "This prevents company events from disappearing inside macro commentary.", claim_type: "interpretation", confidence: "low", horizon: "Next event", importance: "medium", ticker: "NVDA", source_urls: [] }
      ],
      catalysts: [{ date, event: "Sample economic release", expectation: "Example only", impact: "Shows the catalyst table layout", source_urls: [] }],
      watchlist: [{ ticker: "NVDA", catalyst: "Sample earnings catalyst", potential_impact: "Example only", next_date: "TBD", source_urls: [] }]
    });
  }

  // js/storage.js
  var STORAGE_KEYS = {
    settings: "maa_netlify_v4_settings",
    profiles: "maa_netlify_v4_profiles",
    history: "maa_netlify_v4_history",
    secrets: "maa_netlify_v4_secrets",
    ui: "maa_netlify_v4_ui",
    migrated: "maa_netlify_v4_migrated"
  };
  var SHARED_KEYS = {
    settings: "mba_v2_settings",
    profiles: "mba_v2_profiles",
    history: "mba_v2_history",
    secrets: "mba_v2_secrets",
    ui: "mba_v2_ui"
  };
  function parse(storage, key, fallback) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : clone(fallback);
    } catch {
      return clone(fallback);
    }
  }
  function write(storage, key, value) {
    storage.setItem(key, JSON.stringify(value));
    return value;
  }
  var MAX_HISTORY_RECORDS = 200;
  function isQuotaError(error) {
    return Boolean(error) && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22 || error.code === 1014);
  }
  function writeHistory(storage, history) {
    const bounded = history.slice(0, MAX_HISTORY_RECORDS);
    for (; ; ) {
      try {
        return write(storage, STORAGE_KEYS.history, bounded);
      } catch (error) {
        if (!isQuotaError(error) || bounded.length <= 1) throw error;
        bounded.length = Math.max(1, Math.floor(bounded.length / 2));
      }
    }
  }
  function createStore(storage = globalThis.localStorage) {
    function migrateLegacy() {
      if (storage.getItem(STORAGE_KEYS.migrated)) return;
      const sharedSettings = parse(storage, SHARED_KEYS.settings, null);
      const sharedProfiles = parse(storage, SHARED_KEYS.profiles, null);
      if (sharedSettings && Array.isArray(sharedProfiles)) {
        write(storage, STORAGE_KEYS.settings, sharedSettings);
        write(storage, STORAGE_KEYS.profiles, sharedProfiles);
        write(storage, STORAGE_KEYS.history, parse(storage, SHARED_KEYS.history, []));
        write(storage, STORAGE_KEYS.secrets, parse(storage, SHARED_KEYS.secrets, { anthropic: "", google: "", openai: "" }));
        write(storage, STORAGE_KEYS.ui, parse(storage, SHARED_KEYS.ui, { route: "briefing", selectedHistoryId: "", settingsSection: "profiles" }));
        storage.setItem(STORAGE_KEYS.migrated, String(APP_VERSION));
        return;
      }
      const legacySettings = parse(storage, "mb_settings", null);
      const legacyAdmin = parse(storage, "mb_admin", null);
      const legacyHistory = parse(storage, "mb_history", []);
      const profiles = clone(DEFAULT_PROFILES);
      const settings = clone(DEFAULT_SETTINGS);
      if (legacySettings) {
        profiles[0] = normalizeProfile({
          ...profiles[0],
          topicIds: legacySettings.enabled_topics,
          watchlist: legacySettings.watchlist,
          coverageIds: legacySettings.enabled_coverage,
          depth: legacySettings.active_style === "concise" ? "quick" : legacySettings.active_style === "deep_dive" ? "deep" : "standard",
          modelId: legacySettings.default_model,
          instructions: legacySettings.custom_instructions
        });
        settings.theme = legacySettings.theme || settings.theme;
      }
      if (legacyAdmin?.system_prompt) settings.expert.systemPrompt = legacyAdmin.system_prompt;
      write(storage, STORAGE_KEYS.settings, settings);
      write(storage, STORAGE_KEYS.profiles, profiles);
      write(storage, STORAGE_KEYS.history, legacyHistory.map((entry) => ({
        id: entry.id || uid("briefing"),
        kind: "briefing",
        parentId: null,
        profileId: profiles[0].id,
        profileName: profiles[0].name,
        dateFrom: entry.date,
        dateTo: entry.date_to || entry.date,
        modelId: entry.model,
        modelName: entry.model_label || entry.model,
        depth: entry.style === "deep_dive" ? "deep" : entry.style === "concise" ? "quick" : "standard",
        generatedAt: entry.generated_at,
        prompt: entry.prompt_sent || "",
        systemPrompt: entry.system_prompt_sent || "",
        usage: null,
        citations: [],
        rawResponse: entry.response || "",
        briefing: null,
        legacy: true
      })));
      write(storage, STORAGE_KEYS.secrets, { anthropic: storage.getItem("mb_api_key") || "", google: storage.getItem("mb_gemini_api_key") || "", openai: "" });
      storage.setItem(STORAGE_KEYS.migrated, String(APP_VERSION));
    }
    function initialize() {
      migrateLegacy();
      if (!storage.getItem(STORAGE_KEYS.settings)) write(storage, STORAGE_KEYS.settings, DEFAULT_SETTINGS);
      if (!storage.getItem(STORAGE_KEYS.profiles)) write(storage, STORAGE_KEYS.profiles, DEFAULT_PROFILES);
      if (!storage.getItem(STORAGE_KEYS.history)) write(storage, STORAGE_KEYS.history, []);
      if (!storage.getItem(STORAGE_KEYS.secrets)) write(storage, STORAGE_KEYS.secrets, { anthropic: "", google: "", openai: "" });
      if (!storage.getItem(STORAGE_KEYS.ui)) write(storage, STORAGE_KEYS.ui, { route: "briefing", selectedHistoryId: "", settingsSection: "profiles" });
      const storedSettings = parse(storage, STORAGE_KEYS.settings, DEFAULT_SETTINGS);
      write(storage, STORAGE_KEYS.settings, { ...clone(DEFAULT_SETTINGS), ...storedSettings, version: APP_VERSION, expert: { ...DEFAULT_SETTINGS.expert, ...storedSettings.expert } });
      const storedProfiles = parse(storage, STORAGE_KEYS.profiles, DEFAULT_PROFILES);
      write(storage, STORAGE_KEYS.profiles, storedProfiles.map((profile, index) => normalizeProfile(profile, DEFAULT_PROFILES[index] || DEFAULT_PROFILES[0])));
      storage.setItem(STORAGE_KEYS.migrated, String(APP_VERSION));
    }
    const api = {
      initialize,
      getSettings: () => ({ ...clone(DEFAULT_SETTINGS), ...parse(storage, STORAGE_KEYS.settings, DEFAULT_SETTINGS), expert: { ...DEFAULT_SETTINGS.expert, ...parse(storage, STORAGE_KEYS.settings, DEFAULT_SETTINGS).expert } }),
      saveSettings: (settings) => write(storage, STORAGE_KEYS.settings, { ...settings, version: APP_VERSION }),
      getProfiles: () => parse(storage, STORAGE_KEYS.profiles, DEFAULT_PROFILES).map((profile, index) => normalizeProfile(profile, DEFAULT_PROFILES[index] || DEFAULT_PROFILES[0])),
      saveProfiles: (profiles) => write(storage, STORAGE_KEYS.profiles, profiles.map((profile) => normalizeProfile(profile))),
      getHistory: () => parse(storage, STORAGE_KEYS.history, []),
      saveHistory: (history) => writeHistory(storage, history),
      addHistory: (record) => {
        const history = api.getHistory();
        history.unshift(record);
        writeHistory(storage, history);
        return record;
      },
      getSecrets: () => ({ anthropic: "", google: "", openai: "", ...parse(storage, STORAGE_KEYS.secrets, { anthropic: "", google: "", openai: "" }) }),
      saveSecrets: (secrets) => write(storage, STORAGE_KEYS.secrets, { anthropic: String(secrets.anthropic || ""), google: String(secrets.google || ""), openai: String(secrets.openai || "") }),
      getUi: () => parse(storage, STORAGE_KEYS.ui, { route: "briefing", selectedHistoryId: "", settingsSection: "profiles" }),
      saveUi: (ui) => write(storage, STORAGE_KEYS.ui, ui),
      exportBundle({ includeHistory = true, includeSecrets = false } = {}) {
        return {
          format: "market-briefing-backup",
          version: APP_VERSION,
          exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
          settings: api.getSettings(),
          profiles: api.getProfiles(),
          history: includeHistory ? api.getHistory() : [],
          ...includeSecrets ? { secrets: api.getSecrets(), warning: "This file contains API credentials. Store it securely." } : {}
        };
      },
      importBundle(bundle, { acceptSecrets = false } = {}) {
        if (!bundle || bundle.format !== "market-briefing-backup" || Number(bundle.version) > APP_VERSION) throw new Error("Unsupported backup format or version.");
        if (!bundle.settings || !Array.isArray(bundle.profiles) || !Array.isArray(bundle.history)) throw new Error("Backup is missing required data.");
        api.saveSettings({ ...DEFAULT_SETTINGS, ...bundle.settings, expert: { ...DEFAULT_SETTINGS.expert, ...bundle.settings.expert } });
        api.saveProfiles(bundle.profiles);
        api.saveHistory(bundle.history.filter((item) => item && item.id && item.generatedAt));
        if (acceptSecrets && bundle.secrets) api.saveSecrets(bundle.secrets);
      },
      clearHistory: () => write(storage, STORAGE_KEYS.history, []),
      reset() {
        Object.values(STORAGE_KEYS).forEach((key) => storage.removeItem(key));
        initialize();
      }
    };
    return api;
  }

  // js/providers.js
  var RETRYABLE = /* @__PURE__ */ new Set([408, 409, 425, 429, 500, 502, 503, 504]);
  var wait = (ms, signal) => new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new DOMException("Cancelled", "AbortError"));
    }, { once: true });
  });
  function apiError(provider, status, message, retryAfter = 0) {
    const error = new Error(message || `${provider} request failed (${status})`);
    error.provider = provider;
    error.status = status;
    error.retryable = RETRYABLE.has(status);
    error.retryAfter = retryAfter;
    return error;
  }
  async function fetchJson(url, options, { provider, signal, retries = 3, onRetry } = {}) {
    for (let attempt = 0; ; attempt += 1) {
      let response;
      try {
        response = await fetch(url, { ...options, signal });
      } catch (error2) {
        if (error2.name === "AbortError") throw error2;
        if (attempt >= retries) throw apiError(provider, 0, `Could not reach ${provider}. Check your connection.`);
        const delay2 = Math.min(6e3, 500 * 2 ** attempt);
        onRetry?.({ attempt: attempt + 1, delay: delay2, message: "Network interruption" });
        await wait(delay2, signal);
        continue;
      }
      if (response.ok) return response.json();
      let payload = {};
      try {
        payload = await response.json();
      } catch {
      }
      const message = payload?.error?.message || payload?.message || `${provider} request failed (${response.status})`;
      const retryAfter = Number(response.headers.get("retry-after") || 0) * 1e3;
      const error = apiError(provider, response.status, message, retryAfter);
      error.code = payload?.error?.code || "";
      if (!error.retryable || attempt >= retries) throw error;
      const delay = retryAfter || Math.min(8e3, 500 * 2 ** attempt);
      onRetry?.({ attempt: attempt + 1, delay, message });
      await wait(delay, signal);
    }
  }
  function dedupeSources(sources) {
    const seen = /* @__PURE__ */ new Set();
    return sources.map((source) => ({ ...source, url: sanitizeUrl(source.url) })).filter((source) => source.url && !seen.has(source.url) && seen.add(source.url));
  }
  function parseAnthropicResponse(payload) {
    const text = [];
    const citations = [];
    for (const block of payload?.content || []) {
      if (block.type === "text" && block.text) text.push(block.text);
      for (const citation of block.citations || []) if (citation.url) citations.push({ url: citation.url, title: citation.title || "", citedText: citation.cited_text || "" });
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) block.content.forEach((result) => {
        if (result.url) citations.push({ url: result.url, title: result.title || "", citedText: result.cited_text || "" });
      });
    }
    return { text: text.join("\n").trim(), citations: dedupeSources(citations), usage: payload?.usage || null, stopReason: payload?.stop_reason || "" };
  }
  function parseGeminiResponse(payload) {
    const candidate = payload?.candidates?.[0] || {};
    const metadata = candidate.groundingMetadata || {};
    const text = (candidate.content?.parts || []).map((part) => part.text || "").join("\n").trim();
    const citations = (metadata.groundingChunks || []).map((chunk) => chunk.web ? { url: chunk.web.uri, title: chunk.web.title || "", citedText: "" } : null).filter(Boolean);
    return { text, citations: dedupeSources(citations), usage: payload?.usageMetadata || null, stopReason: candidate.finishReason || "" };
  }
  function parseOpenAIResponse(payload) {
    const text = [];
    const citations = [];
    for (const item of payload?.output || []) if (item.type === "message") for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) text.push(content.text);
      for (const annotation of content.annotations || []) if (annotation.type === "url_citation" && annotation.url) citations.push({ url: annotation.url, title: annotation.title || "", citedText: annotation.cited_text || "" });
    }
    return { text: text.join("\n").trim() || String(payload?.output_text || "").trim(), citations: dedupeSources(citations), usage: payload?.usage || null, stopReason: payload?.status || "" };
  }
  async function runProvider({ apiKey, modelId, systemPrompt, prompt, depth = "standard", anthropicSearchTool = "web_search_20250305", signal, onProgress, onRetry }) {
    const model = modelFor(modelId);
    const maxTokens = (DEPTHS[depth] || DEPTHS.standard).maxTokens;
    if (model.transport !== "api") throw new Error("Netlify builds accept cloud API models only.");
    onProgress?.("search", "Searching current sources\u2026");
    let parsed;
    if (model.provider === "openai") {
      const payload = await fetchJson("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: model.id, instructions: systemPrompt, input: prompt, tools: [{ type: "web_search" }], tool_choice: "required", max_output_tokens: maxTokens, store: false }) }, { provider: "OpenAI", signal, onRetry });
      parsed = parseOpenAIResponse(payload);
    } else if (model.provider === "google") {
      const payload = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.id)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, tools: [{ google_search: {} }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 } }) }, { provider: "Google Gemini", signal, onRetry });
      parsed = parseGeminiResponse(payload);
    } else {
      const payload = await fetchJson("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: model.id, max_tokens: maxTokens, system: systemPrompt, tools: [{ type: anthropicSearchTool, name: "web_search", max_uses: (DEPTHS[depth] || DEPTHS.standard).searchUses }], messages: [{ role: "user", content: prompt }], temperature: 0.2 }) }, { provider: "Anthropic", signal, onRetry });
      parsed = parseAnthropicResponse(payload);
    }
    if (!parsed.text) throw apiError(model.provider, 502, "The provider returned no briefing text.");
    onProgress?.("format", "Connecting claims to evidence\u2026");
    return { ...parsed, briefing: normalizeBriefing(parsed.text, { citations: parsed.citations, fallbackText: parsed.text }) };
  }
  async function validateProviderKey(provider, apiKey, { signal } = {}) {
    if (!apiKey) return { ok: false, message: "Enter an API key first." };
    try {
      if (provider === "openai") await fetchJson("https://api.openai.com/v1/models?limit=1", { headers: { Authorization: `Bearer ${apiKey}` } }, { provider: "OpenAI", signal, retries: 0 });
      else if (provider === "google") await fetchJson("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { headers: { "x-goog-api-key": apiKey } }, { provider: "Google Gemini", signal, retries: 0 });
      else await fetchJson("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" } }, { provider: "Anthropic", signal, retries: 0 });
      return { ok: true, message: "Connected" };
    } catch (error) {
      if (error.name === "AbortError") throw error;
      return { ok: false, message: error.status === 401 || error.status === 403 ? "Key rejected by provider." : error.message };
    }
  }
  function formatProviderError(error) {
    if (error?.name === "AbortError") return "Generation cancelled.";
    if (error?.status === 401 || error?.status === 403) return "The provider rejected the API key.";
    if (error?.status === 429) return "The provider rate limit was reached. Wait briefly and try again.";
    return error?.message || "The briefing could not be generated.";
  }

  // app.js
  var store = createStore();
  store.initialize();
  var directFileMode = window.location.protocol === "file:";
  var state = {
    settings: store.getSettings(),
    profiles: store.getProfiles(),
    secrets: store.getSecrets(),
    history: store.getHistory(),
    route: store.getUi().route || "briefing",
    settingsSection: store.getUi().settingsSection || "profiles",
    editingProfileId: store.getSettings().activeProfileId,
    currentRecord: null,
    compareIds: [],
    generationController: null,
    onboardingStep: 1,
    onboardingProvider: "anthropic",
    onboardingTransport: "api",
    onboardingWatchlist: null,
    customizeOpen: false,
    settingsDraft: null,
    profilesDraft: null,
    secretsDraft: null,
    settingsDirty: false,
    run: null
  };
  var requestedRoute = window.location.hash.replace(/^#/, "");
  if (["briefing", "history", "settings"].includes(requestedRoute)) state.route = requestedRoute;
  function activeProfile() {
    return state.profiles.find((profile) => profile.id === state.settings.activeProfileId) || state.profiles[0];
  }
  function resetRun(profile = activeProfile()) {
    const transport = "api";
    const models = availableModelsForTransport(transport);
    const savedModelId = profile.apiModelId;
    const modelId = models.some((model) => model.id === savedModelId) ? savedModelId : models[0].id;
    state.run = { profileId: profile.id, depth: profile.depth, transport, modelId, dateFrom: todayISO(), dateTo: todayISO(), extraTickers: "", instructions: "", rawPrompt: "" };
  }
  resetRun();
  state.currentRecord = state.history.find((item) => item.kind === "briefing") || null;
  var $ = (selector) => document.querySelector(selector);
  var $$ = (selector) => [...document.querySelectorAll(selector)];
  function applyRuntimeIdentity() {
    document.documentElement.dataset.runtime = "api";
    document.title = "Market AI Aggregator \u2014 API";
    $("#runtime-label").textContent = directFileMode ? "Standalone API" : "API mode";
    $("#runtime-detail").textContent = directFileMode ? "Browser APIs" : "Cloud APIs";
    $("#runtime-indicator").title = "API mode uses browser-configured Anthropic, Gemini, and OpenAI credentials.";
  }
  function availableModelsForTransport(transport) {
    return modelsForTransport(transport);
  }
  function modelsForRun(transport = state.run.transport) {
    return availableModelsForTransport(transport);
  }
  function modelOptions(transport, selectedId) {
    const providerNames = { anthropic: "Anthropic API", google: "Google API", openai: "OpenAI API" };
    return html`${modelsForTransport(transport).map((model) => html`<option value="${model.id}" ${model.id === selectedId ? "selected" : ""}>${providerNames[model.provider]} — ${model.name} · ${model.speed}</option>`)}`;
  }
  function toast(message, type = "") {
    const node = document.createElement("div");
    node.className = `toast ${type}`.trim();
    node.textContent = message;
    $("#toast-region").append(node);
    setTimeout(() => node.remove(), 4200);
  }
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme || "dark";
  }
  function persistUi() {
    store.saveUi({ route: state.route, settingsSection: state.settingsSection, selectedHistoryId: state.currentRecord?.id || "" });
  }
  function setRoute(route, settingsSection = "") {
    if (!["briefing", "history", "settings"].includes(route)) route = "briefing";
    if (state.route === "settings") captureSettingsSection();
    state.route = route;
    if (settingsSection) state.settingsSection = settingsSection;
    $$(".view").forEach((view) => {
      const active = view.id === `view-${route}`;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });
    $$(".nav-link").forEach((button) => {
      const active = button.dataset.route === route && (!button.dataset.settingsSection || button.dataset.settingsSection === state.settingsSection);
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (route === "briefing") renderWorkspace();
    if (route === "history") renderHistory();
    if (route === "settings") {
      ensureSettingsDrafts();
      renderSettings();
    }
    if (window.location.hash !== `#${route}`) {
      try {
        window.history.replaceState(null, "", `#${route}`);
      } catch {
        window.location.hash = route;
      }
    }
    persistUi();
    $("#main-content").focus({ preventScroll: true });
  }
  function profileSummary(profile) {
    return [
      `${profile.topicIds.length} topics`,
      `${profile.watchlist.length} tickers`,
      DEPTHS[state.run.depth]?.name || "Standard",
      TRANSPORTS[state.run.transport].name,
      modelFor(state.run.modelId).name
    ];
  }
  function runCostText() {
    const profile = activeProfile();
    const cost = estimateRunCost({ modelId: state.run.modelId, depth: state.run.depth, topicCount: profile.topicIds.length, tickerCount: profile.watchlist.length + parseTickers(state.run.extraTickers).length });
    if (cost.high < 5e-3) return "< $0.01";
    return `$${cost.low.toFixed(2)}\u2013$${cost.high.toFixed(2)}`;
  }
  function renderWorkspace() {
    const profile = activeProfile();
    if (state.run.transport !== "api") resetRun(profile);
    const available = modelsForRun();
    if (!available.some((item) => item.id === state.run.modelId)) state.run.modelId = available[0].id;
    const model = modelFor(state.run.modelId);
    const connected = Boolean(state.secrets[model.provider]);
    $("#workspace-date").textContent = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(/* @__PURE__ */ new Date());
    $("#profile-select").innerHTML = html`${state.profiles.map((item) => html`<option value="${item.id}" ${item.id === profile.id ? "selected" : ""}>${item.name}</option>`)}`;
    $("#profile-summary").innerHTML = html`${profileSummary(profile).map((item) => html`<span class="summary-chip">${item}</span>`)}`;
    const connection = $("#connection-status");
    connection.classList.toggle("is-connected", connected);
    connection.innerHTML = html`<span class="status-dot"></span>${connected ? { google: "Gemini connected", anthropic: "Anthropic connected", openai: "OpenAI connected" }[model.provider] : "Connection required"}`;
    $$('input[name="run-depth"]').forEach((input) => {
      input.checked = input.value === state.run.depth;
    });
    $("#run-date-from").value = state.run.dateFrom;
    $("#run-date-to").value = state.run.dateTo;
    $("#run-tickers").value = state.run.extraTickers;
    $("#run-instructions").value = state.run.instructions;
    $("#run-prompt").value = state.run.rawPrompt;
    $("#run-model").innerHTML = modelOptions(state.run.transport, state.run.modelId);
    $("#customize-panel").hidden = !state.customizeOpen;
    $('[data-action="toggle-customize"]').setAttribute("aria-expanded", String(state.customizeOpen));
    $("#run-summary").innerHTML = html`${[
      html`<div><dt>Profile</dt><dd>${profile.name}</dd></div>`,
      html`<div><dt>Period</dt><dd>${state.run.dateFrom === state.run.dateTo ? formatDate(state.run.dateFrom) : `${formatDate(state.run.dateFrom)}\u2013${formatDate(state.run.dateTo)}`}</dd></div>`,
      html`<div><dt>Depth</dt><dd>${DEPTHS[state.run.depth].name}</dd></div>`,
      html`<div><dt>Method</dt><dd>${TRANSPORTS[state.run.transport].name}</dd></div>`,
      html`<div><dt>Model</dt><dd>${model.name}</dd></div>`,
      html`<div><dt>Coverage</dt><dd>${profile.topicIds.length} topics<br>${profile.watchlist.length + parseTickers(state.run.extraTickers).length} tickers</dd></div>`
    ]}`;
    $("#cost-estimate").textContent = runCostText();
    const costNote = $("#cost-estimate").closest(".cost-note");
    costNote.querySelector("span").textContent = "Estimated cost";
    costNote.querySelector("small").textContent = "Actual provider charges may vary.";
    renderOnboarding();
    renderResult(state.currentRecord);
  }
  function renderOnboarding() {
    const host = $("#onboarding-host");
    if (state.settings.onboardingComplete) {
      host.innerHTML = "";
      return;
    }
    const step = state.onboardingStep;
    const progress = html`<div class="onboarding-steps" aria-label="Setup step ${step} of 4">${[1, 2, 3, 4].map((n) => html`<span class="${n <= step ? "is-active" : ""}"></span>`)}</div>`;
    const exitSetup = html`<button class="text-button" data-action="dismiss-onboarding">Open dashboard without setup</button>`;
    let content = "";
    if (step === 1) content = html`<span class="eyebrow">Welcome</span><h2>Start with a useful briefing, not a wall of settings.</h2><p>Setup takes about a minute. You can change every choice later.</p><div class="onboarding-actions"><button class="primary-button" data-action="onboarding-next">Get started</button><button class="secondary-button" data-action="show-sample">Preview a sample first</button>${exitSetup}</div>`;
    if (step === 2) {
      state.onboardingTransport = "api";
      const apiSetup = html`<p>This provider key stays in this browser and is sent only to the selected provider.</p><fieldset class="depth-selector"><legend>Provider</legend><label><input type="radio" name="onboarding-provider" value="anthropic" ${state.onboardingProvider === "anthropic" ? "checked" : ""}><span>Anthropic<small>Claude models</small></span></label><label><input type="radio" name="onboarding-provider" value="google" ${state.onboardingProvider === "google" ? "checked" : ""}><span>Google<small>Gemini models</small></span></label><label><input type="radio" name="onboarding-provider" value="openai" ${state.onboardingProvider === "openai" ? "checked" : ""}><span>OpenAI<small>GPT models</small></span></label></fieldset><label>API key<input id="onboarding-key" type="password" autocomplete="off" placeholder="Paste your key"></label>`;
      content = html`<span class="eyebrow">Connection</span><h2>Connect a cloud API</h2>${apiSetup}<div class="onboarding-actions"><button class="secondary-button" data-action="onboarding-back">Back</button><button class="primary-button" data-action="onboarding-save-key">Test and continue</button><button class="text-button" data-action="onboarding-next">Skip this step</button>${exitSetup}</div>`;
    }
    if (step === 3) content = html`<span class="eyebrow">Starting point</span><h2>Choose a briefing profile</h2><p>A profile bundles topics, tickers, depth, and model choice.</p><label>Starting profile<select id="onboarding-profile">${state.profiles.map((profile) => html`<option value="${profile.id}">${profile.name} — ${profile.description}</option>`)}</select></label><div class="onboarding-actions"><button class="secondary-button" data-action="onboarding-back">Back</button><button class="primary-button" data-action="onboarding-next">Continue</button>${exitSetup}</div>`;
    if (step === 4) {
      state.onboardingWatchlist ||= [...activeProfile().watchlist];
      content = html`<span class="eyebrow">Watchlist</span><h2>Make it yours</h2><p>Add the stocks you need scanned every time. You can leave the defaults.</p><div class="field-group"><span class="field-label">Stocks to watch</span>${tickerEditorMarkup(state.onboardingWatchlist, "onboarding")}</div><div class="onboarding-actions"><button class="secondary-button" data-action="onboarding-back">Back</button><button class="primary-button" data-action="finish-onboarding">Finish setup</button><button class="secondary-button" data-action="show-sample">Use a sample briefing</button>${exitSetup}</div>`;
    }
    host.innerHTML = html`<section class="onboarding surface"><div class="onboarding-grid"><div>${progress}${content}</div><div class="executive-pulse"><span class="eyebrow">What you get</span><h2>Evidence before confidence</h2><p>Each material claim is labeled, connected to sources when available, and saved for meaningful comparison later.</p></div></div></section>`;
  }
  function previousComparable(record) {
    if (!record) return null;
    return state.history.find((item) => item.id !== record.id && item.kind === "briefing" && item.profileId === record.profileId && new Date(item.generatedAt) < new Date(record.generatedAt));
  }
  function sourceMarkup(sources = []) {
    const valid = sources.map((source) => ({ ...source, url: sanitizeUrl(source.url) })).filter((source) => source.url);
    if (!valid.length) return html`<span class="unsourced">No retrieved source attached</span>`;
    return html`<div class="source-list">${valid.map((source, index) => html`<a class="source-link" href="${source.url}" target="_blank" rel="noopener noreferrer" title="${source.citedText || ""}">${index + 1}. ${source.title || new URL(source.url).hostname}</a>`)}</div>`;
  }
  function findingMarkup(finding, record) {
    return html`<article class="finding-card"><div class="finding-topline"><div><h3>${finding.ticker ? `${finding.ticker}: ${finding.headline}` : finding.headline}</h3><p>${finding.summary}</p></div><button class="secondary-button small" type="button" data-action="open-deep-dive" data-record-id="${record.id}" data-finding-id="${finding.id}">Deep dive</button></div>${finding.why_it_matters ? html`<p class="why-it-matters"><strong>Why it matters:</strong> ${finding.why_it_matters}</p>` : ""}<div class="finding-meta"><span class="claim-chip ${finding.claim_type}">${finding.claim_type}</span><span class="confidence-chip">${finding.confidence} confidence</span><span class="meta-chip">${finding.horizon}</span></div>${sourceMarkup(finding.sources)}</article>`;
  }
  function comparisonSummaryMarkup(previous, record) {
    if (!previous?.briefing || !record?.briefing) return "";
    const changes = compareBriefings(previous, record);
    const list = (items, mapper) => items.length ? html`<ul>${items.slice(0, 5).map((item) => html`<li>${mapper(item)}</li>`)}</ul>` : html`<p class="subtle">None detected</p>`;
    return html`<section class="change-summary surface"><div class="briefing-section-header"><div><span class="eyebrow">Compared with ${formatDateTime(previous.generatedAt)}</span><h2>What changed</h2></div><button class="text-button" data-action="open-comparison" data-left="${previous.id}" data-right="${record.id}">Open full comparison</button></div><div class="change-columns"><div class="change-column"><h3>New</h3>${list(changes.new, (item) => item.headline)}</div><div class="change-column"><h3>Changed</h3>${list(changes.changed, (item) => `${item.before.headline} \u2192 ${item.after.headline}`)}</div><div class="change-column"><h3>No longer active</h3>${list(changes.resolved, (item) => item.headline)}</div></div></section>`;
  }
  function briefingMarkup(record, { compact = false } = {}) {
    if (!record) return html`<div class="empty-briefing"><h2>No briefing yet</h2><p>Generate a live briefing or preview the sample to see the evidence-aware layout.</p></div>`;
    const briefing = record.briefing || normalizeBriefing(record.rawResponse || "", { fallbackText: record.rawResponse || "", title: "Imported briefing" });
    record.briefing = briefing;
    const groups = Object.groupBy ? Object.groupBy(briefing.findings, (item) => item.section) : briefing.findings.reduce((map, item) => ((map[item.section] ||= []).push(item), map), {});
    const sections = Object.entries(groups).map(([section, findings]) => html`<section class="briefing-section surface"><div class="briefing-section-header"><h2>${section}</h2><button class="text-button" data-action="open-section-deep-dive" data-record-id="${record.id}" data-section="${section}">Deep dive on section</button></div><div class="finding-list">${findings.map((finding) => findingMarkup(finding, record))}</div></section>`);
    const catalysts = briefing.catalysts.length ? html`<section class="briefing-section surface"><div class="briefing-section-header"><h2>Catalyst calendar</h2></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Event</th><th>Expectation</th><th>Potential impact</th></tr></thead><tbody>${briefing.catalysts.map((item) => html`<tr><td>${item.date}</td><td>${item.event}${sourceMarkup(item.sources)}</td><td>${item.expectation}</td><td>${item.impact}</td></tr>`)}</tbody></table></div></section>` : "";
    const watchlist = briefing.watchlist.length ? html`<section class="briefing-section surface"><div class="briefing-section-header"><h2>Watchlist scan</h2></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Ticker</th><th>Catalyst</th><th>Potential impact</th><th>Next date</th></tr></thead><tbody>${briefing.watchlist.map((item) => html`<tr><td><strong>${item.ticker}</strong></td><td>${item.catalyst}${sourceMarkup(item.sources)}</td><td>${item.potential_impact}</td><td>${item.next_date}</td></tr>`)}</tbody></table></div></section>` : "";
    return html`<div class="result-shell"><section class="result-hero surface"><div class="result-header"><div><span class="eyebrow">${record.kind === "deep-dive" ? "Contextual deep dive" : "Latest briefing"}</span><h1>${briefing.title}</h1><div class="result-meta"><span class="meta-chip">${record.profileName}</span><span class="meta-chip">${modelFor(record.modelId).name}</span><span class="meta-chip">${formatDateTime(record.generatedAt)}</span><span class="meta-chip">${record.citations?.length || 0} sources</span></div></div>${compact ? "" : html`<div class="result-actions"><button class="secondary-button small" data-action="copy-briefing" data-record-id="${record.id}">Copy</button><button class="secondary-button small" data-action="export-briefing" data-record-id="${record.id}">Export HTML</button><button class="secondary-button small" data-action="print">Print</button><button class="secondary-button small" data-action="regenerate" data-record-id="${record.id}">Regenerate</button></div>`}</div><div class="pulse-grid"><div class="executive-pulse"><h2>Executive pulse</h2><p>${briefing.executive_summary}</p></div><div class="stance-card"><span class="eyebrow">Overall stance</span><strong>${briefing.stance}</strong></div></div></section>${compact ? "" : comparisonSummaryMarkup(previousComparable(record), record)}${sections}${catalysts}${watchlist}</div>`;
  }
  function renderResult(record) {
    $("#briefing-result").innerHTML = briefingMarkup(record);
  }
  function setProgress(step, detail) {
    const order = ["prepare", "search", "synthesize", "format"];
    const index = order.indexOf(step);
    $$(".progress-steps li").forEach((item, i) => {
      item.classList.toggle("is-active", i === index);
      item.classList.toggle("is-done", i < index);
    });
    $("#generation-status-title").textContent = { prepare: "Preparing briefing", search: "Researching current sources", synthesize: "Synthesizing findings", format: "Connecting claims to evidence" }[step] || "Generating briefing";
    $("#generation-status-detail").textContent = detail || "";
  }
  async function generate({ parentRecord = null, parentContext = "", deepDivePrompt = "", regenerateRecord = null } = {}) {
    if (state.generationController) return;
    const profile = activeProfile();
    const depth = parentRecord ? "deep" : regenerateRecord?.depth || state.run.depth;
    const transport = "api";
    const requestedModelId = parentRecord ? $("#deep-dive-model")?.value || state.run.modelId : regenerateRecord?.modelId || state.run.modelId;
    const modelId = availableModelsForTransport("api").some((model2) => model2.id === requestedModelId) ? requestedModelId : state.run.modelId;
    const model = modelFor(modelId);
    const apiKey = state.secrets[model.provider];
    if (transport === "api" && !apiKey) {
      const connectionName = { google: "a Gemini API key", anthropic: "an Anthropic API key", openai: "an OpenAI API key" }[model.provider];
      toast(`Add ${connectionName} in Connections first.`, "error");
      setRoute("settings", "connections");
      return;
    }
    const prompt = regenerateRecord?.prompt || buildPrompt({ profile, depth, dateFrom: state.run.dateFrom, dateTo: state.run.dateTo, extraTickers: state.run.extraTickers, extraInstructions: deepDivePrompt || state.run.instructions, parentContext, rawPrompt: regenerateRecord ? "" : state.run.rawPrompt });
    state.generationController = new AbortController();
    $("#generation-status").hidden = false;
    setProgress("prepare", "Building the request\u2026");
    $("#generate-button").disabled = true;
    try {
      const result = await runProvider({ transport, apiKey, modelId, systemPrompt: state.settings.expert.systemPrompt, prompt, depth, anthropicSearchTool: state.settings.expert.anthropicSearchTool, signal: state.generationController.signal, onProgress: setProgress, onRetry: (info) => setProgress("search", `Temporary provider issue. Retry ${info.attempt} in ${(info.delay / 1e3).toFixed(1)} seconds\u2026`) });
      const record = { id: uid(parentRecord ? "deep-dive" : "briefing"), kind: parentRecord ? "deep-dive" : "briefing", parentId: parentRecord?.id || null, profileId: regenerateRecord?.profileId || profile.id, profileName: regenerateRecord?.profileName || profile.name, dateFrom: regenerateRecord?.dateFrom || state.run.dateFrom, dateTo: regenerateRecord?.dateTo || state.run.dateTo, transport, authMethod: result.authMethod || "", modelId, modelName: model.name, depth, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), prompt, systemPrompt: state.settings.expert.systemPrompt, usage: result.usage, citations: result.citations, rawResponse: result.text, briefing: result.briefing };
      store.addHistory(record);
      state.history = store.getHistory();
      if (!parentRecord) state.currentRecord = record;
      if (parentRecord) {
        $("#dialog-content").innerHTML = briefingMarkup(record, { compact: true });
      } else {
        renderResult(record);
        window.scrollTo({ top: $("#briefing-result").offsetTop - 90, behavior: "smooth" });
      }
      toast(parentRecord ? "Deep dive completed and linked to its parent briefing." : "Briefing generated and saved.");
    } catch (error) {
      toast(formatProviderError(error), error.name === "AbortError" ? "" : "error");
    } finally {
      state.generationController = null;
      $("#generation-status").hidden = true;
      $("#generate-button").disabled = false;
    }
  }
  function historySearchText(record) {
    const briefing = record.briefing || {};
    return [record.profileName, record.modelName, record.rawResponse, briefing.title, briefing.executive_summary, ...(briefing.findings || []).flatMap((item) => [item.headline, item.summary, item.ticker])].join(" ").toLowerCase();
  }
  function renderHistory() {
    state.history = store.getHistory();
    $("#history-profile-filter").innerHTML = html`<option value="">All profiles</option>${state.profiles.map((profile) => html`<option value="${profile.id}">${profile.name}</option>`)}`;
    renderHistoryList();
    renderHistoryDetail(state.currentRecord || state.history[0]);
  }
  function renderHistoryList() {
    const query = $("#history-search")?.value.trim().toLowerCase() || "";
    const profileId = $("#history-profile-filter")?.value || "";
    const records = state.history.filter((record) => (!query || historySearchText(record).includes(query)) && (!profileId || record.profileId === profileId));
    $("#history-list").innerHTML = records.length ? html`${records.map((record) => html`<article class="history-row ${state.currentRecord?.id === record.id ? "is-selected" : ""}"><label class="visually-hidden" for="compare-${record.id}">Select ${record.briefing?.title || record.profileName} for comparison</label><input id="compare-${record.id}" type="checkbox" data-history-compare="${record.id}" ${state.compareIds.includes(record.id) ? "checked" : ""}><button class="text-button history-row-main" type="button" data-action="open-history" data-record-id="${record.id}"><strong>${record.kind === "deep-dive" ? "Deep dive \xB7 " : ""}${record.briefing?.title || record.profileName || "Imported briefing"}</strong><small>${record.briefing?.executive_summary || "Legacy briefing \u2014 open to view"}</small></button><span class="history-row-time">${formatDateTime(record.generatedAt)}</span></article>`)}` : '<div class="empty-briefing"><h2>No matching history</h2><p>Try another search or generate a briefing.</p></div>';
    $("#compare-count").textContent = state.compareIds.length;
    $("#compare-button").disabled = state.compareIds.length !== 2;
  }
  function renderHistoryDetail(record) {
    const detail = $("#history-detail");
    if (!detail) return;
    if (!record) {
      detail.innerHTML = '<div class="empty-briefing"><h2>Select a briefing</h2><p>Its evidence, lineage, and full content will appear here.</p></div>';
      return;
    }
    state.currentRecord = record;
    detail.innerHTML = briefingMarkup(record, { compact: true });
  }
  function comparisonMarkup(left, right) {
    const diff = compareBriefings(left, right);
    const group = (title, values, mapper) => html`<section class="comparison-group"><h3>${title} <span class="meta-chip">${values.length}</span></h3>${values.length ? html`<ul>${values.map((value) => html`<li>${mapper(value)}</li>`)}</ul>` : html`<p class="subtle">None detected</p>`}</section>`;
    return html`<div><p class="subtle">${formatDateTime(left.generatedAt)} → ${formatDateTime(right.generatedAt)}</p><div class="comparison-grid">${group("New", diff.new, (item) => item.headline)}${group("Changed", diff.changed, (item) => html`<strong>${item.after.headline}</strong><br><span class="subtle">Before: ${item.before.summary}</span><br>Now: ${item.after.summary}`)}${group("No longer active", diff.resolved, (item) => item.headline)}${group("Unchanged", diff.unchanged, (item) => item.headline)}</div></div>`;
  }
  function openDialog(title, content, eyebrow = "") {
    $("#dialog-title").textContent = title;
    $("#dialog-eyebrow").textContent = eyebrow;
    $("#dialog-content").innerHTML = content;
    $("#app-dialog").showModal();
  }
  function closeDialog() {
    $("#app-dialog").close();
  }
  function openDeepDive(recordId, { findingId = "", section = "" } = {}) {
    const record = state.history.find((item) => item.id === recordId) || state.currentRecord;
    if (!record?.briefing) return;
    const findings = section ? record.briefing.findings.filter((item) => item.section === section) : record.briefing.findings.filter((item) => item.id === findingId);
    const contextTitle = section || findings[0]?.headline || record.briefing.title;
    const context = findings.map((item) => `${item.headline}: ${item.summary}
Why it matters: ${item.why_it_matters}`).join("\n\n");
    openDialog("Deep dive", html`<div class="deep-dive-context"><strong>${contextTitle}</strong><p>${context}</p></div><div class="form-grid two-column"><label>Model<select id="deep-dive-model">${modelsForRun().map((model) => html`<option value="${model.id}" ${model.id === state.run.modelId ? "selected" : ""}>${model.name}</option>`)}</select></label><label>Analysis style<select id="deep-dive-style"><option value="evidence">Evidence review</option><option value="bull-bear">Bull vs bear</option><option value="scenario">Scenario analysis</option><option value="contrarian">Challenge the conclusion</option></select></label></div><label>Question or focus<textarea id="deep-dive-question" rows="4">Explain the evidence, strongest counterargument, key uncertainty, and the next observable signal that would confirm or invalidate this conclusion.</textarea></label><div class="onboarding-actions"><button class="primary-button" data-action="run-deep-dive" data-record-id="${record.id}" data-context="${context}">Run deep dive</button><button class="secondary-button" data-action="close-dialog">Cancel</button></div>`, contextTitle);
  }
  function ensureSettingsDrafts() {
    if (!state.settingsDraft) state.settingsDraft = clone(state.settings);
    if (!state.profilesDraft) state.profilesDraft = clone(state.profiles);
    if (!state.secretsDraft) state.secretsDraft = clone(state.secrets);
    if (!state.profilesDraft.some((profile) => profile.id === state.editingProfileId)) state.editingProfileId = state.profilesDraft[0]?.id;
  }
  function updateSettingsActions() {
    $$("[data-settings-state]").forEach((node) => {
      node.textContent = state.settingsDirty ? "Unsaved changes" : "No unsaved changes";
    });
    $$("[data-settings-save], [data-settings-discard]").forEach((button) => {
      button.disabled = !state.settingsDirty;
    });
  }
  function markSettingsDirty() {
    state.settingsDirty = true;
    updateSettingsActions();
  }
  function isPersistedSettingsControl(target) {
    if (!target.matches?.("input, select, textarea") || !target.closest("#settings-content")) return false;
    if (target.id === "profile-watchlist-add") return false;
    return true;
  }
  function tickerEditorMarkup(tickers = [], scope = "profile") {
    const prefix = scope === "onboarding" ? "onboarding-watchlist" : "profile-watchlist";
    return html`<div class="ticker-editor">
    <input id="${prefix}" type="hidden" value="${tickers.join(", ")}">
    <div class="ticker-chip-list" aria-label="Stocks currently on this watchlist">${tickers.length ? tickers.map((ticker) => html`<span class="ticker-chip"><span>${ticker}</span><button type="button" data-action="remove-${scope}-ticker" data-ticker="${ticker}" aria-label="Remove ${ticker} from watchlist">×</button></span>`) : html`<span class="subtle">No stocks added yet.</span>`}</div>
    <div class="ticker-add-row"><label for="${prefix}-add"><span>Add a stock</span><input id="${prefix}-add" autocomplete="off" autocapitalize="characters" placeholder="Enter a ticker, such as AAPL"></label><button class="secondary-button" type="button" data-action="add-${scope}-ticker">Add stock</button></div>
    <small class="field-help">Add one ticker at a time, or paste several separated by commas.</small>
  </div>`;
  }
  function captureSettingsSection() {
    if (!state.settingsDraft || !$("#settings-content")) return;
    const section = state.settingsSection;
    if (section === "profiles") {
      const profile = state.profilesDraft.find((item) => item.id === state.editingProfileId);
      if (!profile || !$("#profile-name")) return;
      Object.assign(profile, { name: $("#profile-name").value.trim() || profile.name, description: $("#profile-description").value.trim(), watchlist: parseTickers($("#profile-watchlist").value), depth: $("#profile-depth").value, transport: "api", instructions: $("#profile-instructions").value.trim(), topicIds: $$('input[name="profile-topic"]:checked').map((input) => input.value), coverageIds: $$('input[name="profile-coverage"]:checked').map((input) => input.value) });
      if ($("#profile-api-model")) profile.apiModelId = $("#profile-api-model").value;
      profile.modelId = profile.apiModelId;
    }
    if (section === "connections") {
      if ($("#settings-anthropic-key")) state.secretsDraft.anthropic = $("#settings-anthropic-key").value.trim();
      if ($("#settings-google-key")) state.secretsDraft.google = $("#settings-google-key").value.trim();
      if ($("#settings-openai-key")) state.secretsDraft.openai = $("#settings-openai-key").value.trim();
    }
    if (section === "appearance") state.settingsDraft.theme = $('input[name="settings-theme"]:checked')?.value || state.settingsDraft.theme;
    if (section === "expert") {
      state.settingsDraft.expert.systemPrompt = $("#expert-system-prompt")?.value || state.settingsDraft.expert.systemPrompt;
      state.settingsDraft.expert.anthropicSearchTool = $("#expert-search-tool")?.value || state.settingsDraft.expert.anthropicSearchTool;
    }
  }
  function settingsProfilesMarkupV3() {
    const profiles = state.profilesDraft;
    const profile = profiles.find((item) => item.id === state.editingProfileId) || profiles[0];
    const categories = [...new Set(TOPICS.map((topic) => topic.category))];
    const apiModels = availableModelsForTransport("api");
    const apiModelId = apiModels.some((model) => model.id === profile.apiModelId) ? profile.apiModelId : apiModels[0].id;
    const modelControl = html`<article class="mode-setting-card is-api"><span class="scope-chip api">Cloud API</span><h3>API model</h3><p>Uses the selected provider API.</p><label>API model<select id="profile-api-model">${modelOptions("api", apiModelId)}</select></label></article>`;
    const profileModeSummary = (item) => `API model: ${modelFor(item.apiModelId).name}`;
    return html`<section class="settings-section">
    <div class="section-heading"><div><h2>Briefing profiles</h2><p>This Netlify version uses cloud APIs only.</p></div><button class="secondary-button small" data-action="add-profile">Add profile</button></div>
    <div class="profile-editor-list">${profiles.map((item) => html`<button type="button" class="profile-editor-card text-button ${item.id === profile.id ? "is-active" : ""}" data-action="edit-profile" data-profile-id="${item.id}"><span class="profile-title-row"><strong>${item.name}</strong>${item.id === state.settingsDraft.activeProfileId ? html`<span class="meta-chip">Default</span>` : ""}</span><span class="subtle">${item.description} · ${profileModeSummary(item)}</span></button>`)}</div>
  </section><section class="settings-section">
    <div class="section-heading"><div><span class="scope-chip shared">Common profile fields</span><h2>Edit ${profile.name}</h2><p>${profile.id === state.settingsDraft.activeProfileId ? "This is the default Dashboard profile." : "Changes apply after Save changes."}</p></div><div class="button-cluster">${profile.id !== state.settingsDraft.activeProfileId ? html`<button class="secondary-button small" data-action="make-default-profile" data-profile-id="${profile.id}">Make default</button>` : html`<span class="meta-chip">Default profile</span>`}<button class="secondary-button small" data-action="duplicate-profile" data-profile-id="${profile.id}">Duplicate</button>${profiles.length > 1 ? html`<button class="danger-button small" data-action="delete-profile" data-profile-id="${profile.id}">Delete</button>` : ""}</div></div>
    <div class="form-grid two-column">
      <label>Name<input id="profile-name" value="${profile.name}"></label>
      <label>Description<input id="profile-description" value="${profile.description}"></label>
      <label>Default depth<select id="profile-depth">${Object.entries(DEPTHS).map(([id, item]) => html`<option value="${id}" ${id === profile.depth ? "selected" : ""}>${item.name}</option>`)}</select></label>
    </div>
    <div class="field-group"><span class="field-label">Stocks to watch</span>${tickerEditorMarkup(profile.watchlist)}</div>
    <label>Standing instructions<textarea id="profile-instructions" rows="4">${profile.instructions}</textarea></label>
    <h3>Topics</h3>${categories.map((category) => html`<p class="eyebrow">${category}</p><div class="option-grid">${TOPICS.filter((topic) => topic.category === category).map((topic) => html`<label class="option-card"><input type="checkbox" name="profile-topic" value="${topic.id}" ${profile.topicIds.includes(topic.id) ? "checked" : ""}><span><strong>${topic.name}</strong><small class="subtle">${topic.hint}</small></span></label>`)}</div>`)}
    <h3>Watchlist coverage</h3><div class="option-grid">${COVERAGE_TYPES.map((item) => html`<label class="option-card"><input type="checkbox" name="profile-coverage" value="${item.id}" ${profile.coverageIds.includes(item.id) ? "checked" : ""}><span><strong>${item.name}</strong><small class="subtle">${item.prompt}</small></span></label>`)}</div>
    <div class="mode-settings-grid">${modelControl}</div>
  </section>`;
  }
  function cloudConnectionsMarkup() {
    const status = (provider) => state.secrets[provider] ? html`<span class="connection-pill is-connected"><span class="status-dot"></span>Saved</span>` : html`<span class="connection-pill"><span class="status-dot"></span>Not set</span>`;
    const openaiConnection = html`<div class="connection-card"><label>OpenAI API key<input id="settings-openai-key" type="password" value="${state.secretsDraft.openai}" autocomplete="off"></label><div>${status("openai")} <button class="secondary-button small" data-action="test-connection" data-provider="openai">Test</button></div></div>`;
    return html`<section class="settings-section"><span class="scope-chip api">API only</span><h2>Cloud API connections</h2><p class="subtle">Anthropic, Gemini, and OpenAI keys are device-local and are sent only to the selected provider. Standard exports exclude all connection secrets.</p>
    <div class="connection-card"><label>Anthropic API key<input id="settings-anthropic-key" type="password" value="${state.secretsDraft.anthropic}" autocomplete="off"></label><div>${status("anthropic")} <button class="secondary-button small" data-action="test-connection" data-provider="anthropic">Test</button></div></div>
    <div class="connection-card"><label>Google Gemini API key<input id="settings-google-key" type="password" value="${state.secretsDraft.google}" autocomplete="off"></label><div>${status("google")} <button class="secondary-button small" data-action="test-connection" data-provider="google">Test</button></div></div>
    ${openaiConnection}
  </section>`;
  }
  function settingsConnectionsMarkupV3() {
    return cloudConnectionsMarkup();
  }
  function settingsAppearanceMarkup() {
    return html`<section class="settings-section"><span class="scope-chip shared">Application setting</span><h2>Appearance</h2><p class="subtle">Dark remains the default. Light and the original maize-and-blue theme are still available.</p><div class="theme-grid">${[["dark", "Dark"], ["light", "Light"], ["umich", "Go Blue!"]].map(([id, name]) => html`<label class="theme-card"><input type="radio" name="settings-theme" value="${id}" ${state.settingsDraft.theme === id ? "checked" : ""}><span>${name}</span></label>`)}</div></section>`;
  }
  function settingsDataMarkup() {
    const credentialBackup = html`<section class="settings-section"><span class="scope-chip api">API only</span><h2>Credential backup</h2><div class="danger-zone"><p><strong>Advanced and sensitive.</strong> This produces a plain JSON file containing API keys. Use it only for a secure transfer and delete it afterward.</p><button class="danger-button" data-action="export-secrets">Export backup with credentials</button></div></section>`;
    return html`<section class="settings-section"><span class="scope-chip shared">Application data</span><h2>Data & privacy</h2><p class="subtle">Normal exports exclude credentials. History includes prompts, responses, and retrieved source URLs.</p><div class="button-cluster"><button class="secondary-button" data-action="export-config">Export configuration</button><button class="secondary-button" data-action="export-history">Export history</button><button class="primary-button" data-action="export-full">Export full backup</button><button class="secondary-button" data-action="import-backup">Import backup</button></div></section>${credentialBackup}<section class="settings-section"><span class="scope-chip shared">Application data</span><h2>Storage</h2><p>${state.history.length} saved analyses on this device.</p><div class="danger-zone"><div class="button-cluster"><button class="danger-button" data-action="clear-history">Clear history</button><button class="danger-button" data-action="reset-app">Reset entire application</button></div></div></section>`;
  }
  function settingsExpertMarkup() {
    const apiControls = html`<section class="settings-section"><span class="scope-chip api">API only</span><h2>API administration</h2><p class="subtle">This setting affects Anthropic API requests.</p><label>Anthropic API web-search tool version<select id="expert-search-tool"><option value="web_search_20250305" ${state.settingsDraft.expert.anthropicSearchTool === "web_search_20250305" ? "selected" : ""}>web_search_20250305 · basic API search</option><option value="web_search_20260209" ${state.settingsDraft.expert.anthropicSearchTool === "web_search_20260209" ? "selected" : ""}>web_search_20260209 · dynamic API filtering</option></select></label></section>`;
    return html`<section class="settings-section"><span class="scope-chip shared">All API runs</span><h2>Analysis instructions</h2><p class="subtle">This system prompt applies to every run in this application.</p><label>System prompt<textarea id="expert-system-prompt" rows="10" class="code-input">${state.settingsDraft.expert.systemPrompt}</textarea></label></section>${apiControls}`;
  }
  function renderSettings() {
    ensureSettingsDrafts();
    $$(".settings-nav button").forEach((button) => button.classList.toggle("is-active", button.dataset.settingsSection === state.settingsSection));
    const renderers = { profiles: settingsProfilesMarkupV3, connections: settingsConnectionsMarkupV3, appearance: settingsAppearanceMarkup, data: settingsDataMarkup, expert: settingsExpertMarkup };
    $("#settings-content").innerHTML = (renderers[state.settingsSection] || renderers.profiles)();
    updateSettingsActions();
  }
  function saveSettings() {
    captureSettingsSection();
    state.profilesDraft = state.profilesDraft.map((profile2) => normalizeProfile(profile2));
    if (!state.profilesDraft.some((profile2) => profile2.id === state.settingsDraft.activeProfileId)) state.settingsDraft.activeProfileId = state.profilesDraft[0].id;
    store.saveSettings(state.settingsDraft);
    store.saveProfiles(state.profilesDraft);
    store.saveSecrets(state.secretsDraft);
    state.settings = clone(state.settingsDraft);
    state.profiles = clone(state.profilesDraft);
    state.secrets = clone(state.secretsDraft);
    applyTheme(state.settings.theme);
    state.settingsDirty = false;
    const profile = activeProfile();
    resetRun(profile);
    toast("Settings saved.");
    renderSettings();
  }
  function discardSettings() {
    state.settingsDraft = clone(state.settings);
    state.profilesDraft = clone(state.profiles);
    state.secretsDraft = clone(state.secrets);
    state.settingsDirty = false;
    state.editingProfileId = state.settings.activeProfileId;
    applyTheme(state.settings.theme);
    renderSettings();
    toast("Unsaved settings discarded.");
  }
  function download(name, content, type = "application/json") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  function recordText(record) {
    const briefing = record.briefing;
    return [briefing.title, briefing.executive_summary, ...briefing.findings.flatMap((item) => [`${item.section}: ${item.headline}`, item.summary, `Why it matters: ${item.why_it_matters}`])].join("\n\n");
  }
  function exportRecordHtml(record) {
    const briefing = record.briefing;
    const sources = (list) => list?.length ? html`<ul class="sources">${list.map((source) => html`<li><a href="${sanitizeUrl(source.url)}">${source.title || source.url}</a></li>`)}</ul>` : html`<p class="unsourced">No retrieved source attached</p>`;
    const sections = Object.entries(briefing.findings.reduce((map, item) => ((map[item.section] ||= []).push(item), map), {})).map(([name, findings]) => html`<section><h2>${name}</h2>${findings.map((item) => html`<article><h3>${item.ticker ? `${item.ticker}: ${item.headline}` : item.headline}</h3><p>${item.summary}</p><p><strong>Why it matters:</strong> ${item.why_it_matters}</p><p class="meta">${item.claim_type} · ${item.confidence} confidence · ${item.horizon}</p>${sources(item.sources)}</article>`)}</section>`);
    return String(html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${briefing.title}</title><style>body{max-width:840px;margin:0 auto;padding:32px 20px;color:#14202b;font:16px/1.6 system-ui,sans-serif}h1{line-height:1.15}h2{margin-top:32px;border-bottom:2px solid #d9e0e6;padding-bottom:6px}article{margin:16px 0;padding:18px;border:1px solid #d9e0e6;border-radius:12px;background:#f7f9fb}.meta{color:#536270;font-size:13px}.sources{font-size:13px}.unsourced{color:#a52727;font-size:13px}header{padding:22px;border-radius:14px;background:#dff3ee}.stance{font-weight:700}</style></head><body><header><h1>${briefing.title}</h1><p>${briefing.executive_summary}</p><p class="stance">Overall stance: ${briefing.stance}</p><p class="meta">${record.profileName} · ${modelFor(record.modelId).name} · ${formatDateTime(record.generatedAt)}</p></header>${sections}</body></html>`);
  }
  function fileUpload(callback) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (file) callback(await file.text());
    });
    input.click();
  }
  async function handleAction(button) {
    const action = button.dataset.action;
    if (!action) return;
    if (action === "toggle-customize") {
      state.customizeOpen = !state.customizeOpen;
      renderWorkspace();
    }
    if (action === "reset-run") {
      resetRun();
      renderWorkspace();
    }
    if (action === "preview-prompt") {
      state.run.rawPrompt = buildPrompt({ profile: activeProfile(), depth: state.run.depth, dateFrom: state.run.dateFrom, dateTo: state.run.dateTo, extraTickers: state.run.extraTickers, extraInstructions: state.run.instructions });
      $("#run-prompt").value = state.run.rawPrompt;
      toast("Prompt preview built.");
    }
    if (action === "generate") await generate();
    if (action === "cancel-generation") state.generationController?.abort();
    if (action === "show-sample") {
      const record = { id: uid("sample"), kind: "briefing", parentId: null, profileId: activeProfile().id, profileName: "Product preview", dateFrom: todayISO(), dateTo: todayISO(), transport: state.run.transport, modelId: state.run.modelId, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), prompt: "Local sample", citations: [], briefing: createSampleBriefing(), usage: null, rawResponse: "" };
      state.currentRecord = record;
      renderResult(record);
      toast("Showing a local sample. It is not live market data.");
    }
    if (action === "onboarding-next") {
      if (state.onboardingStep === 3) {
        const selected = $("#onboarding-profile")?.value;
        if (selected) {
          state.settings.activeProfileId = selected;
          const profile = activeProfile();
          profile.apiModelId = { anthropic: "claude-sonnet-4-5-20250929", google: "gemini-2.5-flash", openai: "gpt-5.6-terra" }[state.onboardingProvider];
          profile.modelId = profile.apiModelId;
          state.onboardingWatchlist = [...profile.watchlist];
          resetRun(profile);
        }
      }
      state.onboardingStep = Math.min(4, state.onboardingStep + 1);
      renderWorkspace();
    }
    if (action === "onboarding-back") {
      state.onboardingStep = Math.max(1, state.onboardingStep - 1);
      renderWorkspace();
    }
    if (action === "dismiss-onboarding") {
      state.settings.onboardingComplete = true;
      store.saveSettings(state.settings);
      resetRun(activeProfile());
      renderWorkspace();
      toast("Setup skipped. Configure profiles and connections any time in Settings.");
    }
    if (action === "onboarding-save-key") {
      const key = $("#onboarding-key").value.trim();
      if (!key) return toast("Enter a key or choose Skip for now.", "error");
      button.disabled = true;
      const result = await validateProviderKey(state.onboardingProvider, key);
      button.disabled = false;
      if (!result.ok) return toast(result.message, "error");
      state.onboardingTransport = "api";
      state.secrets[state.onboardingProvider] = key;
      store.saveSecrets(state.secrets);
      state.onboardingStep = 3;
      renderWorkspace();
      toast("Connection verified.");
    }
    if (action === "finish-onboarding") {
      const profile = activeProfile();
      profile.watchlist = [...state.onboardingWatchlist || profile.watchlist];
      state.settings.onboardingComplete = true;
      store.saveProfiles(state.profiles);
      store.saveSettings(state.settings);
      resetRun(profile);
      renderWorkspace();
      toast("Setup complete.");
    }
    if (action === "open-help") {
      const modeHelp = "<p><strong>API mode is open.</strong> Every briefing uses a configured cloud API.</p>";
      openDialog("Market AI Aggregator guide", `<div class="settings-section"><h3>Current version</h3>${modeHelp}<h3>Dashboard</h3><p>Choose a profile and depth, then generate with the configured cloud API.</p><h3>Connections</h3><p>Configure an Anthropic, Gemini, or OpenAI API key.</p><h3>Customize</h3><p>Use Customize this run for dates, one-time tickers, model overrides, and special questions.</p><h3>Deep dives</h3><p>Open any finding or section and request an evidence review, bull-versus-bear analysis, scenario analysis, or challenge.</p><h3>Evidence</h3><p>Retrieved source links appear beside claims. An explicit unsourced label means the provider did not attach retrievable evidence.</p><h3>Themes</h3><p>Dark is the default. Light and Go Blue remain available under Settings \u2192 Appearance.</p><h3>Privacy</h3><p>Settings, history, and provider keys stay in this browser. Standard exports exclude API credentials.</p></div>`, "Guide");
    }
    if (action === "close-dialog") closeDialog();
    if (action === "open-deep-dive") openDeepDive(button.dataset.recordId, { findingId: button.dataset.findingId });
    if (action === "open-section-deep-dive") openDeepDive(button.dataset.recordId, { section: button.dataset.section });
    if (action === "run-deep-dive") {
      const parent = state.history.find((item) => item.id === button.dataset.recordId) || state.currentRecord;
      const style = $("#deep-dive-style").value;
      const question = $("#deep-dive-question").value;
      await generate({ parentRecord: parent, parentContext: button.dataset.context, deepDivePrompt: `Analysis style: ${style}.
Question: ${question}` });
    }
    if (action === "open-history") {
      const record = state.history.find((item) => item.id === button.dataset.recordId);
      renderHistoryDetail(record);
      renderHistoryList();
    }
    if (action === "compare-selected") {
      const [left, right] = state.compareIds.map((id) => state.history.find((item) => item.id === id)).sort((a, b) => new Date(a.generatedAt) - new Date(b.generatedAt));
      if (left && right) openDialog("What changed", comparisonMarkup(left, right), "History comparison");
    }
    if (action === "open-comparison") {
      const left = state.history.find((item) => item.id === button.dataset.left);
      const right = state.history.find((item) => item.id === button.dataset.right) || state.currentRecord;
      if (left && right) openDialog("What changed", comparisonMarkup(left, right), "History comparison");
    }
    if (action === "copy-briefing") {
      const record = state.history.find((item) => item.id === button.dataset.recordId) || state.currentRecord;
      await navigator.clipboard.writeText(recordText(record));
      toast("Briefing copied.");
    }
    if (action === "export-briefing") {
      const record = state.history.find((item) => item.id === button.dataset.recordId) || state.currentRecord;
      download(`market-briefing-${record.dateFrom}.html`, exportRecordHtml(record), "text/html");
      toast("Briefing exported.");
    }
    if (action === "print") window.print();
    if (action === "regenerate") {
      const record = state.history.find((item) => item.id === button.dataset.recordId) || state.currentRecord;
      await generate({ regenerateRecord: record });
    }
    if (action === "save-settings") saveSettings();
    if (action === "discard-settings") discardSettings();
    if (action === "edit-profile") {
      captureSettingsSection();
      state.editingProfileId = button.dataset.profileId;
      renderSettings();
    }
    if (action === "make-default-profile") {
      captureSettingsSection();
      state.settingsDraft.activeProfileId = button.dataset.profileId;
      markSettingsDirty();
      renderSettings();
      toast("Default profile selected. Save changes to confirm.");
    }
    if (action === "add-profile-ticker") {
      captureSettingsSection();
      const profile = state.profilesDraft.find((item) => item.id === state.editingProfileId);
      const additions = parseTickers($("#profile-watchlist-add")?.value || "");
      if (!additions.length) return toast("Enter a valid ticker symbol.", "error");
      profile.watchlist = [.../* @__PURE__ */ new Set([...profile.watchlist, ...additions])];
      markSettingsDirty();
      renderSettings();
      $("#profile-watchlist-add")?.focus();
    }
    if (action === "remove-profile-ticker") {
      captureSettingsSection();
      const profile = state.profilesDraft.find((item) => item.id === state.editingProfileId);
      profile.watchlist = profile.watchlist.filter((ticker) => ticker !== button.dataset.ticker);
      markSettingsDirty();
      renderSettings();
    }
    if (action === "add-onboarding-ticker") {
      const additions = parseTickers($("#onboarding-watchlist-add")?.value || "");
      if (!additions.length) return toast("Enter a valid ticker symbol.", "error");
      state.onboardingWatchlist = [.../* @__PURE__ */ new Set([...state.onboardingWatchlist || activeProfile().watchlist, ...additions])];
      renderOnboarding();
      $("#onboarding-watchlist-add")?.focus();
    }
    if (action === "remove-onboarding-ticker") {
      state.onboardingWatchlist = (state.onboardingWatchlist || activeProfile().watchlist).filter((ticker) => ticker !== button.dataset.ticker);
      renderOnboarding();
    }
    if (action === "add-profile") {
      captureSettingsSection();
      const profile = normalizeProfile({ ...clone(DEFAULT_PROFILES[0]), id: uid("profile"), name: "New profile", description: "Custom briefing profile" });
      state.profilesDraft.push(profile);
      state.editingProfileId = profile.id;
      markSettingsDirty();
      renderSettings();
    }
    if (action === "duplicate-profile") {
      captureSettingsSection();
      const source = state.profilesDraft.find((item) => item.id === button.dataset.profileId);
      const copy = { ...clone(source), id: uid("profile"), name: `${source.name} copy` };
      state.profilesDraft.push(copy);
      state.editingProfileId = copy.id;
      markSettingsDirty();
      renderSettings();
    }
    if (action === "delete-profile") {
      const id = button.dataset.profileId;
      state.profilesDraft = state.profilesDraft.filter((item) => item.id !== id);
      state.editingProfileId = state.profilesDraft[0].id;
      if (state.settingsDraft.activeProfileId === id) state.settingsDraft.activeProfileId = state.editingProfileId;
      markSettingsDirty();
      renderSettings();
    }
    if (action === "test-connection") {
      captureSettingsSection();
      const provider = button.dataset.provider;
      button.disabled = true;
      const result = await validateProviderKey(provider, state.secretsDraft[provider]);
      button.disabled = false;
      toast(result.message, result.ok ? "" : "error");
    }
    if (action === "export-config") download(`market-briefing-config-${todayISO()}.json`, JSON.stringify(store.exportBundle({ includeHistory: false }), null, 2));
    if (action === "export-history") download(`market-briefing-history-${todayISO()}.json`, JSON.stringify({ format: "market-briefing-history", version: 2, history: state.history }, null, 2));
    if (action === "export-full") download(`market-briefing-backup-${todayISO()}.json`, JSON.stringify(store.exportBundle(), null, 2));
    if (action === "export-secrets") {
      if (confirm("This file will contain plain-text API credentials. Create it only for a secure transfer?")) download(`market-briefing-sensitive-backup-${todayISO()}.json`, JSON.stringify(store.exportBundle({ includeSecrets: true }), null, 2));
    }
    if (action === "import-backup") fileUpload((text) => {
      try {
        const bundle = JSON.parse(text);
        const hasSecrets = Boolean(bundle.secrets);
        const accept = hasSecrets && confirm("This backup contains API credentials. Import them into this browser?");
        store.importBundle(bundle, { acceptSecrets: accept });
        location.reload();
      } catch (error) {
        toast(error.message || "Invalid backup.", "error");
      }
    });
    if (action === "clear-history" && confirm("Delete all saved briefings and deep dives? This cannot be undone.")) {
      store.clearHistory();
      state.history = [];
      state.currentRecord = null;
      renderSettings();
      toast("History cleared.");
    }
    if (action === "reset-app" && confirm("Reset settings, profiles, connections, and history? This cannot be undone.")) {
      store.reset();
      location.reload();
    }
  }
  document.addEventListener("click", (event) => {
    const route = event.target.closest("[data-route]");
    if (route) {
      event.preventDefault();
      setRoute(route.dataset.route, route.dataset.settingsSection || "");
      return;
    }
    const settingsButton = event.target.closest("[data-settings-section]");
    if (settingsButton && settingsButton.closest(".settings-nav")) {
      captureSettingsSection();
      state.settingsSection = settingsButton.dataset.settingsSection;
      renderSettings();
      persistUi();
      return;
    }
    const action = event.target.closest("[data-action]");
    if (action) handleAction(action).catch((error) => toast(error.message || "Action failed.", "error"));
  });
  document.addEventListener("change", (event) => {
    if (isPersistedSettingsControl(event.target)) markSettingsDirty();
    if (event.target.id === "profile-select") {
      state.settings.activeProfileId = event.target.value;
      store.saveSettings(state.settings);
      resetRun(activeProfile());
      renderWorkspace();
    }
    if (event.target.name === "run-depth") {
      state.run.depth = event.target.value;
      state.run.rawPrompt = "";
      renderWorkspace();
    }
    if (event.target.id === "run-model") {
      state.run.modelId = event.target.value;
      state.run.rawPrompt = "";
      renderWorkspace();
    }
    if (event.target.name === "onboarding-provider") {
      state.onboardingProvider = event.target.value;
      renderOnboarding();
    }
    if (event.target.name === "settings-theme") {
      state.settingsDraft.theme = event.target.value;
      markSettingsDirty();
      applyTheme(event.target.value);
    }
    if (event.target.dataset.historyCompare) {
      const id = event.target.dataset.historyCompare;
      if (event.target.checked) {
        if (state.compareIds.length === 2) state.compareIds.shift();
        state.compareIds.push(id);
      } else state.compareIds = state.compareIds.filter((item) => item !== id);
      renderHistoryList();
    }
    if (event.target.id === "history-profile-filter") renderHistoryList();
  });
  document.addEventListener("input", (event) => {
    if (isPersistedSettingsControl(event.target)) markSettingsDirty();
    const map = { "run-date-from": "dateFrom", "run-date-to": "dateTo", "run-tickers": "extraTickers", "run-instructions": "instructions", "run-prompt": "rawPrompt" };
    if (map[event.target.id]) {
      state.run[map[event.target.id]] = event.target.value;
      if (event.target.id !== "run-prompt") state.run.rawPrompt = "";
      $("#cost-estimate").textContent = runCostText();
    }
    if (event.target.id === "history-search") renderHistoryList();
  });
  document.addEventListener("keydown", (event) => {
    if (["profile-watchlist-add", "onboarding-watchlist-add"].includes(event.target.id) && event.key === "Enter") {
      event.preventDefault();
      $(`[data-action="add-${event.target.id.startsWith("onboarding") ? "onboarding" : "profile"}-ticker"]`)?.click();
    }
  });
  var sharedSyncTimer = null;
  window.addEventListener("storage", (event) => {
    if (![STORAGE_KEYS.settings, STORAGE_KEYS.profiles, STORAGE_KEYS.secrets, STORAGE_KEYS.history].includes(event.key)) return;
    if (event.key === STORAGE_KEYS.history) {
      state.history = store.getHistory();
      if (state.route === "history") renderHistory();
      return;
    }
    if (state.settingsDirty && [STORAGE_KEYS.settings, STORAGE_KEYS.profiles, STORAGE_KEYS.secrets].includes(event.key)) {
      toast("Settings changed in another API tab. Save or discard this tab\u2019s unsaved changes, then reopen the section.", "error");
      return;
    }
    clearTimeout(sharedSyncTimer);
    sharedSyncTimer = setTimeout(() => {
      state.settings = store.getSettings();
      state.profiles = store.getProfiles();
      state.secrets = store.getSecrets();
      state.history = store.getHistory();
      state.settingsDraft = null;
      state.profilesDraft = null;
      state.secretsDraft = null;
      state.editingProfileId = state.profiles.some((profile) => profile.id === state.editingProfileId) ? state.editingProfileId : state.settings.activeProfileId;
      applyTheme(state.settings.theme);
      resetRun(activeProfile());
      if (state.route === "briefing") renderWorkspace();
      if (state.route === "history") renderHistory();
      if (state.route === "settings") renderSettings();
      toast("Settings updated from another API tab.");
    }, 40);
  });
  $("#app-dialog").addEventListener("click", (event) => {
    if (event.target === $("#app-dialog")) closeDialog();
  });
  applyRuntimeIdentity();
  applyTheme(state.settings.theme);
  setRoute(state.route);
})();
