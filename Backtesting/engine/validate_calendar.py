"""Validate the compacted Nasdaq calendar against OFFICIAL known figures.

Ground truth below is from official BLS/Fed releases (as-released values, which is
what a point-in-time calendar must show). Each fact checks three things at once:
the release EXISTS, the VALUE matches, and the TIMESTAMP lands where the official
release happened (07:30 CST for BLS mornings, 13:00 CST for FOMC) — which also
proves the -2h display-offset correction.

Facts outside the currently pulled range are reported as SKIPPED, so this script
is rerun after every pull session and at final completion (task #3).
Writes results/CALENDAR_VALIDATION.md. Run: python Backtesting/engine/validate_calendar.py
"""
from pathlib import Path

import pandas as pd

PARQUET = Path(__file__).resolve().parent.parent / "data" / "news" / "nasdaq_calendar_2021_2025.parquet"
RESULTS = Path(__file__).resolve().parent.parent / "results"

# (release datetime CST, event contains, actual must contain, label)
FACTS = [
    ("2021-05-07 07:30", "Nonfarm Payrolls", "266", "Apr-2021 NFP miss (+266K vs ~1M expected)"),
    ("2021-05-07 07:30", "Unemployment Rate", "6.1", "Apr-2021 unemployment 6.1%"),
    ("2021-05-12 07:30", "Core CPI", "0.9", "Apr-2021 Core CPI shock 0.9% MoM"),
    ("2021-06-04 07:30", "Nonfarm Payrolls", "559", "May-2021 NFP +559K"),
    ("2021-06-10 07:30", "CPI", "5.0", "May-2021 CPI 5.0% YoY"),
    ("2021-06-16 13:00", "Interest Rate Decision", "0.25", "Jun-2021 FOMC hold at 0.25%"),
    ("2021-07-02 07:30", "Nonfarm Payrolls", "850", "Jun-2021 NFP +850K"),
    ("2021-08-06 07:30", "Nonfarm Payrolls", "943", "Jul-2021 NFP +943K"),
    ("2023-03-10 07:30", "Nonfarm Payrolls", "311", "Feb-2023 NFP +311K vs 205K consensus"),
    ("2023-06-13 07:30", "CPI", "4.0", "May-2023 CPI 4.0% YoY"),
    ("2025-01-29 13:00", "Interest Rate Decision", "4.5", "Jan-2025 FOMC hold at 4.5%"),
]


def main() -> None:
    frame = pd.read_parquet(PARQUET)
    us = frame[frame["country"] == "United States"]
    lines = [f"# Calendar validation — run over {us['event_at_cst'].dt.date.nunique()} stored US days "
             f"({us['event_at_cst'].min().date()} .. {us['event_at_cst'].max().date()})\n"]
    passed = failed = skipped = 0
    coverage_start, coverage_end = us["event_at_cst"].min(), us["event_at_cst"].max()
    for when, event_contains, actual_contains, label in FACTS:
        moment = pd.Timestamp(when)
        if not (coverage_start <= moment <= coverage_end):
            lines.append(f"- SKIPPED (not yet pulled): {label}")
            skipped += 1
            continue
        window = us[(us["event_at_cst"] - moment).abs() <= pd.Timedelta(minutes=1)]
        hits = window[window["event"].str.contains(event_contains, case=False, regex=False)]
        ok = hits["actual"].str.contains(actual_contains, regex=False).any() if len(hits) else False
        if ok:
            row = hits[hits["actual"].str.contains(actual_contains, regex=False)].iloc[0]
            lines.append(f"- PASS: {label} — stored actual {row['actual']!r} at {row['event_at_cst']}")
            passed += 1
        else:
            nearby = us[(us["event_at_cst"] - moment).abs() <= pd.Timedelta(hours=3)]
            nearby_named = nearby[nearby["event"].str.contains(event_contains, case=False, regex=False)]
            detail = (f"found {len(nearby_named)} same-named rows within 3h: "
                      + "; ".join(f"{r.event_at_cst} actual={r.actual!r}" for r in nearby_named.head(3).itertuples())
                      if len(nearby_named) else "no same-named row within 3h")
            lines.append(f"- FAIL: {label} — {detail}")
            failed += 1
    verdict = "PASS" if failed == 0 and passed > 0 else "FAIL"
    lines.append(f"\n**Verdict on stored range: {verdict} — {passed} passed, {failed} failed, {skipped} skipped (outside pulled range).**")
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "CALENDAR_VALIDATION.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
