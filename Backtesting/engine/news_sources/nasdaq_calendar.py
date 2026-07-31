"""Nasdaq economic calendar adapter — reads the LOCAL pulled archive (never the
network): data/news/nasdaq_calendar_raw/*.json, later the compacted parquet.

Timestamp handling (docs/CONCEPTS.md two-timestamp contract):
  - Displayed times carry a verified constant offset: NFP shows 09:30 where the true
    release is 07:30 CST, natural gas storage shows 11:30 vs true 09:30 CST — so
    event CST = displayed - 2h (TIME_OFFSET_HOURS). Recalibrated during validation.
  - macro_release rows: known_at = event_at (actual becomes knowable at release).
  - macro_estimate rows (consensus/previous only, NO actual): known_at = event_at
    minus ESTIMATE_LEAD_DAYS. ASSUMPTION (documented, pending refinement): Nasdaq
    does not say when consensus was published; 7 days is conservative for replays.
"""
import json
import re
from datetime import timedelta
from pathlib import Path

import pandas as pd

from .base import NewsSource

RAW_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "news" / "nasdaq_calendar_raw"
TIME_OFFSET_HOURS = -2
ESTIMATE_LEAD_DAYS = 7


def _clean(value):
    value = str(value or "").replace("&nbsp;", "").strip()
    return value


class NasdaqCalendarSource(NewsSource):
    name = "nasdaq_calendar"

    def fetch(self, start_cst: str, end_cst: str, countries=("United States",)) -> pd.DataFrame:
        start, end = pd.Timestamp(start_cst), pd.Timestamp(end_cst) + pd.Timedelta(days=1)
        rows = []
        for path in sorted(RAW_DIR.glob("*.json")):
            event_date = pd.Timestamp(path.stem)
            if not (start - pd.Timedelta(days=1) <= event_date < end):
                continue
            payload = json.loads(path.read_text(encoding="utf-8"))
            for row in ((payload.get("response") or {}).get("data") or {}).get("rows") or []:
                if countries and row.get("country") not in countries:
                    continue
                time_match = re.match(r"(\d{1,2}):(\d{2})", str(row.get("gmt", "")))
                if not time_match:
                    continue
                event_at = event_date + pd.Timedelta(hours=int(time_match.group(1)) + TIME_OFFSET_HOURS,
                                                     minutes=int(time_match.group(2)))
                actual, consensus, previous = _clean(row.get("actual")), _clean(row.get("consensus")), _clean(row.get("previous"))
                base = {"event_at_cst": event_at, "source": self.name, "body": _clean(row.get("description"))[:500],
                        "tickers": "", "headline": f"{row.get('eventName', '')} ({row.get('country', '')})"}
                if consensus or previous:
                    rows.append({**base, "known_at_cst": event_at - timedelta(days=ESTIMATE_LEAD_DAYS),
                                 "category": "macro_estimate",
                                 "meta": json.dumps({"consensus": consensus, "previous": previous})})
                rows.append({**base, "known_at_cst": event_at, "category": "macro_release",
                             "meta": json.dumps({"actual": actual, "consensus": consensus, "previous": previous})})
        return pd.DataFrame(rows)
