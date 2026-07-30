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
- `dashboard/` — static HTML results viewer. Later.

This folder is standalone: it shares the repo but nothing in `Local/` or `Netlify/`
depends on it, and the parity gate does not apply here.
