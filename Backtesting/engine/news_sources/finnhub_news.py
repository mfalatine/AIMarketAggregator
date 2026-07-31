"""Finnhub news adapter — LIVE supplement (company + general market news) using
Mike's existing free key (access.json, never committed). History caps at ~1 year
on the free tier, so this is an unscheduled-NOW source, not a backtest source.
Timestamps are unix UTC → CST.
"""
import json
import urllib.parse
import urllib.request

import pandas as pd
from zoneinfo import ZoneInfo

from .base import NewsSource

CENTRAL = ZoneInfo("America/Chicago")


class FinnhubNewsSource(NewsSource):
    name = "finnhub_news"

    def fetch(self, start_cst: str, end_cst: str, symbol: str = "") -> pd.DataFrame:
        key = self.config.get("api_key", "")
        if not key:
            raise RuntimeError("finnhub_news: no api_key in data/news/access.json")
        if symbol:
            params = urllib.parse.urlencode({"symbol": symbol, "from": pd.Timestamp(start_cst).date(),
                                             "to": pd.Timestamp(end_cst).date(), "token": key})
            url = f"https://finnhub.io/api/v1/company-news?{params}"
        else:
            url = f"https://finnhub.io/api/v1/news?category=general&token={key}"
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "AMA-news-adapter"}), timeout=60) as response:
            items = json.loads(response.read().decode("utf-8", errors="replace"))
        rows = []
        for item in items:
            published = pd.Timestamp(int(item["datetime"]), unit="s", tz="UTC").tz_convert(CENTRAL).tz_localize(None)
            rows.append({"event_at_cst": published, "known_at_cst": published, "source": self.name,
                         "category": "headline", "headline": str(item.get("headline", ""))[:300],
                         "body": str(item.get("summary", ""))[:500], "tickers": str(item.get("related", "")),
                         "meta": json.dumps({"url": item.get("url", ""), "source_name": item.get("source", "")})})
        frame = pd.DataFrame(rows)
        if len(frame) and start_cst:
            frame = frame[frame["event_at_cst"] >= pd.Timestamp(start_cst)]
        return frame.reset_index(drop=True)
