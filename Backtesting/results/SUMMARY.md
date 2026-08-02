# Backtesting arena summary

Generated 2026-08-01 22:43 CST. All times CST.


## Phase status

- **2023 (develop):** Stage 1 move catalog built — pattern mining next
- **2024 (tweak):** Locked until 2023 produces candidates
- **2025 (final test):** SEALED — one frozen run, no peeking

_Protocol: mine patterns on 2023, tune on 2024, single final run on 2025. See docs/DESIGN.md._

## Stage 1 — spikes/drops per the active event definition

- **Definition mode (variable — test it):** magnitude (magnitude | percentile | either | both) — engine/detection_config.json
- **Magnitude settings:** session 1%, overnight_gap 0.5%, am_leg 0.75%, pm_leg 0.75%, hour 0.5%, week 2%, sunday_gap 0.5%
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

## Trade guidance — 2023 short-list events (entry at event end, in its direction)

| Kind | Events | Closed favorable | Median MFE | Median MAE | Median time to peak | Median MAE $/contract |
|---|---|---|---|---|---|---|
| am_leg | 9 | 6 of 9 | 0.62% | 0.10% | 147 min | $26 |
| hour | 44 | 27 of 44 | 0.45% | 0.28% | 70 min | $64 |
| overnight_gap | 8 | 6 of 8 | 0.54% | 0.63% | 240 min | $178 |
| session | 4 | 1 of 4 | 0.73% | 1.22% | 1114 min | $305 |
| sunday_gap | 8 | 6 of 8 | 0.81% | 0.27% | 988 min | $72 |
| week | 3 | 3 of 3 | 2.84% | 0.47% | 10068 min | $104 |

_MFE = max run in your favor to the horizon; MAE = max pull against you (stop-distance guide, dollarized per micro contract). News attribution pending the source decision._

## Pattern book — 2023 price patterns (news tiers pending)

| Kind | Dir | Events | Kept going | Reversed | Med MFE | Med MAE | Med peak | MAE $/ct |
|---|---|---|---|---|---|---|---|---|
| am_leg | down | 43 | 24 | 19 | 0.28% | 0.45% | 127m | $110 |
| am_leg | up | 63 | 38 | 25 | 0.37% | 0.29% | 135m | $69 |
| hour | down | 160 | 89 | 71 | 0.42% | 0.38% | 71m | $90 |
| hour | up | 159 | 96 | 63 | 0.49% | 0.3% | 87m | $82 |
| overnight_gap | down | 79 | 27 | 52 | 0.5% | 0.61% | 95m | $160 |
| overnight_gap | up | 93 | 50 | 43 | 0.55% | 0.58% | 129m | $146 |
| session | down | 47 | 18 | 29 | 0.54% | 1.0% | 1186m | $242 |
| session | up | 68 | 38 | 30 | 0.75% | 0.52% | 1216m | $120 |
| sunday_gap | down | 1 | 0 | 1 | 0.48% | 1.29% | 562m | $279 |
| sunday_gap | up | 9 | 6 | 3 | 0.68% | 0.35% | 934m | $102 |
| week | down | 15 | 5 | 10 | 0.9% | 2.3% | 7063m | $577 |
| week | up | 26 | 15 | 11 | 1.38% | 1.58% | 6836m | $366 |

_Generated 2026-07-30 18:25 CST under mode 'magnitude'. Full file: PATTERN_BOOK.md._

## Arena runs — scored replays (point-in-time)

| Phase | Provider | Hypothesis | Days | Direction | Expansion | Gap | Severity ±1 |
|---|---|---|---|---|---|---|---|
| 2023 | claude | first real-AI baseline: price-context only, 2023 open book, vs mock floors | 40 | 21/40 | 20/40 | 21/40 | 24/40 |
| 2023 | mock-flat | harness smoke: null baseline | 257 | 2/257 | 218/257 | 186/257 | 146/257 |
| 2023 | mock-momentum | harness smoke: momentum baseline | 257 | 129/257 | 193/257 | 167/257 | 168/257 |

_Every run's full manifest, per-day records, and prompt live in results/runs/<run_id>/._

## 2023 events identified (develop year — outcome counts)

- **Events identified:** 581 spikes/drops on 209 distinct days (full list: EVENTS_2023.md)
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

## News data — actually banked

- **av_2023_events:** 68 rows · 6 event days
- **gdelt_2023_events:** 8,452 rows · 44 event days
- **nasdaq_calendar_2021_2025:** 9,456 rows · 2021-01-01 .. 2021-09-13
- **nasdaq calendar pull:** 226/1,826 event dates fetched (nightly 00:30)
- **explanation table:** 29,886 event-news candidate pairs (attribution unlabeled)
- **calendar validation:** Verdict on stored range: PASS — 8 passed, 0 failed, 3 skipped (outside pulled range).

_Free sources only (Nasdaq calendar, GDELT, Alpha Vantage, FF feed, AI search). Spend to date: $0._
