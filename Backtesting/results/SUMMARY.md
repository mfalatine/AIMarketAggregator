# Backtesting arena summary

Generated 2026-07-29 22:47 CST. All times CST.


## Phase status

- **2023 (develop):** Not started — awaiting Stage 1 move detector
- **2024 (tweak):** Locked until 2023 produces candidates
- **2025 (final test):** SEALED — one frozen run, no peeking

_Protocol: mine patterns on 2023, tune on 2024, single final run on 2025. See docs/DESIGN.md._

## Price data coverage (verified this run)

- **MES minute bars:** 1,767,965
- **MES range (CST):** 2021-01-03 17:00:00 → 2025-12-31 15:59:00
- **MES 2023:** 257 sessions · year move +25.3%
- **MES 2024:** 259 sessions · year move +24.0%
- **MES 2025:** 257 sessions · year move +16.5%
- **MNQ minute bars:** 1,768,695
- **MNQ range (CST):** 2021-01-03 17:00:00 → 2025-12-31 15:59:00
- **MNQ 2023:** 257 sessions · year move +55.5%
- **MNQ 2024:** 259 sessions · year move +26.9%
- **MNQ 2025:** 257 sessions · year move +20.2%

## News data

- **Framework:** In place — adapters registered: trading_economics, benzinga, web_search (allowlisted)
- **Source:** None activated — Mike's decision deferred; keys go in data/news/access.json
- **Discipline:** Point-in-time cut + source lock enforced per docs/OPERATOR_CONCEPTS.md
