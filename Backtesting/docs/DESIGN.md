# Backtesting Arena — Design Document

Status: DRAFT v1 — 2026-07-29. Owner: Mike. Everything below is open to his ruling.

## 1. Goal in one paragraph

Find out whether news can predict short-term moves in the S&P 500 and Nasdaq — and if so,
turn that into the best possible prompt (or algorithm, or a combination) for the customer
project. We mine 2023 for patterns, tune on 2024, and run one frozen final test on 2025.
The output is either prompt verbiage that demonstrably works, an algorithm, or a
documented "no edge found" — all three are valid results.

## 2. The three-year protocol (the backtest)

| Year | Role | Rules (Mike's ruling 2026-07-29 — full record in [CONCEPTS.md](CONCEPTS.md)) |
|------|------|-------|
| 2023 | **Develop** | Open book. Known news sources, generic or specific — this year is for noticing. |
| 2024 | **Tweak** | Point-in-time only: at any simulated moment the AI sees information up to that minute and nothing after. Multiple runs allowed, but each run = ONE conceptual tweak with its hypothesis logged ("noticed X in 2023, trying Y"). Single conceptual tests, not overfitting — no parameter sweeps. |
| 2025 | **Final test** | Absolutely no forward biasing. Run ONCE with the frozen candidate. The 2025 number is the answer. |

**Source lock (all phases that score):** a run declares its news source or set of
sources up front, and the AI may consider ONLY those — nothing outside the declared
set, including the model's own knowledge of events. The declared sources (and the
web-search allowlist, when used) are part of every run manifest.

This mirrors the train/validate/test discipline used in the HYDRA engines. The moment 2025
is used to tune anything, it is burned as a test year and the result is void.

## 3. Price data (in place, verified)

`data/prices/` holds two Parquet files copied byte-identical (SHA-256 checked) from the
ASDSAI minute-bar cache:

- `mes_continuous_2021-01-01_2025-12-31.parquet` — Micro E-mini S&P 500, 1,767,965 rows
- `mnq_continuous_2021-01-01_2025-12-31.parquet` — Micro E-mini Nasdaq-100, 1,768,695 rows

Facts that matter:

- **1-minute OHLCV bars**, continuous (contract rolls already stitched). Columns:
  `datetime, symbol, o, h, l, c, v`.
- **All timestamps are CST, tz-naive** (house convention: ET = CST + 1 hour).
- Coverage 2021-01-03 17:00 → 2025-12-31 15:59, including overnight Globex sessions
  (each trading day starts 17:00 CST the prior calendar day). 2023–2025 regular-hours
  sessions are complete (773 sessions, verified in the source system).
- 1 minute is the **finest data that exists** for this window — no ticks, no bid/ask.
  Every timeframe we test (hourly, twice-daily, daily, weekly) is aggregated up from
  these bars, so one dataset serves all timeframes.
- The micros track the indexes tick-for-tick for pattern purposes; MES stands in for
  S&P 500 / ES, MNQ for Nasdaq-100 / NQ.

## 3.5 The whole machine (Mike ratified 2026-07-30) — and the locked news stack

How the end system works, simplest form:

**INPUTS (what goes in)**
- The news, right now, from whatever sources are checked (APIs / limited web search)
- Today's calendar of scheduled releases (CPI, Fed, jobs...)
- Current ES & NQ prices
- **The pattern book** — the thing the backtest builds: "this type of news → this type
  of move, this often, this size, this direction," plus the in/out numbers per event
  type (how far it runs, where the stop goes, how long to hold)

**MIDDLE (what the AI does with it)**
- Reads the incoming news and matches it against the pattern book — direct hit ("Fed
  speaks") or arm ("Chinese chip IPO → US semis → Nasdaq")
- Decides: does this look like a real event forming? Which direction, expected size
- If yes, pulls the in/out numbers for that event type from the book

**OUTPUTS (what you see — a trade card, or "no trade")**
- **Get in:** now / at the open / at level X
- **Direction:** long or short, ES or NQ or both
- **Stop:** level and $ per contract (from the measured pull-against)
- **Get out:** target level and/or "typically peaks in ~70 minutes — don't overstay"
- **Confidence 0–5** — anchored to how often this pattern actually worked
- **Why:** the one line of news and the pattern it matched
- Silence otherwise — no card, no trade, no noise

**Where the backtest fits:** everything above hinges on the pattern book being real.
2023 writes it (news + events + in/out numbers), 2024 tweaks it one idea at a time,
2025 proves the whole loop end-to-end. Then it runs live on today's news.

**The locked news stack (four feeds, locked "for now" 2026-07-30 — live-verified):**

| Feed | Cell it covers | Job | Cost |
|---|---|---|---|
| FMP Starter | Scheduled + past (and live) | Economic calendar with expected vs actual per release, 2023-25 — the surprise measurement the pattern book runs on | $22/mo billed annually = $264/yr (the only paid item; key pending Mike's signup) |
| GDELT | Unscheduled + past | Timestamped headline archive 2023-25, filtered to the chosen site list — explains the non-calendar half of the event list (SVB, CXMT-type arms) | Free |
| ForexFactory weekly JSON feed (nfs.faireconomy.media) | Scheduled + now | Live week-ahead calendar (forecast/previous/impact) in the FF format Mike knows; redundancy/cross-check for FMP's live calendar, and fallback | Free |
| AI web search (already in the app) | Unscheduled + now | Live headlines and arms-chasing at briefing/trade-card time; not used by the backtest | Free with subscriptions |

The logic: two kinds of news (scheduled vs unscheduled) × two time directions (past for
the backtest, now for live) = four cells, one feed per cell. The true backtest minimum
is FMP + GDELT; FF is deliberate redundancy; AI search is the live side already built.
Rejected on live-verified pricing: Finnhub ($3,500/mo tier, no calendar on free),
EODHD ($99.99/mo bundle), Tiingo (3-month news history), Alpha Vantage (25 req/day).
Benched, not rejected: Benzinga newsfeed via the Polygon/Massive reseller at $99/mo —
in budget, wake condition: the explanation table shows company-headline gaps that
GDELT + AI search cannot fill, and its history depth verifies. Benzinga Pro (~$2k/yr)
is the human terminal with no API — not a system feed.

## 4. News data — the hard part, and the pluggable source design

Prices are solved; historical news is not. The arena needs news **as it looked at the
time**, with real timestamps, not today's rewritten summaries of old events.

Selectable news sources (same idea as the app's Connections screen — pick a source,
provide access info, everything downstream is source-agnostic):

| Source | Type | What it gives us | Cost |
|--------|------|------------------|------|
| Trading Economics | API | Economic calendar history: every CPI/FOMC/jobs release with scheduled time, expected, actual | API key, paid tiers |
| Benzinga | API | Timestamped historical news headlines/bodies, tickers tagged | Paid |
| GDELT | Free bulk | Global news metadata every 15 min back beyond 2023 | Free |
| AI web search | Live | Convenient but sees today's internet — weakest for backtesting (see §6) | Per-call |

**The framework is built** (`engine/news_sources/`): a registry of selectable source
adapters (`trading_economics`, `benzinga`, `web_search`), one normalized schema
(`timestamp_cst, source, category, headline, body, tickers, meta(json)`), a
point-in-time cut (`as_of`) that enforces no-forward-bias in code, and embedded API
settings per source in `data/news/access.json` (git-ignored; template committed as
`access.example.json`). Activating a source = Mike picks it, key goes in the config,
one `fetch()` gets implemented. Web search can be general but carries per-site
on/off limiters (the only repeatability control we have) plus an unrestricted
comparison mode to see what limiting changes — comparison runs are never scored
runs (Mike's concept — see CONCEPTS.md §5).

Source selection itself is deferred by Mike — to be discussed later. Standing
recommendation: Trading Economics calendar first; Benzinga when company-level
headlines are needed.

## 5. The engine — three stages

### Stage 1: Move detector (prices only, no AI, no news)
Scan MES/MNQ per timeframe and emit a catalog of **events**: dips, spikes, opening gaps,
range expansions. Configurable per timeframe, e.g.:

- Hourly: |move| ≥ X% within 60 min
- Twice-daily: open→midday and midday→close legs
- Daily: close→close, plus overnight gap (prior 15:00 close → 08:30 open, CST)
- Weekly: Friday close → Friday close, plus the Sunday 17:00 reopen gap

Output: `results/moves/<symbol>_moves.parquet` (all timeframe kinds in one file, `kind`
column) — every move with timestamps, direction, size, trailing-2-year 95th-percentile
threshold, and a significance flag. Deterministic, cheap, re-runnable. **Built** —
`engine/detect_moves.py`.

### Stage 2: Event matcher (news + moves, still no AI)
Join the news table to the move catalog: what was published/scheduled in the window
before each move, and what did the market do after each news item. Pure mechanics —
this alone answers "do CPI misses gap the open?" style questions and is where the first
patterns will show.

**Attribution supports direct AND arms** (Mike's concept — CONCEPTS.md §4): some news
is direct (the Fed speaking; earnings can be), other news acts through indirect chains,
possibly several at once (CXMT IPO → US memory shortage → US semis hit → Nasdaq drops —
one arm of possibly many simultaneous). The matcher records a direct attribution when
the link is direct, and candidate contributing arms with levels when it is not — it
never forces one shape onto every case.

### Stage 3: Prompt evaluator (the AI arena)
For each candidate prompt and each historical decision point:

1. Assemble the prompt with **only** the news available up to that timestamp.
2. AI answers the fixed contract: direction, expansion yes/no, gap yes/no, severity 0–5.
3. Score against what actually happened (from Stage 1): direction hit rate, gap hit
   rate, severity-vs-realized-move calibration, and a simple simulated P&L per timeframe.
4. Every run is logged to `results/runs/` with the exact prompt, news given, answer,
   and score — nothing is a black box.

Prompts compete on 2023, survivors get tuned on 2024, one champion runs 2025.

## 6. The honesty section — AI leakage (must read)

Any current AI model was trained on the internet and **already knows what markets did in
2023–2025**. Asked "NVDA reports tomorrow (May 24 2023) — direction?", it may be
*remembering*, not *predicting*. This can silently inflate every backtest score.

Controls we adopt:

1. **Mechanics before AI.** Stages 1–2 are AI-free; patterns found there are real.
2. **Blind the prompts.** Strip dates/years where feasible; present news text without
   identifying the era. Imperfect but reduces recall.
3. **Score the calibration, not just the hits.** A model recalling outcomes tends to be
   overconfident everywhere; a genuine signal shows dose-response (higher severity →
   bigger realized moves).
4. **Label the ceiling honestly.** The 2025 result is an upper bound. The only clean
   test is forward: run the champion prompt live on 2026 data it cannot have seen.
   The arena's endgame is exactly that handoff.

## 7. Dashboard + chat access

- **Dashboard:** a **Backtest tab in the Local app** (Mike's ruling 2026-07-29 — reuse
  the existing dashboard, don't reinvent it). The Local dev server serves
  `Backtesting/results/` read-only at `/backtesting/`, and the tab renders
  `results/summary.json`: phase status, pattern/prompt leaderboards, hit rates by
  timeframe, calibration, 2023/2024/2025 side by side. The tab renders whatever
  sections `summary.json` contains, so the engine can grow without app changes.
  Local-only by design: the results live on this machine, and the customer-facing
  Netlify app must not carry the R&D arena — this tab is an explicit exception to the
  feature-parity rule (noted in the root README).
- **Chat:** every engine run also writes plain-Markdown summaries into `results/` so any
  AI session pointed at this folder can answer "how did prompt v3 do on 2024?" by reading
  files — no special tooling.

## 8. Folder layout

```text
Backtesting/
├── README.md            # entry point, points here
├── docs/
│   └── DESIGN.md        # this document
├── data/
│   ├── prices/          # the two 1-minute Parquet files + README (schema/provenance)
│   └── news/            # normalized news tables per source (populated later)
├── engine/
│   ├── load_prices.py   # canonical loader + timeframe aggregation (exists)
│   ├── make_summary.py  # regenerates results/summary.json + SUMMARY.md (exists)
│   └── ...              # move detector, event matcher, prompt evaluator (next)
└── results/
    ├── moves/           # Stage 1 output
    ├── runs/            # Stage 3 logs
    ├── summary.json     # feed for the Local app's Backtest tab
    └── SUMMARY.md       # chat-readable summary
```

The dashboard is the Local app's Backtest tab (§7) — there is no separate dashboard folder.

## 9. Open decisions for Mike

1. News source to start with (recommendation: Trading Economics calendar — §4).
2. Move thresholds per timeframe (defaults will be proposed with Stage 1 code).
3. Prompt vs algo vs combination — deliberately deferred until 2023 patterns are on the
   table, per his instruction.

## 10. Build status (2026-07-30)

BUILT and verified:
1. Stage 1 move detector (`detect_moves.py`) + trade-guidance enrichment (`enrich_events.py`).
2. Event identification + pattern reports (`identify_events.py`).
3. The arena scoring harness (`arena.py`): point-in-time replays, prediction contract,
   scoring, run manifests with required hypotheses, 2025 seal. Mock baselines measured
   on 2023 (momentum ≈ coin flip on direction — the floor to beat).
4. AI bridge (`ai_bridge.py`): mock providers + Claude/Codex subscription CLIs.
5. Explanation-table builder (`build_explanations.py`) — machinery proven by selftest;
   waits on a news source for real input.
6. Pattern book (`build_pattern_book.py`) — price patterns filled; news tiers pending.
7. Backtest tab: results, arena runs, pattern book, and an Arena Settings panel
   (event definition, thresholds, severity bands, source checkboxes, engine re-run).

REMAINING:
- News source activation (Mike's decision) → real explanation table → news tiers.
- Real prompt candidates through the arena (2023 first), then the 2024 tweak loop.
- The live trade-card generator — only after 2025 passes.
