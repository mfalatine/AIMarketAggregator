# Future Feature: ForexFactory Scraper Connection

## Context

There is an existing project at `C:\Users\micha\source\repos\ForexFactoryScraper` that scrapes live economic calendar data from ForexFactory.com. It's already deployed as a Netlify serverless function at `https://forexfactoryscrape.netlify.app`. This document explores the possibility of connecting it to AI Market Aggregator to enhance briefing quality.

---

## What the ForexFactory Scraper Does

- Scrapes **economic calendar events** from ForexFactory (a widely-used forex/macro event calendar)
- Captures **24+ fields per event** including: date, time, currency, event name, impact level (High/Medium/Low), actual value, forecast, previous value, better/worse indicator, and more
- Covers **10 event categories**: Growth, Inflation, Employment, Central Bank, Bonds, Housing, Consumer Surveys, Business Surveys, Speeches, Misc
- Filters by **impact level**, **event type**, and **currency** (USD, EUR, GBP, JPY, etc.)
- Returns structured **JSON or CSV** via API
- Already live and hosted on Netlify — no additional infrastructure needed

### API Example

```text
https://forexfactoryscrape.netlify.app/.netlify/functions/scrape?day=feb07.2025&format=json&permalink=true&impacts=3,2
```

Returns all High and Medium impact events for that day as structured JSON.

---

## The Idea

Instead of relying solely on Claude's web search to find upcoming economic events, **pre-feed the scraper's structured data into the prompt**. This would give Claude deterministic, complete event data to work with rather than hoping web search finds everything.

### How It Could Work

1. Before building the prompt, the app calls the ForexFactory Scraper API for today's (and/or this week's) events
2. Filter for High + Medium impact events (the ones that actually move markets)
3. Inject the structured event list into the prompt as context
4. Claude then uses this **confirmed event data** + web search for everything else (sentiment, analysis, watchlist news)

### Example Prompt Injection

```text
ECONOMIC CALENDAR DATA (confirmed from ForexFactory):
- Feb 7, 8:30 AM ET | USD | Non-Farm Payrolls | Impact: HIGH | Forecast: 170K | Previous: 256K
- Feb 7, 8:30 AM ET | USD | Unemployment Rate | Impact: HIGH | Forecast: 4.1% | Previous: 4.1%
- Feb 7, 10:00 AM ET | USD | Michigan Consumer Sentiment | Impact: MEDIUM | Forecast: 71.1 | Previous: 71.1

Use this confirmed data as the foundation for the Economic Calendar section. Search the web for additional context, market reaction expectations, and any late-breaking changes.
```

---

## Benefits

- **No more missed events** — the scraper captures everything on the ForexFactory calendar, Claude's web search might miss some
- **Confirmed data vs search results** — actual/forecast/previous values come from a structured source, not scraped from random articles
- **Better prompt grounding** — Claude has concrete data to analyze rather than searching from scratch
- **Aligns with existing requirements** — the app already has an "Economic Calendar & Data Releases" topic with prompt hint "List upcoming releases this week with expected vs prior values" — this would feed that topic directly

---

## Integration Options

### Option 1: Client-Side Fetch (Simplest)

- Browser JS calls the scraper API directly before prompt assembly
- Inject results into the prompt text
- **Pros:** No architecture changes, the scraper already has CORS enabled
- **Cons:** Adds a network call before each briefing generation

### Option 2: Admin-Configurable Data Source

- Add a "Data Sources" section in Admin where users can configure external API endpoints
- ForexFactory Scraper would be the first one
- Each data source has: URL template, enabled/disabled toggle, which topic it feeds into
- **Pros:** Extensible for other data sources later
- **Cons:** More UI/config work

### Option 3: Toggle on Dashboard

- Simple checkbox: "☑ Include ForexFactory calendar data"
- When checked, fetches event data and prepends it to the prompt
- **Pros:** Simple UX, user controls when to use it
- **Cons:** Less flexible than Option 2

---

## What's NOT Worked Out Yet

- Exact prompt format for injecting the event data (how verbose, what fields to include)
- Whether to fetch today only, this week, or let the user choose
- How to handle the scraper being down or slow (timeout, fallback to web search only)
- Whether this should replace the "Economic Calendar" topic's web search or supplement it
- Cost impact — adding structured data to the prompt increases input tokens slightly

---

## Scraper API Reference

| Parameter | Example | Description |
| ---------- | ------- | ----------- |
| `day` | `feb07.2025` | Specific day |
| `week` | `feb03.2025` | Week starting date |
| `month` | `feb01.2025` | Full month |
| `start` | `2025-02-07` | Range start (fetches 7 days) |
| `format` | `json` or `csv` | Output format |
| `impacts` | `3,2` | 3=High, 2=Medium, 1=Low |
| `currencies` | `1` | 1=USD (most relevant for S&P 500 focus) |
| `permalink` | `true` | Required parameter |

---

## Status

**Exploratory** — This is a future possibility, not committed for MVP. ~~The ForexFactory Scraper is already running and the API is available.~~ **UPDATE 2026-07-31: the FF scraper is broken — ForexFactory's bot protection blocks it (aftermath of the 108k-requests/day flood incident). The retrofit plan below supersedes the original integration idea.**

---

## Retrofit options — recorded 2026-07-31 (Mike: "different ways to skin a cat, record them all")

Goal: revive the scraper site's interface (day/week/month queries, impact/currency filters, JSON/CSV out, key gate) on a new upstream — Nasdaq's unofficial economic calendar (verified 2026-07-31: actual + consensus + previous, history to at least 2021; AMA has pulled/is pulling the 2021-2025 archive). This work belongs to a separate chat/project; AMA records the options and shares components.

**Decide-first test:** one call to `api.nasdaq.com/api/calendar/economicevents` from a Netlify function. Datacenter IPs may be blocked where residential IPs pass — this single test picks the architecture.

| # | Option | How it works | Trade-offs |
|---|---|---|---|
| 1 | **Cloud-direct (Netlify function)** | Site fetches Nasdaq itself, as the old scraper did FF | Only if the datacenter-IP test passes; zero infrastructure; same fragility class as before |
| 2 | **Local puller + static site** | Mike's always-on box (already runs dai_server 24/7) pulls politely and pushes JSON; Netlify serves cached data, never calls Nasdaq | No IP problem; site can never get the source banned; goes stale (not down) when the box is off; resumable backfill |
| 3 | **Per-user local, AMA-style** | Each user runs the fetcher on their own machine (their residential IP), like AMA's Local app runs its own server; no central service to ban | Best ban-resistance; pushes setup burden to each user — needs the same packaged-setup story AMA needs (exe + first-run setup) |
| 4 | **Cloud virtual desktop as puller** | A persistent VDI (residential-like environment) runs the puller | Machine-independent; **cost risk if left always-on** — would need scheduled wake/pull/sleep to stay cheap |
| 5 | **Hybrid degrade path** | FF's official weekly feed (nfs.faireconomy.media — CDN file, fetchable from anywhere, no bot wall) keeps the forward-looking week fresh from the cloud; actuals fill in via whichever puller (2/3/4) runs | Site degrades gracefully instead of breaking — forward calendar always live, actuals possibly delayed |
| 6 | **Fold into AMA as a Calendar tab** (Mike's idea 2026-07-31) | No standalone site at all: the scraper's interface (day/week/month, impact/currency filters) is reskinned as an AMA tab over data the repo already holds — 5-year history ships as a static bundled file (works even in the Netlify app), forward week from FF's CDN feed, live actuals polling on Local only | Imports nothing (archive/puller/schema/mapping already in-repo); kills the separate site, its hosting, and its key-gate exposure; verified 2026-07-31: nothing else consumes the old site's API. Decision pending alongside options 1-5 |

**Reference plate (Mike's correction 2026-07-31):** the scraper's code is NOT
mostly discardable — the functionality was the hard part. It serves at minimum as
the reference plate, probably more including how it works: event crawling/parsing
(`eventcrawler.js`), event categorization (`EventTypes.csv`), the filter/query API
design, and the field semantics. A full copy lives in this repo at
`Reference/ForexFactoryScraper/` (2026-07-31) to be mined during the retrofit.

**Common components with AMA (build once, share):**
- The normalized calendar schema and two-timestamp point-in-time contract (`Backtesting/engine/news_sources/base.py`) — one format for the site, the arena, and the app.
- The pulled 2021-2025 Nasdaq archive + the polite resumable puller (`Backtesting/engine/pull_nasdaq_calendar.py`) — the site's history section is already fetched.
- The impact mapping (Nasdaq has no High/Med/Low — a one-time curated event-name → impact-tier table serves both the site and AMA's Tier-1 event list).
- The key-gate lockdown pattern (post-hack) — the site stays private-by-key, as does AMA's key handling (git-ignored config, keys never client-side).
- The deployment/setup story: Mike's requirement that every deployment mode (his local, another user's packaged local, cloud) has a clean first-run setup applies to both apps.
