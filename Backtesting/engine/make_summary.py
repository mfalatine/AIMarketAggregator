"""Regenerate results/summary.json and results/SUMMARY.md for the Backtest tab and chat.

Run from anywhere:  python Backtesting/engine/make_summary.py
Every engine stage should extend the sections it writes here; the tab renders whatever
sections exist, so this file is the one contract between engine and dashboard.
"""
import json
from datetime import datetime
from pathlib import Path

from load_prices import FILES, aggregate, load_minutes, rth_only

RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"


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
                    ["2023 (develop)", "Not started — awaiting Stage 1 move detector"],
                    ["2024 (tweak)", "Locked until 2023 produces candidates"],
                    ["2025 (final test)", "SEALED — one frozen run, no peeking"],
                ],
                "note": "Protocol: mine patterns on 2023, tune on 2024, single final run on 2025. See docs/DESIGN.md.",
            },
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
        if section.get("note"):
            lines.append(f"\n_{section['note']}_")
    (RESULTS_DIR / "SUMMARY.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {RESULTS_DIR / 'summary.json'} and SUMMARY.md ({generated})")


if __name__ == "__main__":
    main()
