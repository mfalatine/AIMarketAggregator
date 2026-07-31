"""ForexFactory official weekly feed adapter (nfs.faireconomy.media) — LIVE ONLY.

Forward-looking week: forecast/previous/impact, NO actuals (partial feed by design —
DESIGN.md §3.5). Rows are macro_estimate snapshots whose known_at is the fetch
moment (that is when this process learned them); event_at converts the feed's
UTC-offset timestamps to CST wall time.
"""
import json
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

import pandas as pd

from .base import NewsSource

FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
CENTRAL = ZoneInfo("America/Chicago")


class FFWeeklySource(NewsSource):
    name = "ff_weekly"

    def fetch(self, start_cst: str = "", end_cst: str = "") -> pd.DataFrame:
        request = urllib.request.Request(FEED_URL, headers={"User-Agent": "AMA-news-adapter"})
        with urllib.request.urlopen(request, timeout=60) as response:
            events = json.loads(response.read().decode("utf-8"))
        fetched_at = pd.Timestamp(datetime.now(CENTRAL).replace(tzinfo=None))
        rows = []
        for event in events:
            event_at = pd.Timestamp(event["date"]).tz_convert(CENTRAL).tz_localize(None)
            rows.append({
                "event_at_cst": event_at, "known_at_cst": fetched_at, "source": self.name,
                "category": "macro_estimate",
                "headline": f"{event.get('title', '')} ({event.get('country', '')}, {event.get('impact', '')})",
                "body": "", "tickers": "",
                "meta": json.dumps({"forecast": event.get("forecast", ""), "previous": event.get("previous", ""),
                                    "impact": event.get("impact", "")}),
            })
        return pd.DataFrame(rows)
