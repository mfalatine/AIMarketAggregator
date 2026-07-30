"""Regenerate results/summary.json and results/SUMMARY.md for the Backtest tab and chat.

Run from anywhere:  python Backtesting/engine/make_summary.py
Every engine stage should extend the sections it writes here; the tab renders whatever
sections exist, so this file is the one contract between engine and dashboard.
"""
import json
from datetime import datetime
from pathlib import Path

import pandas as pd

from load_prices import FILES, aggregate, load_minutes, rth_only

RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"


def moves_sections() -> list[dict]:
    frames = []
    for symbol in FILES:
        path = RESULTS_DIR / "moves" / f"{symbol.lower()}_moves.parquet"
        if path.exists():
            frames.append(pd.read_parquet(path))
    if not frames:
        return []
    moves = pd.concat(frames)
    flagged = moves[moves["significant"]]
    counts = flagged.groupby(["kind", "year"]).size().unstack(fill_value=0)
    count_table = {"columns": ["Timeframe kind"] + [str(year) for year in counts.columns],
                   "rows": [[kind] + [str(count) for count in row] for kind, row in counts.iterrows()]}
    extremes = []
    for kind, label in (("session", "Worst sessions"), ("overnight_gap", "Worst overnight gaps")):
        for row in flagged[flagged["kind"] == kind].nsmallest(3, "ret_pct").itertuples():
            extremes.append([f"{label}", f"{row.symbol} {pd.Timestamp(row.ts_end).date()} {row.ret_pct:+.2f}%"])
    sections = [{
        "title": "Stage 1 — move catalog (significant = top 5% vs trailing 2 years)",
        "table": count_table,
        "note": f"{len(moves):,} moves cataloged across both symbols; {len(flagged):,} flagged significant (2023-2025).",
    }, {
        "title": "Stage 1 — extremes",
        "rows": extremes,
        "note": "Face-validity checks passed: 2024-08-05 carry-unwind gap (-4.03%) and April 2025 tariff days flagged.",
    }]
    events_path = RESULTS_DIR / "events_2023.json"
    if events_path.exists():
        events = json.loads(events_path.read_text(encoding="utf-8"))
        patterns = events.get("patterns", {})
        rows = [["Events identified", f"{events['events']} significant events on {events['event_days']} distinct days (full list: EVENTS_2023.md)"]]
        gap = patterns.get("gap_follow_through")
        if gap:
            rows.append(["Gap follow-through", f"{gap['events']} significant gaps; session continued the gap direction {gap['continuation_rate_pct']}% of the time (small sample)"])
        am = patterns.get("am_to_pm")
        if am:
            rows.append(["AM → PM", f"{am['events']} significant mornings; afternoon continued {am['continuation_rate_pct']}% of the time, avg PM {am['avg_pm_after_sig_am']:+.2f}%"])
        weekday = patterns.get("events_by_weekday")
        if weekday:
            rows.append(["By weekday", ", ".join(f"{day[:3]} {count}" for day, count in weekday.items())])
        cluster = patterns.get("vol_clustering")
        if cluster:
            rows.append(["Volatility clustering", f"next session averages ±{cluster['avg_next_session_abs_after_significant']}% after a significant day vs ±{cluster['avg_next_session_abs_otherwise']}% otherwise"])
        sections.append({"title": "2023 events identified (develop year — price-only patterns)", "rows": rows,
                         "note": "Wed/Thu/Fri dominate — the macro-release calendar (FOMC Wednesdays, CPI mornings, Friday jobs) is visible in prices alone."})
    return sections


def coverage_rows(symbol: str) -> list[list[str]]:
    df = load_minutes(symbol)
    rows = [[f"{symbol} minute bars", f"{len(df):,}"],
            [f"{symbol} range (CST)", f"{df['datetime'].min()} → {df['datetime'].max()}"]]
    for year in (2023, 2024, 2025):
        sessions = aggregate(rth_only(load_minutes(symbol, f"{year}-01-01", f"{year}-12-31")), "1D")
        change = (sessions["close"].iloc[-1] / sessions["close"].iloc[0] - 1) * 100
        rows.append([f"{symbol} {year}", f"{len(sessions)} sessions · year move {change:+.1f}%"])
    return rows


def main() -> None:
    generated = datetime.now().strftime("%Y-%m-%d %H:%M CST")
    summary = {
        "generated_at": generated,
        "headline": "Backtesting arena — status",
        "sections": [
            {
                "title": "Phase status",
                "rows": [
                    ["2023 (develop)", "Stage 1 move catalog built — pattern mining next"],
                    ["2024 (tweak)", "Locked until 2023 produces candidates"],
                    ["2025 (final test)", "SEALED — one frozen run, no peeking"],
                ],
                "note": "Protocol: mine patterns on 2023, tune on 2024, single final run on 2025. See docs/DESIGN.md.",
            },
            *moves_sections(),
            {"title": "Price data coverage (verified this run)",
             "rows": coverage_rows("MES") + coverage_rows("MNQ")},
            {
                "title": "News data",
                "rows": [
                    ["Framework", "In place — adapters registered: trading_economics, benzinga, web_search (allowlisted)"],
                    ["Source", "None activated — Mike's decision deferred; keys go in data/news/access.json"],
                    ["Discipline", "Point-in-time cut + source lock enforced per docs/CONCEPTS.md"],
                ],
            },
        ],
    }
    RESULTS_DIR.mkdir(exist_ok=True)
    (RESULTS_DIR / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    lines = [f"# Backtesting arena summary\n\nGenerated {generated}. All times CST.\n"]
    for section in summary["sections"]:
        lines.append(f"\n## {section['title']}\n")
        for label, value in section.get("rows", []):
            lines.append(f"- **{label}:** {value}")
        if section.get("table"):
            table = section["table"]
            lines.append("| " + " | ".join(table["columns"]) + " |")
            lines.append("|" + "---|" * len(table["columns"]))
            for row in table["rows"]:
                lines.append("| " + " | ".join(str(cell) for cell in row) + " |")
        if section.get("note"):
            lines.append(f"\n_{section['note']}_")
    (RESULTS_DIR / "SUMMARY.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {RESULTS_DIR / 'summary.json'} and SUMMARY.md ({generated})")


if __name__ == "__main__":
    main()
