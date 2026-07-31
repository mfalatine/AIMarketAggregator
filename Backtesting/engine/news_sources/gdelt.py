"""GDELT DOC API adapter — historical + live headline discovery.

Honest limits (Sol review / DESIGN.md §3.5): discovery timestamps (~30% exact
publisher times), titles+URLs not bodies, duplicates expected — finds CANDIDATE
explanations, does not prove them. The API rate-limits bursts hard, so this adapter
enforces >=6s spacing and one 30s backoff on HTTP 429. Bulk 15-minute files (no
rate limit) remain the road for full-range pulls; this adapter serves targeted
event-day queries. seendate is UTC → converted to CST; event_at == known_at.
"""
import json
import time
import urllib.parse
import urllib.request

import pandas as pd
from zoneinfo import ZoneInfo

from .base import NewsSource

DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
CENTRAL = ZoneInfo("America/Chicago")
_last_call = [0.0]


class GdeltSource(NewsSource):
    name = "gdelt"

    def fetch(self, start_cst: str, end_cst: str, query: str = '"stock market"', sites=None) -> pd.DataFrame:
        site_filter = ""
        if sites:
            site_filter = " (" + " OR ".join(f"domain:{site}" for site in sites) + ")"
        start = pd.Timestamp(start_cst).tz_localize(CENTRAL).tz_convert("UTC").strftime("%Y%m%d%H%M%S")
        end = pd.Timestamp(end_cst).tz_localize(CENTRAL).tz_convert("UTC").strftime("%Y%m%d%H%M%S")
        params = urllib.parse.urlencode({"query": query + site_filter, "mode": "artlist", "format": "json",
                                         "startdatetime": start, "enddatetime": end,
                                         "maxrecords": int(self.config.get("maxrecords", 75)), "sort": "datedesc"})
        wait = 6.0 - (time.time() - _last_call[0])
        if wait > 0:
            time.sleep(wait)
        url = f"{DOC_URL}?{params}"
        request = urllib.request.Request(url, headers={"User-Agent": "AMA-news-adapter"})
        for attempt in (1, 2):
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    payload = json.loads(response.read().decode("utf-8", errors="replace"))
                break
            except urllib.error.HTTPError as error:
                if error.code == 429 and attempt == 1:
                    time.sleep(30)
                    continue
                raise
        _last_call[0] = time.time()
        rows = []
        for article in payload.get("articles", []):
            seen = pd.Timestamp(article.get("seendate", "")).tz_convert(CENTRAL).tz_localize(None)
            rows.append({"event_at_cst": seen, "known_at_cst": seen, "source": self.name, "category": "headline",
                         "headline": str(article.get("title", ""))[:300], "body": "", "tickers": "",
                         "meta": json.dumps({"url": article.get("url", ""), "domain": article.get("domain", "")})})
        return pd.DataFrame(rows)
