# Backtesting Arena

Tests whether news can predict short-term S&P 500 / Nasdaq moves, to find the best
prompt or algorithm for the customer project. Protocol: mine patterns on 2023, tune on
2024, one frozen final test on 2025.

**Read [docs/DESIGN.md](docs/DESIGN.md) first** — goal, data, engine stages, the AI
leakage caveat, and open decisions.

- `data/prices/` — 1-minute MES (S&P) and MNQ (Nasdaq) bars, 2021–2025, CST. In place, verified.
- `data/news/` — normalized news per selectable source (Trading Economics, Benzinga, …). Later.
- `engine/` — move detector → event matcher → prompt evaluator.
- `results/` — machine-readable outputs plus Markdown summaries any chat session can read.

The dashboard is the **Backtest tab in the Local app**: the Local dev server serves
`results/` read-only at `/backtesting/`, and the tab renders `results/summary.json`
(regenerate with `python Backtesting/engine/make_summary.py`).

This arena is internal R&D: Local-only, excluded from the customer-facing Netlify app
and from the feature-parity rule (see the root README).
