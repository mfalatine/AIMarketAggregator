"""Alpha Vantage NEWS_SENTIMENT adapter — historical + live headlines with
sentiment, using Mike's existing free key (access.json, never committed).

Budget: 25 requests/day on the free tier, up to 1,000 results per request — bulk
history is pulled SLOWLY (a few wide-window calls per day), never in bursts.
ASSUMPTION (documented, pending calibration): time_published treated as UTC.
"""
import json
import urllib.parse
import urllib.request

import pandas as pd
from zoneinfo import ZoneInfo

from .base import NewsSource

CENTRAL = ZoneInfo("America/Chicago")


class AlphaVantageSource(NewsSource):
    name = "alpha_vantage"

    def fetch(self, start_cst: str, end_cst: str, tickers: str = "", topics: str = "") -> pd.DataFrame:
        key = self.config.get("api_key", "")
        if not key:
            raise RuntimeError("alpha_vantage: no api_key in data/news/access.json")
        start = pd.Timestamp(start_cst).tz_localize(CENTRAL).tz_convert("UTC").strftime("%Y%m%dT%H%M")
        end = pd.Timestamp(end_cst).tz_localize(CENTRAL).tz_convert("UTC").strftime("%Y%m%dT%H%M")
        params = {"function": "NEWS_SENTIMENT", "time_from": start, "time_to": end,
                  "limit": int(self.config.get("limit", 1000)), "sort": "EARLIEST", "apikey": key}
        if tickers:
            params["tickers"] = tickers
        if topics:
            params["topics"] = topics
        url = "https://www.alphavantage.co/query?" + urllib.parse.urlencode(params)
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "AMA-news-adapter"}), timeout=90) as response:
            payload = json.loads(response.read().decode("utf-8", errors="replace"))
        if "feed" not in payload:
            raise RuntimeError(f"alpha_vantage: unexpected response: {str(payload)[:200]}")
        rows = []
        for item in payload["feed"]:
            published = pd.Timestamp(item["time_published"]).tz_localize("UTC").tz_convert(CENTRAL).tz_localize(None)
            ticker_list = ",".join(t.get("ticker", "") for t in item.get("ticker_sentiment", []))
            rows.append({"event_at_cst": published, "known_at_cst": published, "source": self.name,
                         "category": "headline", "headline": str(item.get("title", ""))[:300],
                         "body": str(item.get("summary", ""))[:500], "tickers": ticker_list,
                         "meta": json.dumps({"url": item.get("url", ""), "source_name": item.get("source", ""),
                                             "sentiment": item.get("overall_sentiment_score", None)})})
        return pd.DataFrame(rows)
