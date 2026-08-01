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

from .base import NEWS_COLUMNS, NewsSource

DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
CENTRAL = ZoneInfo("America/Chicago")
_last_call = [0.0]


class GdeltSource(NewsSource):
    name = "gdelt"

    def fetch(self, start_cst: str, end_cst: str, query: str = '"stock market"', sites=None) -> pd.DataFrame:
        site_filter = ""
        if sites:
            # GDELT only allows parentheses around OR'd lists of 2+ items.
            joined = " OR ".join(f"domain:{site}" for site in sites)
            site_filter = f" ({joined})" if len(sites) > 1 else f" {joined}"
        start = pd.Timestamp(start_cst).tz_localize(CENTRAL).tz_convert("UTC").strftime("%Y%m%d%H%M%S")
        end = pd.Timestamp(end_cst).tz_localize(CENTRAL).tz_convert("UTC").strftime("%Y%m%d%H%M%S")
        params = urllib.parse.urlencode({"query": query + site_filter, "mode": "artlist", "format": "json",
                                         "startdatetime": start, "enddatetime": end,
                                         "maxrecords": int(self.config.get("maxrecords", 75)), "sort": "datedesc"})
        pace = float(self.config.get("pace_seconds", 6.0))
        wait = pace - (time.time() - _last_call[0])
        if wait > 0:
            time.sleep(wait)
        url = f"{DOC_URL}?{params}"
        request = urllib.request.Request(url, headers={"User-Agent": "AMA-news-adapter"})
        payload = None
        for attempt in (1, 2):
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    body = response.read().decode("utf-8", errors="replace")
                try:
                    payload = json.loads(body)
                except json.JSONDecodeError:
                    # GDELT can answer HTTP 200 with a plain-text throttle page.
                    raise urllib.error.HTTPError(url, 429, f"non-JSON body: {body[:80]}", None, None)
                break
            except urllib.error.HTTPError as error:
                if error.code == 429 and attempt == 1:
                    time.sleep(60)
                    continue
                _last_call[0] = time.time()
                raise
        _last_call[0] = time.time()
        rows = []
        for article in payload.get("articles", []):
            seen = pd.Timestamp(article.get("seendate", "")).tz_convert(CENTRAL).tz_localize(None)
            rows.append({"event_at_cst": seen, "known_at_cst": seen, "source": self.name, "category": "headline",
                         "headline": str(article.get("title", ""))[:300], "body": "", "tickers": "",
                         "meta": json.dumps({"url": article.get("url", ""), "domain": article.get("domain", "")})})
        return pd.DataFrame(rows, columns=NEWS_COLUMNS)

    def fetch_bulk_day(self, day_cst: str, sites: list) -> pd.DataFrame:
        """The no-search-limit door: download the day's 15-minute export files and
        keep rows whose source URL is on one of our sites. These files carry URLs,
        not titles — the headline is derived from the URL slug (readable enough for
        candidate discovery; Alpha Vantage supplies real titles). Timestamps are the
        file's UTC discovery time -> CST."""
        import io
        import urllib.error
        import zipfile
        day = pd.Timestamp(day_cst)
        start_utc = day.tz_localize(CENTRAL).tz_convert("UTC")
        seen_urls = set()
        rows = []
        for slot in range(96):
            stamp = (start_utc + pd.Timedelta(minutes=15 * (slot + 1))).strftime("%Y%m%d%H%M%S")
            url = f"http://data.gdeltproject.org/gdeltv2/{stamp}.export.CSV.zip"
            try:
                request = urllib.request.Request(url, headers={"User-Agent": "AMA-news-adapter"})
                with urllib.request.urlopen(request, timeout=60) as response:
                    raw = response.read()
                archive = zipfile.ZipFile(io.BytesIO(raw))
                lines = archive.read(archive.namelist()[0]).decode("utf-8", errors="replace").splitlines()
            except (urllib.error.HTTPError, urllib.error.URLError, zipfile.BadZipFile):
                continue  # missing slot files happen; skip
            slot_cst = pd.Timestamp(stamp).tz_localize("UTC").tz_convert(CENTRAL).tz_localize(None)
            for line in lines:
                source_url = line.rsplit("\t", 1)[-1].strip()
                domain = source_url.split("/")[2].replace("www.", "") if source_url.count("/") >= 2 else ""
                if domain not in sites or source_url in seen_urls:
                    continue
                seen_urls.add(source_url)
                slug = source_url.rstrip("/").rsplit("/", 1)[-1].split("?")[0]
                pseudo_headline = slug.replace("-", " ").replace("_", " ")[:200]
                rows.append({"event_at_cst": slot_cst, "known_at_cst": slot_cst, "source": self.name,
                             "category": "headline", "headline": pseudo_headline, "body": "", "tickers": "",
                             "meta": json.dumps({"url": source_url, "domain": domain, "via": "bulk"})})
            time.sleep(0.2)
        return pd.DataFrame(rows, columns=NEWS_COLUMNS)
