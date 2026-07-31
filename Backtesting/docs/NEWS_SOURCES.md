# News possibilities — the complete list (Part One)

Compiled 2026-07-31 from live testing and research. Every source considered, its
verified status, and the recommendation. This supersedes scattered notes; DESIGN.md
§3.5 holds the four-cell architecture this feeds.

## Scheduled news (economic calendar)

| # | Source | Verified status (live-tested unless noted) | Cost | Recommendation |
|---|--------|--------------------------------------------|------|----------------|
| 1 | **Nasdaq calendar (unofficial API)** | actual+consensus+previous; history ≥2021 (NFP + Apr-2021 CPI shock verified); +1 date shift and -2h display offset handled; adapter built+tested; **bulk pull IN PROGRESS — soft-block at ~250 sustained requests discovered, sessions now 240 with auto-halt** | $0 | **PRIMARY for scheduled-past.** Finish the 4-session pull, compact to one parquet, validate vs official figures |
| 2 | **ForexFactory weekly JSON feed** (nfs.faireconomy.media) | Live: 92 events/week, forecast/previous/impact; NO actuals; forward week only | $0 | **KEEP — scheduled-now redundancy** and graceful-degrade layer; also Part Two retrofit fuel |
| 3 | FMP Starter | Calendar has estimate+actual per docs; free tier returns nothing usable (tested with Mike's key: 404/402) | $29/mo monthly, $22/mo annual | **BENCHED fallback** — wake only if Nasdaq validation fails; acceptance test written |
| 4 | EODHD calendar | Fields verified (estimate/actual/previous, history from 2020); cheapest access path unresolved ($19.99 claim vs $59.99+ per their docs) | ~$20-60/mo | **BENCHED fallback** — same acceptance test as FMP if needed |
| 5 | Official sources (BLS / Fed / BEA / FRED) | Perfect actuals + release schedules; NO consensus figures | $0 | **VALIDATION cross-check role** — the truth stick we measure Nasdaq's pull against |
| 6 | Trading Economics | Quote-based enterprise pricing | $100s/mo | REJECTED — overkill money |
| 7 | Finnhub calendar | Not on free tier (tested: 403); only paid tier is $3,500/mo | — | REJECTED |

## Unscheduled news (headlines)

| # | Source | Verified status | Cost | Recommendation |
|---|--------|-----------------|------|----------------|
| 8 | **GDELT** | Bulk 15-min files proven (SVB 2023 slice: 1,162 rows); liveness 0-min-old; caveats: discovery timestamps (~30% exact), titles/URLs not bodies, dupes — finds candidates, doesn't prove them; DOC API rate-limits bursts | $0 | **PRIMARY for unscheduled-past** via bulk files filtered to the site list |
| 9 | **Alpha Vantage NEWS_SENTIMENT** (Mike's key) | Historical ranges honored (Aug-2023 NVDA earnings verified, correct dates, sentiment scores); 25 req/day, 1,000 results/req | $0 | **SECONDARY historical headlines + sentiment** — slow pulls, complements GDELT |
| 10 | **Finnhub news** (Mike's key) | Live company+general news works; history capped ~1 yr (2023 empty) | $0 | **LIVE supplement** for unscheduled-now |
| 11 | **AI web search** (already in the app) | The app's existing live path (Anthropic/Gemini/OpenAI tools; Claude/Codex CLI) — tested via CLI, returns sourced answers | $0 w/ subscriptions | **PRIMARY for unscheduled-now**; per-site limiters for scored runs, unrestricted mode = unscored comparison only |
| 12 | Nasdaq news-by-symbol (unofficial) | Works live (tested); same fragility class as the calendar endpoint | $0 | OPTIONAL live supplement — note it exists, don't depend on it |
| 13 | Benzinga newsfeed via Polygon/Massive reseller | Real-time feed $99/mo; history depth unverified; direct Benzinga API = contact-sales (84TB archive) | $99/mo | **BENCHED** — wake: explanation table shows company-headline gaps GDELT+AV+search can't fill, and history depth verifies |
| 14 | Benzinga Pro terminal | $37-197/mo tiers ($166/mo annual ≈ Mike's $2k/yr); human terminal, NO API on any tier | ~$2k/yr | REJECTED as a system feed — feeds a human, not the machine |
| 15 | Tiingo news (Mike's key) | 403 no permission; 3-month history even when permitted | — | REJECTED for backtest use |
| 16 | RSS feeds from the site list | Untested; standard fallback | $0 | OPTIONAL later — live-side alternative if AI-search costs/limits ever bite |

## What should happen (the recommendation, in order)

1. **Finish the Nasdaq pull** (sessions 2–4, one per day) → compact to the single
   parquet → **validate against official BLS/Fed numbers**. Pass = scheduled-past
   filled at $0 and FMP/EODHD stay benched. Fail = wake the FMP $29 trial.
2. **Build the 2023 explanation table** from what's free: Nasdaq calendar rows +
   GDELT slices for the 44 event days + Alpha Vantage headlines for depth. This is
   the pattern book's news half — no spend required.
3. **Live side is already covered**: FF feed (scheduled-now) + AI search and Finnhub
   (unscheduled-now). Nothing to buy.
4. **Total current spend: $0.** Money only enters if a validation fails or a gap
   appears — and each paid option is benched with a written wake condition, not
   forgotten.

Site list (question 2) and cadence (question 3) from the earlier discussion remain
open for Mike's ruling; defaults on the table: 10 sites (Reuters, CNBC, MarketWatch,
Yahoo Finance, Bloomberg, WSJ, Investing.com, Barron's, federalreserve.gov, bls.gov)
and 15-minute polling.
