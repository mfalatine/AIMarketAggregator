# Backtesting arena summary

Generated 2026-07-30 00:00 CST. All times CST.


## Phase status

- **2023 (develop):** Stage 1 move catalog built — pattern mining next
- **2024 (tweak):** Locked until 2023 produces candidates
- **2025 (final test):** SEALED — one frozen run, no peeking

_Protocol: mine patterns on 2023, tune on 2024, single final run on 2025. See docs/DESIGN.md._

## Stage 1 — move catalog (significant = top 5% vs trailing 2 years)

| Timeframe kind | 2023 | 2024 | 2025 |
|---|---|---|---|
| am_leg | 9 | 8 | 28 |
| hour | 48 | 60 | 256 |
| overnight_gap | 8 | 10 | 73 |
| pm_leg | 7 | 11 | 26 |
| session | 4 | 4 | 30 |
| sunday_gap | 2 | 0 | 9 |
| week | 3 | 0 | 8 |

_29,112 moves cataloged across both symbols; 604 flagged significant (2023-2025)._

## Stage 1 — extremes

- **Worst sessions:** MNQ 2025-04-08 -5.75%
- **Worst sessions:** MES 2025-04-08 -5.22%
- **Worst sessions:** MNQ 2025-10-10 -4.53%
- **Worst overnight gaps:** MNQ 2024-08-05 -5.38%
- **Worst overnight gaps:** MES 2024-08-05 -4.03%
- **Worst overnight gaps:** MNQ 2025-04-04 -3.93%

_Face-validity checks passed: 2024-08-05 carry-unwind gap (-4.03%) and April 2025 tariff days flagged._

## 2023 events identified (develop year — price-only patterns)

- **Events identified:** 54 significant events on 40 distinct days (full list: EVENTS_2023.md)
- **Gap follow-through:** 8 significant gaps; session continued the gap direction 75.0% of the time (small sample)
- **AM → PM:** 9 significant mornings; afternoon continued 66.7% of the time, avg PM -0.02%
- **By weekday:** Mon 7, Tue 10, Wed 19, Thu 22, Fri 21, Sun 2
- **Volatility clustering:** next session averages ±0.8% after a significant day vs ±0.64% otherwise

_Wed/Thu/Fri dominate — the macro-release calendar (FOMC Wednesdays, CPI mornings, Friday jobs) is visible in prices alone._

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
- **Discipline:** Point-in-time cut + source lock enforced per docs/CONCEPTS.md
