(() => {
  // models.json
  var models_default = {
    _doc: "Verbatim Local copy of DAI/models.json. The parity test fails if DAI changes so Local cannot silently invent or drift model names, kinds, or CLI model IDs.",
    models: [
      {
        key: "codex",
        label: "Codex GPT-5.5",
        kind: "codex",
        model_id: "gpt-5.5"
      },
      {
        key: "codex-sol",
        label: "Codex Sol 5.6",
        kind: "codex",
        model_id: "gpt-5.6-sol"
      },
      {
        key: "codex-terra",
        label: "Codex Terra 5.6",
        kind: "codex",
        model_id: "gpt-5.6-terra"
      },
      {
        key: "codex-luna",
        label: "Codex Luna 5.6",
        kind: "codex",
        model_id: "gpt-5.6-luna"
      },
      {
        key: "codex-spark",
        label: "Codex Spark 5.3",
        kind: "codex",
        model_id: "gpt-5.3-codex-spark"
      },
      {
        key: "",
        label: "Claude (CLI default)",
        kind: "claude",
        model_id: ""
      },
      {
        key: "claude-opus-4-8",
        label: "Claude Opus 4.8",
        kind: "claude",
        model_id: "claude-opus-4-8"
      },
      {
        key: "claude-sonnet-4-6",
        label: "Claude Sonnet 4.6",
        kind: "claude",
        model_id: "claude-sonnet-4-6"
      },
      {
        key: "claude-haiku-4-5-20251001",
        label: "Claude Haiku 4.5",
        kind: "claude",
        model_id: "claude-haiku-4-5-20251001"
      },
      {
        key: "claude-fable-5",
        label: "Claude Fable 5",
        kind: "claude",
        model_id: "claude-fable-5"
      }
    ]
  };

  // js/cli-models.js
  var speedByDaiKey = {
    codex: "Balanced",
    "codex-sol": "Frontier analysis",
    "codex-terra": "Balanced",
    "codex-luna": "Cost efficient",
    "codex-spark": "Fast",
    "": "Account default",
    "claude-opus-4-8": "Deep synthesis",
    "claude-sonnet-4-6": "Balanced",
    "claude-haiku-4-5-20251001": "Fast",
    "claude-fable-5": "Experimental"
  };
  var CLI_MODELS = models_default.models.map((model) => ({
    id: `cli-${model.key || "claude-default"}`,
    name: model.label,
    provider: model.kind,
    transport: "cli",
    cliModelId: model.model_id,
    daiKey: model.key,
    speed: speedByDaiKey[model.key] || "Subscription CLI",
    rates: { input: 0, output: 0 },
    searchCost: 0
  }));

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
  var MODELS = [...CLI_MODELS];
  var TRANSPORTS = {
    cli: { id: "cli", name: "Local CLI server", description: "Existing Codex or Claude login" }
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
      transport: "cli",
      cliModelId: "cli-codex",
      modelId: "cli-codex",
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
      transport: "cli",
      cliModelId: "cli-codex-spark",
      modelId: "cli-codex-spark",
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
      transport: "cli",
      cliModelId: "cli-claude-opus-4-8",
      modelId: "cli-claude-opus-4-8",
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
      transport: "cli",
      cliModelId: "cli-claude-sonnet-4-6",
      modelId: "cli-claude-sonnet-4-6",
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
      transport: "cli",
      cliModelId: "cli-codex",
      modelId: "cli-codex",
      instructions: "Pre-earnings futures prep for the mega caps on the watchlist that report next. Answer in this order: (1) macro and geopolitical headwinds or tailwinds since their last reports, including strategic moves by global competitors such as rival earnings, IPOs, or major announcements; (2) expected net impact on S&P 500 (ES) and Nasdaq 100 (NQ) futures given index weights; (3) directional bias, bullish or bearish, and whether major price expansion up or down is expected; (4) whether the reaction is likely to create a price gap at the open or session restart; (5) a move severity score from 0 (negligible, sideways) to 5 (massive volatility, extreme range expansion) with a one-line rationale; (6) specific ES and NQ support and resistance levels to watch. Cite the options-market implied move where available. Be direct and focused on trading implications."
    }
  ];
  var DEFAULT_SETTINGS = {
    version: APP_VERSION,
    theme: "dark",
    activeProfileId: "daily-market",
    onboardingComplete: false,
    expert: {
      systemPrompt: "You are a senior market strategist. Produce decision-ready research, not generic commentary. Use current web sources. Separate confirmed facts, forecasts, market-implied values, and your own interpretation. Never invent a source. If a material claim is not supported by a retrieved source, mark it unsourced."
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
  function modelsForTransport(transport = "cli") {
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
    const cliModels = modelsForTransport("cli");
    const baseCliModelId = cliModels.some((model) => model.id === base.cliModelId) ? base.cliModelId : cliModels[0].id;
    const cliModelId = cliModels.some((model) => model.id === profile.cliModelId) ? profile.cliModelId : cliModels.some((model) => model.id === profile.modelId) ? profile.modelId : baseCliModelId;
    return {
      id: String(profile.id || base.id),
      name: String(profile.name || base.name),
      description: String(profile.description || ""),
      topicIds: uniqueStrings(profile.topicIds).filter((id) => TOPICS.some((topic) => topic.id === id)),
      watchlist: parseTickers(profile.watchlist),
      coverageIds: uniqueStrings(profile.coverageIds).filter((id) => COVERAGE_TYPES.some((item) => item.id === id)),
      depth: DEPTHS[profile.depth] ? profile.depth : base.depth,
      transport: "cli",
      cliModelId,
      modelId: cliModelId,
      instructions: String(profile.instructions || "")
    };
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
    settings: "maa_local_v4_settings",
    profiles: "maa_local_v4_profiles",
    history: "maa_local_v4_history",
    ui: "maa_local_v4_ui",
    migrated: "maa_local_v4_migrated"
  };
  var SHARED_KEYS = {
    settings: "mba_v2_settings",
    profiles: "mba_v2_profiles",
    history: "mba_v2_history",
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
      storage.setItem(STORAGE_KEYS.migrated, String(APP_VERSION));
    }
    function initialize() {
      migrateLegacy();
      if (!storage.getItem(STORAGE_KEYS.settings)) write(storage, STORAGE_KEYS.settings, DEFAULT_SETTINGS);
      if (!storage.getItem(STORAGE_KEYS.profiles)) write(storage, STORAGE_KEYS.profiles, DEFAULT_PROFILES);
      if (!storage.getItem(STORAGE_KEYS.history)) write(storage, STORAGE_KEYS.history, []);
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
      getUi: () => parse(storage, STORAGE_KEYS.ui, { route: "briefing", selectedHistoryId: "", settingsSection: "profiles" }),
      saveUi: (ui) => write(storage, STORAGE_KEYS.ui, ui),
      exportBundle({ includeHistory = true } = {}) {
        return {
          format: "market-briefing-backup",
          version: APP_VERSION,
          exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
          settings: api.getSettings(),
          profiles: api.getProfiles(),
          history: includeHistory ? api.getHistory() : []
        };
      },
      importBundle(bundle) {
        if (!bundle || bundle.format !== "market-briefing-backup" || Number(bundle.version) > APP_VERSION) throw new Error("Unsupported backup format or version.");
        if (!bundle.settings || !Array.isArray(bundle.profiles) || !Array.isArray(bundle.history)) throw new Error("Backup is missing required data.");
        api.saveSettings({ ...DEFAULT_SETTINGS, ...bundle.settings, expert: { ...DEFAULT_SETTINGS.expert, ...bundle.settings.expert } });
        api.saveProfiles(bundle.profiles);
        api.saveHistory(bundle.history.filter((item) => item && item.id && item.generatedAt));
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
  async function fetchJson(url, options, { signal } = {}) {
    const response = await fetch(url, { ...options, signal });
    if (response.ok) return response.json();
    let payload = {};
    try {
      payload = await response.json();
    } catch {
    }
    const error = new Error(payload?.error?.message || `Local CLI request failed (${response.status})`);
    error.status = response.status;
    error.code = payload?.error?.code || "";
    error.provider = "Local CLI";
    throw error;
  }
  function dedupeSources(sources = []) {
    const seen = /* @__PURE__ */ new Set();
    return sources.map((source) => ({ ...source, url: sanitizeUrl(source.url) })).filter((source) => source.url && !seen.has(source.url) && seen.add(source.url));
  }
  async function runProvider({ modelId, systemPrompt, prompt, depth = "standard", signal, onProgress }) {
    const model = modelFor(modelId);
    if (model.transport !== "cli") throw new Error("Local builds accept subscription CLI models only.");
    onProgress?.("search", `Running ${model.provider === "codex" ? "Codex" : "Claude"} through the local subscription bridge\u2026`);
    const payload = await fetchJson("/local/cli/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: model.id, systemPrompt, prompt, depth })
    }, { signal });
    const text = String(payload.text || "");
    if (!text) throw new Error("The subscription CLI returned no briefing text.");
    const citations = dedupeSources(payload.citations || []);
    onProgress?.("format", "Connecting claims to evidence\u2026");
    return { text, citations, usage: payload.usage || null, stopReason: payload.stopReason || "", authMethod: payload.authMethod || "", briefing: normalizeBriefing(text, { citations, fallbackText: text }) };
  }
  async function getCliStatus({ signal, refresh = false } = {}) {
    try {
      return await fetchJson(`/local/cli/status${refresh ? "?refresh=1" : ""}`, { headers: { Accept: "application/json" } }, { signal });
    } catch (error) {
      if (error.name === "AbortError") throw error;
      return { ok: false, localOnly: true, engines: [], models: [], message: "The Local server is not running or no subscription CLI is available." };
    }
  }
  async function getCliConfig({ signal } = {}) {
    try {
      return await fetchJson("/local/cli/config", { headers: { Accept: "application/json" } }, { signal });
    } catch (error) {
      if (error.name === "AbortError") throw error;
      return { codexPath: "", claudePath: "", unavailable: true };
    }
  }
  async function saveCliConfig(config, { signal } = {}) {
    return fetchJson("/local/cli/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) }, { signal });
  }
  function formatProviderError(error) {
    if (error?.name === "AbortError") return "Generation cancelled.";
    return error?.message || "The subscription CLI could not generate the briefing.";
  }

  // app.js
  var store = createStore();
  store.initialize();
  var state = {
    settings: store.getSettings(),
    profiles: store.getProfiles(),
    history: store.getHistory(),
    route: store.getUi().route || "briefing",
    settingsSection: store.getUi().settingsSection || "profiles",
    editingProfileId: store.getSettings().activeProfileId,
    currentRecord: null,
    compareIds: [],
    generationController: null,
    onboardingStep: 1,
    onboardingTransport: "cli",
    onboardingWatchlist: null,
    customizeOpen: false,
    settingsDraft: null,
    profilesDraft: null,
    settingsDirty: false,
    cliStatus: null,
    cliConfig: { codexPath: "", claudePath: "" },
    cliStatusLoading: false,
    run: null
  };
  var requestedRoute = window.location.hash.replace(/^#/, "");
  if (["briefing", "history", "settings"].includes(requestedRoute)) state.route = requestedRoute;
  function activeProfile() {
    return state.profiles.find((profile) => profile.id === state.settings.activeProfileId) || state.profiles[0];
  }
  function resetRun(profile = activeProfile()) {
    const transport = "cli";
    const models = availableModelsForTransport(transport);
    const savedModelId = profile.cliModelId;
    const modelId = models.some((model) => model.id === savedModelId) ? savedModelId : models[0].id;
    state.run = { profileId: profile.id, depth: profile.depth, transport, modelId, dateFrom: todayISO(), dateTo: todayISO(), extraTickers: "", instructions: "", rawPrompt: "" };
  }
  resetRun();
  state.currentRecord = state.history.find((item) => item.kind === "briefing") || null;
  var $ = (selector) => document.querySelector(selector);
  var $$ = (selector) => [...document.querySelectorAll(selector)];
  function applyRuntimeIdentity() {
    document.documentElement.dataset.runtime = "local";
    document.title = "Market AI Aggregator \u2014 Local";
    $("#runtime-label").textContent = "Local server";
    $("#runtime-detail").textContent = "Subscription CLI";
    $("#runtime-indicator").title = "Local server mode: briefings use an authenticated Codex or Claude subscription CLI.";
  }
  function cliEngineStatus(engine) {
    return state.cliStatus?.engines?.find((item) => item.id === engine);
  }
  function availableModelsForTransport(transport) {
    return modelsForTransport(transport);
  }
  function modelsForRun(transport = state.run.transport) {
    return availableModelsForTransport(transport);
  }
  function modelOptions(transport, selectedId) {
    const providerNames = { codex: "Codex subscription", claude: "Claude subscription" };
    return html`${modelsForTransport(transport).map((model) => {
      const unavailable = state.cliStatus && !cliEngineStatus(model.provider)?.available;
      return html`<option value="${model.id}" ${model.id === selectedId ? "selected" : ""} ${unavailable ? "disabled" : ""}>${providerNames[model.provider]} — ${model.name} · ${model.speed}${unavailable ? " \xB7 unavailable" : ""}</option>`;
    })}`;
  }
  async function refreshCliStatus({ refresh = false, rerender = true } = {}) {
    if (state.cliStatusLoading) return state.cliStatus;
    state.cliStatusLoading = true;
    try {
      const [status, config] = await Promise.all([getCliStatus({ refresh }), getCliConfig()]);
      state.cliStatus = status;
      state.cliConfig = config;
      if (state.run?.transport === "cli" && !cliEngineStatus(modelFor(state.run.modelId).provider)?.available) {
        const fallback = modelsForTransport("cli").find((model) => cliEngineStatus(model.provider)?.available);
        if (fallback) state.run.modelId = fallback.id;
      }
    } finally {
      state.cliStatusLoading = false;
      if (rerender) {
        if (state.route === "settings" && state.settingsSection === "connections") renderSettings();
        else if (state.route === "briefing") renderWorkspace();
      }
    }
    return state.cliStatus;
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
    return "Plan usage";
  }
  function renderWorkspace() {
    const profile = activeProfile();
    if (state.run.transport !== "cli") resetRun(profile);
    const available = modelsForRun();
    if (!available.some((item) => item.id === state.run.modelId)) state.run.modelId = available[0].id;
    const model = modelFor(state.run.modelId);
    const engine = cliEngineStatus(model.provider);
    const connected = Boolean(engine?.authenticated);
    const attemptable = Boolean(engine?.available);
    $("#workspace-date").textContent = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(/* @__PURE__ */ new Date());
    $("#profile-select").innerHTML = html`${state.profiles.map((item) => html`<option value="${item.id}" ${item.id === profile.id ? "selected" : ""}>${item.name}</option>`)}`;
    $("#profile-summary").innerHTML = html`${profileSummary(profile).map((item) => html`<span class="summary-chip">${item}</span>`)}`;
    const connection = $("#connection-status");
    connection.classList.toggle("is-connected", connected);
    connection.innerHTML = html`<span class="status-dot"></span>${connected ? `${model.provider === "codex" ? "Codex" : "Claude"} CLI connected` : !state.cliStatus ? "CLI server not checked" : attemptable ? "CLI login status unverified \u2014 runs will be attempted" : "Connection required"}`;
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
    costNote.querySelector("span").textContent = "Billing";
    costNote.querySelector("small").textContent = "Uses the active CLI account and its plan limits.";
    renderOnboarding();
    renderResult(state.currentRecord);
  }
  function cliStatusMarkup() {
    if (state.cliStatusLoading) return html`<p class="subtle">Checking Codex and Claude subscription logins…</p>`;
    if (!state.cliStatus) return html`<p class="subtle">CLI status could not be loaded automatically. Select Recheck CLIs.</p>`;
    if (!state.cliStatus.engines?.length) return html`<p class="subtle">${state.cliStatus.message || "Local CLI server is offline."}</p>`;
    return html`<div class="cli-status-grid">${state.cliStatus.engines.map((engine) => html`<div class="cli-engine-row"><div><strong>${engine.id === "codex" ? "Codex CLI" : "Claude CLI"}</strong><small class="subtle">${engine.available ? engine.authMethod : engine.installed ? "Installed \xB7 login required" : "Not installed"} · ${engine.source || "DAI/PATH auto-detection"}</small><small class="cli-path">${engine.path || "Executable not detected"}</small></div><span class="connection-pill ${engine.authenticated ? "is-connected" : ""}"><span class="status-dot"></span>${engine.authenticated ? "Ready" : engine.available ? "Unverified" : "Unavailable"}</span></div>`)}</div>`;
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
      state.onboardingTransport = "cli";
      content = html`<span class="eyebrow">Connection</span><h2>Connect your subscription CLI</h2><p>This application always uses an existing Codex or Claude subscription login.</p>${cliStatusMarkup()}<button class="secondary-button small" data-action="refresh-cli-status">Check subscription CLIs</button><div class="onboarding-actions"><button class="secondary-button" data-action="onboarding-back">Back</button><button class="primary-button" data-action="onboarding-use-cli">Use subscription CLI</button><button class="text-button" data-action="onboarding-next">Skip this step</button>${exitSetup}</div>`;
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
    const transport = "cli";
    const requestedModelId = parentRecord ? $("#deep-dive-model")?.value || state.run.modelId : regenerateRecord?.modelId || state.run.modelId;
    const modelId = modelsForTransport("cli").some((model2) => model2.id === requestedModelId) ? requestedModelId : state.run.modelId;
    const model = modelFor(modelId);
    const status = await refreshCliStatus({ refresh: true, rerender: false });
    if (!status?.engines?.find((item) => item.id === model.provider)?.available) {
      toast(`${model.provider === "codex" ? "Codex" : "Claude"} CLI is not installed and logged in. Check Connections.`, "error");
      setRoute("settings", "connections");
      return;
    }
    const prompt = regenerateRecord?.prompt || buildPrompt({ profile, depth, dateFrom: state.run.dateFrom, dateTo: state.run.dateTo, extraTickers: state.run.extraTickers, extraInstructions: deepDivePrompt || state.run.instructions, parentContext, rawPrompt: regenerateRecord ? "" : state.run.rawPrompt });
    state.generationController = new AbortController();
    $("#generation-status").hidden = false;
    setProgress("prepare", "Building the request\u2026");
    $("#generate-button").disabled = true;
    try {
      const result = await runProvider({ modelId, systemPrompt: state.settings.expert.systemPrompt, prompt, depth, signal: state.generationController.signal, onProgress: setProgress });
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
    if (["cli-codex-path", "cli-claude-path", "profile-watchlist-add"].includes(target.id)) return false;
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
      Object.assign(profile, { name: $("#profile-name").value.trim() || profile.name, description: $("#profile-description").value.trim(), watchlist: parseTickers($("#profile-watchlist").value), depth: $("#profile-depth").value, transport: "cli", instructions: $("#profile-instructions").value.trim(), topicIds: $$('input[name="profile-topic"]:checked').map((input) => input.value), coverageIds: $$('input[name="profile-coverage"]:checked').map((input) => input.value) });
      if ($("#profile-cli-model")) profile.cliModelId = $("#profile-cli-model").value;
      profile.modelId = profile.cliModelId;
    }
    if (section === "appearance") state.settingsDraft.theme = $('input[name="settings-theme"]:checked')?.value || state.settingsDraft.theme;
    if (section === "expert") state.settingsDraft.expert.systemPrompt = $("#expert-system-prompt")?.value || state.settingsDraft.expert.systemPrompt;
  }
  function settingsProfilesMarkupV3() {
    const profiles = state.profilesDraft;
    const profile = profiles.find((item) => item.id === state.editingProfileId) || profiles[0];
    const categories = [...new Set(TOPICS.map((topic) => topic.category))];
    const cliModels = availableModelsForTransport("cli");
    const cliModelId = cliModels.some((model) => model.id === profile.cliModelId) ? profile.cliModelId : cliModels[0].id;
    const modelControl = html`<article class="mode-setting-card is-local"><span class="scope-chip local">Subscription CLI</span><h3>CLI model</h3><p>Uses the authenticated Codex or Claude subscription.</p><label>Subscription model<select id="profile-cli-model">${modelOptions("cli", cliModelId)}</select></label></article>`;
    const profileModeSummary = (item) => `Subscription model: ${modelFor(item.cliModelId).name}`;
    return html`<section class="settings-section">
    <div class="section-heading"><div><h2>Briefing profiles</h2><p>This Local version uses subscription CLIs only.</p></div><button class="secondary-button small" data-action="add-profile">Add profile</button></div>
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
  function settingsConnectionsMarkupV3() {
    const detected = (engine) => cliEngineStatus(engine)?.path || "";
    return html`<section class="settings-section"><div class="section-heading"><div><span class="scope-chip local">Local subscription only</span><h2>Codex and Claude connections</h2><p>Local checks the same CLI commands DAI uses: DAI command overrides first, then Windows PATH. No path setup is required when a CLI is detected.</p></div><button class="secondary-button small" data-action="refresh-cli-status">Recheck CLIs</button></div>
    ${cliStatusMarkup()}
    <details class="advanced-disclosure cli-path-settings"><summary>Advanced path override (normally unnecessary)</summary><div class="advanced-body"><label>Codex executable<input id="cli-codex-path" value="${state.cliConfig.codexPath || detected("codex")}" placeholder="${detected("codex") || "Example: C:\\Users\\you\\AppData\\Roaming\\npm\\codex.cmd"}"><small class="field-help">The detected DAI/PATH value is shown. Edit only to force a different codex executable.</small></label><label>Claude executable<input id="cli-claude-path" value="${state.cliConfig.claudePath || detected("claude")}" placeholder="${detected("claude") || "Example: C:\\Users\\you\\.local\\bin\\claude.exe"}"><small class="field-help">The detected DAI/PATH value is shown. Edit only to force a different claude executable.</small></label><button class="secondary-button" data-action="save-cli-paths">Save path overrides</button></div></details>
    <p class="field-help">CLI prompts run in an isolated temporary workspace that is deleted after each run. Codex may write only inside that workspace; Claude is limited to web research tools.</p>
  </section>`;
  }
  function settingsAppearanceMarkup() {
    return html`<section class="settings-section"><span class="scope-chip shared">Application setting</span><h2>Appearance</h2><p class="subtle">Dark remains the default. Light and the original maize-and-blue theme are still available.</p><div class="theme-grid">${[["dark", "Dark"], ["light", "Light"], ["umich", "Go Blue!"]].map(([id, name]) => html`<label class="theme-card"><input type="radio" name="settings-theme" value="${id}" ${state.settingsDraft.theme === id ? "checked" : ""}><span>${name}</span></label>`)}</div></section>`;
  }
  function settingsDataMarkup() {
    return html`<section class="settings-section"><span class="scope-chip shared">Application data</span><h2>Data & privacy</h2><p class="subtle">History includes prompts, responses, and retrieved source URLs. CLI credentials remain owned by the installed CLI.</p><div class="button-cluster"><button class="secondary-button" data-action="export-config">Export configuration</button><button class="secondary-button" data-action="export-history">Export history</button><button class="primary-button" data-action="export-full">Export full backup</button><button class="secondary-button" data-action="import-backup">Import backup</button></div></section><section class="settings-section"><span class="scope-chip shared">Application data</span><h2>Storage</h2><p>${state.history.length} saved analyses on this device.</p><div class="danger-zone"><div class="button-cluster"><button class="danger-button" data-action="clear-history">Clear history</button><button class="danger-button" data-action="reset-app">Reset entire application</button></div></div></section>`;
  }
  function settingsExpertMarkup() {
    const localControls = html`<section class="settings-section"><span class="scope-chip local">Local subscription only</span><h2>CLI administration</h2><p class="subtle">These protections apply to Codex and Claude subscription runs.</p><div class="admin-fact-grid"><div><strong>Codex workspace</strong><span>Isolated temporary folder, deleted after each run</span></div><div><strong>Claude tools</strong><span>WebSearch and WebFetch only</span></div><div><strong>Prompt transport</strong><span>stdin; no shell command input</span></div><div><strong>Credentials</strong><span>Owned by the installed CLI</span></div></div><p class="field-help">Executable selection and authentication status are managed under Connections.</p></section>`;
    return html`<section class="settings-section"><span class="scope-chip shared">All subscription runs</span><h2>Analysis instructions</h2><p class="subtle">This system prompt applies to every run in this application.</p><label>System prompt<textarea id="expert-system-prompt" rows="10" class="code-input">${state.settingsDraft.expert.systemPrompt}</textarea></label></section>${localControls}`;
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
    state.settings = clone(state.settingsDraft);
    state.profiles = clone(state.profilesDraft);
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
          profile.cliModelId = cliEngineStatus("codex")?.available ? "cli-codex-terra" : "cli-claude-default";
          profile.modelId = profile.cliModelId;
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
    if (action === "onboarding-use-cli") {
      const status = await refreshCliStatus({ refresh: true, rerender: false });
      if (!status?.ok) return toast("Install and log in to Codex or Claude, then check again.", "error");
      state.onboardingTransport = "cli";
      state.onboardingStep = 3;
      renderWorkspace();
      toast("Local CLI connection verified.");
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
      const modeHelp = "<p><strong>Local Server mode is open.</strong> Every briefing uses an authenticated Codex or Claude subscription CLI.</p>";
      openDialog("Market AI Aggregator guide", `<div class="settings-section"><h3>Current version</h3>${modeHelp}<h3>Dashboard</h3><p>Choose a profile and depth, then generate with your subscription CLI.</p><h3>Connections</h3><p>Connect an authenticated Codex or Claude installation and its existing subscription.</p><h3>Customize</h3><p>Use Customize this run for dates, one-time tickers, model overrides, and special questions.</p><h3>Deep dives</h3><p>Open any finding or section and request an evidence review, bull-versus-bear analysis, scenario analysis, or challenge.</p><h3>Evidence</h3><p>Retrieved source links appear beside claims. An explicit unsourced label means the CLI did not attach retrievable evidence.</p><h3>Themes</h3><p>Dark is the default. Light and Go Blue remain available under Settings \u2192 Appearance.</p><h3>Privacy</h3><p>Settings and history stay in this browser. CLI credentials remain owned by the installed CLI.</p></div>`, "Guide");
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
    if (action === "refresh-cli-status") {
      button.disabled = true;
      await refreshCliStatus({ refresh: true });
      button.disabled = false;
      toast(state.cliStatus?.ok ? "Local CLI status refreshed." : "No authenticated local CLI is available.", state.cliStatus?.ok ? "" : "error");
    }
    if (action === "save-cli-paths") {
      button.disabled = true;
      try {
        const result = await saveCliConfig({ codexPath: $("#cli-codex-path")?.value || "", claudePath: $("#cli-claude-path")?.value || "" });
        state.cliConfig = result.config;
        state.cliStatus = result.status;
        renderSettings();
        toast("CLI executable paths saved and verified.");
      } finally {
        button.disabled = false;
      }
    }
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
    if (action === "export-config") download(`market-briefing-config-${todayISO()}.json`, JSON.stringify(store.exportBundle({ includeHistory: false }), null, 2));
    if (action === "export-history") download(`market-briefing-history-${todayISO()}.json`, JSON.stringify({ format: "market-briefing-history", version: 2, history: state.history }, null, 2));
    if (action === "export-full") download(`market-briefing-backup-${todayISO()}.json`, JSON.stringify(store.exportBundle(), null, 2));
    if (action === "import-backup") fileUpload((text) => {
      try {
        store.importBundle(JSON.parse(text));
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
    if (action === "reset-app" && confirm("Reset settings, profiles, CLI paths, and history? This cannot be undone.")) {
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
    if (![STORAGE_KEYS.settings, STORAGE_KEYS.profiles, STORAGE_KEYS.history].includes(event.key)) return;
    if (event.key === STORAGE_KEYS.history) {
      state.history = store.getHistory();
      if (state.route === "history") renderHistory();
      return;
    }
    if (state.settingsDirty && [STORAGE_KEYS.settings, STORAGE_KEYS.profiles].includes(event.key)) {
      toast("Settings changed in another Local tab. Save or discard this tab\u2019s unsaved changes, then reopen the section.", "error");
      return;
    }
    clearTimeout(sharedSyncTimer);
    sharedSyncTimer = setTimeout(() => {
      state.settings = store.getSettings();
      state.profiles = store.getProfiles();
      state.history = store.getHistory();
      state.settingsDraft = null;
      state.profilesDraft = null;
      state.editingProfileId = state.profiles.some((profile) => profile.id === state.editingProfileId) ? state.editingProfileId : state.settings.activeProfileId;
      applyTheme(state.settings.theme);
      resetRun(activeProfile());
      if (state.route === "briefing") renderWorkspace();
      if (state.route === "history") renderHistory();
      if (state.route === "settings") renderSettings();
      toast("Settings updated from another Local tab.");
    }, 40);
  });
  $("#app-dialog").addEventListener("click", (event) => {
    if (event.target === $("#app-dialog")) closeDialog();
  });
  applyRuntimeIdentity();
  applyTheme(state.settings.theme);
  void refreshCliStatus({ refresh: true });
  setRoute(state.route);
})();
