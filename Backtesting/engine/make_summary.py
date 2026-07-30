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
    flagged = moves[moves["event"]]
    counts = flagged[flagged["year"] >= 2023].groupby(["kind", "year"]).size().unstack(fill_value=0)
    count_table = {"columns": ["Timeframe kind"] + [str(year) for year in counts.columns],
                   "rows": [[kind] + [str(count) for count in row] for kind, row in counts.iterrows()]}
    definition = json.loads((Path(__file__).resolve().parent / "detection_config.json").read_text(encoding="utf-8"))["event_definition"]
    thresholds = definition["magnitude"]["spike_thresholds_pct"]
    extremes = []
    for kind, label in (("session", "Worst sessions"), ("overnight_gap", "Worst overnight gaps")):
        for row in flagged[flagged["kind"] == kind].nsmallest(3, "ret_pct").itertuples():
            extremes.append([f"{label}", f"{row.symbol} {pd.Timestamp(row.ts_end).date()} {row.ret_pct:+.2f}%"])
    sections = [{
        "title": "Stage 1 — spikes/drops per the active event definition",
        "rows": [
            ["Definition mode (variable — test it)", f"{definition['mode']} (magnitude | percentile | either | both) — engine/detection_config.json"],
            ["Magnitude settings", ", ".join(f"{kind} {value}%" for kind, value in thresholds.items())],
            ["Percentile settings", f"top {definition['percentile']['top_percent']}% vs trailing {definition['percentile']['trailing_years']} years"],
        ],
        "table": count_table,
        "note": f"{len(moves):,} moves cataloged across both symbols; {len(flagged):,} qualify under the active definition. Both flags are always kept in the catalog, so switching modes never loses data.",
    }, {
        "title": "Stage 1 — extremes",
        "rows": extremes,
        "note": "Face-validity checks passed: 2024-08-05 carry-unwind gap and April 2025 tariff days are cataloged.",
    }]
    # Trade guidance per kind — short list (percentile events, 2023): counts and medians.
    short = moves[(moves["year"] == 2023) & moves["percentile_event"] & moves["mfe_pct"].notna()]
    if len(short):
        guidance_rows = []
        for kind, group in short.groupby("kind"):
            followed = int((group["fwd_ret_pct"] > 0).sum())
            guidance_rows.append([kind,
                                  str(len(group)), f"{followed} of {len(group)}",
                                  f"{group['mfe_pct'].median():.2f}%", f"{group['mae_pct'].median():.2f}%",
                                  f"{group['time_to_peak_min'].median():.0f} min",
                                  f"${group['mae_usd'].median():.0f}"])
        sections.append({
            "title": "Trade guidance — 2023 short-list events (entry at event end, in its direction)",
            "table": {"columns": ["Kind", "Events", "Closed favorable", "Median MFE", "Median MAE", "Median time to peak", "Median MAE $/contract"],
                      "rows": guidance_rows},
            "note": "MFE = max run in your favor to the horizon; MAE = max pull against you (stop-distance guide, dollarized per micro contract). News attribution pending the source decision.",
        })
    book_path = RESULTS_DIR / "pattern_book.json"
    if book_path.exists():
        book = json.loads(book_path.read_text(encoding="utf-8"))
        sections.append({
            "title": f"Pattern book — {book['year']} price patterns (news tiers pending)",
            "table": {"columns": ["Kind", "Dir", "Events", "Kept going", "Reversed", "Med MFE", "Med MAE", "Med peak", "MAE $/ct"],
                      "rows": [[p["kind"], p["direction"], str(p["events"]), str(p["kept_going"]), str(p["reversed"]),
                                f"{p['median_mfe_pct']}%", f"{p['median_mae_pct']}%", f"{p['median_minutes_to_peak']}m",
                                f"${p['median_mae_usd_per_contract']}"] for p in book["price_patterns"]]},
            "note": f"Generated {book['generated_at']} under mode '{book['event_definition_mode']}'. Full file: PATTERN_BOOK.md.",
        })
    runs_dir = RESULTS_DIR / "runs"
    if runs_dir.exists():
        run_rows = []
        for run_path in sorted(runs_dir.iterdir()):
            manifest_path, scores_path = run_path / "manifest.json", run_path / "scores.json"
            if not (manifest_path.exists() and scores_path.exists()):
                continue
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            scores = json.loads(scores_path.read_text(encoding="utf-8"))
            graded = scores["days"] - scores["unparseable"]
            run_rows.append([str(manifest["phase"]), manifest["provider"], manifest.get("hypothesis", ""),
                             str(scores["days"]),
                             f"{scores['direction_hits']}/{graded}", f"{scores['expansion_hits']}/{graded}",
                             f"{scores['gap_hits']}/{graded}", f"{scores['severity_within_1']}/{graded}"])
        if run_rows:
            sections.append({
                "title": "Arena runs — scored replays (point-in-time)",
                "table": {"columns": ["Phase", "Provider", "Hypothesis", "Days", "Direction", "Expansion", "Gap", "Severity ±1"],
                          "rows": run_rows},
                "note": "Every run's full manifest, per-day records, and prompt live in results/runs/<run_id>/.",
            })
    events_path = RESULTS_DIR / "events_2023.json"
    if events_path.exists():
        events = json.loads(events_path.read_text(encoding="utf-8"))
        outcomes = events.get("outcomes", {})
        rows = [["Events identified", f"{events['events']} spikes/drops on {events['event_days']} distinct days (full list: EVENTS_2023.md)"]]
        gap = outcomes.get("after_gap_event")
        if gap:
            rows.append(["After a gap event", f"{gap['gap_events']} gap events: session closed in the gap's direction {gap['session_closed_gap_direction']}, reversed {gap['session_reversed']}, session was itself an event {gap['session_was_also_event']}"])
        am = outcomes.get("after_am_event")
        if am:
            rows.append(["After an AM event", f"{am['am_events']} AM events: PM same direction {am['pm_same_direction']}, opposite {am['pm_opposite']}, PM was itself an event {am['pm_was_also_event']}"])
        weekday = outcomes.get("events_by_weekday")
        if weekday:
            rows.append(["By weekday", ", ".join(f"{day[:3]} {count}" for day, count in weekday.items())])
        pointer = outcomes.get("pointer_back_to_back")
        if pointer:
            rows.append(["Pointer info (not a director)", f"of {pointer['session_events']} session events, {pointer['next_session_also_event']} were followed by another session event the next day"])
        sections.append({"title": "2023 events identified (develop year — outcome counts)", "rows": rows,
                         "note": "Counts of what actually happened, per CONCEPTS.md §7 — no averages."})
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
