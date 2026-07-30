# Backtesting arena summary

Generated 2026-07-30 02:05 CST. All times CST.


## Phase status

- **2023 (develop):** Stage 1 move catalog built — pattern mining next
- **2024 (tweak):** Locked until 2023 produces candidates
- **2025 (final test):** SEALED — one frozen run, no peeking

_Protocol: mine patterns on 2023, tune on 2024, single final run on 2025. See docs/DESIGN.md._

## Stage 1 — spikes/drops per the active event definition

- **Definition mode (variable — test it):** magnitude (magnitude | percentile | either | both) — engine/detection_config.json
- **Magnitude settings:** session 1.0%, overnight_gap 0.5%, am_leg 0.75%, pm_leg 0.75%, hour 0.5%, week 2.0%, sunday_gap 0.5%
- **Percentile settings:** top 5% vs trailing 2 years
| Timeframe kind | 2023 | 2024 | 2025 |
|---|---|---|---|
| am_leg | 106 | 84 | 95 |
| hour | 334 | 256 | 368 |
| overnight_gap | 172 | 151 | 202 |
| pm_leg | 70 | 38 | 42 |
| session | 115 | 76 | 76 |
| sunday_gap | 10 | 5 | 25 |
| week | 41 | 31 | 44 |

_29,114 moves cataloged across both symbols; 5,081 qualify under the active definition. Both flags are always kept in the catalog, so switching modes never loses data._

## Stage 1 — extremes

- **Worst sessions:** MNQ 2025-04-08 -5.75%
- **Worst sessions:** MES 2025-04-08 -5.22%
- **Worst sessions:** MNQ 2025-10-10 -4.53%
- **Worst overnight gaps:** MNQ 2024-08-05 -5.38%
- **Worst overnight gaps:** MES 2024-08-05 -4.03%
- **Worst overnight gaps:** MNQ 2025-04-04 -3.93%

_Face-validity checks passed: 2024-08-05 carry-unwind gap and April 2025 tariff days are cataloged._

## 2023 events identified (develop year — outcome counts)

- **Events identified:** 495 spikes/drops on 209 distinct days (full list: EVENTS_2023.md)
- **After a gap event:** 172 gap events: session closed in the gap's direction 77, reversed 95, session was itself an event 41
- **After an AM event:** 106 AM events: PM same direction 62, opposite 44, PM was itself an event 19
- **By weekday:** Mon 105, Tue 124, Wed 168, Thu 218, Fri 223, Sun 10
- **Pointer info (not a director):** of 115 session events, 29 were followed by another session event the next day

_Counts of what actually happened, per CONCEPTS.md §7 — no averages._

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
