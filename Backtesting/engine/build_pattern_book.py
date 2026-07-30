"""Pattern book — the distilled, fixed-format artifact the prompt builder and the
dashboard read. Price-side patterns fill now; news tiers fill once explanations exist.

Shape (results/pattern_book.json):
  price_patterns: per (kind, direction): event count, how many kept going
                  (counts, not averages — CONCEPTS.md section 7), median MFE/MAE %,
                  median minutes to peak, median MAE $ per micro contract
  news_tiers:     empty until the explanation table is labeled (source decision pending)

Run: python build_pattern_book.py [--year 2023]
"""
import argparse
import json
from datetime import datetime
from pathlib import Path

import pandas as pd

RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"
SYMBOLS = ("MES", "MNQ")


def build(year: int) -> dict:
    frames = [pd.read_parquet(RESULTS_DIR / "moves" / f"{symbol.lower()}_moves.parquet") for symbol in SYMBOLS]
    moves = pd.concat(frames, ignore_index=True)
    events = moves[(moves["year"] == year) & moves["event"] & moves["mfe_pct"].notna()]
    patterns = []
    for (kind, direction), group in events.groupby(["kind", "direction"]):
        kept_going = int((group["fwd_ret_pct"] > 0).sum())
        patterns.append({
            "kind": kind, "direction": direction, "events": len(group),
            "kept_going": kept_going, "reversed": len(group) - kept_going,
            "median_mfe_pct": round(group["mfe_pct"].median(), 2),
            "median_mae_pct": round(group["mae_pct"].median(), 2),
            "median_minutes_to_peak": round(group["time_to_peak_min"].median()),
            "median_mae_usd_per_contract": round(group["mae_usd"].median()),
        })
    explanations = RESULTS_DIR / f"explanations_{year}.parquet"
    return {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M CST"),
        "year": year,
        "event_definition_mode": json.loads((Path(__file__).resolve().parent / "detection_config.json").read_text(encoding="utf-8"))["event_definition"]["mode"],
        "price_patterns": sorted(patterns, key=lambda p: (p["kind"], p["direction"])),
        "news_tiers": {"status": "pending — no labeled explanation table yet"
                                 if not explanations.exists() else "explanations exist; labeling pass not yet run"},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2023)
    args = parser.parse_args()
    book = build(args.year)
    out = RESULTS_DIR / "pattern_book.json"
    out.write_text(json.dumps(book, indent=2) + "\n", encoding="utf-8")
    lines = [f"# Pattern book — {args.year} (generated {book['generated_at']})\n",
             f"Event definition mode: {book['event_definition_mode']}. Counts, not averages.\n",
             "| Kind | Direction | Events | Kept going | Reversed | Med MFE | Med MAE | Med peak | Med MAE $/ct |",
             "|---|---|---|---|---|---|---|---|---|"]
    for p in book["price_patterns"]:
        lines.append(f"| {p['kind']} | {p['direction']} | {p['events']} | {p['kept_going']} | {p['reversed']} "
                     f"| {p['median_mfe_pct']}% | {p['median_mae_pct']}% | {p['median_minutes_to_peak']}m | ${p['median_mae_usd_per_contract']} |")
    lines.append(f"\nNews tiers: {book['news_tiers']['status']}")
    (RESULTS_DIR / "PATTERN_BOOK.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"pattern book: {len(book['price_patterns'])} price patterns -> pattern_book.json / PATTERN_BOOK.md")


if __name__ == "__main__":
    main()
