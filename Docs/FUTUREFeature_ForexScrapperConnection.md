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

**Exploratory** — This is a future possibility, not committed for MVP. The ForexFactory Scraper is already running and the API is available. Integration would be a relatively light lift when ready.
