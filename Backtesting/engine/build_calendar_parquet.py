"""Compact the raw Nasdaq calendar archive into THE working parquet.

Raw per-day JSON (data/news/nasdaq_calendar_raw/) stays untouched as the archive
layer; this build writes data/news/nasdaq_calendar_2021_2025.parquet — one row per
release line with event datetime CST (display offset corrected), country, event,
actual, consensus, previous. The engine reads ONLY the parquet.

Safe to run on a partial archive (prints coverage); rerun after every pull session.
Run: python Backtesting/engine/build_calendar_parquet.py
"""
import json
import re
from pathlib import Path

import pandas as pd

from news_sources.nasdaq_calendar import RAW_DIR, display_to_cst, _clean

OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "news" / "nasdaq_calendar_2021_2025.parquet"


def build() -> pd.DataFrame:
    rows = []
    for path in sorted(RAW_DIR.glob("*.json")):
        event_date = pd.Timestamp(path.stem)
        payload = json.loads(path.read_text(encoding="utf-8"))
        for row in ((payload.get("response") or {}).get("data") or {}).get("rows") or []:
            time_match = re.match(r"(\d{1,2}):(\d{2})", str(row.get("gmt", "")))
            if not time_match:
                continue
            rows.append({
                "event_at_cst": display_to_cst(event_date, int(time_match.group(1)), int(time_match.group(2))),
                "country": row.get("country", ""),
                "event": _clean(row.get("eventName")),
                "actual": _clean(row.get("actual")),
                "consensus": _clean(row.get("consensus")),
                "previous": _clean(row.get("previous")),
                "description": _clean(row.get("description"))[:300],
            })
    return pd.DataFrame(rows).sort_values("event_at_cst").reset_index(drop=True)


def main() -> None:
    frame = build()
    frame.to_parquet(OUT_PATH, index=False)
    days = frame["event_at_cst"].dt.date.nunique()
    print(f"{len(frame):,} release rows across {days} days -> {OUT_PATH.name} "
          f"({frame['event_at_cst'].min().date()} .. {frame['event_at_cst'].max().date()})")
    us = frame[frame["country"] == "United States"]
    print(f"US rows: {len(us):,}; with consensus: {(us['consensus'] != '').sum():,}; with actual: {(us['actual'] != '').sum():,}")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    main()
