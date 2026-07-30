# Market AI Aggregator

This repository contains two deliberately separate applications. There is no
runtime mode switch and no shared browser storage between them. Local uses
`maa_local_*` keys and Netlify uses `maa_netlify_*` keys.

## Applications

- [`Local/`](Local/) — Codex or Claude subscription CLI only. Start it with
  `Local/MarketAIAggregator_start.bat`.
- [`Netlify/`](Netlify/) — cloud API only. Open its `index.html` directly or
  deploy the folder to Netlify; Anthropic, Gemini, and OpenAI use direct API
  key connections.

Each application owns its HTML, CSS, JavaScript, models, settings UI,
connections UI, Admin UI, build, and tests.

## Mandatory feature-parity rule

**Operator rule (2026-07-29): Local is the test bench, Netlify is the customer
handoff. Only the interfacing may differ between the two apps — how each one
connects to and talks to its AI (subscription CLI vs. cloud API). Everything
else — the processing of information, features, and behavior — must be updated
equally in both apps in the same change, so that what is verified on Local is
exactly what the customer receives on Netlify.**

**Exception (operator ruling 2026-07-29): the `Backtesting/` arena and the Local app's
Backtest tab are internal R&D. They are deliberately Local-only, excluded from the
Netlify app and from the parity rule — do not "fix" parity by adding them to Netlify.**

When a product feature applies to both applications—profiles, watchlists,
briefing layout, history, deep dives, evidence display, accessibility, themes,
or responsive behavior—the same change must be made and tested in both
folders. This rule is enforced automatically: `pnpm check` runs
`scripts/check-parity.mjs` first, which fails if `styles.css`,
`schemas/briefing.schema.json`, or `scripts/check-project.mjs` differ between
the folders, or if either committed `app.bundle.js` is stale relative to its
source. Mode-specific work stays isolated:

- CLI authentication, executable paths, and subscription models: `Local` only.
- API credentials, provider models, and API tools:
  `Netlify` only.

Run the complete repository verification with:

```powershell
pnpm install
pnpm check
```
